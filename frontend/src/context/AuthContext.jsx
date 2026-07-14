import { createContext, useContext, useState, useEffect } from "react";
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
        // Misma forma de error que devolvería axios, para que Login.jsx
        // no tenga que distinguir entre mock y API real.
        reject({ response: { data: { detail: "Credenciales incorrectas. Verifica tu documento de identidad y contraseña." } } });
        return;
      }
      resolve({ data: { token: `mock-token-${match.user.rol}-${Date.now()}`, user: match.user } });
    }, 600); // simula latencia de red
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
// TODO backend (Celery): este mock simula únicamente "crear el token y
// responder". En el backend real, este endpoint encola la tarea de envío
// de correo (enviar_correo_recuperacion.delay(correo, token)) y responde
// de inmediato — no espera a que el correo salga. Por eso aquí tampoco
// "esperamos" nada más que el setTimeout que simula latencia de red.
function mockForgotPassword(correo) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const match = MOCK_USERS.find((m) => m.user.correo === correo);

      // Misma respuesta exista o no la cuenta, para no revelar qué
      // correos están registrados (esto también debe respetarse en el
      // backend real).
      if (!match) {
        resolve({ data: { enviado: true } });
        return;
      }

      const token = crearTokenReset(match.user.id);
      // Sin correo real todavía: dejamos el link en consola y también lo
      // devolvemos como _mockToken para poder mostrarlo en pantalla.
      // Ambas cosas desaparecen en cuanto el backend mande el correo de
      // verdad — el frontend nunca debería recibir el token en la respuesta.
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
      consumirTokenReset(token); // token de un solo uso
      resolve({ data: { ok: true } });
    }, 600);
  });
}
// ─────────────────────────────────────────────────────────────────────────

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Al cargar la app, recupera la sesión guardada (si existe)
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");
    if (token && storedUser) {
      setUser(JSON.parse(storedUser));
      // axiosClient.defaults.headers.common.Authorization = `Bearer ${token}`;
    }
    setLoading(false);
  }, []);

  // Mantiene sincronizado al usuario de la sesión activa con MOCK_USERS.
  // Sin esto, si un administrador edita a este mismo usuario (por ejemplo,
  // el horario, la sede o las especialidades de un médico) mientras ese
  // médico ya tiene sesión abierta, el objeto `user` en memoria (y el de
  // localStorage) se queda desactualizado hasta que cierre sesión y vuelva
  // a entrar. `subscribeUsuarios` avisa cada vez que MOCK_USERS cambia, y
  // aquí releemos únicamente al usuario logueado.
  useEffect(() => {
    if (!USE_MOCK || !user) return;
    return subscribeUsuarios(() => {
      const actualizado = getUsuarioPorId(user.id);
      if (!actualizado) return; // el usuario fue eliminado por un admin
      setUser((prev) => {
        // Evita un re-render/loop innecesario si nada cambió realmente.
        if (prev && JSON.stringify(prev) === JSON.stringify(actualizado)) return prev;
        localStorage.setItem("user", JSON.stringify(actualizado));
        return actualizado;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  async function login(cedula, password) {
    const { data } = USE_MOCK
      ? await mockLogin(cedula, password)
      : await axiosClient.post("/auth/login", { cedula, password });

    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    // axiosClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setUser(data.user);

    return data.user; // Login.jsx usa esto para redirigir según data.user.rol
  }

  async function register(datos) {
    const { data } = USE_MOCK
      ? await mockRegister(datos)
      : await axiosClient.post("/auth/register", datos);

    // Registro exitoso deja al usuario con sesión iniciada (como login)
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
    // axiosClient.defaults.headers.common.Authorization = `Bearer ${data.token}`;
    setUser(data.user);

    return data.user; // Register.jsx usa esto para redirigir según data.user.rol
  }

  // Actualiza el perfil del usuario autenticado ("Mi perfil" en ambos
  // dashboards). Sincroniza el mock compartido, el localStorage y el
  // estado en memoria, para que cualquier otra pantalla que lea al usuario
  // (o a MOCK_USERS) vea el cambio de inmediato.
  async function updateProfile(cambios) {
    const actualizado = USE_MOCK
      ? actualizarUsuarioMock(user.id, cambios)
      : (await axiosClient.put(`/usuarios/${user.id}`, cambios)).data;

    localStorage.setItem("user", JSON.stringify(actualizado));
    setUser(actualizado);
    return actualizado;
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    // delete axiosClient.defaults.headers.common.Authorization;
    setUser(null);
  }

  // Solicita el envío del correo de recuperación. No requiere sesión activa.
  async function forgotPassword(correo) {
    const { data } = USE_MOCK
      ? await mockForgotPassword(correo)
      : await axiosClient.post("/auth/forgot-password", { correo });
    return data; // { enviado: true, _mockToken? } — _mockToken solo existe en el mock
  }

  // Completa la recuperación con el token recibido por correo (o por el
  // _mockToken mientras no hay backend). No requiere sesión activa.
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
    login,
    register,
    updateProfile,
    forgotPassword,
    resetPassword,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}