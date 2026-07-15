from datetime import datetime, timedelta
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    Cita,
    EPS,
    Especialidad,
    ExcepcionMedico,
    HorarioMedico,
    Medico,
    NotificacionPendiente,
    Paciente,
    TopeEPS,
)


class CitaService:
    """Encapsula reglas de negocio de agendamiento."""

    MIN_DURACION_MINUTOS = 15
    MAX_DURACION_MINUTOS = 120
    MAX_CANCELACIONES_30_DIAS = 3

    @classmethod
    def validate_payload(cls, attrs, lock=False):
        errors = {}
        alerts = []

        paciente = attrs.get('paciente')
        medico = attrs.get('medico')
        especialidad = attrs.get('especialidad')
        eps = attrs.get('eps')
        fecha = attrs.get('fecha')
        hora_inicio = attrs.get('hora_inicio')
        hora_fin = attrs.get('hora_fin')

        def add_error(field, message):
            errors.setdefault(field, []).append(message)

        today = timezone.localdate()
        if fecha and fecha < today:
            add_error('fecha', 'La fecha de la cita no puede estar en el pasado.')

        if hora_inicio and hora_fin:
            if hora_inicio >= hora_fin:
                add_error('hora_inicio', 'La hora de inicio debe ser menor que la hora de fin.')
            else:
                duracion_minutos = int(
                    (datetime.combine(fecha or today, hora_fin) - datetime.combine(fecha or today, hora_inicio)).total_seconds()
                    / 60
                )
                if duracion_minutos < cls.MIN_DURACION_MINUTOS:
                    add_error(
                        'hora_fin',
                        f'La duración mínima de la cita es de {cls.MIN_DURACION_MINUTOS} minutos.',
                    )
                if duracion_minutos > cls.MAX_DURACION_MINUTOS:
                    add_error(
                        'hora_fin',
                        f'La duración máxima de la cita es de {cls.MAX_DURACION_MINUTOS} minutos.',
                    )

        if paciente and not paciente.usuario.is_active:
            add_error('paciente', 'El paciente existe pero no está activo.')

        if medico and (not medico.activo or not medico.usuario.is_active):
            add_error('medico', 'El médico existe pero no está activo.')

        if especialidad and not especialidad.activo:
            add_error('especialidad', 'La especialidad existe pero está inactiva.')

        if paciente:
            if not paciente.eps or not paciente.eps.activo:
                add_error('eps', 'El paciente no tiene una EPS activa registrada.')
            elif eps and paciente.eps_id != eps.id:
                add_error('eps', 'La EPS indicada no coincide con la EPS registrada del paciente.')

        if medico and especialidad and not medico.especialidades.filter(pk=especialidad.pk).exists():
            add_error('especialidad', 'El médico no tiene asignada la especialidad seleccionada.')

        if fecha and hora_inicio and hora_fin and medico:
            horarios = HorarioMedico.objects.filter(
                medico=medico,
                dia_semana=fecha.weekday(),
                activo=True,
                hora_inicio__lte=hora_inicio,
                hora_fin__gte=hora_fin,
            )
            if not horarios.exists():
                add_error('medico', 'El médico no está disponible en el horario seleccionado.')
            else:
                max_citas_por_hora = max(horarios.values_list('max_citas_por_hora', flat=True))
                citas_hora = Cita.objects.filter(
                    medico=medico,
                    fecha=fecha,
                    hora_inicio__hour=hora_inicio.hour,
                ).exclude(estado='CANCELADA')
                if lock:
                    citas_hora = citas_hora.select_for_update()
                if citas_hora.count() >= max_citas_por_hora:
                    add_error('medico', 'El médico alcanzó el máximo de citas permitidas para esta hora.')

            excepciones = ExcepcionMedico.objects.filter(
                medico=medico,
                fecha=fecha,
                activo=True,
            )
            if excepciones.filter(hora_inicio__isnull=True, hora_fin__isnull=True).exists():
                add_error('medico', 'El médico tiene una excepción de disponibilidad para esta fecha.')
            elif excepciones.filter(hora_inicio__lt=hora_fin, hora_fin__gt=hora_inicio).exists():
                add_error('medico', 'El médico tiene una excepción de disponibilidad para este horario.')

            citas_medico = Cita.objects.filter(medico=medico, fecha=fecha).exclude(estado='CANCELADA')
            if lock:
                citas_medico = citas_medico.select_for_update()
            if citas_medico.filter(hora_inicio__lt=hora_fin, hora_fin__gt=hora_inicio).exists():
                add_error('medico', 'El médico ya tiene una cita agendada en el horario seleccionado.')

            if paciente:
                citas_paciente = Cita.objects.filter(paciente=paciente, fecha=fecha).exclude(estado='CANCELADA')
                if lock:
                    citas_paciente = citas_paciente.select_for_update()
                if citas_paciente.filter(hora_inicio__lt=hora_fin, hora_fin__gt=hora_inicio).exists():
                    add_error('paciente', 'El paciente ya tiene una cita agendada en este horario.')

                ventana_cancelacion = today - timedelta(days=30)
                canceladas = Cita.objects.filter(
                    paciente=paciente,
                    estado='CANCELADA',
                    fecha__gte=ventana_cancelacion,
                ).count()
                if canceladas >= cls.MAX_CANCELACIONES_30_DIAS:
                    add_error(
                        'paciente',
                        'El paciente superó el máximo de cancelaciones permitido en los últimos 30 días.',
                    )

        if especialidad and fecha:
            citas_especialidad = Cita.objects.filter(
                especialidad=especialidad,
                fecha=fecha,
            ).exclude(estado='CANCELADA')
            if lock:
                citas_especialidad = citas_especialidad.select_for_update()
            if citas_especialidad.count() >= especialidad.capacidad_diaria:
                add_error('especialidad', 'La especialidad ya alcanzó su capacidad diaria.')

        
        if paciente and especialidad and fecha:
            fecha_minima = fecha - timedelta(days=especialidad.dias_entre_citas)
            fecha_maxima = fecha + timedelta(days=especialidad.dias_entre_citas)

            citas_paciente_especialidad = Cita.objects.filter(
                paciente=paciente,
                especialidad=especialidad,
                fecha__gt=fecha_minima,
                fecha__lt=fecha_maxima,
            ).exclude(estado='CANCELADA')

            if lock:
                citas_paciente_especialidad = citas_paciente_especialidad.select_for_update()

            if citas_paciente_especialidad.exists():
                add_error(
                    'paciente',
                    f'Solo puede agendar una cita de {especialidad.nombre} cada '
                    f'{especialidad.dias_entre_citas} días.'
                )


        if eps and fecha:
            tope = TopeEPS.objects.filter(eps=eps).first()
            if tope:
                if tope.tipo_periodo == 'SEMANAL':
                    inicio_periodo = fecha - timedelta(days=fecha.weekday())
                    fin_periodo = inicio_periodo + timedelta(days=7)
                else:
                    inicio_periodo = fecha.replace(day=1)
                    if fecha.month == 12:
                        fin_periodo = fecha.replace(year=fecha.year + 1, month=1, day=1)
                    else:
                        fin_periodo = fecha.replace(month=fecha.month + 1, day=1)

                citas_eps = Cita.objects.filter(
                    eps=eps,
                    fecha__gte=inicio_periodo,
                    fecha__lt=fin_periodo,
                ).exclude(estado='CANCELADA')
                if lock:
                    citas_eps = citas_eps.select_for_update()
                citas_eps_count = citas_eps.count()
                if citas_eps_count >= tope.limite_citas:
                    add_error('eps', 'La EPS ha alcanzado el tope de citas para este período.')
                else:
                    porcentaje_uso = Decimal(citas_eps_count + 1) / Decimal(tope.limite_citas)
                    if porcentaje_uso >= Decimal('0.8'):
                        alerts.append('La EPS está próxima a agotar su tope de citas.')

                if tope.presupuesto_maximo is not None and Decimal(citas_eps_count + 1) > tope.presupuesto_maximo:
                    add_error('eps', 'El presupuesto asignado a la EPS está agotado.')

        return errors, alerts

    @classmethod
    def create_cita(cls, attrs):
        with transaction.atomic():
            Paciente.objects.select_for_update().get(pk=attrs['paciente'].pk)
            Medico.objects.select_for_update().get(pk=attrs['medico'].pk)
            Especialidad.objects.select_for_update().get(pk=attrs['especialidad'].pk)
            EPS.objects.select_for_update().get(pk=attrs['eps'].pk)

            errors, alerts = cls.validate_payload(attrs, lock=True)
            if errors:
                raise serializers.ValidationError(errors)

            fecha_hora = timezone.make_aware(datetime.combine(attrs['fecha'], attrs['hora_inicio']))
            cita = Cita.objects.create(
                paciente=attrs['paciente'],
                medico=attrs['medico'],
                especialidad=attrs['especialidad'],
                eps=attrs['eps'],
                fecha=attrs['fecha'],
                hora_inicio=attrs['hora_inicio'],
                hora_fin=attrs['hora_fin'],
                fecha_hora=fecha_hora,
                motivo=attrs.get('motivo', ''),
                tipo_cita=attrs.get('tipo_cita', 'consulta_general'),
                estado='CONFIRMADA',
            )

            transaction.on_commit(lambda: cls.enqueue_confirmation_notification(cita.id))
            return cita, alerts

    @classmethod
    def enqueue_confirmation_notification(cls, cita_id):
        cita = Cita.objects.select_related('paciente__usuario', 'medico__usuario').get(pk=cita_id)
        NotificacionPendiente.objects.create(
            tipo='confirmacion_cita',
            cita=cita,
            payload={
                'email_paciente': cita.paciente.usuario.email,
                'medico_id': cita.medico_id,
                'fecha': cita.fecha.isoformat() if cita.fecha else None,
                'hora_inicio': cita.hora_inicio.isoformat() if cita.hora_inicio else None,
            },
        )
        Cita.objects.filter(pk=cita_id).update(notificacion_encolada=True)
