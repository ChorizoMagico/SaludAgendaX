"""
HU-014: Testing de topes de EPS.

Suite de tests para validar:
- Bloqueo al superar límite de citas por período (semanal/mensual)
- Casos límite (80% de uso, 100% de uso)
- Presupuesto máximo
- Alertas de tope
- Diferentes períodos (semanal, mensual)
"""

import uuid
from datetime import datetime, timedelta
from decimal import Decimal

from django.apps import apps
from django.contrib.auth import get_user_model
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError

User = get_user_model()
Cita = apps.get_model("pacientes", "Cita")
Paciente = apps.get_model("pacientes", "Paciente")
Medico = apps.get_model("pacientes", "Medico")
Especialidad = apps.get_model("pacientes", "Especialidad")
EPS = apps.get_model("pacientes", "EPS")
TopeEPS = apps.get_model("pacientes", "TopeEPS")
HorarioMedico = apps.get_model("pacientes", "HorarioMedico")
AlertaTopeEnviada = apps.get_model("pacientes", "AlertaTopeEnviada")
from pacientes.services import CitaService


class TopesHU014Tests(TransactionTestCase):
    """Test suite para HU-014: topes de EPS"""

    def setUp(self):
        """Crear datos de prueba comunes"""
        # Crear EPS
        self.eps = EPS.objects.create(
            nombre=f"EPS-{uuid.uuid4().hex[:8]}",
            codigo=f"COD-{uuid.uuid4().hex[:8]}",
            activo=True
        )

        # Crear TopeEPS mensual con límite de 5 citas
        self.tope = TopeEPS.objects.create(
            eps=self.eps,
            limite_citas=5,
            tipo_periodo='MENSUAL',
            presupuesto_maximo=Decimal('1000.00')
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

        # Crear especialidad
        self.especialidad = Especialidad.objects.create(
            nombre=f"Specialty-{uuid.uuid4().hex[:8]}",
            descripcion="Test specialty",
            activo=True,
            capacidad_diaria=10
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

    def _crear_cita(self, dias_offset=0, hora_inicio="10:00:00", hora_fin="10:30:00", estado="CONFIRMADA"):
        """Helper para crear cita"""
        fecha = self.fecha_base + timedelta(days=dias_offset)
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
            estado=estado,
            motivo="Test appointment"
        )

    def test_permite_crear_cita_dentro_del_limite(self):
        """Verificar que permite crear cita dentro del límite"""
        # Crear 3 citas (dentro del límite de 5)
        for i in range(3):
            self._crear_cita(dias_offset=i)

        # Intentar crear cita 4 (debe permitir)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=3),
            'hora_inicio': timezone.datetime.strptime("14:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("14:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('eps', errors)

    def test_bloquea_al_alcanzar_100_porciento_del_tope(self):
        """Verificar que bloquea al alcanzar 100% del tope"""
        # Crear 5 citas (límite completo)
        for i in range(5):
            self._crear_cita(dias_offset=i)

        # Intentar crear cita 6 (debe fallar)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=5),
            'hora_inicio': timezone.datetime.strptime("14:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("14:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertIn('eps', errors)
        self.assertIn('tope de citas', errors['eps'][0])

    def test_alerta_al_alcanzar_80_porciento_del_tope(self):
        """Verificar que genera alerta al alcanzar 80% del tope"""
        # Crear 4 citas (80% de 5)
        for i in range(4):
            self._crear_cita(dias_offset=i)

        # Intentar crear cita 5 (debe permitir pero con alerta)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=4),
            'hora_inicio': timezone.datetime.strptime("14:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("14:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('eps', errors)
        # Debe haber alerta de proximidad al tope
        self.assertTrue(any('próxima' in str(alert).lower() or 'agotar' in str(alert).lower() for alert in alerts))

    def test_no_cuenta_citas_canceladas_en_tope(self):
        """Verificar que no cuenta citas canceladas en el tope"""
        # Crear 5 citas confirmadas
        citas_ids = []
        for i in range(5):
            cita = self._crear_cita(dias_offset=i)
            citas_ids.append(cita.id)

        # Cancelar una cita
        Cita.objects.filter(pk=citas_ids[0]).update(estado='CANCELADA')

        # Intentar crear cita (debe permitir porque hay solo 4 confirmadas)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=5),
            'hora_inicio': timezone.datetime.strptime("14:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("14:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('eps', errors)

    def test_tope_mensual_se_reinicia_cada_mes(self):
        """Verificar que el tope mensual se reinicia al cambiar de mes"""
        # Crear 5 citas en el mes actual
        for i in range(5):
            self._crear_cita(dias_offset=i)

        # Intentar crear en el mes actual (debe fallar)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=5),
            'hora_inicio': timezone.datetime.strptime("14:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("14:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }
        errors, alerts = CitaService.validate_payload(payload)
        self.assertIn('eps', errors)

        # Intentar crear en el próximo mes (debe permitir)
        fecha_proximo_mes = self.fecha_base + timedelta(days=30)
        payload['fecha'] = fecha_proximo_mes

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('eps', errors)

    def test_tope_semanal_se_reinicia_cada_semana(self):
        """Verificar que el tope semanal se reinicia cada semana"""
        # Cambiar a tope semanal con límite de 3
        self.tope.tipo_periodo = 'SEMANAL'
        self.tope.limite_citas = 3
        self.tope.save()

        # Crear 3 citas en la semana actual
        for i in range(3):
            self._crear_cita(dias_offset=i)

        # Intentar crear 4ta en la misma semana (debe fallar)
        dias_para_fin_semana = 7 - self.fecha_base.weekday()
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=dias_para_fin_semana - 1),
            'hora_inicio': timezone.datetime.strptime("14:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("14:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }
        errors, alerts = CitaService.validate_payload(payload)
        self.assertIn('eps', errors)

        # Intentar crear en la próxima semana (debe permitir)
        fecha_proxima_semana = self.fecha_base + timedelta(days=7)
        payload['fecha'] = fecha_proxima_semana

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('eps', errors)

    def test_bloquea_si_presupuesto_maximo_agotado(self):
        """Verificar que bloquea si el presupuesto máximo está agotado"""
        # Crear 11 citas (presupuesto se agota después de 10 si cada una cuesta 100)
        # Para este test, simplemente verificamos la lógica del presupuesto
        self.tope.presupuesto_maximo = Decimal('5')  # 5 unidades de presupuesto
        self.tope.limite_citas = 100  # Límite alto para que no bloquee por citas
        self.tope.save()

        # Crear 5 citas
        for i in range(5):
            self._crear_cita(dias_offset=i)

        # Intentar crear cita 6 (debe fallar por presupuesto)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=5),
            'hora_inicio': timezone.datetime.strptime("14:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("14:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertIn('eps', errors)
        self.assertIn('presupuesto', errors['eps'][0])

    def test_tope_cero_bloquea_todas_las_citas(self):
        """Verificar que tope de 0 bloquea todas las citas"""
        self.tope.limite_citas = 0
        self.tope.save()

        # Intentar crear cita (debe fallar)
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
        self.assertIn('eps', errors)

    def test_tope_negativo_no_se_puede_crear(self):
        """Verificar que tope negativo no es permitido por el modelo"""
        # El modelo tiene CHECK constraint que no permite valores negativos
        from django.db.utils import IntegrityError
        
        with self.assertRaises(IntegrityError):
            TopeEPS.objects.create(
                eps=self.eps,
                limite_citas=-5,
                tipo_periodo='MENSUAL',
                presupuesto_maximo=0
            )

    def test_sin_tope_configurado_no_bloquea(self):
        """Verificar que sin TopeEPS configurado no hay bloqueo"""
        # Eliminar tope
        self.tope.delete()

        # Crear muchas citas (sin límite)
        for i in range(10):
            payload = {
                'paciente': self.paciente,
                'medico': self.medico,
                'especialidad': self.especialidad,
                'fecha': self.fecha_base + timedelta(days=i),
                'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
                'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
                'eps': self.eps,
            }

            errors, alerts = CitaService.validate_payload(payload)
            self.assertNotIn('eps', errors)

    def test_diferentes_eps_tienen_topes_independientes(self):
        """Verificar que topes de diferentes EPS son independientes"""
        # Crear segunda EPS con tope de 2
        eps_2 = EPS.objects.create(
            nombre=f"EPS2-{uuid.uuid4().hex[:8]}",
            codigo=f"COD2-{uuid.uuid4().hex[:8]}",
            activo=True
        )

        TopeEPS.objects.create(
            eps=eps_2,
            limite_citas=2,
            tipo_periodo='MENSUAL'
        )

        # Crear paciente 2 con EPS2
        paciente_2_user = User.objects.create_user(
            username=f"paciente2-{uuid.uuid4().hex[:8]}",
            email=f"paciente2-{uuid.uuid4().hex[:8]}@test.com",
            password="testpass123"
        )

        paciente_2 = Paciente.objects.create(
            usuario=paciente_2_user,
            tipo_documento="CC",
            num_documento=f"{uuid.uuid4().hex[:10]}",
            fecha_nacimiento=timezone.now().date() - timedelta(days=365*30),
            eps=eps_2,
            direccion="Test Address 2"
        )

        # Crear 5 citas reales para paciente 1 con EPS1 (debe permitir)
        for i in range(5):
            self._crear_cita(dias_offset=i)

        # Crear 2 citas reales para paciente 2 con EPS2 (debe permitir)
        for i in range(2):
            Cita.objects.create(
                paciente=paciente_2,
                medico=self.medico,
                especialidad=self.especialidad,
                fecha_hora=timezone.make_aware(
                    datetime.strptime(f"{self.fecha_base + timedelta(days=i)} 10:00:00", "%Y-%m-%d %H:%M:%S")
                ),
                fecha=self.fecha_base + timedelta(days=i),
                hora_inicio=timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
                hora_fin=timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
                eps=eps_2,
                estado="CONFIRMADA",
                motivo="Test"
            )

        # Intentar crear 3ra cita para paciente 2 (debe bloquear porque EPS2 tiene tope=2)
        payload = {
            'paciente': paciente_2,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=2),
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': eps_2,
        }
        errors, _ = CitaService.validate_payload(payload)
        self.assertIn('eps', errors)

    def test_porcentaje_uso_calculado_correctamente(self):
        """Verificar que el porcentaje de uso se calcula correctamente"""
        # Crear 2 citas de 5 (40%)
        for i in range(2):
            self._crear_cita(dias_offset=i)

        # Debe permitir sin alertas
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=2),
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        self.assertNotIn('eps', errors)
        # Sin alertas en 40%
        self.assertFalse(any('próxima' in str(a).lower() or 'agotar' in str(a).lower() for a in alerts))

    def test_caso_limite_79_porciento_no_genera_alerta(self):
        """Verificar que 79% no genera alerta (umbral es 80%)"""
        # Con límite de 100, 79 citas son 79%
        self.tope.limite_citas = 100
        self.tope.save()

        # Crear 78 citas (78% que al + 1 será 79%)
        for i in range(78):
            fecha = self.fecha_base + timedelta(days=i % 20)  # Reciclar fechas
            hora = f"{8 + (i % 9):02d}:00:00"
            try:
                self._crear_cita(dias_offset=i % 20, hora_inicio=hora, hora_fin=f"{8 + (i % 9):02d}:30:00")
            except:
                pass

        # Cita 79 (79% exacto)
        payload = {
            'paciente': self.paciente,
            'medico': self.medico,
            'especialidad': self.especialidad,
            'fecha': self.fecha_base + timedelta(days=10),
            'hora_inicio': timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            'hora_fin': timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            'eps': self.eps,
        }

        errors, alerts = CitaService.validate_payload(payload)
        # 79% no debe tener alerta
        self.assertFalse(any('próxima' in str(a).lower() or 'agotar' in str(a).lower() for a in alerts))
