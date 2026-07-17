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
    ExcepcionMedico,
)
from .notificaciones import enviar_notificaciones_pendientes


class EndpointsAdministracionPendientesTests(APITestCase):
    """Cobertura de los endpoints que conectan los módulos administrativos con el backend."""

    def setUp(self):
        self.admin = User.objects.create_user(
            username='admin-crud@example.com', email='admin-crud@example.com', password='Password123!', is_staff=True,
        )
        self.superadmin = User.objects.create_superuser(
            username='super-crud@example.com', email='super-crud@example.com', password='Password123!',
        )
        self.eps = EPS.objects.create(nombre='EPS CRUD', codigo='CRUD-01', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Medicina interna CRUD', descripcion='Pruebas', dias_entre_citas=7,
        )
        medico_user = User.objects.create_user(
            username='medico-crud@example.com', email='medico-crud@example.com', password='Password123!',
            first_name='Marta', last_name='Medica',
        )
        self.medico = Medico.objects.create(
            usuario=medico_user, registro_medico='RM-CRUD', num_documento='90001', activo=True, estado='aprobado',
        )
        self.medico.especialidades.add(self.especialidad)

    def test_administrativo_gestiona_paciente_y_desactivacion_conserva_registro(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(reverse('paciente-administrativo-list'), {
            'email': 'paciente-crud@example.com', 'password': 'Password123!', 'nombres': 'Paula',
            'apellidos': 'Paciente', 'tipo_documento': 'CC', 'num_documento': '80001',
            'fecha_nacimiento': '1990-01-01', 'eps': self.eps.id, 'direccion': 'Calle 1', 'telefono': '3000000000',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        paciente_id = response.data['id']

        response = self.client.patch(
            reverse('paciente-administrativo-detail', args=[paciente_id]), {'telefono': '3111111111'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['telefono'], '3111111111')

        response = self.client.delete(reverse('paciente-administrativo-detail', args=[paciente_id]))
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Paciente.objects.get(pk=paciente_id).usuario.is_active)

    def test_administrativo_gestiona_medico_y_no_autorizado_es_rechazado(self):
        normal = User.objects.create_user('normal-crud@example.com', 'normal-crud@example.com', 'Password123!')
        self.client.force_authenticate(user=normal)
        response = self.client.get(reverse('medico-administrativo-list'))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        self.client.force_authenticate(user=self.admin)
        response = self.client.patch(
            reverse('medico-administrativo-detail', args=[self.medico.id]),
            {'activo': False, 'especialidad_ids': [self.especialidad.id]}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['activo'])

    def test_superadmin_configura_tope_y_restriccion_de_frecuencia(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(reverse('tope-eps-list'), {
            'eps': self.eps.id, 'limite_citas': 20, 'tipo_periodo': 'MENSUAL', 'presupuesto_maximo': '15.00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['eps_nombre'], self.eps.nombre)

        response = self.client.patch(
            reverse('restriccion-frecuencia-detail', args=[self.especialidad.id]), {'dias_entre_citas': 14}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['dias_entre_citas'], 14)

    def test_medico_solo_gestiona_sus_excepciones_y_se_validan_las_horas(self):
        self.client.force_authenticate(user=self.medico.usuario)
        response = self.client.post(reverse('excepcion-medico-list'), {
            'medico': self.medico.id, 'fecha': '2030-01-01', 'hora_inicio': '13:00:00', 'hora_fin': '12:00:00',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        response = self.client.post(reverse('excepcion-medico-list'), {
            'fecha': '2030-01-01', 'motivo': 'Vacaciones',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['medico'], self.medico.id)
        self.assertTrue(ExcepcionMedico.objects.filter(pk=response.data['id'], medico=self.medico).exists())


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

    def test_full_flow_medico_especialidad_relationship(self):
        """
        HU-005: Creación de especialidad con médico asignado y posterior agendamiento de cita.
        Verifica la relación Especialidad <-> Medico en el flujo completo.
        """
        # El administrador crea una especialidad y asigna el médico.
        self.client.force_authenticate(user=self.admin_user)
        create_response = self.client.post(
            reverse('especialidad-list'),
            {
                'nombre': 'Reumatologia',
                'descripcion': 'Dolores articulares',
                'activo': True,
                'medico_ids': [self.medico.id],
            },
            format='json',
        )
        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)

        especialidad_id = create_response.data['id']
        especialidad = Especialidad.objects.get(pk=especialidad_id)
        self.assertTrue(especialidad.medicos.filter(pk=self.medico.id).exists())

        # Verificar que la API devuelve la especialidad con el médico asignado.
        detail_response = self.client.get(reverse('especialidad-detail', args=[especialidad_id]))
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data['nombre'], 'Reumatologia')
        self.assertEqual(len(detail_response.data['medicos']), 1)
        self.assertEqual(detail_response.data['medicos'][0]['id'], self.medico.id)

        # Luego el paciente crea una cita con ese médico y especialidad.
        self.client.force_authenticate(user=self.paciente_user)
        appointment_payload = self._payload(especialidad=especialidad_id)
        appointment_response = self.client.post(self.url, appointment_payload, format='json')

        self.assertEqual(appointment_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(appointment_response.data['status'], 'success')
        self.assertEqual(appointment_response.data['data']['especialidad'], especialidad_id)
        self.assertEqual(appointment_response.data['data']['medico'], self.medico.id)

        cita = Cita.objects.get(pk=appointment_response.data['data']['id'])
        self.assertTrue(cita.medico.especialidades.filter(pk=especialidad_id).exists())
        self.assertEqual(cita.especialidad.id, especialidad_id)
        self.assertEqual(cita.paciente.id, self.paciente.id)

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


class CancelacionCitaTests(APITestCase):
    """HU-010: cancelación de citas libera cupos y vuelve a quedar disponible."""

    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS Cancelacion', codigo='EPS005', activo=True)
        self.paciente_user = User.objects.create_user(
            username='pacienteCancel@saludagendax.com',
            email='pacienteCancel@saludagendax.com',
            password='Password123!',
        )
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user,
            tipo_documento='CC',
            num_documento='666666666',
            fecha_nacimiento='1990-01-01',
            eps=self.eps,
            direccion='Calle 6',
        )
        self.medico_user = User.objects.create_user(
            username='medicoCancel@saludagendax.com',
            email='medicoCancel@saludagendax.com',
            password='Password123!',
            first_name='Elena',
            last_name='Soto',
        )
        self.medico = Medico.objects.create(usuario=self.medico_user, registro_medico='RM-006', activo=True)
        self.especialidad = Especialidad.objects.create(
            nombre='Psiquiatria',
            descripcion='Salud mental',
            activo=True,
            capacidad_diaria=20,
        )
        self.medico.especialidades.add(self.especialidad)

        self.fecha = timezone.localdate() + timedelta(days=3)
        HorarioMedico.objects.create(
            medico=self.medico,
            dia_semana=self.fecha.weekday(),
            hora_inicio='08:00:00',
            hora_fin='18:00:00',
            max_citas_por_hora=1,
            activo=True,
        )

        self.cita = Cita.objects.create(
            paciente=self.paciente,
            medico=self.medico,
            especialidad=self.especialidad,
            eps=self.eps,
            fecha=self.fecha,
            hora_inicio='09:00:00',
            hora_fin='09:30:00',
            fecha_hora=timezone.make_aware(datetime.strptime(f'{self.fecha} 09:00:00', '%Y-%m-%d %H:%M:%S')),
            estado='CONFIRMADA',
            tipo_cita='consulta_general',
            motivo='Control',
        )
        self.client.force_authenticate(user=self.paciente_user)
        self.url = reverse('cancelar_cita', args=[self.cita.id])

    def test_cancelar_cita_libera_cupo_y_reaparece_en_disponibilidad(self):
        response = self.client.patch(self.url, {'motivo_cancelacion': 'No puedo asistir'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.cita.refresh_from_db()
        self.assertEqual(self.cita.estado, 'CANCELADA')

        disponibilidad_response = self.client.get(
            reverse('disponibilidad_medica'),
            {
                'medico_id': self.medico.id,
                'fecha_inicio': datetime.combine(self.fecha, datetime.strptime('09:00:00', '%H:%M:%S').time()).isoformat(),
                'fecha_fin': datetime.combine(self.fecha, datetime.strptime('09:00:00', '%H:%M:%S').time()).isoformat(),
                'duracion_minutos': 30,
            },
        )

        self.assertEqual(disponibilidad_response.status_code, status.HTTP_200_OK)
        self.assertTrue(disponibilidad_response.data['slots_disponibles'])
        slot = disponibilidad_response.data['slots_disponibles'][0]
        self.assertTrue(slot['disponible'])
        self.assertEqual(slot['cupos_restantes'], 1)

        reagendamiento_response = self.client.post(
            reverse('cita-list'),
            {
                'paciente': self.paciente.id,
                'medico': self.medico.id,
                'especialidad': self.especialidad.id,
                'fecha': self.fecha.isoformat(),
                'hora_inicio': '09:00:00',
                'hora_fin': '09:30:00',
                'eps': self.eps.id,
                'motivo_consulta': 'Reagendamiento tras cancelación',
                'tipo_cita': 'consulta_general',
            },
            format='json',
        )

        self.assertEqual(reagendamiento_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reagendamiento_response.data['status'], 'success')


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
