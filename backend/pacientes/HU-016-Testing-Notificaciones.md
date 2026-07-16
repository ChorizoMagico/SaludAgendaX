# HU-016: Testing de Notificaciones - Documentación

## Resumen
Suite completa de testing para el módulo de notificaciones por email (HU-016). Valida el envío, recepción y procesamiento de 4 tipos de notificaciones con mock SMTP en diferentes escenarios.

## Configuración de Testing

### Email Backend
```python
@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
```
- Usa el backend en memoria de Django para testing
- No envía emails reales, los almacena en `django.core.mail.outbox`
- Acceso sincrónico a los emails sin necesidad de SMTP real

## Tipos de Notificaciones Probadas

### 1. Confirmación de Cita
- **Tipo**: `confirmacion_cita`
- **Trigger**: Cuando se crea una cita confirmada
- **Contenido**: Fecha, hora, médico, especialidad
- **Asunto**: "SaludAgendaX - Confirmación de tu cita"

### 2. Cancelación de Cita
- **Tipo**: `cancelacion_cita`
- **Trigger**: Cuando se cancela una cita
- **Contenido**: Fecha original, hora, motivo de cancelación
- **Asunto**: "SaludAgendaX - Cita cancelada"

### 3. Reprogramación de Cita
- **Tipo**: `reprogramacion_cita`
- **Trigger**: Cuando se reprograma una cita (HU-013)
- **Contenido**: Fecha/hora anterior, fecha/hora nueva
- **Asunto**: "SaludAgendaX - Cita reprogramada"

### 4. Recordatorio (24h)
- **Tipo**: `recordatorio_cita`
- **Trigger**: Management command `enviar_recordatorios` ejecutado ~24h antes
- **Contenido**: Recordatorio de cita al día siguiente
- **Asunto**: "SaludAgendaX - Recordatorio de tu cita mañana"

## Escenarios de Testing (16 tests)

### ✅ Escenarios de Envío Correcto
1. **test_envio_notificacion_confirmacion_cita**
   - Verifica envío correcto de confirmación
   - Valida contenido, destinatario, asunto
   - Comprueba transición de estado: pendiente → enviada

2. **test_envio_notificacion_cancelacion_cita**
   - Verifica envío correcto de cancelación
   - Valida motivo de cancelación en email
   - Comprueba estado final

3. **test_envio_notificacion_reprogramacion_cita**
   - Verifica envío correcto de reprogramación
   - Valida fechas/horas anterior y nueva
   - Comprueba marcas de transición temporal

4. **test_envio_notificacion_recordatorio_cita**
   - Verifica envío correcto de recordatorio
   - Valida mención de "mañana" en asunto
   - Comprueba contenido del recordatorio

### ✅ Escenarios de Destinatario
5. **test_usa_email_del_payload_si_existe**
   - Verifica que usa email del payload cuando está disponible
   - Ignora email del usuario si hay alternativa en payload
   - Casos: redirect, forwarding, múltiples emails

6. **test_usa_email_del_usuario_si_no_hay_en_payload**
   - Fallback a email del usuario del paciente
   - Verifica lógica por defecto
   - Garantiza que siempre hay destino

7. **test_envio_a_destinatario_correcto**
   - Verifica envío a múltiples pacientes
   - Validar que cada email va al destinatario correcto
   - Evita cross-contamination entre usuarios

### ✅ Escenarios de Estados
8. **test_transicion_de_estados_correcta**
   - Valida flujo: pendiente → procesando → enviada
   - Verifica que la notificación se actualiza correctamente
   - Comprueba atomicidad de cambios

9. **test_no_reenviar_notificaciones_ya_enviadas**
   - No reenvía notificaciones en estado 'enviada'
   - Verifica que el filtro funciona correctamente
   - Evita duplicados

10. **test_no_reenviar_notificaciones_fallidas**
    - No reprocesa notificaciones en estado 'fallida'
    - Permite reintentos manuales sin auto-reprocessing
    - Protege contra loops infinitos

11. **test_procesa_solo_notificaciones_pendientes**
    - Filtra correctamente por estado 'pendiente'
    - Ignora estados procesando, enviada, fallida
    - Validar query SELECT en DB

### ✅ Escenarios de Volumen y Límites
12. **test_respeta_limite_procesamiento**
    - Valida que respeta límite de 5 notificaciones
    - Crea 15, procesa 5, quedan 10 pendientes
    - Comprueba paginación de carga

13. **test_multiples_notificaciones_tipos_diferentes**
    - Procesa 4 tipos diferentes en una ejecución
    - Valida que cada uno genera email correcto
    - Comprueba asuntos diferentes

14. **test_notificaciones_concurrentes_sin_duplicados**
    - Crea 3 notificaciones del mismo tipo
    - Verifica que todas se procesan
    - Valida que no hay duplicados en DB

### ✅ Escenarios de Payload y Contenido
15. **test_preserva_contenido_payload_en_email**
    - Verifica que el payload se refleja en el email
    - Valida que datos dinámicos se insertan correctamente
    - Comprueba que el motivo de cancelación aparece

### ✅ Escenarios de Error y Recuperación
16. **test_manejo_de_error_en_envio**
    - Valida que notificaciones se procesan incluso con payload parcial
    - Verifica que no crash por datos incompletos
    - Comprueba resiliencia del sistema

## Configuración de Payload

Ejemplo de payloads para cada tipo:

```python
# Confirmación
{
    'email_paciente': 'paciente@example.com',
    'fecha': '2026-07-23',
    'hora_inicio': '10:00:00',
}

# Cancelación
{
    'email_paciente': 'paciente@example.com',
    'fecha': '2026-07-23',
    'hora_inicio': '10:00:00',
    'motivo': 'Urgencia médica del doctor',
}

# Reprogramación
{
    'email_paciente': 'paciente@example.com',
    'fecha_anterior': '2026-07-23',
    'hora_inicio_anterior': '10:00:00',
    'fecha_nueva': '2026-07-26',
    'hora_inicio_nueva': '14:00:00',
}

# Recordatorio
{
    'email_paciente': 'paciente@example.com',
    'fecha': '2026-07-23',
    'hora_inicio': '10:00:00',
}
```

## Ejecución de Tests

```bash
# Ejecutar todos los tests de HU-016
python manage.py test pacientes.test_notificaciones_hu016 -v 2

# Ejecutar test específico
python manage.py test pacientes.test_notificaciones_hu016.NotificacionesHU016Tests.test_envio_notificacion_confirmacion_cita -v 2

# Con coverage
coverage run --source='pacientes' manage.py test pacientes.test_notificaciones_hu016
coverage report
```

## Resultados

```
Ran 16 tests in 41.979s
OK
```

### Cobertura Lograda
- ✅ 4 tipos de notificaciones diferentes
- ✅ Manejo de destinatarios (payload vs usuario)
- ✅ Estados y transiciones (pendiente → procesando → enviada/fallida)
- ✅ Límites de procesamiento
- ✅ Volumen (múltiples notificaciones, sin duplicados)
- ✅ Contenido y payload dinámico
- ✅ Resiliencia ante errores

## Integración con el Sistema

### Management Commands
```bash
# Encolar recordatorios (cada hora)
python manage.py enviar_recordatorios

# Procesar notificaciones (cada 5 minutos)
python manage.py procesar_notificaciones --limite 200
```

### Flujo de Datos
1. Cita creada/modificada → CitaService encola NotificacionPendiente
2. Management command detecta pendientes
3. `enviar_notificaciones_pendientes()` procesa cola
4. Django core.mail envía via SMTP (real) o console (dev)
5. Estado se actualiza: enviada o fallida

## Notas de Implementación

- **Backend en Testing**: `locmem.EmailBackend` para velocidad y aislamiento
- **Backend en Producción**: Configurar via .env (Gmail, AWS SES, etc.)
- **Retry Logic**: Actualmente no hay retry automático (estado final es 'fallida')
- **Logging**: Captura excepciones en logger para debugging

## Próximos Pasos

1. Agregar tests de management commands
2. Implementar retry automático con Celery
3. Agregar tests de rendimiento (benchmark de 1000+ notificaciones)
4. Implementar templates de email (en lugar de strings hardcoded)
5. Agregar validación de email en payload
