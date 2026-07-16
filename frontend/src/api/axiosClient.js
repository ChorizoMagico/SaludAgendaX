import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────
// Cliente HTTP único para hablar con el backend real de Django.
//
// VITE_API_URL se define en `.env` (ver `.env.example`). En desarrollo local
// normalmente es http://localhost:8000/api.
// ─────────────────────────────────────────────────────────────────────────
const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

const SESSION_KEY = "session";

function leerSesion() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function leerToken() {
  return leerSesion()?.token ?? null;
}

function leerRefreshToken() {
  return leerSesion()?.refresh ?? null;
}

// Sustituye solo el access token dentro de la sesión guardada, sin tocar
// el resto (user, expiraEn, refresh). AuthContext sigue siendo la única
// fuente de verdad para crear/borrar la sesión completa; esto solo la
// actualiza en el lugar cuando el access token se renueva en segundo plano.
function actualizarAccessToken(nuevoAccess) {
  const sesion = leerSesion();
  if (!sesion) return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...sesion, token: nuevoAccess }));
}

function borrarSesion() {
  sessionStorage.removeItem(SESSION_KEY);
}

// Adjunta el JWT (access token) guardado por AuthContext a cada petición,
// sin que cada llamada tenga que preocuparse por el header manualmente.
axiosClient.interceptors.request.use((config) => {
  const token = leerToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─────────────────────────────────────────────────────────────────────────
// Refresh automático de sesión.
//
// El backend emite `refresh` en login/registro y ahora expone
// POST /token/refresh/ (rest_framework_simplejwt.views.TokenRefreshView).
// Cuando una petición responde 401 (access token vencido, dura 1h), se
// intenta canjear el refresh token una sola vez y se reintenta la petición
// original con el access nuevo. Si el refresh también falla (venció, dura
// 1 día, o no existe porque la sesión es del mock), se limpia la sesión y
// se avisa a AuthContext vía un evento de window para que haga logout y
// marque sessionExpired, en vez de dejar al usuario con llamadas colgadas.
//
// `refreshEnCurso` evita disparar varios refresh en paralelo cuando varias
// peticiones fallan con 401 casi al mismo tiempo: todas esperan la misma
// promesa en lugar de pedir un refresh cada una.
// ─────────────────────────────────────────────────────────────────────────
let refreshEnCurso = null;

function avisarSesionVencida() {
  borrarSesion();
  window.dispatchEvent(new Event("auth:sessionExpired"));
}

axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url ?? "";

    // Nunca reintentar el propio endpoint de refresh, ni login (un 401 ahí
    // es "credenciales inválidas", no "sesión vencida").
    const esRefreshUrl = url.includes("/token/refresh/");
    const esLoginUrl = url.includes("/login/");

    if (status !== 401 || esRefreshUrl || esLoginUrl || !original || original._retry) {
      return Promise.reject(error);
    }

    const refresh = leerRefreshToken();
    if (!refresh) {
      // Sesión mock (sin refresh) u otro caso sin token para renovar: no hay
      // nada que intentar, se corta acá.
      avisarSesionVencida();
      return Promise.reject(error);
    }

    original._retry = true;

    try {
      if (!refreshEnCurso) {
        refreshEnCurso = axiosClient
          .post("/token/refresh/", { refresh })
          .then(({ data }) => {
            actualizarAccessToken(data.access);
            return data.access;
          })
          .finally(() => {
            refreshEnCurso = null;
          });
      }
      const nuevoAccess = await refreshEnCurso;
      original.headers = { ...original.headers, Authorization: `Bearer ${nuevoAccess}` };
      return axiosClient(original);
    } catch (refreshError) {
      avisarSesionVencida();
      return Promise.reject(refreshError);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────
// Los endpoints reales de DRF no siempre devuelven el error bajo `detail`
// (ej. el registro devuelve `{ "num_documento": ["Este documento ya está
// registrado"] }`, y recuperar-contraseña devuelve `{ "email": [...] }`).
// Este helper intenta sacar SIEMPRE el primer mensaje legible, sin importar
// la forma exacta que tenga la respuesta, para no mostrar mensajes
// genéricos cuando el backend sí mandó algo útil.
// ─────────────────────────────────────────────────────────────────────────
export function extraerMensajeError(err, fallback) {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data === "string") return data;
  if (data.detail) return data.detail;
  if (data.message) return data.message;
  if (Array.isArray(data.non_field_errors) && data.non_field_errors[0]) {
    return data.non_field_errors[0];
  }
  // Cualquier otro campo (num_documento, email, password, etc.): toma el
  // primer valor, ya sea string o lista de strings.
  const primerCampo = Object.values(data).find((v) => v != null);
  if (Array.isArray(primerCampo)) return primerCampo[0] ?? fallback;
  if (typeof primerCampo === "string") return primerCampo;
  return fallback;
}

export default axiosClient;
