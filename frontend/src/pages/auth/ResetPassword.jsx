import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { extraerMensajeError } from "../../api/axiosClient";
import medicosImg from "../../img/medicos5.jpg";
import logo from "../../img/favicon.png";

export default function ResetPassword() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  // El backend real firma el link con uidb64 + token (ver
  // pacientes/utils.py:enviar_email_recuperacion). El flujo mock no lo usa.
  const uidb64 = searchParams.get("uidb64");

  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("El enlace no es válido. Solicita uno nuevo.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      await resetPassword(uidb64, token, password);
      setListo(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (err) {
      setError(extraerMensajeError(err, "No pudimos restablecer tu contraseña. Intenta de nuevo."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="min-h-screen flex text-[16px] text-[#1A2624]">
      {/* Panel de marca — mismo hero/imagen que el resto del flujo de auth */}
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
              Tu cuenta, siempre protegida.
            </h1>
            <p className="text-white/80 max-w-sm">
              Crea una nueva contraseña segura y vuelve a gestionar tus citas médicas sin
              contratiempos.
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
          {/* Logo visible solo en mobile */}
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-[#0E9668] text-3xl">stethoscope</span>
            <span className="text-2xl font-bold text-[#0F3D3E]">SaludAgendaX</span>
          </Link>

          {!token ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#FDECEC] text-[#8A2E2E]">
                  <span className="material-symbols-outlined text-2xl">link_off</span>
                </span>
                <h1 className="text-2xl font-semibold text-[#0F3D3E]">Enlace inválido</h1>
              </div>
              <p className="text-[#48605C]">
                Este enlace no incluye un token de recuperación válido. Solicita uno nuevo para
                continuar.
              </p>
              <Link
                to="/forgot-password"
                className="w-full text-center bg-[#0E9668] text-white px-5 py-3.5 rounded-lg font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
              >
                Solicitar nuevo enlace
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            </div>
          ) : listo ? (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#E4F5EE] text-[#0E9668]">
                  <span className="material-symbols-outlined text-2xl">check_circle</span>
                </span>
                <h1 className="text-2xl font-semibold text-[#0F3D3E]">Contraseña actualizada</h1>
              </div>
              <p className="text-[#48605C]">
                Tu contraseña se guardó correctamente. Te llevamos al inicio de sesión...
              </p>
              <div className="h-1 w-full bg-[#DCE8E5] rounded-full overflow-hidden">
                <div className="h-full bg-[#0E9668] animate-[progress_2.5s_linear_forwards]" />
              </div>
              <style>{`
                @keyframes progress {
                  from { width: 0%; }
                  to { width: 100%; }
                }
              `}</style>
            </div>
          ) : (
            <>
              <h2 className="text-3xl font-semibold text-[#0F3D3E] mb-1">Crear nueva contraseña</h2>
              <p className="text-[#48605C] mb-8">
                Elige una contraseña nueva y segura para tu cuenta.
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
                    Nueva contraseña
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#48605C] text-xl">
                      lock
                    </span>
                    <input
                      id="password"
                      type={mostrarPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-3 border border-[#DCE8E5] rounded-lg text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassword((v) => !v)}
                      aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#48605C] hover:text-[#0F3D3E]"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {mostrarPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                  <p className="text-xs text-[#9AAFAB] mt-1.5">Mínimo 8 caracteres.</p>
                </div>

                <div>
                  <label htmlFor="confirmar" className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
                    Confirmar contraseña
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#48605C] text-xl">
                      lock_reset
                    </span>
                    <input
                      id="confirmar"
                      type={mostrarConfirmar ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirmar}
                      onChange={(e) => setConfirmar(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-3 border border-[#DCE8E5] rounded-lg text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirmar((v) => !v)}
                      aria-label={mostrarConfirmar ? "Ocultar contraseña" : "Mostrar contraseña"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#48605C] hover:text-[#0F3D3E]"
                    >
                      <span className="material-symbols-outlined text-xl">
                        {mostrarConfirmar ? "visibility_off" : "visibility"}
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
                  disabled={enviando}
                  className="w-full bg-[#0E9668] text-white px-5 py-3.5 rounded-lg font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
                >
                  {enviando ? (
                    <>
                      <span className="material-symbols-outlined text-xl animate-spin">
                        progress_activity
                      </span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      Guardar nueva contraseña
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-[#48605C] mt-8">
            <Link
              to="/login"
              className="text-[#0E9668] font-semibold hover:text-[#0C7D57] hover:underline inline-flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}