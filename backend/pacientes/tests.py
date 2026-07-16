from django.contrib.auth.models import Group, User
from datetime import datetime, timedelta
from django.utils import timezone
from django.urls import reverse
from django.core import mail
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    AlertaTopeEnviada,
    Cita,
    ConfiguracionGlobal,
    EPS,
    Especialidad,
    Feriado,
    HorarioMedico,
    Medico,
    NotificacionPendiente,
    Paciente,
    Sede,
    TopeEPS,
)
from .notificaciones import enviar_notificaciones_pendientes


class EspecialidadEndpointTests(APITestCase):
    def setUp(self):

        Group.objects.get_or_create(name='administrativo')
        Group.objects.get_or_create(name='superadministrador')

        self.admin_user = User.objects.create_user(
            username='admin@saludagendax.com',
            email='admin@saludagendax.com',
            password='Password123!',
            is_staff=True,
        )
        self.normal_user = User.objects.create_user(
            username='paciente@saludagendax.com',
            email='paciente@saludagendax.com',
            password='Password123!',
        )
        self.medico_user = User.objects.create_user(
            username='medico@saludagendax.com',
            email='medico@saludagendax.com',
            password='Password123!',
            first_name='Ana',
            last_name='Lopez',
        )
        self.medico = Medico.objects.create(
            usuario=self.medico_user,
            registro_medico='RM-001',
            activo=True,
        )

    def test_public_list_returns_only_active_specialties(self):
        Especialidad.objects.create(nombre='Cardiologia', descripcion='Corazon', activo=True)
        Especialidad.objects.create(nombre='Dermatologia', descripcion='Piel', activo=False)

        response = self.client.get(reverse('especialidad-list'))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['nombre'], 'Cardiologia')

    def test_non_admin_cannot_create_specialty(self):
        self.client.force_authenticate(user=self.normal_user)

        response = self.client.post(
            reverse('especialidad-list'),
            {'nombre': 'Pediatria', 'descripcion': 'Ninos', 'activo': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_create_specialty_and_assign_doctor(self):
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse('especialidad-list'),
            {
                'nombre': 'Neurologia',
                'descripcion': 'Sistema nervioso',
                'activo': True,
                'medico_ids': [self.medico.id],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        especialidad = Especialidad.objects.get(nombre='Neurologia')
        self.assertEqual(especialidad.medicos.count(), 1)
        self.assertEqual(especialidad.medicos.first().id, self.medico.id)

    def test_duplicate_name_is_rejected_case_insensitive(self):
        Especialidad.objects.create(nombre='Cardiologia', descripcion='Corazon', activo=True)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.post(
            reverse('especialidad-list'),
            {'nombre': 'cardiologia', 'descripcion': 'Corazon 2', 'activo': True},
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('nombre', response.data)

    def test_delete_performs_soft_deactivation(self):
        especialidad = Especialidad.objects.create(nombre='Urologia', descripcion='Urinario', activo=True)
        self.client.force_authenticate(user=self.admin_user)

        response = self.client.delete(reverse('especialidad-detail', args=[especialidad.id]))

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        especialidad.refresh_from_db()
        self.assertFalse(especialidad.activo)


class CitasEndpointTests(APITestCase):
    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS Salud', codigo='EPS001', activo=True)
        self.admin_user = User.objects.create_user(
            username='admin2@saludagendax.com',
            email='admin2@saludagendax.com',
            password='Password123!',
            is_staff=True,
        )
        self.paciente_user = User.objects.create_user(
            username='paciente2@saludagendax.com',
            email='paciente2@saludagendax.com',
            password='Password123!',
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user,
            tipo_documento='CC',
            num_documento='123456789',
            fecha_nacimiento='1995-01-01',
            eps=self.eps,
            direccion='Calle 1',
        )

        self.medico_user = User.objects.create_user(
            username='medico2@saludagendax.com',
            email='medico2@saludagendax.com',
            password='Password123!',
            first_name='Carlos',
            last_name='Perez',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-002', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Medicina General',
            descripcion='Atencion general',
            activo=True,
            capacidad_diaria=20,
        )
        self.medico.especialidades.add(self.especialidad)

        self.fecha_base = timezone.localdate() + timedelta(days=3)
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
            'motivo_consulta': 'Dolor de cabeza',
            'tipo_cita': 'consulta_general',
        }
        base.update(overrides)
        return base

    def _crear_cita(self, hora_inicio='09:00:00', hora_fin='09:30:00', fecha=None):
        fecha_obj = fecha or self.fecha_base
        return Cita.objects.create(
            paciente=self.paciente,
            medico=self.medico,
            especialidad=self.especialidad,
            eps=self.eps,
            fecha=fecha_obj,
            hora_inicio=hora_inicio,
            hora_fin=hora_fin,
            fecha_hora=timezone.make_aware(datetime.strptime(f'{fecha_obj} {hora_inicio}', '%Y-%m-%d %H:%M:%S')),
            estado='CONFIRMADA',
            tipo_cita='consulta_general',
            motivo='Control',
        )

    def test_rechaza_cita_fuera_de_horario_medico(self):
        response = self.client.post(
            self.url,
            self._payload(hora_inicio='19:00:00', hora_fin='19:30:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('medico', response.data['errors'])

    def test_rechaza_cita_con_solapamiento_medico(self):
        self._crear_cita(hora_inicio='09:00:00', hora_fin='09:30:00')

        response = self.client.post(
            self.url,
            self._payload(hora_inicio='09:15:00', hora_fin='09:45:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('medico', response.data['errors'])

    def test_rechaza_cita_por_tope_eps(self):
        TopeEPS.objects.create(eps=self.eps, limite_citas=1, tipo_periodo='MENSUAL')
        self._crear_cita(hora_inicio='10:00:00', hora_fin='10:30:00')

        response = self.client.post(
            self.url,
            self._payload(hora_inicio='11:00:00', hora_fin='11:30:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('eps', response.data['errors'])

    def test_rechaza_cita_por_frecuencia_paciente(self):
        for i in range(4):
            fecha = self.fecha_base + timedelta(days=i + 1)
            HorarioMedico.objects.get_or_create(
                medico=self.medico,
                dia_semana=fecha.weekday(),
                defaults={
                    'hora_inicio': '08:00:00',
                    'hora_fin': '18:00:00',
                    'max_citas_por_hora': 4,
                    'activo': True,
                },
            )
            self._crear_cita(hora_inicio='10:00:00', hora_fin='10:30:00', fecha=fecha)

        fecha_intento = self.fecha_base + timedelta(days=5)
        HorarioMedico.objects.get_or_create(
            medico=self.medico,
            dia_semana=fecha_intento.weekday(),
            defaults={
                'hora_inicio': '08:00:00',
                'hora_fin': '18:00:00',
                'max_citas_por_hora': 4,
                'activo': True,
            },
        )
        response = self.client.post(
            self.url,
            self._payload(fecha=fecha_intento.isoformat(), hora_inicio='14:00:00', hora_fin='14:30:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('paciente', response.data['errors'])

    def test_crea_cita_exitosa_y_encola_notificacion(self):
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.url, self._payload(), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['data']['estado'], 'CONFIRMADA')
        self.assertEqual(NotificacionPendiente.objects.count(), 1)

        cita = Cita.objects.get(pk=response.data['data']['id'])
        self.assertTrue(cita.notificacion_encolada)

    def test_estructura_errores_estandarizada(self):
        response = self.client.post(
            self.url,
            self._payload(hora_inicio='10:00:00', hora_fin='09:00:00'),
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['code'], 400)
        self.assertIn('errors', response.data)


class CitaCreacionAdministrativaTests(APITestCase):
    """HU-009: el administrativo puede elegir el paciente; sin bypass de reglas."""

    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS Salud', codigo='EPS002', activo=True)
        self.admin_user = User.objects.create_user(
            username='admin3@saludagendax.com', email='admin3@saludagendax.com',
            password='Password123!', is_staff=True,
        )

        self.paciente_user_a = User.objects.create_user(
            username='pacienteA@saludagendax.com', email='pacienteA@saludagendax.com',
            password='Password123!',
        )
        self.paciente_a = Paciente.objects.create(
            usuario=self.paciente_user_a, tipo_documento='CC', num_documento='111111111',
            fecha_nacimiento='1990-01-01', eps=self.eps, direccion='Calle 1',
        )

        self.paciente_user_b = User.objects.create_user(
            username='pacienteB@saludagendax.com', email='pacienteB@saludagendax.com',
            password='Password123!',
        )
        self.paciente_b = Paciente.objects.create(
            usuario=self.paciente_user_b, tipo_documento='CC', num_documento='222222222',
            fecha_nacimiento='1992-01-01', eps=self.eps, direccion='Calle 2',
        )

        self.medico_user = User.objects.create_user(
            username='medico3@saludagendax.com', email='medico3@saludagendax.com',
            password='Password123!', first_name='Ana', last_name='Ruiz',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-003', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Pediatria', descripcion='Atencion infantil', activo=True, capacidad_diaria=20,
        )
        self.medico.especialidades.add(self.especialidad)

        self.fecha = timezone.localdate() + timedelta(days=3)
        HorarioMedico.objects.create(
            medico=self.medico, dia_semana=self.fecha.weekday(),
            hora_inicio='08:00:00', hora_fin='18:00:00', max_citas_por_hora=4, activo=True,
        )
        self.url = reverse('cita-list')

    def _payload(self, paciente_id, **overrides):
        base = {
            'paciente': paciente_id,
            'medico': self.medico.id,
            'especialidad': self.especialidad.id,
            'fecha': self.fecha.isoformat(),
            'hora_inicio': '09:00:00',
            'hora_fin': '09:30:00',
            'eps': self.eps.id,
            'motivo_consulta': 'Control',
            'tipo_cita': 'consulta_general',
        }
        base.update(overrides)
        return base

    def test_admin_puede_crear_cita_para_cualquier_paciente(self):
        self.client.force_authenticate(user=self.admin_user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.url, self._payload(self.paciente_b.id), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        cita = Cita.objects.get(pk=response.data['data']['id'])
        self.assertEqual(cita.paciente_id, self.paciente_b.id)

    def test_paciente_no_puede_agendar_a_nombre_de_otro(self):
        """Un paciente autenticado que intenta enviar el id de otro paciente
        termina agendando para sí mismo (no para el paciente indicado)."""
        self.client.force_authenticate(user=self.paciente_user_a)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.url, self._payload(self.paciente_b.id), format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        cita = Cita.objects.get(pk=response.data['data']['id'])
        self.assertEqual(cita.paciente_id, self.paciente_a.id)

    def test_paciente_sigue_sujeto_a_todas_las_validaciones(self):
        """El paciente normal, agendando para sí mismo, sigue respetando reglas
        (ej. no puede agendar fuera del horario del médico)."""
        self.client.force_authenticate(user=self.paciente_user_a)
        response = self.client.post(
            self.url, self._payload(self.paciente_a.id, hora_inicio='20:00:00', hora_fin='20:30:00'),
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('medico', response.data['errors'])


class ReprogramarCitaTests(APITestCase):
    """HU-013: reprogramación de citas."""

    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS Salud', codigo='EPS003', activo=True)
        self.paciente_user = User.objects.create_user(
            username='pacienteR@saludagendax.com', email='pacienteR@saludagendax.com',
            password='Password123!',
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user, tipo_documento='CC', num_documento='333333333',
            fecha_nacimiento='1990-01-01', eps=self.eps, direccion='Calle 3',
        )
        self.otro_paciente_user = User.objects.create_user(
            username='pacienteR2@saludagendax.com', email='pacienteR2@saludagendax.com',
            password='Password123!',
        )
        Paciente.objects.create(
            usuario=self.otro_paciente_user, tipo_documento='CC', num_documento='444444444',
            fecha_nacimiento='1991-01-01', eps=self.eps, direccion='Calle 4',
        )

        self.medico_user = User.objects.create_user(
            username='medicoR@saludagendax.com', email='medicoR@saludagendax.com',
            password='Password123!', first_name='Luis', last_name='Gomez',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-004', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Dermatologia', descripcion='Piel', activo=True, capacidad_diaria=20,
        )
        self.medico.especialidades.add(self.especialidad)

        self.fecha = timezone.localdate() + timedelta(days=3)
        self.fecha_nueva = timezone.localdate() + timedelta(days=4)
        for fecha in (self.fecha, self.fecha_nueva):
            HorarioMedico.objects.get_or_create(
                medico=self.medico, dia_semana=fecha.weekday(),
                defaults={'hora_inicio': '08:00:00', 'hora_fin': '18:00:00', 'max_citas_por_hora': 4, 'activo': True},
            )

        self.cita = Cita.objects.create(
            paciente=self.paciente, medico=self.medico, especialidad=self.especialidad, eps=self.eps,
            fecha=self.fecha, hora_inicio='09:00:00', hora_fin='09:30:00',
            fecha_hora=timezone.make_aware(datetime.strptime(f'{self.fecha} 09:00:00', '%Y-%m-%d %H:%M:%S')),
            estado='CONFIRMADA', tipo_cita='consulta_general', motivo='Control',
        )
        self.url = reverse('reprogramar_cita', args=[self.cita.id])

    def test_paciente_propietario_puede_reprogramar(self):
        self.client.force_authenticate(user=self.paciente_user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url,
                {'fecha': self.fecha_nueva.isoformat(), 'hora_inicio': '10:00:00', 'hora_fin': '10:30:00'},
                format='json',
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cita.refresh_from_db()
        self.assertEqual(self.cita.fecha, self.fecha_nueva)
        self.assertEqual(str(self.cita.hora_inicio), '10:00:00')
        self.assertTrue(
            NotificacionPendiente.objects.filter(cita=self.cita, tipo='reprogramacion_cita').exists()
        )

    def test_otro_paciente_no_puede_reprogramar(self):
        self.client.force_authenticate(user=self.otro_paciente_user)
        response = self.client.patch(
            self.url,
            {'fecha': self.fecha_nueva.isoformat(), 'hora_inicio': '10:00:00', 'hora_fin': '10:30:00'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_reprogramar_mismo_horario_no_choca_consigo_misma(self):
        """Reprogramar 'a lo mismo' no debe fallar por conflicto contra sí misma."""
        self.client.force_authenticate(user=self.paciente_user)
        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.patch(
                self.url,
                {'fecha': self.fecha.isoformat(), 'hora_inicio': '09:00:00', 'hora_fin': '09:30:00'},
                format='json',
            )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_no_se_puede_reprogramar_fuera_de_horario(self):
        self.client.force_authenticate(user=self.paciente_user)
        response = self.client.patch(
            self.url,
            {'fecha': self.fecha_nueva.isoformat(), 'hora_inicio': '22:00:00', 'hora_fin': '22:30:00'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('medico', response.data['errors'])


class CalendarioCitasTests(APITestCase):
    """HU-011: endpoint de calendario con vistas diaria/semanal/mensual."""

    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS Salud', codigo='EPS004', activo=True)
        self.admin_user = User.objects.create_user(
            username='admin4@saludagendax.com', email='admin4@saludagendax.com',
            password='Password123!', is_staff=True,
        )
        self.paciente_user = User.objects.create_user(
            username='pacienteC@saludagendax.com', email='pacienteC@saludagendax.com',
            password='Password123!',
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user, tipo_documento='CC', num_documento='555555555',
            fecha_nacimiento='1990-01-01', eps=self.eps, direccion='Calle 5',
        )
        self.medico_user = User.objects.create_user(
            username='medicoC@saludagendax.com', email='medicoC@saludagendax.com',
            password='Password123!', first_name='Marta', last_name='Diaz',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-005', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Cardiologia', descripcion='Corazon', activo=True, capacidad_diaria=20,
        )
        self.medico.especialidades.add(self.especialidad)

        self.fecha = timezone.localdate() + timedelta(days=3)
        self.cita = Cita.objects.create(
            paciente=self.paciente, medico=self.medico, especialidad=self.especialidad, eps=self.eps,
            fecha=self.fecha, hora_inicio='09:00:00', hora_fin='09:30:00',
            fecha_hora=timezone.make_aware(datetime.strptime(f'{self.fecha} 09:00:00', '%Y-%m-%d %H:%M:%S')),
            estado='CONFIRMADA', tipo_cita='consulta_general', motivo='Control',
        )
        self.url = reverse('calendario_citas')

    def test_admin_ve_vista_diaria(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url, {'vista': 'diaria', 'fecha': self.fecha.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_citas'], 1)
        self.assertIn(self.fecha.isoformat(), response.data['dias'])

    def test_paciente_solo_ve_sus_propias_citas(self):
        otro_paciente_user = User.objects.create_user(
            username='pacienteD@saludagendax.com', email='pacienteD@saludagendax.com',
            password='Password123!',
        )
        Paciente.objects.create(
            usuario=otro_paciente_user, tipo_documento='CC', num_documento='666666666',
            fecha_nacimiento='1990-01-01', eps=self.eps, direccion='Calle 6',
        )
        self.client.force_authenticate(user=otro_paciente_user)
        response = self.client.get(self.url, {'vista': 'diaria', 'fecha': self.fecha.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_citas'], 0)

    def test_vista_semanal_incluye_rango_de_7_dias(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url, {'vista': 'semanal', 'fecha': self.fecha.isoformat()})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inicio = datetime.strptime(response.data['fecha_inicio'], '%Y-%m-%d').date()
        fin = datetime.strptime(response.data['fecha_fin'], '%Y-%m-%d').date()
        self.assertEqual((fin - inicio).days, 6)
        self.assertGreaterEqual(response.data['total_citas'], 1)

    def test_filtro_por_medico_y_especialidad(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url, {
            'vista': 'diaria', 'fecha': self.fecha.isoformat(),
            'medico_id': self.medico.id, 'especialidad_id': self.especialidad.id,
        })
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_citas'], 1)


class NotificacionesEmailTests(APITestCase):
    """HU-016: envío real de los correos encolados."""

    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS Salud', codigo='EPS005', activo=True)
        self.paciente_user = User.objects.create_user(
            username='pacienteN@saludagendax.com', email='pacienteN@saludagendax.com',
            password='Password123!',
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user, tipo_documento='CC', num_documento='777777777',
            fecha_nacimiento='1990-01-01', eps=self.eps, direccion='Calle 7',
        )
        self.medico_user = User.objects.create_user(
            username='medicoN@saludagendax.com', email='medicoN@saludagendax.com',
            password='Password123!', first_name='Paula', last_name='Nino',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-006', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Oftalmologia', descripcion='Ojos', activo=True, capacidad_diaria=20,
        )
        self.fecha = timezone.localdate() + timedelta(days=1)
        self.cita = Cita.objects.create(
            paciente=self.paciente, medico=self.medico, especialidad=self.especialidad, eps=self.eps,
            fecha=self.fecha, hora_inicio='09:00:00', hora_fin='09:30:00',
            fecha_hora=timezone.make_aware(datetime.strptime(f'{self.fecha} 09:00:00', '%Y-%m-%d %H:%M:%S')),
            estado='CONFIRMADA', tipo_cita='consulta_general', motivo='Control',
        )

    def test_envia_correo_de_confirmacion_pendiente(self):
        NotificacionPendiente.objects.create(
            tipo='confirmacion_cita', cita=self.cita,
            payload={
                'email_paciente': self.paciente_user.email,
                'medico_id': self.medico.id,
                'fecha': self.fecha.isoformat(),
                'hora_inicio': '09:00:00',
            },
        )

        resumen = enviar_notificaciones_pendientes()

        self.assertEqual(resumen['enviadas'], 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.paciente_user.email])
        notificacion = NotificacionPendiente.objects.get(cita=self.cita)
        self.assertEqual(notificacion.estado, 'enviada')

    def test_no_reenvia_notificaciones_ya_enviadas(self):
        NotificacionPendiente.objects.create(
            tipo='confirmacion_cita', cita=self.cita, estado='enviada',
            payload={'email_paciente': self.paciente_user.email},
        )
        resumen = enviar_notificaciones_pendientes()
        self.assertEqual(resumen['procesadas'], 0)
        self.assertEqual(len(mail.outbox), 0)


class AlertaTopeEPSTests(APITestCase):
    """HU-022: alertas de tope EPS al superadministrador (por email)."""

    def setUp(self):
        self.superadmin_user = User.objects.create_user(
            username='super2@saludagendax.com', email='super2@saludagendax.com',
            password='Password123!', is_superuser=True, is_staff=True,
        )
        self.eps = EPS.objects.create(nombre='EPS Salud', codigo='EPS007', activo=True)
        TopeEPS.objects.create(eps=self.eps, limite_citas=5, tipo_periodo='MENSUAL')

        self.paciente_user = User.objects.create_user(
            username='pacienteT@saludagendax.com', email='pacienteT@saludagendax.com',
            password='Password123!',
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user, tipo_documento='CC', num_documento='999999999',
            fecha_nacimiento='1990-01-01', eps=self.eps, direccion='Calle 9',
        )
        self.medico_user = User.objects.create_user(
            username='medicoT@saludagendax.com', email='medicoT@saludagendax.com',
            password='Password123!', first_name='Sara', last_name='Vega',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-008', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Endocrinologia', descripcion='Hormonas', activo=True, capacidad_diaria=20,
        )
        self.medico.especialidades.add(self.especialidad)

        self.fecha_base = timezone.localdate() + timedelta(days=3)
        self.url = reverse('cita-list')

    def _crear_cita_directa(self, dias_offset, hora_inicio, hora_fin):
        fecha = self.fecha_base + timedelta(days=dias_offset)
        HorarioMedico.objects.get_or_create(
            medico=self.medico, dia_semana=fecha.weekday(),
            defaults={'hora_inicio': '08:00:00', 'hora_fin': '18:00:00', 'max_citas_por_hora': 4, 'activo': True},
        )
        return Cita.objects.create(
            paciente=self.paciente, medico=self.medico, especialidad=self.especialidad, eps=self.eps,
            fecha=fecha, hora_inicio=hora_inicio, hora_fin=hora_fin,
            fecha_hora=timezone.make_aware(datetime.strptime(f'{fecha} {hora_inicio}', '%Y-%m-%d %H:%M:%S')),
            estado='CONFIRMADA', tipo_cita='consulta_general', motivo='Control',
        )

    def test_envia_alerta_al_alcanzar_80_por_ciento(self):
        for i in range(3):
            self._crear_cita_directa(i + 1, '08:00:00', '08:30:00')

        self.client.force_authenticate(user=self.paciente_user)
        fecha_cuarta = self.fecha_base + timedelta(days=10)
        HorarioMedico.objects.get_or_create(
            medico=self.medico, dia_semana=fecha_cuarta.weekday(),
            defaults={'hora_inicio': '08:00:00', 'hora_fin': '18:00:00', 'max_citas_por_hora': 4, 'activo': True},
        )
        payload = {
            'paciente': self.paciente.id, 'medico': self.medico.id, 'especialidad': self.especialidad.id,
            'fecha': fecha_cuarta.isoformat(),
            'hora_inicio': '09:00:00', 'hora_fin': '09:30:00', 'eps': self.eps.id,
            'motivo_consulta': 'Control', 'tipo_cita': 'consulta_general',
        }

        with self.captureOnCommitCallbacks(execute=True):
            response = self.client.post(self.url, payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(AlertaTopeEnviada.objects.filter(eps=self.eps).exists())
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.eps.nombre, mail.outbox[0].subject)

    def test_no_duplica_alerta_en_el_mismo_periodo(self):
        for i in range(4):
            self._crear_cita_directa(i + 1, '08:00:00', '08:30:00')

        from .services import CitaService
        CitaService.verificar_alerta_tope_eps(self.eps.id, self.fecha_base)
        CitaService.verificar_alerta_tope_eps(self.eps.id, self.fecha_base)

        self.assertEqual(AlertaTopeEnviada.objects.filter(eps=self.eps).count(), 1)
        self.assertEqual(len(mail.outbox), 1)


class ConfiguracionGlobalTests(APITestCase):
    """HU-023: parámetros globales del sistema."""

    def setUp(self):
        self.superadmin_user = User.objects.create_user(
            username='super1@saludagendax.com', email='super1@saludagendax.com',
            password='Password123!', is_superuser=True, is_staff=True,
        )
        self.admin_user = User.objects.create_user(
            username='admin5@saludagendax.com', email='admin5@saludagendax.com',
            password='Password123!', is_staff=True,
        )
        self.url = reverse('configuracion-global')

    def test_admin_normal_puede_leer_pero_no_escribir(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.put(self.url, {'anticipacion_minima_horas': 5}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_puede_actualizar_configuracion(self):
        self.client.force_authenticate(user=self.superadmin_user)
        response = self.client.put(
            self.url,
            {'anticipacion_minima_horas': 5, 'anticipacion_maxima_dias': 30},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        config = ConfiguracionGlobal.get_solo()
        self.assertEqual(config.anticipacion_minima_horas, 5)
        self.assertEqual(config.anticipacion_maxima_dias, 30)

    def test_rechaza_horario_apertura_mayor_que_cierre(self):
        self.client.force_authenticate(user=self.superadmin_user)
        response = self.client.put(
            self.url,
            {'horario_apertura': '20:00:00', 'horario_cierre': '08:00:00'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class FeriadoYReglasGlobalesCitaTests(APITestCase):
    """HU-023: feriados y reglas institucionales aplicadas al agendar citas."""

    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS Salud', codigo='EPS006', activo=True)
        self.admin_user = User.objects.create_user(
            username='admin6@saludagendax.com', email='admin6@saludagendax.com',
            password='Password123!', is_staff=True,
        )
        self.paciente_user = User.objects.create_user(
            username='pacienteF@saludagendax.com', email='pacienteF@saludagendax.com',
            password='Password123!',
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user, tipo_documento='CC', num_documento='888888888',
            fecha_nacimiento='1990-01-01', eps=self.eps, direccion='Calle 8',
        )
        self.medico_user = User.objects.create_user(
            username='medicoF@saludagendax.com', email='medicoF@saludagendax.com',
            password='Password123!', first_name='Jorge', last_name='Leon',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-007', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Ortopedia', descripcion='Huesos', activo=True, capacidad_diaria=20,
        )
        self.medico.especialidades.add(self.especialidad)

        self.fecha = timezone.localdate() + timedelta(days=3)
        HorarioMedico.objects.create(
            medico=self.medico, dia_semana=self.fecha.weekday(),
            hora_inicio='08:00:00', hora_fin='18:00:00', max_citas_por_hora=4, activo=True,
        )
        self.url = reverse('cita-list')
        self.client.force_authenticate(user=self.paciente_user)

    def _payload(self, **overrides):
        base = {
            'paciente': self.paciente.id, 'medico': self.medico.id, 'especialidad': self.especialidad.id,
            'fecha': self.fecha.isoformat(), 'hora_inicio': '09:00:00', 'hora_fin': '09:30:00',
            'eps': self.eps.id, 'motivo_consulta': 'Control', 'tipo_cita': 'consulta_general',
        }
        base.update(overrides)
        return base

    def test_no_se_puede_agendar_en_feriado(self):
        Feriado.objects.create(fecha=self.fecha, descripcion='Festivo de prueba')
        response = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('fecha', response.data['errors'])

    def test_rechaza_fuera_de_horario_institucional(self):
        ConfiguracionGlobal.objects.update_or_create(
            pk=1, defaults={'horario_apertura': '10:00:00', 'horario_cierre': '16:00:00'}
        )
        response = self.client.post(self.url, self._payload(hora_inicio='09:00:00', hora_fin='09:30:00'), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('hora_inicio', response.data['errors'])

    def test_rechaza_por_anticipacion_minima(self):
        ConfiguracionGlobal.objects.update_or_create(pk=1, defaults={'anticipacion_minima_horas': 999999})
        response = self.client.post(self.url, self._payload(), format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('hora_inicio', response.data['errors'])


class SedeEndpointTests(APITestCase):
    """HU-023: CRUD de sedes."""

    def setUp(self):
        self.admin_user = User.objects.create_user(
            username='admin7@saludagendax.com', email='admin7@saludagendax.com',
            password='Password123!', is_staff=True,
        )
        self.normal_user = User.objects.create_user(
            username='normal7@saludagendax.com', email='normal7@saludagendax.com',
            password='Password123!',
        )

    def test_admin_puede_crear_sede(self):
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.post(
            reverse('sede-list'),
            {'nombre': 'Sede Norte', 'direccion': 'Cra 1 # 2-3', 'telefono': '3000000000', 'activo': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Sede.objects.filter(nombre='Sede Norte').exists())

    def test_no_admin_no_puede_crear_sede(self):
        self.client.force_authenticate(user=self.normal_user)
        response = self.client.post(
            reverse('sede-list'), {'nombre': 'Sede Sur'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
