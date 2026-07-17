import axios from "axios";

// ─────────────────────────────────────────────────────────────────────────
// Cliente HTTP único para hablar con el backend real de Django.
//
// VITE_API_URL se define en `.env` (ver `.env.example`). En desarrollo local
// normalmente es http://localhost:8000/api.
// ─────────────────────────────────────────────────────────────────────────
function normalizarUrlApi(urlConfigurada) {
  const url = urlConfigurada?.trim();
  if (!url) return "http://localhost:8000/api";

  // Una URL sin protocolo (por ejemplo, la copiada desde Railway) se
  // interpreta como ruta relativa del frontend. Al anteponer HTTPS se evita
  // que la carga de EPS y el registro se envíen al servidor equivocado.
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const axiosClient = axios.create({
  baseURL: normalizarUrlApi(import.meta.env.VITE_API_URL),
  headers: {
    "Content-Type": "application/json",
  },
});

const SESSION_KEY = "session";

function leerToken() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw)?.token ?? null;
  } catch {
    return null;
  }
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

// NOTA (pendiente): el backend emite `refresh` además de `access`, pero acá
// todavía no hay lógica de refresh automático cuando el access token (1h)
// expira. Por ahora, si expira, la próxima llamada devolverá 401 y el
// usuario deberá volver a iniciar sesión.

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

  // Las citas responden con una envoltura consistente:
  // { message: "No es posible...", errors: { campo: ["Motivo concreto"] } }.
  // Se debe priorizar el motivo concreto para que el paciente pueda corregir
  // el formulario, en vez de quedarse con el título genérico de la respuesta.
  const obtenerPrimerMensaje = (valor) => {
    if (typeof valor === "string" && valor.trim()) return valor;
    if (Array.isArray(valor)) {
      for (const item of valor) {
        const mensaje = obtenerPrimerMensaje(item);
        if (mensaje) return mensaje;
      }
      return null;
    }
    if (valor && typeof valor === "object") {
      for (const item of Object.values(valor)) {
        const mensaje = obtenerPrimerMensaje(item);
        if (mensaje) return mensaje;
      }
    }
    return null;
  };

  const mensajeError = obtenerPrimerMensaje(data.errors ?? data.non_field_errors);
  if (mensajeError) return mensajeError;
  if (data.message) return data.message;

  // Cualquier otro campo (num_documento, email, password, etc.).
  return obtenerPrimerMensaje(data) ?? fallback;
}

export default axiosClient;
