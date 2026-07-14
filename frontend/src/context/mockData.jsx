// src/shared/mockData.js
// ─────────────────────────────────────────────────────────────────────────
// Fuente única de datos simulados para toda la app (auth + dashboards).
// Cuando exista backend, este archivo desaparece y cada dominio consulta su
// propio endpoint (usuarios, citas, catálogos) vía Axios. Mientras tanto,
// AuthContext y los dashboards de paciente/médico/administrativo importan
// todo desde aquí para no tener listas de "usuarios de mentira"
// desincronizadas entre sí.
// ─────────────────────────────────────────────────────────────────────────

// `let`, no `const`: el dashboard administrativo puede agregar/eliminar
// especialidades y sedes en caliente (flujo 2.2 / pantalla 15).
export let ESPECIALIDADES = [
  "Cardiología", "Medicina general", "Pediatría", "Dermatología",
  "Odontología", "Neurología", "Gastroenterología", "Psicología",
  "Ortopedia", "Ginecología", "Radiología", "Urología",
];

// Asignadas por el personal administrativo (flujo 2.2).
export let SEDES = ["Sede Norte", "Sede Sur", "Sede Centro", "Sede Chipichape"];

export const EPS_DISPONIBLES = ["Nueva EPS", "Sura EPS", "Compensar", "Sanitas", "Coosalud"];

// Horario base compartido por todos los médicos por ahora (flujo 2.1).
// Cuando exista backend, cada médico tendrá el suyo propio.
export const HORARIO_BASE = {
  Lunes: { inicio: "08:00", fin: "16:00" },
  Martes: { inicio: "08:00", fin: "16:00" },
  Miércoles: { inicio: "08:00", fin: "12:00" },
  Jueves: { inicio: "08:00", fin: "16:00" },
  Viernes: { inicio: "08:00", fin: "14:00" },
};

export const FRANJAS_MOCK = ["08:00", "08:30", "09:00", "10:00", "10:30", "11:00", "14:00", "14:30"];

// Duración fija de toda cita — usada para marcarla como completada sola
// 30 min después de la hora de inicio (flujo de auto-completado), y para
// detectar solapamientos al bloquear horarios o agendar citas nuevas.
export const DURACION_CITA_MIN = 30;

function citaHaTerminado(cita) {
  const [h, m] = cita.hora.split(":").map(Number);
  const inicio = new Date(`${cita.fecha}T00:00:00`);
  inicio.setHours(h, m, 0, 0);
  return new Date(inicio.getTime() + DURACION_CITA_MIN * 60000) <= new Date();
}

// ---------- Gestión de especialidades (flujo 2.2 / pantalla 15) ----------

export function agregarEspecialidad(nombre) {
  const limpio = (nombre || "").trim();
  if (!limpio) return { ok: false, mensaje: "El nombre de la especialidad no puede estar vacío." };
  if (ESPECIALIDADES.some((e) => e.toLowerCase() === limpio.toLowerCase())) {
    return { ok: false, mensaje: "Esa especialidad ya existe." };
  }
  ESPECIALIDADES = [...ESPECIALIDADES, limpio];
  return { ok: true };
}

export function eliminarEspecialidad(nombre) {
  const enUso = getMedicos().some((m) => m.especialidades.includes(nombre));
  if (enUso) {
    return { ok: false, mensaje: "No puedes eliminar esta especialidad: hay médicos asignados a ella." };
  }
  ESPECIALIDADES = ESPECIALIDADES.filter((e) => e !== nombre);
  return { ok: true };
}

// ---------- Gestión de sedes ----------

export function agregarSede(nombre) {
  const limpio = (nombre || "").trim();
  if (!limpio) return { ok: false, mensaje: "El nombre de la sede no puede estar vacío." };
  if (SEDES.some((s) => s.toLowerCase() === limpio.toLowerCase())) {
    return { ok: false, mensaje: "Esa sede ya existe." };
  }
  SEDES = [...SEDES, limpio];
  return { ok: true };
}

export function eliminarSede(nombre) {
  const enUso = getMedicos().some((m) => m.sede === nombre);
  if (enUso) {
    return { ok: false, mensaje: "No puedes eliminar esta sede: hay médicos asignados a ella." };
  }
  SEDES = SEDES.filter((s) => s !== nombre);
  return { ok: true };
}

// ---------- Usuarios ----------
// `let`, no `const`: mockRegister/agregarUsuarioMock/registrarMedico le
// agregan cuentas nuevas mientras se prueba sin backend.
export let MOCK_USERS = [
  {
    cedula: "1000000001",
    password: "paciente123",
    user: {
      id: 1, rol: "paciente",
      nombre: "Valeria", apellido: "Restrepo",
      correo: "valeria.restrepo@example.com",
      telefono: "3001234567",
      direccion: "Calle 10 # 20-30, Cali",
      eps: "Sura EPS",
      activo: true,
    },
  },
  {
    cedula: "1000000005",
    password: "paciente123",
    user: {
      id: 5, rol: "paciente",
      nombre: "Ana", apellido: "Martínez",
      correo: "ana.martinez@example.com",
      telefono: "3009876543",
      direccion: "Carrera 5 # 12-40, Cali",
      eps: "Nueva EPS",
      activo: true,
    },
  },
  {
    cedula: "1000000002",
    password: "medico123",
    user: {
      id: 2, rol: "medico",
      nombre: "Andrés", apellido: "Mejía",
      correo: "andres.mejia@saludagendax.com",
      telefono: "3101112233",
      direccion: "Av. 6 # 25-10, Cali",
      especialidades: ["Cardiología"],
      sede: "Sede Norte",
      numeroRegistro: "RM-10021",
      titulo: "Especialista en Cardiología",
      activo: true,
    },
  },
  {
    cedula: "1000000006",
    password: "medico123",
    user: {
      id: 6, rol: "medico",
      nombre: "Laura", apellido: "Gómez",
      correo: "laura.gomez@saludagendax.com",
      telefono: "3117778899",
      direccion: "Calle 15 # 8-22, Cali",
      especialidades: ["Medicina general", "Pediatría"],
      sede: "Sede Centro",
      numeroRegistro: "RM-10022",
      titulo: "Médica general, especialista en Pediatría",
      activo: true,
    },
  },
  {
    cedula: "1000000007",
    password: "medico123",
    user: {
      id: 7, rol: "medico",
      nombre: "Camila", apellido: "Torres",
      correo: "camila.torres@saludagendax.com",
      telefono: "3123334455",
      direccion: "Calle 30 # 4-18, Cali",
      especialidades: ["Dermatología"],
      sede: "Sede Sur",
      numeroRegistro: "RM-10023",
      titulo: "Especialista en Dermatología",
      activo: true,
    },
  },
  {
    cedula: "1000000003",
    password: "admin123",
    user: {
      id: 3, rol: "administrativo",
      nombre: "Laura", apellido: "Gómez",
      correo: "laura.admin@saludagendax.com",
      activo: true,
    },
  },
  {
    cedula: "1000000004",
    password: "super123",
    user: {
      id: 4, rol: "superadministrador",
      nombre: "Carlos", apellido: "Ríos",
      correo: "carlos.rios@saludagendax.com",
      activo: true,
    },
  },
];

export function agregarUsuarioMock(nuevo) {
  MOCK_USERS = [...MOCK_USERS, nuevo];
}

// Usado por "Mi perfil" en los dashboards al guardar cambios.
export function actualizarUsuarioMock(id, cambios) {
  MOCK_USERS = MOCK_USERS.map((m) =>
    m.user.id === id ? { ...m, user: { ...m.user, ...cambios } } : m
  );
  return MOCK_USERS.find((m) => m.user.id === id)?.user;
}

// Usado por resetPassword al completar la recuperación de contraseña.
export function actualizarPasswordMock(id, nuevaPassword) {
  MOCK_USERS = MOCK_USERS.map((m) => (m.user.id === id ? { ...m, password: nuevaPassword } : m));
}

// Activa/desactiva una cuenta (médico o paciente). Flujo de administración
// de usuarios: en vez de borrar, se marca activo=false.
export function toggleActivoUsuario(id) {
  MOCK_USERS = MOCK_USERS.map((m) =>
    m.user.id === id ? { ...m, user: { ...m.user, activo: m.user.activo === false ? true : false } } : m
  );
  return MOCK_USERS.find((m) => m.user.id === id)?.user;
}

// ---------- Registro de médicos (flujo 2.1) ----------
// El admin crea el usuario + datos profesionales + especialidades + sede en
// un solo paso. El horario base es compartido por todos los médicos por
// ahora (ver nota en HORARIO_BASE), así que no se configura por médico aquí.
export function registrarMedico({
  cedula,
  password,
  nombre,
  apellido,
  correo,
  telefono,
  direccion,
  especialidades,
  sede,
  numeroRegistro,
  titulo,
}) {
  const nuevoId = MOCK_USERS.reduce((max, m) => Math.max(max, m.user.id), 0) + 1;
  const nuevo = {
    cedula,
    password,
    user: {
      id: nuevoId,
      rol: "medico",
      nombre,
      apellido,
      correo,
      telefono,
      direccion,
      especialidades,
      sede,
      numeroRegistro,
      titulo,
      activo: true,
    },
  };
  MOCK_USERS = [...MOCK_USERS, nuevo];
  return nuevo.user;
}

// ---------- Recuperación de contraseña ----------
// Simula la tabla `password_resets` que tendría el backend real
// (token, usuario, expiración). Cuando exista el backend con Celery, el
// endpoint POST /auth/forgot-password:
//   1) crea este mismo registro de token en la base de datos real
//   2) encola una tarea async en vez de "enviar" nada de inmediato:
//        enviar_correo_recuperacion.delay(correo, token)
//   3) responde al frontend sin esperar a que el correo salga
// El worker de Celery es quien efectivamente llama al proveedor de correo
// (Resend/SendGrid) fuera del ciclo de request/response. Aquí, sin backend
// ni worker, solo generamos el token y lo mostramos en pantalla/consola
// para poder probar el flujo completo.
let passwordResets = []; // { token, userId, expiraEn }

export function crearTokenReset(userId) {
  const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const expiraEn = Date.now() + 30 * 60 * 1000; // 30 minutos, igual que se validaría en el backend
  passwordResets = [...passwordResets.filter((r) => r.userId !== userId), { token, userId, expiraEn }];
  return token;
}

export function validarTokenReset(token) {
  const registro = passwordResets.find((r) => r.token === token);
  if (!registro || Date.now() > registro.expiraEn) return null;
  return registro.userId;
}

export function consumirTokenReset(token) {
  passwordResets = passwordResets.filter((r) => r.token !== token);
}

export function getMedicos() {
  return MOCK_USERS.filter((m) => m.user.rol === "medico").map((m) => m.user);
}

export function getPacientes() {
  return MOCK_USERS.filter((m) => m.user.rol === "paciente").map((m) => m.user);
}

// Igual que getPacientes(), pero incluye la cédula (vive en la entrada de
// MOCK_USERS, no en el objeto user) para poder buscar pacientes por
// documento desde el dashboard administrativo (flujo 5.2 / pantalla 17).
export function getPacientesConCedula() {
  return MOCK_USERS.filter((m) => m.user.rol === "paciente").map((m) => ({ ...m.user, cedula: m.cedula }));
}

export function getMedicoPorId(id) {
  return getMedicos().find((m) => m.id === id);
}

export function getPacientePorId(id) {
  return getPacientes().find((p) => p.id === id);
}

// ---------- Store de citas compartido ----------
// Un mismo arreglo en memoria que leen los dashboards de paciente, médico y
// administrativo, para que una cita agendada por cualquiera de ellos
// aparezca en los demás sin necesidad de backend. Se expone vía
// useSyncExternalStore para que cualquier componente que la use se
// re-renderice al cambiar.
let citas = [
  { id: 1, pacienteId: 1, medicoId: 2, especialidad: "Cardiología", sede: "Sede Norte", fecha: "2026-07-18", hora: "09:00", estado: "agendada", motivo: "Control anual" },
  { id: 2, pacienteId: 1, medicoId: 6, especialidad: "Medicina general", sede: "Sede Centro", fecha: "2026-06-02", hora: "10:00", estado: "completada", motivo: "Chequeo general" },
  { id: 3, pacienteId: 1, medicoId: 7, especialidad: "Dermatología", sede: "Sede Sur", fecha: "2026-05-20", hora: "11:00", estado: "cancelada", motivo: "Revisión de lunar" },
  { id: 4, pacienteId: 5, medicoId: 6, especialidad: "Medicina general", sede: "Sede Centro", fecha: "2026-07-15", hora: "09:00", estado: "agendada", motivo: "Control anual" },
  { id: 5, pacienteId: 5, medicoId: 6, especialidad: "Medicina general", sede: "Sede Centro", fecha: "2026-07-16", hora: "11:00", estado: "agendada", motivo: "Dolor de garganta" },
  { id: 6, pacienteId: 5, medicoId: 6, especialidad: "Pediatría", sede: "Sede Centro", fecha: "2026-07-12", hora: "08:00", estado: "completada", motivo: "Vacunación" },
];

const listeners = new Set();
function emit() {
  listeners.forEach((l) => l());
}

// Revisa todas las citas "agendada"/"reprogramada" y marca como
// "completada" las que ya llevan 30+ min desde su hora de inicio.
// Corre aquí, en el store, para que aplique sin importar qué dashboard
// (paciente, médico o administrativo) esté montado en ese momento.
function revisarCitasVencidas() {
  const vencidas = citas.filter(
    (c) => (c.estado === "agendada" || c.estado === "reprogramada") && citaHaTerminado(c)
  );
  if (vencidas.length === 0) return; // nada cambió: no tocar la referencia del array

  const idsVencidas = new Set(vencidas.map((c) => c.id));
  citas = citas.map((c) => (idsVencidas.has(c.id) ? { ...c, estado: "completada" } : c));
  emit();
}

// Revisión inicial al cargar el módulo + revisión periódica de respaldo,
// para que las citas se completen solas aunque nadie esté leyendo el
// snapshot en ese momento (p. ej. si el usuario deja la pestaña quieta).
revisarCitasVencidas();
setInterval(revisarCitasVencidas, 30000);

export const citasStore = {
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot() {
    // Revisión "al vuelo": garantiza que cualquier componente que lea el
    // store en este instante vea el estado más actualizado posible.
    revisarCitasVencidas();
    return citas;
  },
  agregar(cita) {
    citas = [{ id: Date.now(), ...cita }, ...citas];
    emit();
    return citas[0];
  },
  actualizar(id, cambios) {
    citas = citas.map((c) => (c.id === id ? { ...c, ...cambios } : c));
    emit();
  },
  eliminar(id) {
    citas = citas.filter((c) => c.id !== id);
    emit();
  },
};