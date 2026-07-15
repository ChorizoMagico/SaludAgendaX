from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta

from pacientes.models import Cita, NotificacionPendiente


class Command(BaseCommand):
    """
    Encola recordatorios para citas CONFIRMADAS cuya fecha_hora cae dentro de
    las próximas ~24 horas y que todavía no tienen recordatorio encolado.

    Uso:
        python manage.py enviar_recordatorios

    Pensado para ejecutarse cada hora vía cron / Programador de tareas de
    Windows. Los recordatorios encolados aquí se envían realmente cuando
    corre `procesar_notificaciones` (que sí manda el correo).

    Ejemplo de crontab (cada hora):
        0 * * * * cd /ruta/al/backend && /ruta/al/venv/bin/python manage.py enviar_recordatorios
    """

    help = 'Encola recordatorios de citas que ocurren en las próximas 24 horas.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--ventana-horas',
            type=int,
            default=1,
            help=(
                'Ancho de la ventana (en horas) alrededor de las 24h antes de la '
                'cita en la que se considera "hora de recordar". Con el valor '
                'default (1h) y una ejecución horaria del comando, cada cita se '
                'recuerda una sola vez.'
            ),
        )

    def handle(self, *args, **options):
        ahora = timezone.now()
        ventana = timedelta(hours=options['ventana_horas'])

        objetivo_inicio = ahora + timedelta(hours=24)
        objetivo_fin = objetivo_inicio + ventana

        citas = Cita.objects.select_related('paciente__usuario', 'medico__usuario', 'especialidad').filter(
            estado='CONFIRMADA',
            recordatorio_enviado=False,
            fecha_hora__gte=objetivo_inicio,
            fecha_hora__lt=objetivo_fin,
        )

        encoladas = 0
        for cita in citas:
            NotificacionPendiente.objects.create(
                tipo='recordatorio_cita',
                cita=cita,
                payload={
                    'email_paciente': cita.paciente.usuario.email,
                    'medico_id': cita.medico_id,
                    'fecha': cita.fecha.isoformat() if cita.fecha else None,
                    'hora_inicio': cita.hora_inicio.isoformat() if cita.hora_inicio else None,
                },
            )
            Cita.objects.filter(pk=cita.pk).update(recordatorio_enviado=True)
            encoladas += 1

        self.stdout.write(self.style.SUCCESS(f'Recordatorios encolados: {encoladas}'))
