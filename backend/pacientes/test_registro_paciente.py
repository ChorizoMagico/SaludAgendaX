from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import EPS, Paciente


class RegistroPacienteTests(APITestCase):
    def setUp(self):
        self.eps = EPS.objects.create(nombre='EPS de prueba', codigo='EPS-PRUEBA')
        self.url = reverse('registro_paciente')
        self.payload = {
            'email': 'paciente@example.com',
            'password': 'ClaveSegura123',
            'password_confirm': 'ClaveSegura123',
            'nombres': 'Ana',
            'apellidos': 'Paciente',
            'tipo_documento': 'CC',
            'num_documento': '123456789',
            'fecha_nacimiento': '1995-01-01',
            'eps_id': self.eps.id,
            'direccion': 'Calle 1',
            'telefono': '3001234567',
        }

    def test_registro_crea_usuario_y_perfil_paciente(self):
        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        user = User.objects.get(email=self.payload['email'])
        paciente = Paciente.objects.get(usuario=user)
        self.assertEqual(paciente.num_documento, self.payload['num_documento'])
        self.assertEqual(paciente.eps, self.eps)

    def test_no_crea_usuario_si_eps_no_es_valida(self):
        self.payload['eps_id'] = 999999
        response = self.client.post(self.url, self.payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('eps_id', response.data)
        self.assertFalse(User.objects.filter(email=self.payload['email']).exists())
        self.assertFalse(Paciente.objects.filter(num_documento=self.payload['num_documento']).exists())
