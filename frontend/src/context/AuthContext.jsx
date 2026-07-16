import { createContext, useContext, useState, useEffect, useRef, useCallback } from "react";
import {
  MOCK_USERS,
  agregarUsuarioMock,
  actualizarUsuarioMock,
  actualizarPasswordMock,
  crearTokenReset,
  validarTokenReset,
  consumirTokenReset,
  subscribeUsuarios,
  getUsuarioPorId,
} from "./mockData";
import axiosClient from "../api/axiosClient";

const AuthContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────
// Sesión con expiración por inactividad.
// Se guarda todo en sessionStorage bajo una sola clave ("session"), como
// { token, user, expiraEn }. sessionStorage (a diferencia de localStorage)
// se borra solo al cerrar la pestaña/navegador, lo cual combina bien con
// una sesión que además expira por tiempo.
// ─────────────────────────────────────────────────────────────────────────
const SESSION_KEY = "session";
const SESSION_DURATION_MS = 20 * 60 * 1000; // 20 minutos

function leerSesion() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function guardarSesion(token, user, expiraEn, refresh = null) {
  // `refresh` es opcional porque las sesiones mock no tienen uno real; en
  // ese caso axiosClient simplemente no intentará renovar (ver interceptor).
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, expiraEn, refresh }));
}

function borrarSesion() {
  sessionStorage.removeItem(SESSION_KEY);
}

// ─────────────────────────────────────────────────────────────────────────
// MOCK — bórralo (junto con USE_MOCK, mockLogin y mockRegister) cuando el
// backend real de /auth esté listo. MOCK_USERS ahora vive en
// shared/mockData.js, para que los dashboards de paciente y médico lean
// exactamente los mismos usuarios que este contexto usa para el login.
// ─────────────────────────────────────────────────────────────────────────
// USE_MOCK ahora se controla con VITE_USE_MOCK (ver .env.example).
// Por defecto sigue en true (comportamiento anterior sin cambios) a menos
// que se ponga explícitamente VITE_USE_MOCK=false.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

// ─────────────────────────────────────────────────────────────────────────
// Conexión real al backend.
//
// Los 3 roles autorregistrables (paciente/medico/administrativo) ya tienen
// login/registro reales (punto 1). medico/administrativo se registran
// 'pendientes' — el backend no emite tokens para ellos (ver realRegisterMedico
// / realRegisterAdministrativo más abajo), así que register() más adelante
// no crea sesión para esos casos. superadministrador sigue sin autorregistro
// (Register.jsx ni siquiera lo ofrece como opción) y perfil/citas/dashboard
// de médico/administrativo todavía no tienen su propio endpoint, así que esas
// pantallas (fuera de login/registro) siguen en mock por ahora.
// ─────────────────────────────────────────────────────────────────────────
async function realLogin(cedula, password) {
  // El backend recibe el campo `username` de SimpleJWT, pero internamente
  // ahora acepta también el número de documento (cédula) y lo resuelve al
  // username real, sin importar el rol (paciente/medico/administrativo) —
  // ver PacienteTokenSerializer en el backend.
  const { data } = await axiosClient.post("/login/", { username: cedula, password });
  return { data: { token: data.access, refresh: data.refresh, user: data.user } };
}

async function realRegisterPaciente(datos) {
  const { data } = await axiosClient.post("/registro/", {
    email: datos.correo,
    password: datos.password,
    password_confirm: datos.confirmPassword ?? datos.password,
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    tipo_documento: datos.tipoDocumento ?? "CC",
    num_documento: datos.cedula,
    fecha_nacimiento: datos.fechaNacimiento,
    eps_id: datos.epsId,
    direccion: datos.direccion ?? "",
    telefono: datos.telefono ?? "",
  });
  return { data: { token: data.access, refresh: data.refresh, user: data.user } };
}

// NOTA (conexion FE-BE, punto 1): a diferencia de realRegisterPaciente, el
// backend NO devuelve access/refresh acá — la cuenta queda 'pendiente' hasta
// que un superadministrador la aprueba (ver AprobarSolicitudView), así que
// no hay token que guardar todavía. register() más abajo no crea sesión
// cuando `pendiente` viene en true.
async function realRegisterMedico(datos) {
  const { data } = await axiosClient.post("/medicos/registro/", {
    email: datos.correo,
    password: datos.password,
    password_confirm: datos.confirmPassword ?? datos.password,
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    num_documento: datos.cedula,
    telefono: datos.telefono ?? "",
    especialidad: datos.especialidad,
    registro_medico: datos.numeroRegistroMedico,
  });
  return { data };
}

async function realRegisterAdministrativo(datos) {
  const { data } = await axiosClient.post("/administrativos/registro/", {
    email: datos.correo,
    password: datos.password,
    password_confirm: datos.confirmPassword ?? datos.password,
    nombres: datos.nombres,
    apellidos: datos.apellidos,
    num_documento: datos.cedula,
    telefono: datos.telefono ?? "",
  });
  return { data };
}

// NOTA (conexion FE-BE): recuperar/restablecer contraseña ya usan el
// backend real (antes seguían siempre en mock). El backend firma el reset
// con `uidb64` + `token` (no solo `token`, como hacía el mock), por eso
// `resetPassword` ahora recibe ambos valores (ver ResetPassword.jsx).
async function realForgotPassword(correo) {
  const { data } = await axiosClient.post("/recuperar-contrasena/", { email: correo });
  return { data: { enviado: true, mensaje: data.mensaje } };
}

// NOTA (conexion FE-BE): /perfil/ (PUT) ya funciona en el backend y ahora
// también devuelve `telefono`. Solo se usa para rol "paciente": el email no
// es editable ahí (en el backend viene de User.email, de solo lectura), así
// que ese campo del formulario se ignora silenciosamente si el usuario lo
// cambia. EPS tampoco se envía (no es editable por el paciente).
async function realUpdateProfile(cambios) {
  const { data } = await axiosClient.put("/perfil/", {
    primer_nombre: cambios.nombre,
    apellido: cambios.apellido,
    telefono: cambios.telefono,
    direccion: cambios.direccion,
  });
  return data.paciente;
}

async function realResetPassword(uidb64, token, nuevaPassword) {
  const { data } = await axiosClient.post("/reset-contrasena/", {
    uidb64,
    token,
    nueva_contrasena: nuevaPassword,
    nueva_contrasena_confirm: nuevaPassword,
  });
  return { data: { ok: true, mensaje: data.mensaje } };
}
// ─────────────────────────────────────────────────────────────────────────


function mockLogin(cedula, password) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const match = MOCK_USERS.find((m) => m.cedula === cedula && m.password === password);
      if (!match) {
        reject({ response: { data: { detail: "Credenciales incorrectas. Verifica tu documento de identidad y contraseña." } } });
        return;
      }
      resolve({ data: { token: `mock-token-${match.user.rol}-${Date.now()}`, user: match.user } });
    }, 600);
  });
}

function mockRegister(datos) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const yaExiste = MOCK_USERS.some((m) => m.cedula === datos.cedula);
      if (yaExiste) {
        reject({ response: { data: { detail: "Ya existe una cuenta registrada con esas credenciales." } } });
        return;
      }

      const nuevo = {
        cedula: datos.cedula,
        password: datos.password,
        user: {
          id: Date.now(),
          nombre: datos.nombres,
          apellido: datos.apellidos,
          cedula: datos.cedula,
          correo: datos.correo,
          telefono: datos.telefono,
          rol: datos.rol,
          ...(datos.rol === "paciente" ? { eps: datos.eps, direccion: datos.direccion ?? "" } : {}),
          ...(datos.rol === "medico"
            ? { especialidades: [datos.especialidad], sede: datos.sede, direccion: datos.direccion ?? "" }
            : {}),
        },
      };
      agregarUsuarioMock(nuevo);

      resolve({ data: { token: `mock-token-${nuevo.user.rol}-${Date.now()}`, user: nuevo.user } });
    }, 600);
  });
}

function mockForgotPassword(correo) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const match = MOCK_USERS.find((m) => m.user.correo === correo);
      if (!match) {
        resolve({ data: { enviado: true } });
        return;
      }
      const token = crearTokenReset(match.user.id);
      console.info(`[MOCK] Link de recuperación: /reset-password?token=${token}`);
      resolve({ data: { enviado: true, _mockToken: token } });
    }, 600);
  });
}

function mockResetPassword(token, nuevaPassword) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const userId = validarTokenReset(token);
      if (!userId) {
        reject({ response: { data: { detail: "El enlace no es válido o ya expiró. Solicita uno nuevo." } } });
        return;
      }
      actualizarPasswordMock(userId, nuevaPassword);
      consumirTokenReset(token);
      resolve({ data: { ok: true } });
    }, 600);
  });
}
// ─────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Referencias para el timer de auto-logout (no deben disparar re-render).
  const timeoutRef = useRef(null);

  const limpiarTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cierra la sesión. `porExpiracion` distingue un logout manual de uno
  // disparado porque se venció el tiempo, para poder avisarle al usuario.
  const logout = useCallback((porExpiracion = false) => {
    limpiarTimer();
    borrarSesion();
    // delete axiosClient.defaults.headers.common.Authorization;
    setUser(null);
    if (porExpiracion) setSessionExpired(true);
  }, [limpiarTimer]);

  // Programa el cierre automático para el instante exacto en que vence
  // `expiraEn`. Si ya venció (ej. la pestaña estuvo en segundo plano), lo
  // dispara casi de inmediato.
  const programarAutoLogout = useCallback((expiraEn) => {
    limpiarTimer();
    const restante = Math.max(expiraEn - Date.now(), 0);
    timeoutRef.current = setTimeout(() => logout(true), restante);
  }, [limpiarTimer, logout]);

  // Extiende la sesión 20 minutos más a partir de "ahora" y reprograma el
  // timer. Se llama tanto al iniciar sesión como cada vez que se detecta
  // actividad del usuario.
  const renovarSesion = useCallback(() => {
    const actual = leerSesion();
    if (!actual) return;
    const expiraEn = Date.now() + SESSION_DURATION_MS;
    guardarSesion(actual.token, actual.user, expiraEn, actual.refresh);
    programarAutoLogout(expiraEn);
  }, [programarAutoLogout]);

  // Al cargar la app, recupera la sesión guardada (si existe y no venció).
  useEffect(() => {
    const sesion = leerSesion();
    if (sesion) {
      if (sesion.expiraEn <= Date.now()) {
        borrarSesion();
      } else {
        setUser(sesion.user);
        // axiosClient.defaults.headers.common.Authorization = `Bearer ${sesion.token}`;
        programarAutoLogout(sesion.expiraEn);
      }
    }
    setLoading(false);
    return limpiarTimer;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Renueva la sesión ante actividad real del usuario (click, teclado,
  // scroll), para que los 20 minutos sean de INACTIVIDAD y no un límite
  // fijo desde el login. Throttleado a lo sumo cada 30s para no escribir
  // en sessionStorage en cada pixel de scroll.
  useEffect(() => {
    if (!user) return;

    let ultimaRenovacion = 0;
    const THROTTLE_MS = 30 * 1000;

    function alDetectarActividad() {
      const ahora = Date.now();
      if (ahora - ultimaRenovacion < THROTTLE_MS) return;
      ultimaRenovacion = ahora;
      renovarSesion();
    }

    const eventos = ["mousedown", "keydown", "scroll", "touchstart"];
    eventos.forEach((ev) => window.addEventListener(ev, alDetectarActividad));
    return () => eventos.forEach((ev) => window.removeEventListener(ev, alDetectarActividad));
  }, [user, renovarSesion]);

  // Mantiene sincronizado al usuario de la sesión activa con MOCK_USERS.
  useEffect(() => {
    if (!USE_MOCK || !user) return;
    return subscribeUsuarios(() => {
      const actualizado = getUsuarioPorId(user.id);
      if (!actualizado) return; // el usuario fue eliminado por un admin
      setUser((prev) => {
        if (prev && JSON.stringify(prev) === JSON.stringify(actualizado)) return prev;
        const sesion = leerSesion();
        if (sesion) guardarSesion(sesion.token, actualizado, sesion.expiraEn, sesion.refresh);
        return actualizado;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function login(cedula, password) {
    const { data } = USE_MOCK
      ? await mockLogin(cedula, password)
      : await realLogin(cedula, password);

    const expiraEn = Date.now() + SESSION_DURATION_MS;
    guardarSesion(data.token, data.user, expiraEn, data.refresh);
    // axiosClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setSessionExpired(false);
    setUser(data.user);
    programarAutoLogout(expiraEn);

    return data.user;
  }

  // NOTA (conexion FE-BE, punto 1): los 3 roles autorregistrables ya pegan
  // al backend real cuando USE_MOCK=false. paciente vuelve con
  // access/refresh (sesión inmediata, igual que antes); medico/administrativo
  // vuelven 'pendientes' (sin tokens), así que NO se guarda sesión ni se
  // actualiza `user` para esos dos — Register.jsx ya maneja esto mostrando
  // la pantalla de "pendiente de autorización" sin depender de una sesión
  // activa (ver ROLES_CON_AUTORIZACION en Register.jsx).
  async function register(datos) {
    if (USE_MOCK) {
      const { data } = await mockRegister(datos);
      return _iniciarSesionPorRegistro(data);
    }

    if (datos.rol === "medico") {
      await realRegisterMedico(datos);
      return { rol: "medico", pendiente: true };
    }

    if (datos.rol === "administrativo") {
      await realRegisterAdministrativo(datos);
      return { rol: "administrativo", pendiente: true };
    }

    const { data } = await realRegisterPaciente(datos);
    return _iniciarSesionPorRegistro(data);
  }

  // Extraído de register(): arranca la sesión con lo que devolvió el
  // backend/mock cuando el registro SÍ deja la cuenta activa de inmediato
  // (paciente, o cualquier rol en modo mock).
  function _iniciarSesionPorRegistro(data) {
    const expiraEn = Date.now() + SESSION_DURATION_MS;
    guardarSesion(data.token, data.user, expiraEn, data.refresh);
    // axiosClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setSessionExpired(false);
    setUser(data.user);
    programarAutoLogout(expiraEn);

    return data.user;
  }

  // Cuando axiosClient no puede renovar la sesión (el refresh también venció,
  // o no había refresh porque era una sesión mock), dispara este evento en
  // vez de dejar las llamadas fallando en silencio. Se resuelve igual que un
  // logout por expiración normal, para reusar el mismo aviso de UI.
  useEffect(() => {
    function alVencerSesion() {
      logout(true);
    }
    window.addEventListener("auth:sessionExpired", alVencerSesion);
    return () => window.removeEventListener("auth:sessionExpired", alVencerSesion);
  }, [logout]);

  // NOTA (conexion FE-BE): updateProfile ahora sí llama a /perfil/ para el
  // rol paciente (el único que tiene ese endpoint funcionando en el backend).
  // medico/administrativo/superadministrador siguen en mock porque el
  // backend todavía no tiene perfil propio para esos roles (ver resumen).
  //
  // El resto del dashboard de paciente (citas, historial, calendario) sigue
  // leyendo de mockData en esta tarea, así que el objeto `user` queda con una
  // mezcla: los campos de perfil (nombre/apellido/telefono/direccion) vienen
  // del backend real, y el resto (id, rol, eps, cedula) se conserva tal cual
  // vino del login real, sin tocar mockData para nada relacionado a citas.
  async function updateProfile(cambios) {
    const usaBackendReal = !USE_MOCK && user?.rol === "paciente";

    let actualizado;
    if (usaBackendReal) {
      const perfil = await realUpdateProfile(cambios);
      actualizado = {
        ...user,
        nombre: perfil.primer_nombre,
        apellido: perfil.apellido,
        telefono: perfil.telefono,
        direccion: perfil.direccion,
      };
    } else {
      actualizado = actualizarUsuarioMock(user.id, cambios);
    }

    const sesion = leerSesion();
    if (sesion) guardarSesion(sesion.token, actualizado, sesion.expiraEn, sesion.refresh);
    setUser(actualizado);
    return actualizado;
  }

  async function forgotPassword(correo) {
    const { data } = USE_MOCK
      ? await mockForgotPassword(correo)
      : await realForgotPassword(correo);
    return data;
  }

  // `uidb64` viene del link que el backend real manda por correo
  // (?uidb64=...&token=...). En el flujo mock no existe, así que se ignora.
  async function resetPassword(uidb64, token, nuevaPassword) {
    const { data } = USE_MOCK
      ? await mockResetPassword(token, nuevaPassword)
      : await realResetPassword(uidb64, token, nuevaPassword);
    return data;
  }

  const value = {
    user,
    rol: user?.rol ?? null,
    isAuthenticated: !!user,
    loading,
    sessionExpired,
    clearSessionExpired: () => setSessionExpired(false),
    login,
    register,
    updateProfile,
    forgotPassword,
    resetPassword,
    logout: () => logout(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}