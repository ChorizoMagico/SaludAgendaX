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

export default axiosClient;
