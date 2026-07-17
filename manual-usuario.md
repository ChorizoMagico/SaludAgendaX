# Manual de Usuario — SaludAgendaX

Guía de uso de SaludAgendaX para cada tipo de usuario del sistema: paciente, médico, personal administrativo y superadministrador.

## Acceso al sistema

1. Ingresa a la URL de la aplicación (página principal).
2. Si ya tienes cuenta, selecciona **Iniciar sesión** e ingresa tu correo y contraseña.
3. Si eres paciente nuevo, selecciona **Registrarme** en la página principal.
4. Si olvidaste tu contraseña, usa la opción **¿Olvidaste tu contraseña?** en la pantalla de login: recibirás un correo con un enlace para restablecerla.

---

## 1. Rol: Paciente

### Registro
En la pantalla de registro debes indicar: nombres, apellidos, correo, contraseña, tipo y número de documento, fecha de nacimiento, EPS y (opcional) dirección y teléfono. Al completar el registro, quedas automáticamente autenticado.

### Agendar una cita
1. Desde tu panel, selecciona la especialidad médica que necesitas.
2. Elige un médico disponible para esa especialidad.
3. Selecciona una franja horaria libre en el calendario.
4. Indica el motivo de la consulta y confirma.

> El sistema valida automáticamente: disponibilidad real del médico, límites de tu EPS, frecuencia mínima entre citas de la misma especialidad, capacidad diaria de la especialidad, y que no tengas ya una cita en ese horario. Si alguna regla no se cumple, verás un mensaje explicando por qué no se pudo agendar.

### Consultar tu historial y calendario
Desde tu panel puedes ver todas tus citas (pasadas y futuras) y su estado: **Pendiente**, **Confirmada** o **Cancelada**.

### Cancelar una cita
Selecciona la cita desde tu historial y elige **Cancelar**. Puedes indicar un motivo opcional. Ten en cuenta que el sistema limita a 3 el número de cancelaciones en un período de 30 días.

### Reprogramar una cita
Selecciona la cita y elige **Reprogramar**; escoge nueva fecha y horario. Se valida contra las mismas reglas que una cita nueva.

### Editar tu perfil
Puedes actualizar tus datos de contacto (nombre, dirección, teléfono) desde la sección de perfil.

---

## 2. Rol: Médico

### Registro
Los médicos se autorregistran indicando: nombres, apellidos, correo, contraseña, documento, teléfono, número de registro médico y especialidad.

> **Importante:** tu cuenta queda en estado **pendiente de autorización** después del registro. No podrás iniciar sesión hasta que un superadministrador revise y apruebe tu solicitud. Recibirás un correo cuando esto ocurra.

### Consultar tu agenda
Una vez tu cuenta esté aprobada, al iniciar sesión accedes a **Mi Agenda**, donde puedes ver todas las citas asignadas a ti: fecha, hora, paciente, especialidad, motivo y estado.

---

## 3. Rol: Administrativo

### Registro
Igual que el médico, te autorregistras (nombres, apellidos, correo, contraseña, documento, teléfono y cargo) y tu cuenta queda **pendiente** hasta ser aprobada por un superadministrador.

### Panel administrativo
Una vez aprobado, tienes acceso a:
- **Gestión de citas:** ver, crear citas en nombre de un paciente y consultar el listado general.
- **Gestión de pacientes:** consulta y administración de los pacientes registrados.
- **Gestión de médicos y especialidades:** registrar especialidades, asignar médicos a especialidades y definir sus horarios de atención.
- **Reportes:** estadísticas de ocupación por médico, especialidad y EPS, y métricas del panel (citas del día, canceladas, pendientes).

### Crear una cita en nombre de un paciente
Desde **Gestión de citas**, selecciona el paciente, la especialidad, el médico y la franja horaria disponible; el sistema aplica exactamente las mismas reglas de negocio que si el paciente la agendara por sí mismo (no hay excepciones para el rol administrativo).

---

## 4. Rol: Superadministrador

El superadministrador tiene el nivel de acceso más alto y configura las reglas de negocio y parámetros globales del sistema.

### Solicitudes pendientes
En **Solicitudes pendientes** revisas las cuentas de médicos y administrativos recién autorregistradas. Por cada solicitud puedes:
- **Aprobar:** la cuenta se activa de inmediato y el usuario recibe un correo de confirmación; si es administrativo, queda asignado al grupo correspondiente.
- **Rechazar:** puedes indicar un motivo; el usuario recibe un correo notificando el rechazo.

### Topes por EPS
En **Topes EPS** defines, por cada aseguradora, el número máximo de citas permitidas en un período (semanal o mensual) y, opcionalmente, un presupuesto máximo. Cuando el uso de una EPS llega al 80% de su tope, el sistema te alertará automáticamente por correo (una sola vez por período).

### Alertas de topes
En **Alertas de topes** puedes consultar el historial de alertas ya enviadas, filtrando por EPS.

### Restricciones de frecuencia
En **Restricciones de frecuencia** configuras, por especialidad, cuántos días mínimos deben pasar entre dos citas de un mismo paciente en esa especialidad.

### Reportes de topes
Consulta el uso acumulado de los topes configurados por EPS para el período vigente.

### Configuración global
Define parámetros generales del sistema: horario de apertura y cierre de atención, anticipación mínima (horas) y máxima (días) permitida para agendar una cita, y el correo de contacto de soporte.

### Sedes y feriados
Administra las sedes físicas de la institución y los días feriados: un feriado registrado bloquea automáticamente el agendamiento de citas en esa fecha para todos los pacientes.

---

## Notificaciones por correo

El sistema envía notificaciones automáticas por correo electrónico en los siguientes casos:
- Confirmación de una cita nueva.
- Cancelación de una cita.
- Reprogramación de una cita.
- Recordatorio 24 horas antes de una cita confirmada.
