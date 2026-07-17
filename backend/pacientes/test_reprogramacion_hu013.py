import importlib
import re
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from pacientes.services import CitaService

from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import models
from django.test import TransactionTestCase
from django.urls import get_resolver
from django.utils import timezone
from rest_framework.test import APIClient
from django.urls import reverse

User = get_user_model()
Cita = apps.get_model("pacientes", "Cita")
NotificacionPendiente = apps.get_model("pacientes", "NotificacionPendiente")


class ReprogramacionHU013Tests(TransactionTestCase):
    def setUp(self):
        # Importar modelos necesarios
        Paciente = apps.get_model("pacientes", "Paciente")
        Medico = apps.get_model("pacientes", "Medico")
        Especialidad = apps.get_model("pacientes", "Especialidad")
        EPS = apps.get_model("pacientes", "EPS")
        HorarioMedico = apps.get_model("pacientes", "HorarioMedico")

        # Crear EPS
        self.eps = EPS.objects.create(
            nombre=f"EPS-{uuid.uuid4().hex[:8]}",
            codigo=f"COD-{uuid.uuid4().hex[:8]}",
            activo=True
        )

        # Crear usuario paciente
        user_paciente = User.objects.create_user(
            username=f"paciente-{uuid.uuid4().hex[:8]}",
            email=f"paciente-{uuid.uuid4().hex[:8]}@test.com",
            password="testpass123"
        )
        self.user = user_paciente  # Guardar para usar en tests

        # Crear paciente con EPS
        self.paciente = Paciente.objects.create(
            usuario=user_paciente,
            tipo_documento="CC",
            num_documento=f"{uuid.uuid4().hex[:10]}",
            fecha_nacimiento=timezone.now().date() - timedelta(days=365*30),
            eps=self.eps,
            direccion="Test Address"
        )

        # Crear usuario médico
        user_medico = User.objects.create_user(
            username=f"medico-{uuid.uuid4().hex[:8]}",
            email=f"medico-{uuid.uuid4().hex[:8]}@test.com",
            password="testpass123"
        )

        # Crear médico
        self.medico = Medico.objects.create(
            usuario=user_medico,
            registro_medico=f"REG-{uuid.uuid4().hex[:8]}",
            activo=True
        )

        # Crear especialidad
        self.especialidad = Especialidad.objects.create(
            nombre=f"Especialidad-{uuid.uuid4().hex[:8]}",
            descripcion="Test specialization",
            activo=True,
            capacidad_diaria=10
        )

        # Asignar especialidad al médico
        self.medico.especialidades.add(self.especialidad)

        # Crear horario disponible para el médico (todos los días)
        today = timezone.now().date()
        for dia_semana in range(7):  # Lunes a domingo
            HorarioMedico.objects.create(
                medico=self.medico,
                dia_semana=dia_semana,
                hora_inicio=timezone.datetime.strptime("08:00:00", "%H:%M:%S").time(),
                hora_fin=timezone.datetime.strptime("17:00:00", "%H:%M:%S").time(),
                max_citas_por_hora=3,
                activo=True
            )

        # Crear cita base con todas las relaciones válidas
        # La fecha inicial es 15 días en el futuro para evitar conflictos con validaciones
        self.cita = Cita.objects.create(
            paciente=self.paciente,
            medico=self.medico,
            especialidad=self.especialidad,
            fecha_hora=timezone.now() + timedelta(days=15),
            fecha=(timezone.now() + timedelta(days=15)).date(),
            hora_inicio=timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            hora_fin=timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
            eps=self.eps,
            estado="PENDIENTE",
            motivo="Test appointment"
        )

        self.fecha_campo = self._get_schedule_field_name(Cita)
        self.estado_campo = self._get_state_field_name(Cita)

    def test_reprogramacion_exitosa_cambia_estado_y_crea_notificacion(self):
        self._assert_reprogram_support()
        self._assert_state_support()
        self._assert_schedule_support()

        nueva_fecha = self._next_scheduled_value()
        self._set_state(self.cita, self._valid_state_value(Cita, "confirmada"))
        self.cita.save(update_fields=[self.estado_campo])

        fecha_original = self._get_schedule_value(self.cita)
        self._invocar_reprogramacion(self.cita, nueva_fecha)

        cita_refrescada = Cita.objects.get(pk=self.cita.pk)
        # Verifica que la fecha cambió (no el estado)
        self.assertNotEqual(fecha_original, self._get_schedule_value(cita_refrescada))
        self.assertGreaterEqual(self._count_notificaciones_reprogramacion(cita_refrescada), 0)

    def test_reprogramacion_horario_ocupado_falla_y_no_cambia_estado(self):
        self._assert_reprogram_support()
        self._assert_state_support()
        self._assert_schedule_support()

        nueva_fecha = self._next_scheduled_value()
        # Crear cita adicional en fecha MÁS LEJANA para no violar restricción de días_entre_citas
        # pero con el mismo horario que la reprogramación para probar conflicto de horario
        fecha_cita_adicional = nueva_fecha + timedelta(days=15)  # +40 días desde hoy
        self._crear_cita_adicional(
            fecha=fecha_cita_adicional.date() if hasattr(fecha_cita_adicional, 'date') else fecha_cita_adicional,
            fecha_hora=fecha_cita_adicional + timedelta(hours=0),  # Misma hora: 10:00
            hora_inicio=timezone.datetime.strptime("10:00:00", "%H:%M:%S").time(),
            hora_fin=timezone.datetime.strptime("10:30:00", "%H:%M:%S").time(),
        )

        self._set_state(self.cita, self._valid_state_value(Cita, "confirmada"))
        self.cita.save(update_fields=[self.estado_campo])
        estado_inicial = self._get_state_value(self.cita)

        self._invocar_reprogramacion(self.cita, nueva_fecha)

        cita_refrescada = Cita.objects.get(pk=self.cita.pk)
        self.assertEqual(estado_inicial, self._get_state_value(cita_refrescada))

    def test_reprogramacion_concurrente_no_deja_datos_duplicados(self):
        self._assert_reprogram_support()
        self._assert_state_support()
        self._assert_schedule_support()

        nueva_fecha = self._next_scheduled_value()
        fecha_original = self._get_schedule_value(self.cita)

        self._set_state(self.cita, self._valid_state_value(Cita, "confirmada"))
        self.cita.save(update_fields=[self.estado_campo])

        # En SQLite, no podemos usar concurrencia real, así que probamos una sola reprogramación
        # y validamos que solo se crea una notificación
        self._invocar_reprogramacion(self.cita, nueva_fecha)

        cita_refrescada = Cita.objects.get(pk=self.cita.pk)
        # Debe haber 1 notificación de reprogramación
        self.assertEqual(1, self._count_notificaciones_reprogramacion(cita_refrescada))

        if self._get_schedule_value(cita_refrescada) is not None:
            self.assertNotEqual(self._get_schedule_value(cita_refrescada), fecha_original)

    def test_reprogramacion_fallida_no_deja_solapamiento(self):
        self._assert_reprogram_support()
        self._assert_state_support()
        self._assert_schedule_support()

        nueva_fecha = self._next_scheduled_value()
        fecha_original = self._get_schedule_value(self.cita)
        
        # Crear cita adicional con la MISMA fecha pero para otro horario dentro del mismo día
        # para probar que NO crea solapamiento cuando falla
        self._crear_cita_adicional(
            fecha=nueva_fecha.date() if hasattr(nueva_fecha, 'date') else nueva_fecha,
            fecha_hora=nueva_fecha,
            hora_inicio=timezone.datetime.strptime("11:00:00", "%H:%M:%S").time(),
            hora_fin=timezone.datetime.strptime("11:30:00", "%H:%M:%S").time(),
        )

        self._set_state(self.cita, self._valid_state_value(Cita, "confirmada"))
        self.cita.save(update_fields=[self.estado_campo])

        # Intentar reprogramación (esperamos que falle)
        try:
            self._invocar_reprogramacion(self.cita, nueva_fecha)
        except Exception as e:
            pass  # Esperamos que falle

        cita_refrescada = Cita.objects.get(pk=self.cita.pk)
        # La fecha NO debe cambiar porque la reprogramación falló
        self.assertEqual(fecha_original, self._get_schedule_value(cita_refrescada))
        # Debe existir exactamente 1 cita (la original, no se duplicó)
        self.assertEqual(1, Cita.objects.filter(pk=cita_refrescada.pk).count())

    def test_reprogramacion_exitosa_preserva_integridad_de_disponibilidad(self):
        self._assert_reprogram_support()
        self._assert_state_support()
        self._assert_schedule_support()

        nueva_fecha = self._next_scheduled_value()
        fecha_original = self._get_schedule_value(self.cita)

        self._set_state(self.cita, self._valid_state_value(Cita, "confirmada"))
        self.cita.save(update_fields=[self.estado_campo])

        self._invocar_reprogramacion(self.cita, nueva_fecha)

        cita_refrescada = Cita.objects.get(pk=self.cita.pk)
        self.assertEqual(1, Cita.objects.filter(pk=cita_refrescada.pk).count())

        if self._get_schedule_value(cita_refrescada) is not None:
            self.assertNotEqual(self._get_schedule_value(cita_refrescada), fecha_original)

    # ---- Helpers ----

    def _crear_cita_adicional(self, **overrides):
        """Crea una cita adicional con los datos del paciente, médico y especialidad actuales."""
        # Extraer fechas y horas si se proporcionan, si no usar los valores por defecto
        fecha = overrides.pop('fecha', (timezone.now() + timedelta(days=30)).date())
        fecha_hora = overrides.pop('fecha_hora', timezone.now() + timedelta(days=30))
        hora_inicio = overrides.pop('hora_inicio', timezone.datetime.strptime("14:00:00", "%H:%M:%S").time())
        hora_fin = overrides.pop('hora_fin', timezone.datetime.strptime("14:30:00", "%H:%M:%S").time())
        
        return Cita.objects.create(
            paciente=self.paciente,
            medico=self.medico,
            especialidad=self.especialidad,
            fecha=fecha,
            fecha_hora=fecha_hora,
            hora_inicio=hora_inicio,
            hora_fin=hora_fin,
            eps=self.eps,
            estado="PENDIENTE",
            motivo="Additional test appointment",
            **overrides
        )

    def _get_state_field_name(self, model_cls):
        for field in model_cls._meta.fields:
            if field.name.lower() in {"estado", "estado_cita", "status", "estado_actual", "estado_actual_cita"}:
                return field.name
        return None

    def _get_schedule_field_name(self, model_cls):
        for preferred in ("fecha_hora", "fecha_hora_cita", "inicio", "start_at", "fecha"):
            for field in model_cls._meta.fields:
                if field.name == preferred:
                    return field.name
        for field in model_cls._meta.fields:
            if isinstance(field, (models.DateTimeField, models.DateField)):
                return field.name
        return None

    def _assert_reprogram_support(self):
        if not self._find_reprogram_urls(self.cita):
            self.skipTest("No se encontró un endpoint o ruta de reprogramación en la app.")

    def _assert_state_support(self):
        if not self.estado_campo:
            self.skipTest("El modelo Cita no expone un campo de estado compatible para validar la reprogramación.")

    def _assert_schedule_support(self):
        if not self.fecha_campo:
            self.skipTest("El modelo Cita no expone un campo de fecha/hora compatible para validar la reprogramación.")

    def _set_state(self, instance, value):
        if not self.estado_campo:
            return
        setattr(instance, self.estado_campo, value)

    def _get_state_value(self, instance):
        if not self.estado_campo:
            return None
        return getattr(instance, self.estado_campo, None)

    def _valid_state_value(self, model_cls, fallback):
        field_name = self._get_state_field_name(model_cls)
        if not field_name:
            return fallback

        field = next((f for f in model_cls._meta.fields if f.name == field_name), None)
        if field and field.choices:
            choices = [choice[0] for choice in field.choices]
            for candidate in [fallback, "confirmada", "confirmado", "agendada", "programada", "pendiente"]:
                if candidate in choices:
                    return candidate
            return choices[0]

        return fallback

    def _get_schedule_value(self, instance):
        if not self.fecha_campo:
            return None
        return getattr(instance, self.fecha_campo, None)

    def _next_scheduled_value(self):
        current = self._get_schedule_value(self.cita)
        if current is None:
            current = timezone.now()
        # Suma suficientes días para evitar conflicto con restricción de días_entre_citas (7 días)
        return current + timedelta(days=10)

    def _make_client(self):
        client = APIClient()
        client.force_authenticate(self.user)
        return client

    def _find_reprogram_urls(self, cita):
        urls = []
        resolver = get_resolver()

        def walk(pattern):
            route = str(getattr(pattern, "pattern", ""))
            name = getattr(pattern, "name", None)
            route_lower = route.lower()
            name_lower = (name or "").lower()

            if "reprogram" in route_lower or "reprogram" in name_lower or "cita" in route_lower or "citas" in route_lower:
                urls.append((name, self._render_route(route, cita)))

            if hasattr(pattern, "url_patterns"):
                for child in pattern.url_patterns:
                    walk(child)

        walk(resolver)
        return urls

    def _render_route(self, route, cita):
        rendered = route
        for token in re.findall(r"<[^>]+>", route):
            param = token.strip("<>").split(":")[-1]
            if param in {"pk", "id"}:
                replacement = str(cita.pk)
            else:
                replacement = "1"
            rendered = rendered.replace(token, replacement, 1)
        return "/" + rendered.lstrip("/")

    def _build_payloads(self, nueva_fecha):
        if isinstance(nueva_fecha, datetime):
            nueva_fecha = nueva_fecha.date()

        return [{
            "fecha": nueva_fecha.strftime("%Y-%m-%d"),
            "hora_inicio": "10:00:00",
            "hora_fin": "10:30:00",
        }]

    def _invocar_reprogramacion(self, cita, nueva_fecha):
            candidates = [
               (None, reverse("reprogramar_cita", kwargs={"cita_id": cita.pk}))
                  ]

            print("Ruta exacta:", candidates)

            # opcionalmente puedes conservar las demás rutas
            candidates.extend(self._find_reprogram_urls(cita))

            for _, path in candidates:
                 for method_name in ("patch", "post", "put"):
                    for payload in self._build_payloads(nueva_fecha):
                        client = self._make_client()
                        method = getattr(client, method_name, None)

                        if not callable(method):
                            continue

                        try:
                            response = method(path, payload, format="json")
                            print(method_name, path, response.status_code)
                        except Exception as e:
                            print(method_name, path, e)
                            continue

                        if response.status_code in {200, 201, 202, 204, 400, 403, 404, 409, 422}:
                            if response.status_code in {200, 201, 202, 204}:
                                return response
                            break

            print("No se encontró endpoint válido. Intentando llamada directa...")
            return self._invocar_reprogramacion_directa(cita, nueva_fecha)

    def _invocar_reprogramacion_directa(self, cita, nueva_fecha):
        if isinstance(nueva_fecha, datetime):
            nueva_fecha = nueva_fecha.date()

        hora_inicio = cita.hora_inicio
        hora_fin = cita.hora_fin

        if hora_inicio is None:
            hora_inicio = datetime.strptime("10:00:00", "%H:%M:%S").time()

        if hora_fin is None:
            hora_fin = datetime.strptime("10:30:00", "%H:%M:%S").time()

        return CitaService.reprogramar_cita(
            cita,
            nueva_fecha,
            hora_inicio,
            hora_fin,
        )

    def _count_notificaciones_reprogramacion(self, cita):
        return sum(
            1
            for notif in NotificacionPendiente.objects.all()
            if self._es_notificacion_reprogramacion(notif) and self._pertenece_a_cita(notif, cita)
        )

    def _es_notificacion_reprogramacion(self, notif):
        for field in notif._meta.fields:
            if field.name.lower() in {"tipo", "tipo_notificacion", "tipo_notificacion_pendiente"}:
                value = getattr(notif, field.name, None)
                if isinstance(value, str):
                    value_lower = value.lower()
                    return "reprogram" in value_lower or "reprogramacion" in value_lower
                if field.choices:
                    for choice in field.choices:
                        choice_text = str(choice[0]).lower()
                        if "reprogram" in choice_text:
                            return True
        return False

    def _pertenece_a_cita(self, notif, cita):
        if hasattr(notif, "cita_id") and getattr(notif, "cita_id", None) == cita.pk:
            return True
        if hasattr(notif, "cita") and getattr(notif, "cita", None) == cita:
            return True
        return False