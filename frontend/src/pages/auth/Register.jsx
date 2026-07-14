import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLES, REDIRECT_BY_ROLE } from "../../context/roles";
import medicosImg from "../../img/medicos3.jpg";

const EPS_DISPONIBLES = [
  "Sura EPS",
  "Nueva EPS",
  "Sanitas",
  "Compensar",
  "Coosalud",
  "Salud Total",
  "Famisanar",
];

const TIPOS_DOCUMENTO = [
  { key: "CC", icon: "badge", label: "Cédula de ciudadanía" },
  { key: "TI", icon: "contact_page", label: "Tarjeta de identidad" },
];

const PASOS = [
  { n: 1, titulo: "Tu cuenta" },
  { n: 2, titulo: "Tus datos" },
  { n: 3, titulo: "Seguridad" },
];

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();

  const rolInicial = useMemo(() => {
    const rol = searchParams.get("rol");
    return ROLES.some((r) => r.key === rol) ? rol : "paciente";
  }, [searchParams]);

  const [paso, setPaso] = useState(1);
  const [rol, setRol] = useState(rolInicial);
  const [form, setForm] = useState({
    tipoDocumento: "CC",
    documento: "",
    nombres: "",
    apellidos: "",
    correo: "",
    telefono: "",
    eps: EPS_DISPONIBLES[0],
    especialidad: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const rolInfo = ROLES.find((r) => r.key === rol);
  const docInfo = TIPOS_DOCUMENTO.find((d) => d.key === form.tipoDocumento);

  function actualizar(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (error) setError(""); // el mensaje de validación no debe quedar pegado mientras corriges
  }

  // Salvaguarda: sin importar qué haya disparado un error antes, al cambiar
  // de paso siempre arranca limpio.
  useEffect(() => {
    setError("");
  }, [paso]);

  function validarPaso(n, esFinal = false) {
    if (n === 1) {
      if (!form.documento) return "Ingresa tu número de documento.";
      if (!/^\d{6,12}$/.test(form.documento)) return "El documento debe tener entre 6 y 12 dígitos.";
    }
    if (n === 2) {
      if (!form.nombres || !form.apellidos || !form.correo || !form.telefono) {
        return "Completa todos los campos.";
      }
      if (!/^\S+@\S+\.\S+$/.test(form.correo)) return "Ingresa un correo electrónico válido.";
      if (rol === "medico" && !form.especialidad) return "Indica tu especialidad médica.";
    }
    if (n === 3 && esFinal) {
      if (form.password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
      if (form.password !== form.confirmPassword) return "Las contraseñas no coinciden.";
    }
    return "";
  }

  function irSiguiente() {
    const mensaje = validarPaso(paso);

    if (mensaje) {
      setError(mensaje);
      return;
    }

    setError("");
    setPaso((p) => Math.min(p + 1, 3));
  }

  function irAtras() {
    setError("");
    setPaso((p) => Math.max(p - 1, 1));
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && paso < 3) {
      e.preventDefault();
      irSiguiente();
    }
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault();

    const mensaje = validarPaso(3, true);

    if (mensaje) {
      setError(mensaje);
      return;
    }

    setError("");
    setLoading(true);

    try {
      const usuario = await register({
        ...form,
        cedula: form.documento,
        rol,
      });

      const destino = REDIRECT_BY_ROLE[usuario?.rol] ?? "/";
      navigate(destino, { replace: true });
    } catch (err) {
      const mensajeError =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        "No fue posible crear la cuenta. Intenta de nuevo.";

      setError(mensajeError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex text-[16px] text-[#1A2624]">
      {/* Panel de marca */}
      <div className="hidden lg:flex lg:w-[38%] relative overflow-hidden bg-[#0F3D3E]">
        <div className="absolute inset-0 z-0">
          <img
            alt="Personal médico atendiendo a un paciente"
            className="w-full h-full object-cover opacity-40"
            src={medicosImg}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F3D3E] via-[#0F3D3E]/85 to-[#0F3D3E]/50" />
        </div>
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#0E9668] text-3xl">stethoscope</span>
            <span className="text-2xl font-bold">SaludAgendaX</span>
          </Link>

          {/* Resumen dinámico del rol elegido: le da vida al panel y confirma la elección */}
          <div>
            <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-xs uppercase tracking-widest px-3 py-1.5 rounded-full mb-4">
              <span className="material-symbols-outlined text-base">{rolInfo.icon}</span>
              Cuenta de {rolInfo.label.toLowerCase()}
            </span>
            <h1 className="text-3xl font-bold leading-tight mb-3">{rolInfo.desc}</h1>
            <p className="text-white/70 max-w-sm">
              Solo te toma unos minutos. Vas a poder cambiar tus datos después desde tu perfil.
            </p>
          </div>

          <span className="text-xs text-white/50">© 2026 SaludAgendaX · Universidad del Valle</span>
        </div>
      </div>

      {/* Panel de formulario */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-[#F3F8F7]">
        <div className="w-full max-w-xl bg-white border border-[#DCE8E5] rounded-lg shadow-sm p-8 md:p-10">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8 w-fit">
            <span className="material-symbols-outlined text-[#0E9668] text-3xl">stethoscope</span>
            <span className="text-2xl font-bold text-[#0F3D3E]">SaludAgendaX</span>
          </Link>

          {/* Stepper — mismo lenguaje visual del bloque "Cómo funciona" del landing */}
          <div className="flex items-center mb-10">
            {PASOS.map((p, i) => {
              const activo = p.n === paso;
              const completado = p.n < paso;
              return (
                <div key={p.n} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-2">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-200 ${
                        completado
                          ? "bg-[#0E9668] text-white"
                          : activo
                          ? "bg-[#D3F3E6] text-[#0E9668] ring-2 ring-[#0E9668]"
                          : "bg-[#F3F8F7] text-[#9AAFAB] border border-[#DCE8E5]"
                      }`}
                    >
                      {completado ? (
                        <span className="material-symbols-outlined text-lg">check</span>
                      ) : (
                        p.n
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium whitespace-nowrap ${
                        activo || completado ? "text-[#0F3D3E]" : "text-[#9AAFAB]"
                      }`}
                    >
                      {p.titulo}
                    </span>
                  </div>
                  {i < PASOS.length - 1 && (
                    <div
                      className={`h-0.5 flex-1 mx-2 mb-5 transition-colors duration-200 ${
                        completado ? "bg-[#0E9668]" : "bg-[#DCE8E5]"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <form onKeyDown={handleKeyDown} noValidate>
            {/* Paso 1 — Tipo de cuenta + documento */}
            {paso === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-semibold text-[#0F3D3E] mb-1">¿Qué tipo de cuenta necesitas?</h2>
                  <p className="text-[#48605C] text-sm">Elige el rol con el que vas a usar SaludAgendaX.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {ROLES.map((r) => {
                    const activo = r.key === rol;
                    return (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setRol(r.key)}
                        className={`text-left p-4 rounded-lg border transition-all duration-200 ${
                          activo
                            ? "border-[#0E9668] bg-[#D3F3E6]/60 shadow-sm"
                            : "border-[#DCE8E5] hover:border-[#0E9668] hover:bg-[#F3F8F7]"
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-2xl mb-2 block ${
                            activo ? "text-[#0E9668]" : "text-[#48605C]"
                          }`}
                        >
                          {r.icon}
                        </span>
                        <span className="block font-semibold text-sm text-[#0F3D3E]">{r.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div>
                  <span className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Tipo de documento</span>
                  <div className="grid grid-cols-2 gap-3">
                    {TIPOS_DOCUMENTO.map((d) => {
                      const activo = d.key === form.tipoDocumento;
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => actualizar("tipoDocumento", d.key)}
                          className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
                            activo
                              ? "border-[#0E9668] bg-[#D3F3E6]/60 text-[#0F3D3E]"
                              : "border-[#DCE8E5] text-[#48605C] hover:border-[#0E9668] hover:bg-[#F3F8F7]"
                          }`}
                        >
                          <span className="material-symbols-outlined text-xl">{d.icon}</span>
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Campo
                  id="documento"
                  label={`Número de ${docInfo.label.toLowerCase()}`}
                  value={form.documento}
                  onChange={(v) => actualizar("documento", v.replace(/[^0-9]/g, ""))}
                  placeholder="1130678945"
                  inputMode="numeric"
                  icon={docInfo.icon}
                />
              </div>
            )}

            {/* Paso 2 — Datos personales */}
            {paso === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold text-[#0F3D3E] mb-1">Cuéntanos de ti</h2>
                  <p className="text-[#48605C] text-sm">
                    Registrando cuenta de <span className="font-medium">{rolInfo.label.toLowerCase()}</span>.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <Campo
                    id="nombres"
                    label="Nombres"
                    value={form.nombres}
                    onChange={(v) => actualizar("nombres", v)}
                    placeholder="Juan"
                  />
                  <Campo
                    id="apellidos"
                    label="Apellidos"
                    value={form.apellidos}
                    onChange={(v) => actualizar("apellidos", v)}
                    placeholder="Pérez"
                  />
                </div>

                <Campo
                  id="correo"
                  label="Correo electrónico"
                  type="email"
                  value={form.correo}
                  onChange={(v) => actualizar("correo", v)}
                  placeholder="tucorreo@ejemplo.com"
                  icon="mail"
                />

                <Campo
                  id="telefono"
                  label="Teléfono"
                  value={form.telefono}
                  onChange={(v) => actualizar("telefono", v.replace(/[^0-9]/g, ""))}
                  placeholder="3001234567"
                  inputMode="numeric"
                  icon="call"
                />

                {rol === "paciente" && (
                  <div>
                    <label htmlFor="eps" className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
                      Entidad aseguradora (EPS)
                    </label>
                    <select
                      id="eps"
                      value={form.eps}
                      onChange={(e) => actualizar("eps", e.target.value)}
                      className="w-full px-4 py-3 border border-[#DCE8E5] rounded-lg text-[#1A2624] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow"
                    >
                      {EPS_DISPONIBLES.map((eps) => (
                        <option key={eps} value={eps}>
                          {eps}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {rol === "medico" && (
                  <Campo
                    id="especialidad"
                    label="Especialidad médica"
                    value={form.especialidad}
                    onChange={(v) => actualizar("especialidad", v)}
                    placeholder="Cardiología"
                    icon="stethoscope"
                  />
                )}
              </div>
            )}

            {/* Paso 3 — Seguridad */}
            {paso === 3 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-semibold text-[#0F3D3E] mb-1">Protege tu cuenta</h2>
                  <p className="text-[#48605C] text-sm">Crea una contraseña que solo tú conozcas.</p>
                </div>

                <Campo
                  id="password"
                  label="Contraseña"
                  type="password"
                  value={form.password}
                  onChange={(v) => actualizar("password", v)}
                  placeholder="Mínimo 8 caracteres"
                  icon="lock"
                  showToggle
                  visible={showPassword}
                  onToggleVisible={() => setShowPassword((v) => !v)}
                />
                <Campo
                  id="confirmPassword"
                  label="Confirmar contraseña"
                  type="password"
                  value={form.confirmPassword}
                  onChange={(v) => actualizar("confirmPassword", v)}
                  placeholder="Repite tu contraseña"
                  icon="lock"
                  showToggle
                  visible={showConfirmPassword}
                  onToggleVisible={() => setShowConfirmPassword((v) => !v)}
                />
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-[#FDECEC] border border-[#F3B9B9] text-[#8A2E2E] text-sm rounded-lg px-4 py-3 mt-6"
              >
                <span className="material-symbols-outlined text-lg">error</span>
                {error}
              </div>
            )}

            <div className="flex items-center gap-3 mt-8">
              {paso > 1 && (
                <button
                  type="button"
                  onClick={irAtras}
                  className="px-5 py-3.5 rounded-lg font-semibold text-[#48605C] border border-[#DCE8E5] hover:bg-[#F3F8F7] transition-colors duration-200 flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">arrow_back</span>
                  Atrás
                </button>
              )}

              {paso < 3 ? (
                <button
                  type="button"
                  onClick={irSiguiente}
                  className="flex-1 bg-[#0E9668] text-white px-5 py-3.5 rounded-lg font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2"
                >
                  Continuar
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-[#0E9668] text-white px-5 py-3.5 rounded-lg font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 disabled:opacity-60 disabled:hover:translate-y-0 disabled:hover:shadow-none flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="material-symbols-outlined text-xl animate-spin">
                        progress_activity
                      </span>
                      Creando cuenta...
                    </>
                  ) : (
                    <>
                      Crear cuenta
                      <span className="material-symbols-outlined text-lg">check</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>

          <p className="text-center text-sm text-[#48605C] mt-8">
            ¿Ya tienes cuenta?{" "}
            <Link to="/login" className="text-[#0E9668] font-semibold hover:text-[#0C7D57] hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Campo({
  id,
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon,
  inputMode,
  showToggle = false,
  visible = false,
  onToggleVisible,
}) {
  const tipoReal = showToggle ? (visible ? "text" : "password") : type;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#48605C] text-xl">
            {icon}
          </span>
        )}
        <input
          id={id}
          type={tipoReal}
          inputMode={inputMode}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${icon ? "pl-10" : "pl-4"} ${
            showToggle ? "pr-10" : "pr-4"
          } py-3 border border-[#DCE8E5] rounded-lg text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow`}
        />
        {showToggle && (
          <button
            type="button"
            onClick={onToggleVisible}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#48605C] hover:text-[#0F3D3E]"
          >
            <span className="material-symbols-outlined text-xl">
              {visible ? "visibility_off" : "visibility"}
            </span>
          </button>
        )}
      </div>
    </div>
  );
}