"""
HU-015: Testing de restricciones de frecuencia.

Suite de tests para validar:
- Restricción de días entre citas (dias_entre_citas por especialidad)
- Paciente no puede agendar 2 citas de misma especialidad en X días
- Casos límite (día X-1, día X, día X+1)
- Paciente repetido con diferentes especialidades
- Especialidades con diferentes restricciones
"""

import uuid
from datetime import datetime, timedelta

from django.apps import apps
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone

User = get_user_model()
Cita = apps.get_model("pacientes", "Cita")
Paciente = apps.get_model("pacientes", "Paciente")
Medico = apps.get_model("pacientes", "Medico")
Especialidad = apps.get_model("pacientes", "Especialidad")
EPS = apps.get_model("pacientes", "EPS")
HorarioMedico = apps.get_model("pacientes", "HorarioMedico")
from pacientes.services import CitaService


class FrecuenciaHU015Tests(TransactionTestCase):
    """Test suite para HU-015: restricciones de frecuencia"""

    def setUp(self):
        """Crear datos de prueba comunes"""
        # Crear EPS
        self.eps = EPS.objects.create(
            nombre=f"EPS-{uuid.uuid4().hex[:8]}",
            codigo=f"COD-{uuid.uuid4().hex[:8]}",
            activo=True
        )

        # Crear usuario paciente
        self.paciente_user = User.objects.create_user(
            username=f"paciente-{uuid.uuid4().hex[:8]}",
            email=f"paciente-{uuid.uuid4().hex[:8]}@test.com",
            password="testpass123"
        )

        # Crear paciente
        self.paciente = Paciente.objects.create(
            usuario=self.paciente_user,
            tipo_documento="CC",
            num_documento=f"{uuid.uuid4().hex[:10]}",
            fecha_nacimiento=timezone.now().date() - timedelta(days=365*30),
            eps=self.eps,
            direccion="Test Address"
        )

        # Crear usuario médico
        self.medico_user = User.objects.create_user(
            username=f"medico-{uuid.uuid4().hex[:8]}",
            email=f"medico-{uuid.uuid4().hex[:8]}@test.com",
            password="testpass123"
        )

        # Crear médico
        self.medico = Medico.objects.create(
            usuario=self.medico_user,
            registro_medico=f"REG-{uuid.uuid4().hex[:8]}",
            activo=True
        )

        # Crear especialidad con 7 días entre citas (por defecto)
        self.especialidad = Especialidad.objects.create(
            nombre=f"Specialty-{uuid.uuid4().hex[:8]}",
            descripcion="Test specialty",
            activo=True,
            capacidad_diaria=10,
            dias_entre_citas=7
        )

        # Asignar especialidad al médico
        self.medico.especialidades.add(self.especialidad)

        # Crear horarios disponibles (todos los días)
        for dia in range(7):
            HorarioMedico.objects.create(
                medico=self.medico,
                dia_semana=dia,
                hora_inicio=timezone.datetime.strptime("08:00:00", "%H:%M:%S").time(),
                hora_fin=timezone.datetime.strptime("17:00:00", "%H:%M:%S").time(),
                max_citas_por_hora=10,
                activo=True
            )

        self.fecha_base = timezone.now().date() + timedelta(days=5)

    def _crear_cita(self, fecha, hora_inicio="10:00:00", hora_fin="10:30:00"):
        """Helper para crear cita"""
        hora_inicio_obj = timezone.datetime.strptime(hora_inicio, "%H:%M:%S").time()
        hora_fin_obj = timezone.datetime.strptime(hora_fin, "%H:%M:%S").time()
        
        return Cita.objects.create(
            paciente=self.paciente,
            medico=self.medico,
            especialidad=self.especialidad,
            fecha_hora=timezone.make_aware(
                datetime.strptime(f"{fecha} {hora_inicio}", "%Y-%m-%d %H:%M:%S")
            ),
            fecha=fecha,
            hora_inicio=hora_inicio_obj,
            hora_fin=hora_fin_obj,
            eps=self.eps,
            estado="CONFIRMADA",
            motivo="Test appointment"
        )

    def test_permite_agendar_primera_cita(self):
        """Verificar que permite agendar la primera cita"""
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base,
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_bloquea_cita_a_6_dias_de_la_anterior(self):
        """Verificar que bloquea cita a día 6 (menos de 7 días)"""
        # Crear cita en día base
        self._crear_cita(self.fecha_base)

        # Intentar crear en día +6 (debe bloquear)
        fecha_conflicto = self.fecha_base + timedelta(days=6)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': fecha_conflicto,
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertIn('paciente', errors)
        self.assertIn('7 días', errors['paciente'][0])

    def test_permite_cita_a_7_dias_exactos(self):
        """Verificar que permite cita exactamente a 7 días"""
        # Crear cita en día base
        self._crear_cita(self.fecha_base)

        # Crear cita a 7 días exactos (debe permitir)
        fecha_permitida = self.fecha_base + timedelta(days=7)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': fecha_permitida,
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_permite_cita_a_8_dias_o_mas(self):
        """Verificar que permite cita a 8 días o más"""
        # Crear cita en día base
        self._crear_cita(self.fecha_base)

        # Crear cita a 8 días (debe permitir)
        fecha_permitida = self.fecha_base + timedelta(days=8)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': fecha_permitida,
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_especialidades_diferentes_no_interfieren(self):
        """Verificar que especialidades diferentes no interfieren"""
        # Crear especialidad 2
        especialidad_2 = Especialidad.objects.create(
            nombre=f"Specialty2-{uuid.uuid4().hex[:8]}",
            descripcion="Test specialty 2",
            activo=True,
            capacidad_diaria=10,
            dias_entre_citas=7
        )

        self.medico.especialidades.add(especialidad_2)

        # Crear cita con especialidad 1
        self._crear_cita(self.fecha_base)

        # Intentar crear cita con especialidad 2 al día siguiente (debe permitir)
        fecha_siguiente = self.fecha_base + timedelta(days=1)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': especialidad_2,
            'fecha': fecha_siguiente,
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_especialidad_con_dias_cero_permite_multiple_citas_mismo_dia(self):
        """Verificar que especialidad con dias_entre_citas=0 permite múltiples"""
        # Crear especialidad sin restricción
        especialidad_sin_restriccion = Especialidad.objects.create(
            nombre=f"NoRestrict-{uuid.uuid4().hex[:8]}",
            descripcion="No restriction",
            activo=True,
            capacidad_diaria=10,
            dias_entre_citas=0
        )

        self.medico.especialidades.add(especialidad_sin_restriccion)

        # Crear cita 1
        self._crear_cita(self.fecha_base, hora_inicio="10:00:00", hora_fin="10:30:00")

        # Intentar crear cita 2 el mismo día (debe permitir)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': especialidad_sin_restriccion,
            'fecha': self.fecha_base,
            'hora_inicio': timezone.datetime.strptime("11:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("11:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_especialidad_con_dias_3_valida_correctamente(self):
        """Verificar que especialidad con dias_entre_citas=3 valida correctamente"""
        # Crear especialidad con 3 días entre citas
        especialidad_3_dias = Especialidad.objects.create(
            nombre=f"3Days-{uuid.uuid4().hex[:8]}",
            descripcion="3 days restriction",
            activo=True,
            capacidad_diaria=10,
            dias_entre_citas=3
        )

        self.medico.especialidades.add(especialidad_3_dias)

        # Crear cita en día base
        cita_1 = Cita.objects.create(
            paciente=self.paciente,
            medico=self.medico,
            especialidad=especialidad_3_dias,
            fecha_hora=timezone.make_aware(
                datetime.strptime(f"{self.fecha_base} 10:00:00", "%Y-%m-%d %H:%M:%S")
            ),
            fecha=self.fecha_base,
            hora_inicio=timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            hora_fin=timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            eps=self.eps,
            estado="CONFIRMADA",
            motivo="Test"
        )

        # Intentar a día 2 (debe bloquear)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': especialidad_3_dias,
            'fecha': self.fecha_base + timedelta(days=2),
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertIn('paciente', errors)

        # Intentar a día 3 exacto (debe permitir)
        payload['fecha'] = self.fecha_base + timedelta(days=3)
        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_paciente_repetido_diferentes_especialidades(self):
        """Verificar paciente puede agendar diferentes especialidades sin restricción"""
        # Crear especialidad 2
        especialidad_2 = Especialidad.objects.create(
            nombre=f"Specialty-{uuid.uuid4().hex[:8]}",
            descripcion="Test specialty 2",
            activo=True,
            capacidad_diaria=10,
            dias_entre_citas=7
        )

        medico_2 = Medico.objects.create(
            usuario=User.objects.create_user(
                username=f"medico2-{uuid.uuid4().hex[:8]}",
                email=f"medico2-{uuid.uuid4().hex[:8]}@test.com",
                password="testpass123"
            ),
            registro_medico=f"REG2-{uuid.uuid4().hex[:8]}",
            activo=True
        )

        medico_2.especialidades.add(especialidad_2)

        for dia in range(7):
            HorarioMedico.objects.create(
                medico=medico_2,
                dia_semana=dia,
                hora_inicio=timezone.datetime.strptime("08:00:00", "%H:%M:%S").time(),
                hora_fin=timezone.datetime.strptime("17:00:00", "%H:%M:%S").time(),
                max_citas_por_hora=10,
                activo=True
            )

        # Crear cita con especialidad 1 en médico 1
        self._crear_cita(self.fecha_base)

        # Crear cita con especialidad 2 en médico 2 al día siguiente (debe permitir)
        fecha_siguiente = self.fecha_base + timedelta(days=1)
        payload = {
            'paciente': self.paciente,
            'medico': medico_2,
            'especialidad': especialidad_2,
            'fecha': fecha_siguiente,
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_cancelada_no_cuenta_para_restriccion(self):
        """Verificar que cita cancelada no cuenta para restricción de frecuencia"""
        # Crear cita confirmada
        cita_1 = self._crear_cita(self.fecha_base)

        # Cancelarla
        cita_1.estado = 'CANCELADA'
        cita_1.save()

        # Intentar crear a 6 días (debe permitir porque la anterior está cancelada)
        fecha_conflicto = self.fecha_base + timedelta(days=6)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': fecha_conflicto,
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_multiples_citas_validacion_conjunta(self):
        """Verificar que validación funciona con múltiples citas previas"""
        # Crear 3 citas espaciadas
        cita_1 = self._crear_cita(self.fecha_base)
        cita_2 = self._crear_cita(self.fecha_base + timedelta(days=7))
        cita_3 = self._crear_cita(self.fecha_base + timedelta(days=14))

        # Intentar crear a 20 días (debe permitir, está lejos de la última)
        fecha_nueva = self.fecha_base + timedelta(days=21)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': fecha_nueva,
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('paciente', errors)

    def test_dias_entre_citas_negativo_no_se_permite(self):
        """Verificar que dias_entre_citas negativo no es permitido por el modelo"""
        # El modelo tiene CHECK constraint que no permite valores negativos
        from django.db.utils import IntegrityError
        
        with self.assertRaises(IntegrityError):
            Especialidad.objects.create(
                nombre=f"Negative-{uuid.uuid4().hex[:8]}",
                descripcion="Negative dias restriction",
                activo=True,
                capacidad_diaria=10,
                dias_entre_citas=-5
            )

    def test_pendiente_tambien_cuenta_para_restriccion(self):
        """Verificar que citas PENDIENTE también cuentan para restricción"""
        # Crear cita con estado PENDIENTE
        cita_pendiente = Cita.objects.create(
            paciente=self.paciente,
            medico=self.medico,
            especialidad=self.especialidad,
            fecha_hora=timezone.make_aware(
                datetime.strptime(f"{self.fecha_base} 10:00:00", "%Y-%m-%d %H:%M:%S")
            ),
            fecha=self.fecha_base,
            hora_inicio=timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            hora_fin=timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            eps=self.eps,
            estado="PENDIENTE",
            motivo="Test"
        )

        # Intentar crear a 6 días (debe bloquear)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=6),
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertIn('paciente', errors)
