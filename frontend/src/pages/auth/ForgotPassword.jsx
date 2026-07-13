import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

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
    <div className="min-h-screen bg-[#FBFDFC] text-[#1A2624] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white border border-[#DCE8E5] rounded-lg p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-[#0E9668] text-2xl">stethoscope</span>
          <span className="font-bold text-[#0F3D3E]">SaludAgendaX</span>
        </div>

        {estado !== "enviado" ? (
          <>
            <h1 className="text-xl font-bold text-[#0F3D3E] mb-1">Recuperar contraseña</h1>
            <p className="text-sm text-[#48605C] mb-6">
              Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-[#0F3D3E]">Correo electrónico</label>
                <input
                  type="email"
                  required
                  value={correo}
                  onChange={(e) => setCorreo(e.target.value)}
                  className="border border-[#DCE8E5] rounded px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                  placeholder="tucorreo@ejemplo.com"
                />
              </div>

              {error && <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded">{error}</p>}

              <button
                type="submit"
                disabled={estado === "enviando"}
                className="bg-[#0E9668] text-white px-6 py-3 rounded font-semibold hover:bg-[#0C7D57] disabled:opacity-50 transition-colors duration-200"
              >
                {estado === "enviando" ? "Enviando..." : "Enviar enlace de recuperación"}
              </button>
            </form>
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#0E9668] text-2xl">mark_email_read</span>
              <h1 className="text-xl font-bold text-[#0F3D3E]">Revisa tu correo</h1>
            </div>
            <p className="text-sm text-[#48605C]">
              Si <strong>{correo}</strong> está registrado, te enviamos un enlace para restablecer tu contraseña.
              El enlace vence en 30 minutos.
            </p>

            {/* Bloque solo para pruebas: desaparece en cuanto exista backend
                real enviando el correo (el backend nunca debe devolver el
                token en la respuesta). */}
            {mockToken && (
              <div className="border border-dashed border-[#0E9668] bg-[#D3F3E6]/40 rounded-lg p-4 text-sm">
                <p className="font-semibold text-[#0F3D3E] mb-2">Modo de prueba (sin backend todavía)</p>
                <p className="text-[#48605C] mb-2">Como aún no hay envío de correo real, aquí tienes el enlace directo:</p>
                <Link to={`/reset-password?token=${mockToken}`} className="text-[#0E9668] font-semibold hover:underline break-all">
                  /reset-password?token={mockToken}
                </Link>
              </div>
            )}
          </div>
        )}

        <Link to="/login" className="block mt-6 text-sm text-[#48605C] hover:underline">
          ← Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
