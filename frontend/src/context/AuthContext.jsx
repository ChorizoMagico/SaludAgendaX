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
// import axiosClient from "../api/axiosClient"; // descomenta cuando apagues el mock

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
const USE_MOCK = true;

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
      : await axiosClient.post("/auth/login", { cedula, password });

    const expiraEn = Date.now() + SESSION_DURATION_MS;
    guardarSesion(data.token, data.user, expiraEn);
    // axiosClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setSessionExpired(false);
    setUser(data.user);
    programarAutoLogout(expiraEn);

    return data.user;
  }

  async function register(datos) {
    const { data } = USE_MOCK
      ? await mockRegister(datos)
      : await axiosClient.post("/auth/register", datos);

    const expiraEn = Date.now() + SESSION_DURATION_MS;
    guardarSesion(data.token, data.user, expiraEn);
    // axiosClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setSessionExpired(false);
    setUser(data.user);
    programarAutoLogout(expiraEn);

    return data.user;
  }

  async function updateProfile(cambios) {
    const actualizado = USE_MOCK
      ? actualizarUsuarioMock(user.id, cambios)
      : (await axiosClient.put(`/usuarios/${user.id}`, cambios)).data;

    const sesion = leerSesion();
    if (sesion) guardarSesion(sesion.token, actualizado, sesion.expiraEn);
    setUser(actualizado);
    return actualizado;
  }

  async function forgotPassword(correo) {
    const { data } = USE_MOCK
      ? await mockForgotPassword(correo)
      : await axiosClient.post("/auth/forgot-password", { correo });
    return data;
  }

  async function resetPassword(token, nuevaPassword) {
    const { data } = USE_MOCK
      ? await mockResetPassword(token, nuevaPassword)
      : await axiosClient.post("/auth/reset-password", { token, password: nuevaPassword });
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