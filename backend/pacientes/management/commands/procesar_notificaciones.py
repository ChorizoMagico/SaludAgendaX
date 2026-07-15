from django.core.management.base import BaseCommand

from pacientes.notificaciones import enviar_notificaciones_pendientes


class Command(BaseCommand):
    """
    Envía los correos de la cola de NotificacionPendiente (confirmación,
    cancelación, reprogramación).

    Uso:
        python manage.py procesar_notificaciones

    Pensado para ejecutarse cada 1-5 minutos vía cron (Linux/Mac) o el
    Programador de tareas de Windows. Ejemplo de crontab:

        */5 * * * * cd /ruta/al/backend && /ruta/al/venv/bin/python manage.py procesar_notificaciones
    """

    help = 'Envía por correo las notificaciones pendientes (confirmación, cancelación, reprogramación).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--limite',
            type=int,
            default=200,
            help='Máximo de notificaciones a procesar en esta ejecución (default: 200).',
        )

    def handle(self, *args, **options):
        resumen = enviar_notificaciones_pendientes(limite=options['limite'])
        self.stdout.write(self.style.SUCCESS(
            f"Procesadas: {resumen['procesadas']} | Enviadas: {resumen['enviadas']} | "
            f"Fallidas: {resumen['fallidas']}"
        ))
