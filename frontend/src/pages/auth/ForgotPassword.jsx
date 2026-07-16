import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import medicosImg from "../../img/medicos4.jpg";
import logo from "../../img/favicon.png";

export default function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState("form"); // "form" | "enviando" | "enviado"
  const [error, setError] = useState("");
  const [mockToken, setMockToken] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setEstado("enviando");
    try {
      const data = await forgotPassword(correo);
      // _mockToken solo existe mientras no hay backend enviando el correo
      // de verdad; en producción esta línea nunca tendrá nada que mostrar.
      setMockToken(data._mockToken ?? null);
      setEstado("enviado");
    } catch (err) {
      setError(err?.response?.data?.detail ?? "No pudimos procesar la solicitud. Intenta de nuevo.");
      setEstado("form");
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
            <h1 className="text-3xl font-bold leading-tight mb-3">Recupera el acceso a tu cuenta.</h1>
            <p className="text-white/80 max-w-sm">
              Te enviamos un enlace seguro a tu correo para que puedas crear una nueva contraseña
              y volver a gestionar tus citas médicas.
            </p>
          </div>
          <span className="text-xs text-white/50">© 2026 SaludAgendaX · Universidad del Valle</span>
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

          {estado !== "enviado" ? (
            <>
              <h2 className="text-3xl font-semibold text-[#0F3D3E] mb-1">Recuperar contraseña</h2>
              <p className="text-[#48605C] mb-8">
                Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
              </p>

              <form onSubmit={handleSubmit} noValidate className="space-y-5">
                <div>
                  <label htmlFor="correo" className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
                    Correo electrónico
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#48605C] text-xl">
                      mail
                    </span>
                    <input
                      id="correo"
                      type="email"
                      autoComplete="email"
                      required
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder="tucorreo@ejemplo.com"
                      className="w-full pl-10 pr-4 py-3 border border-[#DCE8E5] rounded-lg text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow"
                    />
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
                  disabled={estado === "enviando"}
                  className="w-full bg-[#0E9668] text-white px-5 py-3.5 rounded-lg font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
                >
                  {estado === "enviando" ? (
                    <>
                      <span className="material-symbols-outlined text-xl animate-spin">progress_activity</span>
                      Enviando...
                    </>
                  ) : (
                    <>
                      Enviar enlace de recuperación
                      <span className="material-symbols-outlined text-lg">arrow_forward</span>
                    </>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="flex items-center justify-center w-12 h-12 rounded-full bg-[#E4F5EE] text-[#0E9668]">
                  <span className="material-symbols-outlined text-2xl">mark_email_read</span>
                </span>
                <h1 className="text-2xl font-semibold text-[#0F3D3E]">Revisa tu correo</h1>
              </div>
              <p className="text-[#48605C]">
                Si <strong>{correo}</strong> está registrado, te enviamos un enlace para restablecer tu
                contraseña. El enlace vence en 30 minutos.
              </p>

              {/* Bloque solo para pruebas: desaparece en cuanto exista backend
                  real enviando el correo (el backend nunca debe devolver el
                  token en la respuesta). */}
              {mockToken && (
                <div className="border border-dashed border-[#0E9668] bg-[#E4F5EE] rounded-lg p-4 text-sm">
                  <p className="font-semibold text-[#0F3D3E] mb-2">Modo de prueba (sin backend todavía)</p>
                  <p className="text-[#48605C] mb-2">Como aún no hay envío de correo real, aquí tienes el enlace directo:</p>
                  <Link
                    to={`/reset-password?token=${mockToken}`}
                    className="text-[#0E9668] font-semibold hover:underline break-all"
                  >
                    /reset-password?token={mockToken}
                  </Link>
                </div>
              )}
            </div>
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