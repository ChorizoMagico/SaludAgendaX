"""
Envío de notificaciones por correo (HU-016).

Las citas encolan registros en NotificacionPendiente (confirmación al crear,
cancelación al cancelar, reprogramación al reprogramar). Los recordatorios de
24h se encolan aparte por el management command `enviar_recordatorios`.

Este módulo NO decide cuándo se encola una notificación (eso vive en
CitaService / views.py); solo sabe cómo redactar y enviar las que ya están
en la cola con estado='pendiente'.
"""

import logging

from django.core.mail import send_mail
from django.conf import settings

from .models import NotificacionPendiente

logger = logging.getLogger(__name__)


def _construir_email(notificacion):
    """Devuelve (asunto, mensaje) según el tipo de notificación."""
    payload = notificacion.payload or {}
    cita = notificacion.cita

    if notificacion.tipo == 'confirmacion_cita':
        asunto = 'SaludAgendaX - Confirmación de tu cita'
        mensaje = (
            f"Hola,\n\n"
            f"Tu cita ha sido confirmada para el {payload.get('fecha')} "
            f"a las {payload.get('hora_inicio')}.\n\n"
            f"Médico: {cita.medico}\n"
            f"Especialidad: {cita.especialidad.nombre}\n\n"
            f"SaludAgendaX"
        )
    elif notificacion.tipo == 'cancelacion_cita':
        asunto = 'SaludAgendaX - Cita cancelada'
        mensaje = (
            f"Hola,\n\n"
            f"Tu cita del {payload.get('fecha')} a las {payload.get('hora_inicio')} "
            f"ha sido cancelada.\n"
            f"Motivo: {payload.get('motivo') or 'No especificado'}\n\n"
            f"SaludAgendaX"
        )
    elif notificacion.tipo == 'reprogramacion_cita':
        asunto = 'SaludAgendaX - Cita reprogramada'
        mensaje = (
            f"Hola,\n\n"
            f"Tu cita fue reprogramada.\n"
            f"Antes: {payload.get('fecha_anterior')} {payload.get('hora_inicio_anterior')}\n"
            f"Ahora: {payload.get('fecha_nueva')} {payload.get('hora_inicio_nueva')}\n\n"
            f"SaludAgendaX"
        )
    elif notificacion.tipo == 'recordatorio_cita':
        asunto = 'SaludAgendaX - Recordatorio de tu cita mañana'
        mensaje = (
            f"Hola,\n\n"
            f"Te recordamos tu cita de mañana {payload.get('fecha')} "
            f"a las {payload.get('hora_inicio')} con {cita.medico} "
            f"({cita.especialidad.nombre}).\n\n"
            f"SaludAgendaX"
        )
    else:
        asunto = 'SaludAgendaX - Notificación'
        mensaje = f"Notificación relacionada con tu cita #{cita.id}."

    return asunto, mensaje


def enviar_notificaciones_pendientes(limite=200):
    """
    Procesa la cola de NotificacionPendiente y envía los correos reales.

    Pensado para ejecutarse periódicamente vía el management command
    `procesar_notificaciones` (programado con cron / Task Scheduler).

    Retorna un resumen {'enviadas': int, 'fallidas': int, 'procesadas': int}.
    """
    pendientes = NotificacionPendiente.objects.select_related(
        'cita__paciente__usuario', 'cita__medico__usuario', 'cita__especialidad'
    ).filter(estado='pendiente')[:limite]

    enviadas = 0
    fallidas = 0

    for notificacion in pendientes:
        NotificacionPendiente.objects.filter(pk=notificacion.pk).update(estado='procesando')
        try:
            asunto, mensaje = _construir_email(notificacion)
            destinatario = notificacion.payload.get('email_paciente') or notificacion.cita.paciente.usuario.email
            send_mail(asunto, mensaje, settings.DEFAULT_FROM_EMAIL, [destinatario])
        except Exception:
            logger.exception('Fallo enviando notificación %s (tipo=%s)', notificacion.pk, notificacion.tipo)
            NotificacionPendiente.objects.filter(pk=notificacion.pk).update(estado='fallida')
            fallidas += 1
            continue

        NotificacionPendiente.objects.filter(pk=notificacion.pk).update(estado='enviada')
        enviadas += 1

    return {'enviadas': enviadas, 'fallidas': fallidas, 'procesadas': enviadas + fallidas}
