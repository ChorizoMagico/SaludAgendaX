from datetime import time

from django.contrib.auth.models import User
from django.core.management.base import BaseCommand

from pacientes.models import ConfiguracionGlobal, EPS, Especialidad, HorarioMedico, Medico, Sede


EPS_DEMO = [
    ('Sura EPS', 'SURA'),
    ('Nueva EPS', 'NUEVA'),
    ('Sanitas', 'SANITAS'),
    ('Compensar', 'COMPENSAR'),
    ('Coosalud', 'COOSALUD'),
    ('Salud Total', 'SALUDTOTAL'),
    ('Famisanar', 'FAMISANAR'),
]

SEDES_DEMO = [
    ('Sede San Fernando', 'Calle 5 # 36-08, Cali', '6025550101'),
    ('Sede Norte', 'Avenida 6N # 28-45, Cali', '6025550102'),
    ('Sede Sur', 'Carrera 66 # 10-30, Cali', '6025550103'),
]

ESPECIALIDADES_DEMO = [
    ('Medicina General', 'Consulta médica general y valoración inicial.', 60, 7),
    ('Cardiología', 'Prevención, diagnóstico y manejo de enfermedades cardiovasculares.', 24, 14),
    ('Dermatología', 'Atención de enfermedades de la piel, cabello y uñas.', 28, 14),
    ('Ginecología', 'Atención integral de la salud femenina.', 24, 14),
    ('Pediatría', 'Atención médica para niños y adolescentes.', 30, 7),
    ('Odontología', 'Consulta, prevención y tratamiento de salud oral.', 32, 7),
]

MEDICOS_DEMO = [
    ('Laura', 'Martínez', 'laura.martinez@saludagendax.demo', '1000000001', 'RM-DEMO-001', '3000000001', 'Sede San Fernando', ['Medicina General']),
    ('Carlos', 'Rodríguez', 'carlos.rodriguez@saludagendax.demo', '1000000002', 'RM-DEMO-002', '3000000002', 'Sede Norte', ['Cardiología', 'Medicina General']),
    ('Diana', 'Gómez', 'diana.gomez@saludagendax.demo', '1000000003', 'RM-DEMO-003', '3000000003', 'Sede Norte', ['Dermatología']),
    ('Andrés', 'López', 'andres.lopez@saludagendax.demo', '1000000004', 'RM-DEMO-004', '3000000004', 'Sede Sur', ['Ginecología']),
    ('Paula', 'Herrera', 'paula.herrera@saludagendax.demo', '1000000005', 'RM-DEMO-005', '3000000005', 'Sede San Fernando', ['Pediatría']),
    ('Miguel', 'Torres', 'miguel.torres@saludagendax.demo', '1000000006', 'RM-DEMO-006', '3000000006', 'Sede Sur', ['Odontología']),
]


class Command(BaseCommand):
    help = 'Carga EPS, sedes, especialidades, médicos y horarios de demostración sin eliminar datos existentes.'

    def handle(self, *args, **options):
        creados = {'EPS': 0, 'sedes': 0, 'especialidades': 0, 'médicos': 0, 'horarios': 0}

        for nombre, codigo in EPS_DEMO:
            _, creado = EPS.objects.get_or_create(nombre=nombre, defaults={'codigo': codigo, 'activo': True})
            creados['EPS'] += creado

        for nombre, direccion, telefono in SEDES_DEMO:
            _, creado = Sede.objects.get_or_create(
                nombre=nombre,
                defaults={'direccion': direccion, 'telefono': telefono, 'activo': True},
            )
            creados['sedes'] += creado

        especialidades = {}
        for nombre, descripcion, capacidad, dias_entre_citas in ESPECIALIDADES_DEMO:
            especialidad, creado = Especialidad.objects.get_or_create(
                nombre=nombre,
                defaults={
                    'descripcion': descripcion,
                    'capacidad_diaria': capacidad,
                    'dias_entre_citas': dias_entre_citas,
                    'activo': True,
                },
            )
            especialidades[nombre] = especialidad
            creados['especialidades'] += creado

        for nombres, apellidos, email, documento, registro, telefono, nombre_sede, nombres_especialidades in MEDICOS_DEMO:
            medico = Medico.objects.filter(registro_medico=registro).first()
            if medico is None:
                usuario, usuario_creado = User.objects.get_or_create(
                    username=email,
                    defaults={
                        'email': email,
                        'first_name': nombres,
                        'last_name': apellidos,
                    },
                )
                if usuario_creado:
                    # Contraseña exclusiva para pruebas locales; debe cambiarse antes de un uso real.
                    usuario.set_password('DemoSalud2026!')
                    usuario.save(update_fields=['password'])

                medico, medico_creado = Medico.objects.get_or_create(
                    usuario=usuario,
                    defaults={
                        'registro_medico': registro,
                        'num_documento': documento,
                        'telefono': telefono,
                        'sede': Sede.objects.get(nombre=nombre_sede),
                        'activo': True,
                        'estado': 'aprobado',
                    },
                )
                creados['médicos'] += medico_creado

            if medico.sede_id is None:
                medico.sede = Sede.objects.get(nombre=nombre_sede)
                medico.save(update_fields=['sede'])
            medico.especialidades.add(*(especialidades[nombre] for nombre in nombres_especialidades))

            for dia_semana in range(5):
                _, horario_creado = HorarioMedico.objects.get_or_create(
                    medico=medico,
                    dia_semana=dia_semana,
                    hora_inicio=time(8, 0),
                    hora_fin=time(17, 0),
                    defaults={'max_citas_por_hora': 4, 'activo': True},
                )
                creados['horarios'] += horario_creado

        configuracion, _ = ConfiguracionGlobal.objects.get_or_create(pk=1)
        configuracion.contacto_soporte_email = configuracion.contacto_soporte_email or 'soporte@saludagendax.demo'
        configuracion.save(update_fields=['contacto_soporte_email', 'actualizado_en'])

        resumen = ' | '.join(f'{nombre}: {cantidad}' for nombre, cantidad in creados.items())
        self.stdout.write(self.style.SUCCESS(f'Datos de demostración listos. Nuevos registros → {resumen}.'))
