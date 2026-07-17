"""
HU-007: Casos borde del agendamiento completo de citas.

Complementa a CitasEndpointTests (test_citas_endpoint.py), que ya cubre:
horario médico, solapamiento médico, tope EPS, frecuencia por especialidad,
feriados, horario institucional y anticipación mínima.

Aquí se cubren los límites exactos y combinaciones no probadas todavía:
fechas/duraciones en el borde, entidades inactivas, cupos exactos,
excepciones de disponibilidad, solapamiento por paciente, capacidad diaria
de especialidad, máximo de cancelaciones y presupuesto de EPS.
"""
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import User
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Cita,
    ConfiguracionGlobal,
    EPS,
    Especialidad,
    ExcepcionMedico,
    HorarioMedico,
    Medico,
    Paciente,
    TopeEPS,
)


class AgendamientoBaseTestCase(APITestCase):
    """Fixtures comunes a todas las clases de casos borde de HU-007."""

    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS Borde', codigo='EPSB01', activo=True)
        self.paciente_user = User.objects.create_user(
            username='pacienteBorde@saludagendax.com',
            email='pacienteBorde@saludagendax.com',
            password='Password123!',
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user,
            tipo_documento='CC',
            num_documento='100100100',
            fecha_nacimiento='1990-01-01',
            eps=self.eps,
            direccion='Calle Borde 1',
        )
        self.medico_user = User.objects.create_user(
            username='medicoBorde@saludagendax.com',
            email='medicoBorde@saludagendax.com',
            password='Password123!',
            first_name='Boris',
            last_name='Ordelio',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-B01', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Medicina Interna',
            descripcion='Casos borde',
            activo=True,
            capacidad_diaria=20,
            dias_entre_citas=15,
        )
        self.medico.especialidades.add(self.especialidad)

        self.fecha_base = timezone.localdate() + timedelta(days=5)
        HorarioMedico.objects.create(
            medico=self.medico,
            dia_semana=self.fecha_base.weekday(),
            hora_inicio='08:00:00',
            hora_fin='18:00:00',
            max_citas_por_hora=4,
            activo=True,
        )

        self.url = reverse('cita-list')
        self.client.force_authenticate(user=self.paciente_user)

    def _payload(self, **overrides):
        base = {
            'paciente': self.paciente.id,
            'medico': self.medico.id,
            'especialidad': self.especialidad.id,
            'fecha': self.fecha_base.isoformat(),
            'hora_inicio': '09:00:00',
            'hora_fin': '09:30:00',
            'eps': self.eps.id,
            'motivo_consulta': 'Chequeo de rutina',
            'tipo_cita': 'consulta_general',
        }
        base.update(overrides)
        return base

    def _crear_cita_directa(self, fecha=None, hora_inicio='09:00:00', hora_fin='09:30:00',
                             estado='CONFIRMADA', paciente=None, medico=None, especialidad=None):
        from datetime import datetime
        fecha_obj = fecha or self.fecha_base
        return Cita.objects.create(
            paciente=paciente or self.paciente,
            medico=medico or self.medico,
            especialidad=especialidad or self.especialidad,
            eps=self.eps,
            fecha=fecha_obj,
            hora_inicio=hora_inicio,
            hora_fin=hora_fin,
            fecha_hora=timezone.make_aware(datetime.strptime(f'{fecha_obj} {hora_inicio}', '%Y-%m-%d %H:%M:%S')),
            estado=estado,
            tipo_cita='consulta_general',
            motivo='Control',
        )


class AgendamientoFechaHoraBordeTests(AgendamientoBaseTestCase):
    """Límites exactos de fecha, anticipación y duración."""

    def test_rechaza_fecha_en_el_pasado(self):
        ayer = timezone.localdate() - timedelta(days=1)
        response = self.client.post(self.url, self._payload(fecha=ayer.isoformat()), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('fecha', response.data['errors'])

    def test_rechaza_fecha_que_excede_anticipacion_maxima(self):
        ConfiguracionGlobal.objects.update_or_create(pk=1, defaults={'anticipacion_maxima_dias': 10})
        fecha_excedida = timezone.localdate() + timedelta(days=11)
        HorarioMedico.objects.get_or_create(
            medico=self.medico, dia_semana=fecha_excedida.weekday(),
            defaults={'hora_inicio': '08:00:00', 'hora_fin': '18:00:00', 'max_citas_por_hora': 4, 'activo': True},
        )
        response = self.client.post(
            self.url, self._payload(fecha=fecha_excedida.isoformat()), format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('fecha', response.data['errors'])

    def test_acepta_duracion_minima_exacta_15_minutos(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url,
                self._payload(hora_inicio='09:00:00', hora_fin='09:15:00'),
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rechaza_duracion_menor_a_15_minutos(self):
        response = self.client.post(
            self.url,
            self._payload(hora_inicio='09:00:00', hora_fin='09:14:00'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('hora_fin', response.data['errors'])

    def test_acepta_duracion_maxima_exacta_120_minutos(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(
                self.url,
                self._payload(hora_inicio='09:00:00', hora_fin='11:00:00'),
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rechaza_duracion_mayor_a_120_minutos(self):
        response = self.client.post(
            self.url,
            self._payload(hora_inicio='09:00:00', hora_fin='11:01:00'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('hora_fin', response.data['errors'])

    def test_rechaza_hora_inicio_igual_a_hora_fin(self):
        response = self.client.post(
            self.url,
            self._payload(hora_inicio='09:00:00', hora_fin='09:00:00'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('hora_inicio', response.data['errors'])


class AgendamientoEntidadesInactivasBordeTests(AgendamientoBaseTestCase):
    """Rechazo por médico, especialidad, paciente o EPS inactivos / no coincidentes."""

    def test_rechaza_medico_inactivo(self):
        self.medico.activo = False
        self.medico.save(update_fields=['activo'])

        response = self.client.post(self.url, self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('medico', response.data['errors'])

    def test_rechaza_especialidad_inactiva(self):
        self.especialidad.activo = False
        self.especialidad.save(update_fields=['activo'])

        response = self.client.post(self.url, self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('especialidad', response.data['errors'])

    def test_rechaza_si_eps_del_paciente_esta_inactiva(self):
        self.eps.activo = False
        self.eps.save(update_fields=['activo'])

        response = self.client.post(self.url, self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('eps', response.data['errors'])

    def test_rechaza_si_eps_del_payload_no_coincide_con_la_registrada(self):
        otra_eps = EPS.objects.create(nombre='Otra EPS', codigo='EPSB02', activo=True)

        response = self.client.post(self.url, self._payload(eps=otra_eps.id), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('eps', response.data['errors'])

    def test_rechaza_medico_sin_la_especialidad_asignada(self):
        otra_especialidad = Especialidad.objects.create(
            nombre='Neumologia', descripcion='Pulmones', activo=True, capacidad_diaria=20,
        )

        response = self.client.post(
            self.url, self._payload(especialidad=otra_especialidad.id), format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('especialidad', response.data['errors'])


class AgendamientoCupoYExcepcionesBordeTests(AgendamientoBaseTestCase):
    """Cupo por hora en el límite exacto, excepciones de disponibilidad, solapamiento por paciente."""

    def setUp(self):
        super().setUp()
        HorarioMedico.objects.filter(medico=self.medico, dia_semana=self.fecha_base.weekday()).update(
            max_citas_por_hora=1
        )

    def test_rechaza_al_superar_cupo_maximo_de_la_hora_sin_solapar_horario(self):
        # Franjas contiguas (no se solapan en tiempo), pero comparten la misma hora reloj (9).
        self._crear_cita_directa(hora_inicio='09:00:00', hora_fin='09:15:00')

        response = self.client.post(
            self.url,
            self._payload(hora_inicio='09:15:00', hora_fin='09:30:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('medico', response.data['errors'])

    def test_rechaza_por_excepcion_medico_dia_completo(self):
        ExcepcionMedico.objects.create(
            medico=self.medico, fecha=self.fecha_base,
            hora_inicio=None, hora_fin=None, activo=True,
        )

        response = self.client.post(self.url, self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('medico', response.data['errors'])

    def test_rechaza_por_excepcion_medico_horario_parcial(self):
        ExcepcionMedico.objects.create(
            medico=self.medico, fecha=self.fecha_base,
            hora_inicio='08:00:00', hora_fin='10:00:00', activo=True,
        )

        response = self.client.post(
            self.url, self._payload(hora_inicio='09:00:00', hora_fin='09:30:00'), format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('medico', response.data['errors'])

    def test_rechaza_solapamiento_del_paciente_con_otro_medico(self):
        otro_medico_user = User.objects.create_user(
            username='medicoBorde2@saludagendax.com', email='medicoBorde2@saludagendax.com',
            password='Password123!', first_name='Otro', last_name='Medico',
        )
        otro_medico = Medico.objects.create(usuario=otro_medico_user, registro_medico='RM-B02', activo=True)
        otro_medico.especialidades.add(self.especialidad)
        HorarioMedico.objects.create(
            medico=otro_medico, dia_semana=self.fecha_base.weekday(),
            hora_inicio='08:00:00', hora_fin='18:00:00', max_citas_por_hora=4, activo=True,
        )
        # El paciente ya tiene una cita con self.medico a las 09:00-09:30.
        self._crear_cita_directa(hora_inicio='09:00:00', hora_fin='09:30:00')

        response = self.client.post(
            self.url,
            self._payload(medico=otro_medico.id, hora_inicio='09:15:00', hora_fin='09:45:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('paciente', response.data['errors'])


class AgendamientoTopesBordeTests(AgendamientoBaseTestCase):
    """Límites exactos de capacidad diaria de especialidad, cancelaciones y presupuesto EPS."""

    def test_rechaza_al_alcanzar_capacidad_diaria_de_especialidad(self):
        self.especialidad.capacidad_diaria = 1
        self.especialidad.save(update_fields=['capacidad_diaria'])
        self._crear_cita_directa(hora_inicio='09:00:00', hora_fin='09:30:00')

        response = self.client.post(
            self.url,
            self._payload(hora_inicio='11:00:00', hora_fin='11:30:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('especialidad', response.data['errors'])

    def test_rechaza_al_alcanzar_exactamente_3_cancelaciones_en_30_dias(self):
        for i in range(3):
            self._crear_cita_directa(
                fecha=self.fecha_base - timedelta(days=i + 1),
                hora_inicio='09:00:00', hora_fin='09:30:00',
                estado='CANCELADA',
            )

        response = self.client.post(self.url, self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('paciente', response.data['errors'])

    def test_permite_agendar_con_solo_2_cancelaciones_en_30_dias(self):
        for i in range(2):
            self._crear_cita_directa(
                fecha=self.fecha_base - timedelta(days=i + 1),
                hora_inicio='09:00:00', hora_fin='09:30:00',
                estado='CANCELADA',
            )

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.url, self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_rechaza_por_presupuesto_maximo_de_eps_agotado(self):
        TopeEPS.objects.create(
            eps=self.eps, limite_citas=999, tipo_periodo='MENSUAL',
            presupuesto_maximo=Decimal('1'),
        )
        self._crear_cita_directa(hora_inicio='09:00:00', hora_fin='09:30:00')

        response = self.client.post(
            self.url,
            self._payload(hora_inicio='11:00:00', hora_fin='11:30:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('eps', response.data['errors'])


class ReprogramacionBordeTests(AgendamientoBaseTestCase):
    """Casos borde específicos de reprogramar_cita (HU-013), relevantes para el flujo de HU-007."""

    def test_no_permite_reprogramar_una_cita_ya_cancelada(self):
        cita = self._crear_cita_directa(hora_inicio='09:00:00', hora_fin='09:30:00', estado='CANCELADA')
        url = reverse('reprogramar_cita', args=[cita.id])
        nueva_fecha = self.fecha_base + timedelta(days=1)
        HorarioMedico.objects.get_or_create(
            medico=self.medico, dia_semana=nueva_fecha.weekday(),
            defaults={'hora_inicio': '08:00:00', 'hora_fin': '18:00:00', 'max_citas_por_hora': 4, 'activo': True},
        )

        response = self.client.patch(
            url,
            {'fecha': nueva_fecha.isoformat(), 'hora_inicio': '10:00:00', 'hora_fin': '10:30:00'},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
