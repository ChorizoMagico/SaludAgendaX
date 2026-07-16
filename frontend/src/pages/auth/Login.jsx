import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { REDIRECT_BY_ROLE } from "../../context/roles";
import medicosImg from "../../img/medicos2.jpg";
import logo from "../../img/favicon.png";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [documento, setDocumento] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!documento || !password) {
      setError("Ingresa tu número de documento y tu contraseña.");
      return;
    }

    setLoading(true);
    try {
      // AuthContext.login hace la petición, guarda token + rol en sesión
      // y devuelve el usuario autenticado (incluye user.rol).
      const usuario = await login(documento, password);

      const destino = REDIRECT_BY_ROLE[usuario?.rol] ?? "/";
      navigate(destino, { replace: true });
    } catch (err) {
      const mensaje =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "Credenciales incorrectas. Verifica tu documento de identidad y contraseña.";
      setError(mensaje);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex text-[16px] text-[#1A2624]">
      {/* Panel de marca — reutiliza el mismo hero/imagen del landing */}
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-[#0F3D3E]">
        <div className="absolute inset-0 z-0">
          <img
            alt="Personal médico atendiendo a un paciente"
            className="w-full h-full object-cover opacity-40"
            src={medicosImg}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F3D3E] via-[#0F3D3E]/80 to-[#0F3D3E]/40" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="SaludAgendaX" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
            <span className="text-2xl font-bold">SaludAgendaX</span>
          </Link>
          <div>
            <h1 className="text-3xl font-bold leading-tight mb-3">
              Tu salud, sin filas ni llamadas.
            </h1>
            <p className="text-white/80 max-w-sm">
              Consulta disponibilidad en tiempo real y gestiona tus citas médicas desde cualquier
              dispositivo.
            </p>
          </div>
          <span className="text-xs text-white/50">
            © 2026 SaludAgendaX · Universidad del Valle
          </span>
        </div>
      </div>

      {/* Panel de formulario */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-white">
        <div className="w-full max-w-md">
          {/* Logo visible solo en mobile, donde no se ve el panel izquierdo */}
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-[#0E9668] text-3xl">stethoscope</span>
            <span className="text-2xl font-bold text-[#0F3D3E]">SaludAgendaX</span>
          </Link>

          <h2 className="text-3xl font-semibold text-[#0F3D3E] mb-1">Iniciar sesión</h2>
          <p className="text-[#48605C] mb-8">Accede con tu documento de identidad y contraseña.</p>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label htmlFor="documento" className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
                Número de documento
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#48605C] text-xl">
                  badge
                </span>
                <input
                  id="documento"
                  type="text"
                  inputMode="numeric"
                  autoComplete="username"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="Ej. 1130678945"
                  className="w-full pl-10 pr-4 py-3 border border-[#DCE8E5] rounded-lg text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-[#0F3D3E]">
                  Contraseña
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-[#0E9668] hover:text-[#0C7D57] hover:underline"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#48605C] text-xl">
                  lock
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 border border-[#DCE8E5] rounded-lg text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#48605C] hover:text-[#0F3D3E]"
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-[#FDECEC] border border-[#F3B9B9] text-[#8A2E2E] text-sm rounded-lg px-4 py-3"
              >
                <span className="material-symbols-outlined text-lg">error</span>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#0E9668] text-white px-5 py-3.5 rounded-lg font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined text-xl animate-spin">
                    progress_activity
                  </span>
                  Ingresando...
                </>
              ) : (
                <>
                  Iniciar sesión
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-[#48605C] mt-8">
            ¿Aún no tienes cuenta?{" "}
            <Link
              to="/registro"
              className="text-[#0E9668] font-semibold hover:text-[#0C7D57] hover:underline"
            >
              Regístrate aquí
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
