from datetime import datetime, timedelta
from decimal import Decimal
import logging

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from .models import (
    AlertaTopeEnviada,
    Cita,
    ConfiguracionGlobal,
    EPS,
    Especialidad,
    ExcepcionMedico,
    Feriado,
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

    @staticmethod
    def _periodo_para_fecha(tope, fecha):
        """Devuelve (inicio, fin) del período (semanal/mensual) que contiene `fecha`."""
        if tope.tipo_periodo == 'SEMANAL':
            inicio_periodo = fecha - timedelta(days=fecha.weekday())
            fin_periodo = inicio_periodo + timedelta(days=7)
        else:
            inicio_periodo = fecha.replace(day=1)
            if fecha.month == 12:
                fin_periodo = fecha.replace(year=fecha.year + 1, month=1, day=1)
            else:
                fin_periodo = fecha.replace(month=fecha.month + 1, day=1)
        return inicio_periodo, fin_periodo

    @classmethod
    def validate_payload(cls, attrs, lock=False, exclude_cita_id=None):
        """Valida las reglas de negocio de una cita.

        exclude_cita_id: al reprogramar una cita existente, se excluye su propio
        id de todas las búsquedas de conflicto para que no choque consigo misma.
        """
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

        def _excluir_propia(queryset):
            if exclude_cita_id:
                return queryset.exclude(pk=exclude_cita_id)
            return queryset

        today = timezone.localdate()
        if fecha and fecha < today:
            add_error('fecha', 'La fecha de la cita no puede estar en el pasado.')

        if fecha and Feriado.objects.filter(fecha=fecha).exists():
            add_error('fecha', 'La fecha seleccionada es un feriado institucional.')

        config_global = ConfiguracionGlobal.get_solo()
        if fecha and (fecha - today).days > config_global.anticipacion_maxima_dias:
            add_error(
                'fecha',
                f'No se pueden agendar citas con más de {config_global.anticipacion_maxima_dias} '
                f'días de anticipación.',
            )

        if hora_inicio and hora_fin:
            if hora_inicio < config_global.horario_apertura or hora_fin > config_global.horario_cierre:
                add_error(
                    'hora_inicio',
                    f'La institución solo atiende entre las {config_global.horario_apertura} '
                    f'y las {config_global.horario_cierre}.',
                )

            if hora_inicio >= hora_fin:
                add_error('hora_inicio', 'La hora de inicio debe ser menor que la hora de fin.')
            else:
                duracion_minutos = int(
                    (
                        datetime.combine(fecha or today, hora_fin)
                        - datetime.combine(fecha or today, hora_inicio)
                    ).total_seconds() / 60
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

            if fecha:
                inicio_cita_dt = timezone.make_aware(datetime.combine(fecha, hora_inicio))
                minimo_requerido = timezone.now() + timedelta(hours=config_global.anticipacion_minima_horas)
                if inicio_cita_dt < minimo_requerido:
                    add_error(
                        'hora_inicio',
                        f'La cita debe agendarse con al menos {config_global.anticipacion_minima_horas} '
                        f'hora(s) de anticipación.',
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
                citas_hora = _excluir_propia(
                    Cita.objects.filter(
                        medico=medico,
                        fecha=fecha,
                        hora_inicio=hora_inicio,
                    ).exclude(estado='CANCELADA')
                )
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

            citas_medico = _excluir_propia(
                Cita.objects.filter(medico=medico, fecha=fecha).exclude(estado='CANCELADA')
            )
            if lock:
                citas_medico = citas_medico.select_for_update()
            if citas_medico.filter(hora_inicio__lt=hora_fin, hora_fin__gt=hora_inicio).exists():
                add_error('medico', 'El médico ya tiene una cita agendada en el horario seleccionado.')

            if paciente:
                citas_paciente = _excluir_propia(
                    Cita.objects.filter(paciente=paciente, fecha=fecha).exclude(estado='CANCELADA')
                )
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
            citas_especialidad = _excluir_propia(
                Cita.objects.filter(especialidad=especialidad, fecha=fecha).exclude(estado='CANCELADA')
            )
            if lock:
                citas_especialidad = citas_especialidad.select_for_update()
            if citas_especialidad.count() >= especialidad.capacidad_diaria:
                add_error('especialidad', 'La especialidad ya alcanzó su capacidad diaria.')

        if paciente and especialidad and fecha:
            fecha_minima = fecha - timedelta(days=especialidad.dias_entre_citas)
            fecha_maxima = fecha + timedelta(days=especialidad.dias_entre_citas)

            citas_paciente_especialidad = _excluir_propia(
                Cita.objects.filter(
                    paciente=paciente,
                    especialidad=especialidad,
                    fecha__gt=fecha_minima,
                    fecha__lt=fecha_maxima,
                ).exclude(estado='CANCELADA')
            )

            if lock:
                citas_paciente_especialidad = citas_paciente_especialidad.select_for_update()

            if citas_paciente_especialidad.exists():
                add_error(
                    'paciente',
                    f'Solo puede agendar una cita de {especialidad.nombre} cada '
                    f'{especialidad.dias_entre_citas} días.',
                )

        if eps and fecha:
            tope = TopeEPS.objects.filter(eps=eps).first()
            if tope:
                inicio_periodo, fin_periodo = cls._periodo_para_fecha(tope, fecha)

                citas_eps = _excluir_propia(
                    Cita.objects.filter(
                        eps=eps,
                        fecha__gte=inicio_periodo,
                        fecha__lt=fin_periodo,
                    ).exclude(estado='CANCELADA')
                )
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
    def verificar_alerta_tope_eps(cls, eps_id, fecha):
        """
        HU-022: si el uso del tope de una EPS llega al 80% o más en su período
        actual, envía un correo de alerta al/los superadministrador(es).

        Se llama después de confirmar la persistencia de una cita (no durante
        la validación en sí) y es idempotente por período gracias al
        UniqueConstraint de AlertaTopeEnviada.
        """
        try:
            eps = EPS.objects.get(pk=eps_id)
        except EPS.DoesNotExist:
            return

        tope = TopeEPS.objects.filter(eps=eps).first()
        if not tope:
            return

        inicio_periodo, fin_periodo = cls._periodo_para_fecha(tope, fecha)
        citas_periodo = Cita.objects.filter(
            eps=eps, fecha__gte=inicio_periodo, fecha__lt=fin_periodo,
        ).exclude(estado='CANCELADA').count()

        if tope.limite_citas <= 0:
            return

        porcentaje_uso = Decimal(citas_periodo) / Decimal(tope.limite_citas)
        if porcentaje_uso < Decimal('0.8'):
            return

        _, creada = AlertaTopeEnviada.objects.get_or_create(
            eps=eps,
            periodo_inicio=inicio_periodo,
            defaults={
                'periodo_fin': fin_periodo,
                'porcentaje_uso': (porcentaje_uso * 100).quantize(Decimal('0.01')),
            },
        )
        if not creada:
            return  # ya se avisó en este período, no reenviar

        destinatarios = cls._emails_superadmin()
        if not destinatarios:
            return

        asunto = f'SaludAgendaX - Alerta: tope de {eps.nombre} al {int(porcentaje_uso * 100)}%'
        mensaje = (
            f"La EPS {eps.nombre} alcanzó el {int(porcentaje_uso * 100)}% de su tope de citas "
            f"({citas_periodo}/{tope.limite_citas}) para el período "
            f"{inicio_periodo.isoformat()} - {fin_periodo.isoformat()}.\n\n"
            f"Revisa la configuración de topes en el panel administrativo."
        )
        try:
            send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL, destinatarios)
        except Exception:
            logging.getLogger(__name__).exception('No se pudo enviar la alerta de tope EPS para %s', eps.nombre)

    @staticmethod
    def _emails_superadmin():
        emails = list(
            User.objects.filter(is_superuser=True).exclude(email='').values_list('email', flat=True)
        )
        emails += list(
            User.objects.filter(groups__name='superadministrador')
            .exclude(email='')
            .values_list('email', flat=True)
        )
        emails = list(dict.fromkeys(emails))
        if not emails:
            emails = list(getattr(settings, 'ALERTA_TOPES_EMAILS', []))
        return emails

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
            transaction.on_commit(lambda: cls.verificar_alerta_tope_eps(attrs['eps'].pk, attrs['fecha']))
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

    @classmethod
    def enqueue_cancelacion_notification(cls, cita_id):
        cita = Cita.objects.select_related('paciente__usuario', 'medico__usuario').get(pk=cita_id)
        NotificacionPendiente.objects.create(
            tipo='cancelacion_cita',
            cita=cita,
            payload={
                'email_paciente': cita.paciente.usuario.email,
                'medico_id': cita.medico_id,
                'fecha': cita.fecha.isoformat() if cita.fecha else None,
                'hora_inicio': cita.hora_inicio.isoformat() if cita.hora_inicio else None,
                'motivo': cita.motivo,
            },
        )

    @classmethod
    def enqueue_reprogramacion_notification(cls, cita_id, fecha_anterior, hora_inicio_anterior):
        cita = Cita.objects.select_related('paciente__usuario', 'medico__usuario').get(pk=cita_id)
        NotificacionPendiente.objects.create(
            tipo='reprogramacion_cita',
            cita=cita,
            payload={
                'email_paciente': cita.paciente.usuario.email,
                'medico_id': cita.medico_id,
                'fecha_anterior': fecha_anterior.isoformat() if fecha_anterior else None,
                'hora_inicio_anterior': hora_inicio_anterior.isoformat() if hora_inicio_anterior else None,
                'fecha_nueva': cita.fecha.isoformat() if cita.fecha else None,
                'hora_inicio_nueva': cita.hora_inicio.isoformat() if cita.hora_inicio else None,
            },
        )

    @classmethod
    def reprogramar_cita(cls, cita, nueva_fecha, nueva_hora_inicio, nueva_hora_fin):
        """Reprograma una cita existente validando disponibilidad de la nueva franja.

        HU-013: valida contra las mismas reglas de negocio que la creación de citas,
        excluyendo la propia cita de los chequeos de conflicto (de lo contrario
        chocaría consigo misma).
        """
        if cita.estado == 'CANCELADA':
            raise serializers.ValidationError(
                {'estado': ['No se puede reprogramar una cita cancelada.']}
            )

        with transaction.atomic():
            cita_bloqueada = Cita.objects.select_for_update().get(pk=cita.pk)

            attrs = {
                'paciente': cita_bloqueada.paciente,
                'medico': cita_bloqueada.medico,
                'especialidad': cita_bloqueada.especialidad,
                'eps': cita_bloqueada.eps,
                'fecha': nueva_fecha,
                'hora_inicio': nueva_hora_inicio,
                'hora_fin': nueva_hora_fin,
            }

            errors, alerts = cls.validate_payload(attrs, lock=True, exclude_cita_id=cita_bloqueada.pk)
            if errors:
                raise serializers.ValidationError(errors)

            fecha_anterior = cita_bloqueada.fecha
            hora_inicio_anterior = cita_bloqueada.hora_inicio

            nueva_fecha_hora = timezone.make_aware(datetime.combine(nueva_fecha, nueva_hora_inicio))
            cita_bloqueada.fecha = nueva_fecha
            cita_bloqueada.hora_inicio = nueva_hora_inicio
            cita_bloqueada.hora_fin = nueva_hora_fin
            cita_bloqueada.fecha_hora = nueva_fecha_hora
            cita_bloqueada.recordatorio_enviado = False
            cita_bloqueada.save(update_fields=[
                'fecha', 'hora_inicio', 'hora_fin', 'fecha_hora', 'recordatorio_enviado', 'actualizado_en'
            ])

            transaction.on_commit(
                lambda: cls.enqueue_reprogramacion_notification(
                    cita_bloqueada.id, fecha_anterior, hora_inicio_anterior
                )
            )
            transaction.on_commit(
                lambda: cls.verificar_alerta_tope_eps(cita_bloqueada.eps_id, cita_bloqueada.fecha)
            )

            return cita_bloqueada, alerts
        


    @classmethod
    def buscar_citas(cls, queryset, filtros):
        """
        Aplica filtros dinámicos sobre un queryset de citas.

        Filtros soportados:
        - fecha
        - medico
        - paciente
        - especialidad
        - eps
        - estado
        """

        fecha = filtros.get("fecha")
        medico = filtros.get("medico")
        paciente = filtros.get("paciente")
        especialidad = filtros.get("especialidad")
        eps = filtros.get("eps")
        estado = filtros.get("estado")

        if fecha:
            queryset = queryset.filter(fecha=fecha)

        if medico:
            queryset = queryset.filter(medico_id=medico)

        if paciente:
            queryset = queryset.filter(paciente_id=paciente)

        if especialidad:
            queryset = queryset.filter(especialidad_id=especialidad)

        if eps:
            queryset = queryset.filter(eps_id=eps)

        if estado:
            queryset = queryset.filter(estado=estado)

        return queryset
        
    
