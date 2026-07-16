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

function guardarSesion(token, user, expiraEn) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token, user, expiraEn }));
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
// Conexión real al backend (solo rol "paciente" por ahora).
//
// El backend solo tiene implementados login/registro para pacientes; los
// roles medico/administrativo/superadministrador no tienen todavía un flujo
// propio (no hay alta de médico/admin, ni "solicitud de autorización" en el
// backend), así que ESOS roles siguen usando el mock incluso con
// VITE_USE_MOCK=false. Ver el resumen de la tarea para el detalle completo.
// ─────────────────────────────────────────────────────────────────────────
async function realLogin(cedula, password) {
  // El backend recibe el campo `username` de SimpleJWT, pero internamente
  // ahora acepta también el número de documento (cédula) y lo resuelve al
  // username real (ver PacienteTokenSerializer en el backend).
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
    fecha_nacimiento: datos.fechaNacimiento, // ver nota: aún no hay input en el form
    eps_id: datos.epsId, // ver nota: el form todavía manda el nombre de la EPS, no su id
    direccion: datos.direccion ?? "",
    // NOTA (pendiente): `telefono` no se envía porque el modelo Paciente en
    // el backend todavía no tiene esa columna (falta una migración).
  });
  return { data: { token: data.access, refresh: data.refresh, user: data.user } };
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
    guardarSesion(actual.token, actual.user, expiraEn);
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
        if (sesion) guardarSesion(sesion.token, actualizado, sesion.expiraEn);
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
    guardarSesion(data.token, data.user, expiraEn);
    // axiosClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setSessionExpired(false);
    setUser(data.user);
    programarAutoLogout(expiraEn);

    return data.user;
  }

  async function register(datos) {
    // Solo el rol "paciente" tiene un flujo real en el backend hoy.
    // medico/administrativo siguen en mock (ver nota más arriba).
    const usaBackendReal = !USE_MOCK && datos.rol === "paciente";
    const { data } = usaBackendReal
      ? await realRegisterPaciente(datos)
      : await mockRegister(datos);

    const expiraEn = Date.now() + SESSION_DURATION_MS;
    guardarSesion(data.token, data.user, expiraEn);
    // axiosClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setSessionExpired(false);
    setUser(data.user);
    programarAutoLogout(expiraEn);

    return data.user;
  }

  // NOTA (pendiente, NO conectado en esta tarea): updateProfile, forgotPassword
  // y resetPassword siguen usando el mock siempre, incluso con
  // VITE_USE_MOCK=false. El backend expone `/perfil/`, `/recuperar-contrasena/`
  // y `/reset-contrasena/`, pero con formas de payload distintas a las de acá
  // (ej. reset-contrasena pide `uidb64` + `token`, no solo `token`), así que
  // falta adaptar esta capa antes de activarlos. Se dejan siempre en mock por
  // ahora para no romper el flujo con llamadas a endpoints mal formados.
  async function updateProfile(cambios) {
    const actualizado = actualizarUsuarioMock(user.id, cambios);

    const sesion = leerSesion();
    if (sesion) guardarSesion(sesion.token, actualizado, sesion.expiraEn);
    setUser(actualizado);
    return actualizado;
  }

  async function forgotPassword(correo) {
    const { data } = await mockForgotPassword(correo);
    return data;
  }

  async function resetPassword(token, nuevaPassword) {
    const { data } = await mockResetPassword(token, nuevaPassword);
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