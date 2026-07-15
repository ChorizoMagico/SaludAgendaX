## HU-005: Pruebas de integración  - Flujo Médico / Especialidad

### Objetivo
Se busca validar el flujo completo de creación de especialidad, asignación de médico y agendamiento de cita, comprobando que la relación `Medico <-> Especialidad` se mantiene y que el backend responde con el formato esperado.


- Módulo de tests: `backend/pacientes/test_citas_endpoint.py`
- Clase: `CitasEndpointTests`
- Total de tests en el módulo: 12
- Total de tests en `CitasEndpointTests`: 7

## Distincion

El módulo `test_citas_endpoint.py` contiene dos clases de pruebas:
- `EspecialidadEndpointTests`
- `CitasEndpointTests`

Por eso, cuando ejecutas `python manage.py test pacientes.test_citas_endpoint` se detectan 12 tests en todo el archivo, pero al ejecutar `python manage.py test pacientes.test_citas_endpoint.CitasEndpointTests` solo se ejecutan los 7 tests de esa clase específica.

### Cambios aplicados
- `backend/pacientes/disponibilidad.py`: importación de `ExcepcionHorario`.
- `backend/pacientes/views.py`: importación de `HorarioMedico` y respuesta `{"status": "success", "data": ...}`.
- `backend/pacientes/services.py`: validación de frecuencia de citas usa `paciente` como clave de error.

### Casos clave
| Test | Descripción | Resultado |
|------|-------------|-----------|
| `test_full_flow_medico_especialidad_relationship` | Flujo completo de especialidad, médico y agendamiento de cita | Pasa |
| `test_rechaza_cita_por_frecuencia_paciente` | Rechazo por restricción de frecuencia de paciente | Pasa |

### Cómo se ejecuta?
Desde `backend`:

```powershell
cd C:\Users\User\Documents\Cosas de Checho\Programas\Gits\SaludAgendaX\backend
.\.venv\Scripts\python.exe manage.py test pacientes.test_citas_endpoint.CitasEndpointTests
```

Para ejecutar solo un caso específico dentro de la clase `CitasEndpointTests`:

```powershell
.\.venv\Scripts\python.exe manage.py test pacientes.test_citas_endpoint.CitasEndpointTests.test_full_flow_medico_especialidad_relationship
```

```powershell
.\.venv\Scripts\python.exe manage.py test pacientes.test_citas_endpoint.CitasEndpointTests.test_rechaza_cita_por_frecuencia_paciente
```

Para ejecutar todos los tests del módulo completo (incluye también `EspecialidadEndpointTests`):

```powershell
.\.venv\Scripts\python.exe manage.py test pacientes.test_citas_endpoint
```

### Archivos importantes para esta prueba que se hizo

- `backend/pacientes/test_citas_endpoint.py`
- `backend/pacientes/disponibilidad.py`
- `backend/pacientes/views.py`
- `backend/pacientes/services.py`


