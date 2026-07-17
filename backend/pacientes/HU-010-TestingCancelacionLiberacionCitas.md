# HU-010: Pruebas de cancelación de citas y liberación de cupos

## Objetivo
Validar que al cancelar una cita el sistema:
- cambia el estado de la cita a `CANCELADA`;
- libera el cupo del médico para ese horario;
- vuelve a mostrar ese slot como disponible en el endpoint de disponibilidad;
- permite reagendar una nueva cita en ese mismo horario.

## Alcance de la prueba
Se implementó una prueba de integración en:
- `backend/pacientes/test_citas_endpoint.py`
- Clase: `CancelacionCitaTests`
- Método: `test_cancelar_cita_libera_cupo_y_reaparece_en_disponibilidad`


## Qué valida el test
El caso de prueba cubre de forma integrada tres validaciones principales:

1. Cancelación de la cita
   - El paciente cancela una cita existente mediante el endpoint de cancelación.
   - Se verifica que la cita quede en estado `CANCELADA`.

2. Liberación de cupos
   - Se comprueba que, tras la cancelación, el horario ya no siga ocupado para el médico.
   - Esto se valida mediante la disponibilidad del médico para ese mismo día y horario.

3. Redisponibilidad del slot
   - Se intenta reagendar una nueva cita en el mismo horario.
   - Si el sistema ha liberado correctamente el cupo, la nueva cita puede crearse sin error.

### Cómo se ejecuta?

Desde `backend`:

```powershell
cd C:\Users\User\Documents\Cosas de Checho\Programas\Gits\SaludAgendaX\backend
.\.venv\Scripts\python.exe manage.py test pacientes.test_citas_endpoint.CancelacionCitaTests
```

## Checklist temporal para el testeo manual

1. Crear un médico con un horario disponible para una fecha específica.
   - Verificar que el médico exista y que tenga configurado un rango horario válido para ese día.

2. Crear un paciente y asociarlo a una EPS válida.
   - Confirmar que el paciente quede registrado correctamente y que su EPS esté activa.

3. Crear una cita válida para ese médico y ese paciente en un horario concreto.
   - Asegurarse de que la cita se genere con estado inicial válido y que no choque con otros horarios del médico.

4. Confirmar que la cita aparece como activa en la agenda o en el historial del paciente.
   - Revisar la respuesta del sistema o la vista correspondiente para comprobar que la cita está registrada y visible.

5. Ejecutar el endpoint de cancelación de la cita.
   - Enviar la solicitud de cancelación y verificar que el sistema responda correctamente.

6. Verificar que la cita cambia a estado `CANCELADA`.
   - Consultar la cita nuevamente y comprobar que el estado ya no sea activo, sino cancelado.

7. Consultar la disponibilidad del médico para ese mismo día y horario.
   - Llamar al endpoint de disponibilidad y revisar si el slot solicitado aparece en la lista.

8. Confirmar que el slot vuelve a aparecer como disponible.
   - Validar que el horario previamente ocupado ahora se muestre como disponible para nueva reserva.

9. Intentar agendar una nueva cita en ese mismo horario.
   - Probar la creación de otra cita en ese mismo slot y verificar que no haya bloqueos indebidos.

10. Validar que la nueva cita se crea correctamente sin errores.
    - Comprobar que la respuesta de creación sea exitosa y que la nueva cita quede registrada.

### Archivos importantes para esta prueba que se hizo

- `backend/pacientes/test_citas_endpoint.py`
- `backend/pacientes/views.py`
- `backend/pacientes/disponibilidad.py`
