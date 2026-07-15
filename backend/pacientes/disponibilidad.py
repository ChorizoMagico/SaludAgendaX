from datetime import datetime, timedelta, time
from .models import HorarioMedico, Cita, ExcepcionMedico

def calcular_slots_disponibles(medico, fecha_inicio, fecha_fin, duracion_minutos=30):
    """
    Calcula los slots disponibles para un médico en un rango de fechas
    
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
    
    while fecha_actual <= fecha_fin.date():
        # Obtener día de semana (0=Lunes, 6=Domingo)
        dia_semana = fecha_actual.weekday()
        
        # Verificar si hay excepción (día libre, cerrado, etc)
        excepcion = ExcepcionMedico.objects.filter(
            medico=medico,
            fecha=fecha_actual
        ).first()
        
        if excepcion and excepcion.tipo == 'BLOQUEO':
            fecha_actual += timedelta(days=1)
            continue
        
        # Obtener horarios del médico para este día
        horarios = HorarioMedico.objects.filter(
            medico=medico,
            dia_semana=dia_semana,
            activo=True
        )
        
        if not horarios.exists():
            fecha_actual += timedelta(days=1)
            continue
        
        # Para cada horario, generar slots de 30 minutos
        for horario in horarios:
            hora_actual = datetime.combine(fecha_actual, horario.hora_inicio)
            hora_fin = datetime.combine(fecha_actual, horario.hora_fin)
            
            while hora_actual + timedelta(minutes=duracion_minutos) <= hora_fin:
                # Verificar si ya hay cita en este slot
                cita_existe = Cita.objects.filter(
                    medico=medico,
                    fecha_hora=hora_actual,
                    estado__in=['PENDIENTE', 'CONFIRMADA']
                ).exists()
                
                if not cita_existe:
                    slots.append({
                        'fecha_hora': hora_actual.isoformat(),
                        'disponible': True
                    })
                
                hora_actual += timedelta(minutes=duracion_minutos)
        
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