from datetime import datetime, timedelta, time
from .models import HorarioMedico, Cita, ExcepcionMedico

def calcular_slots_disponibles(medico, fecha_inicio, fecha_fin, duracion_minutos=30):
    """
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
        
    
    excepciones_db = ExcepcionHorario.objects.filter(
        medico=medico,
        fecha__range=[fecha_actual, fecha_limite],
        tipo='BLOQUEO'
    )
    
    dias_bloqueados = {ex.fecha for ex in excepciones_db} 
    
    
    citas_db = Cita.objects.filter(
        medico=medico,
        fecha__range=[fecha_actual, fecha_limite],
        estado__in=['PENDIENTE', 'CONFIRMADA']
    )
    
    citas_ocupadas = {cita.fecha_hora for cita in citas_db} 
    
    
    while fecha_actual <= fecha_limite:
        if fecha_actual in dias_bloqueados:
            fecha_actual += timedelta(days=1)
            continue
            
        dia_semana = fecha_actual.weekday()
        horarios_del_dia = horarios_por_dia[dia_semana]
        
        for horario in horarios_del_dia:
            hora_actual_dt = datetime.combine(fecha_actual, horario.hora_inicio)
            hora_fin_dt = datetime.combine(fecha_actual, horario.hora_fin)
            
            while hora_actual_dt + timedelta(minutes=duracion_minutos) <= hora_fin_dt:
                
                if hora_actual_dt not in citas_ocupadas:
                    slots.append({
                        'fecha_hora': hora_actual_dt.isoformat(),
                        'disponible': True
                    })
                hora_actual_dt += timedelta(minutes=duracion_minutos)
                
        fecha_actual += timedelta(days=1)
        
    return slots

def esta_disponible(medico, fecha, hora_inicio, hora_fin):
    # 1. Verificar excepciones (Prioridad máxima)
    excepcion = ExcepcionHorario.objects.filter(
        medico=medico, fecha=fecha, 
        hora_inicio__lte=hora_inicio, hora_fin__gte=hora_fin
    ).first()
    
    if excepcion:
        return excepcion.tipo == 'EXTRA'
    
    # 2. Verificar horario base
    return HorarioMedico.objects.filter(
        medico=medico, dia_semana=fecha.weekday(),
        hora_inicio__lte=hora_inicio, hora_fin__gte=hora_fin,
        activo=True
    ).exists()