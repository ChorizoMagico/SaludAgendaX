from django.contrib.auth.models import Group, User
from datetime import datetime, timedelta
from django.utils import timezone
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import (
    Cita,
    EPS,
    Especialidad,
    HorarioMedico,
    Medico,
    NotificacionPendiente,
    Paciente,
    TopeEPS,
)


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
