from datetime import datetime, timedelta, time
from .models import HorarioMedico, Cita, ExcepcionMedico

def calcular_slots_disponibles(medico, fecha_inicio, fecha_fin, duracion_minutos=30):
    """
    Calcula los slots disponibles para un médico en un rango de fechas. Optimizado.
    Calcula los slots disponibles para un médico en un rango de fechas. Optimizado.
    
    Args:
        medico: instancia de Medico
        fecha_inicio: datetime de inicio
        fecha_fin: datetime de fin
        duracion_minutos: duración de cada cita (default 30)
    
    Returns:
        Lista de diccionarios con slots disponibles
    """
    slots = []
    fecha_actual = fecha_inicio.date()
    fecha_limite = fecha_fin.date()

    horarios_db = HorarioMedico.objects.filter(medico=medico, activo=True)

    horarios_por_dia = {i: [] for i in range(7)}
    for h in horarios_db:
        horarios_por_dia[h.dia_semana].append(h)
        
        # Verificar si hay excepción (día libre, cerrado, etc)
        excepcion = ExcepcionMedico.objects.filter(
            medico=medico,
            fecha=fecha_actual
        ).first()
        
        if excepcion and not excepcion.disponible:
            fecha_actual += timedelta(days=1)
            continue

        dia_semana = fecha_actual.weekday()
        horarios_del_dia = horarios_por_dia[dia_semana]
        bloqueos_horario_dia = bloqueos_horario_por_dia.get(fecha_actual, [])
        bloqueos_medico_dia = bloqueos_medico_por_dia.get(fecha_actual, [])

        for horario in horarios_del_dia:
            hora_actual_dt = datetime.combine(fecha_actual, horario.hora_inicio)
            hora_fin_dt = datetime.combine(fecha_actual, horario.hora_fin)

            while hora_actual_dt + timedelta(minutes=duracion_minutos) <= hora_fin_dt:
                hora_slot_inicio = hora_actual_dt.time()
                hora_slot_fin = (hora_actual_dt + timedelta(minutes=duracion_minutos)).time()

                bloqueado = _bloqueado_por_rango(bloqueos_horario_dia, hora_slot_inicio, hora_slot_fin) or \
                    _bloqueado_por_rango(bloqueos_medico_dia, hora_slot_inicio, hora_slot_fin)

                if not bloqueado:
                    ocupadas = citas_por_slot.get((fecha_actual, hora_slot_inicio), 0)
                    if ocupadas < horario.max_citas_por_hora:
                        slots.append({
                            'fecha_hora': hora_actual_dt.isoformat(),
                            'disponible': True,
                            'cupos_restantes': horario.max_citas_por_hora - ocupadas,
                        })
                hora_actual_dt += timedelta(minutes=duracion_minutos)

        fecha_actual += timedelta(days=1)

    return slots

def esta_disponible(medico, fecha, hora_inicio, hora_fin):
    """Verifica si un médico tiene disponibilidad base en una franja puntual.

    No considera cupos ni citas ya agendadas: para eso usar CitaService,
    que además aplica bloqueo (select_for_update) contra condiciones de carrera.
    """
    # 1. Permisos/vacaciones de día completo o parcial (máxima prioridad).
    bloqueo_medico = ExcepcionMedico.objects.filter(medico=medico, fecha=fecha, activo=True)
    if bloqueo_medico.filter(hora_inicio__isnull=True, hora_fin__isnull=True).exists():
        return False
    if bloqueo_medico.filter(hora_inicio__lt=hora_fin, hora_fin__gt=hora_inicio).exists():
        return False

    # 2. Excepciones puntuales de horario (bloqueo u horario extra).
    excepcion = ExcepcionHorario.objects.filter(
        medico=medico, fecha=fecha,
        hora_inicio__lte=hora_inicio, hora_fin__gte=hora_fin
    ).first()

    if excepcion:
        return excepcion.tipo == 'EXTRA'

    # 3. Horario base semanal.
    return HorarioMedico.objects.filter(
        medico=medico, dia_semana=fecha.weekday(),
        hora_inicio__lte=hora_inicio, hora_fin__gte=hora_fin,
        activo=True
    ).exists()