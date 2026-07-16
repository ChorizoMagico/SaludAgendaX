import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { ROLES, REDIRECT_BY_ROLE } from "../../context/roles";
import { ESPECIALIDADES } from "../../context/mockData";
import axiosClient, { extraerMensajeError } from "../../api/axiosClient";
import medicosImg from "../../img/medicos3.jpg";
import logo from "../../img/favicon.png";

// El registro público no debe permitir crear cuentas de superadministrador:
// ese rol se asigna manualmente, no vía formulario de autorregistro.
const ROLES_REGISTRABLES = ROLES.filter((r) => r.key !== "superadministrador");

// NOTA (conexion FE-BE): lista de respaldo, usada mientras el modo mock
// esté activo o si el backend real no responde (ej. no está corriendo).
// Cuando hay backend disponible, se reemplaza por el resultado real de
// GET /api/eps/ (ver useEffect más abajo), que trae el `id` real que el
// registro necesita mandar como `eps_id`.
const EPS_FALLBACK = [
  "Sura EPS",
  "Nueva EPS",
  "Sanitas",
  "Compensar",
  "Coosalud",
  "Salud Total",
  "Famisanar",
].map((nombre) => ({ id: null, nombre }));

const TIPOS_DOCUMENTO = [
  { key: "CC", icon: "badge", label: "Cédula de ciudadanía" },
  { key: "TI", icon: "contact_page", label: "Tarjeta de identidad" },
];

const PASOS = [
  { n: 1, titulo: "Tu cuenta" },
  { n: 2, titulo: "Tus datos" },
  { n: 3, titulo: "Seguridad" },
];

// Roles cuyo registro no otorga acceso inmediato: quedan pendientes de
// revisión y aprobación manual por parte de un superadministrador.
const ROLES_CON_AUTORIZACION = ["medico", "administrativo"];

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { register } = useAuth();

  const rolInicial = useMemo(() => {
    const rol = searchParams.get("rol");
    return ROLES_REGISTRABLES.some((r) => r.key === rol) ? rol : "paciente";
  }, [searchParams]);

  const [paso, setPaso] = useState(1);
  const [rol, setRol] = useState(rolInicial);
  const [epsDisponibles, setEpsDisponibles] = useState(EPS_FALLBACK);
  const [form, setForm] = useState({
    tipoDocumento: "CC",
    documento: "",
    nombres: "",
    apellidos: "",
    correo: "",
    telefono: "",
    fechaNacimiento: "",
    eps: EPS_FALLBACK[0].nombre,
    epsId: EPS_FALLBACK[0].id,
    especialidad: "",
    numeroRegistroMedico: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Una vez enviado el formulario de un rol que requiere autorización,
  // se muestra la pantalla de "pendiente de revisión" en lugar de redirigir.
  const [pendienteAutorizacion, setPendienteAutorizacion] = useState(false);

  // NOTA (conexion FE-BE): trae las EPS reales del backend (con su id) para
  // el selector del paso 2. Si el backend no responde (mock activo, o el
  // backend real no está corriendo), se queda con la lista de respaldo.
  useEffect(() => {
    let cancelado = false;
    axiosClient
      .get("/eps/")
      .then(({ data }) => {
        if (cancelado || !Array.isArray(data) || data.length === 0) return;
        setEpsDisponibles(data);
        setForm((f) => (f.epsId ? f : { ...f, eps: data[0].nombre, epsId: data[0].id }));
      })
      .catch(() => {
        // Se queda con EPS_FALLBACK; no es un error visible para el usuario.
      });
    return () => {
      cancelado = true;
    };
  }, []);

  const rolInfo = ROLES_REGISTRABLES.find((r) => r.key === rol);
  const docInfo = TIPOS_DOCUMENTO.find((d) => d.key === form.tipoDocumento);

  // Solo pacientes pueden registrarse con tarjeta de identidad (personas
  // menores de edad). Médicos y administrativos deben ser mayores de edad
  // y con cédula de ciudadanía.
  const tarjetaIdentidadPermitida = rol === "paciente";

  function seleccionarRol(key) {
    setRol(key);
    if (key !== "paciente" && form.tipoDocumento === "TI") {
      actualizar("tipoDocumento", "CC");
    }
  }

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
      if (form.tipoDocumento === "TI" && !tarjetaIdentidadPermitida) {
        return "Este rol solo admite registro con cédula de ciudadanía.";
      }
      if (!form.documento) return "Ingresa tu número de documento.";
      if (!/^\d{6,12}$/.test(form.documento)) return "El documento debe tener entre 6 y 12 dígitos.";
    }
    if (n === 2) {
      if (!form.nombres || !form.apellidos || !form.correo || !form.telefono) {
        return "Completa todos los campos.";
      }
      if (!/^\S+@\S+\.\S+$/.test(form.correo)) return "Ingresa un correo electrónico válido.";
      if (rol === "paciente" && !form.fechaNacimiento) return "Ingresa tu fecha de nacimiento.";
      if (rol === "medico" && !form.especialidad) return "Indica tu especialidad médica.";
      if (rol === "medico" && !form.numeroRegistroMedico) return "Ingresa tu número de registro médico.";
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

      if (ROLES_CON_AUTORIZACION.includes(rol)) {
        // Médicos y administrativos no quedan con sesión activa de inmediato:
        // deben esperar la aprobación de un superadministrador.
        setPendienteAutorizacion(true);
      } else {
        const destino = REDIRECT_BY_ROLE[usuario?.rol] ?? "/";
        navigate(destino, { replace: true });
      }
    } catch (err) {
      setError(extraerMensajeError(err, "No fue posible crear la cuenta. Intenta de nuevo."));
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
            <img src={logo} alt="SaludAgendaX" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
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

          {pendienteAutorizacion ? (
            /* Pantalla de confirmación: el registro se guardó, pero el
               acceso queda sujeto a la revisión de un superadministrador. */
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-[#D3F3E6] text-[#0E9668] flex items-center justify-center mx-auto mb-6">
                <span className="material-symbols-outlined text-3xl">hourglass_top</span>
              </div>
              <h2 className="text-2xl font-semibold text-[#0F3D3E] mb-3">¡Registro recibido!</h2>
              <p className="text-[#48605C] mb-2 max-w-sm mx-auto">
                Tu cuenta de <span className="font-medium">{rolInfo.label.toLowerCase()}</span> fue creada correctamente.
              </p>
              <p className="text-[#48605C] mb-8 max-w-sm mx-auto">
                Un superadministrador debe autorizar tu acceso. Este proceso puede tomar hasta{" "}
                <span className="font-semibold text-[#0F3D3E]">2 días hábiles</span>. Te notificaremos por
                correo electrónico en cuanto tu cuenta esté activa.
              </p>
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 bg-[#0E9668] text-white px-6 py-3.5 rounded-lg font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
              >
                Ir a inicio de sesión
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </Link>
            </div>
          ) : (
            <>
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

                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      {ROLES_REGISTRABLES.map((r) => {
                        const activo = r.key === rol;
                        return (
                          <button
                            key={r.key}
                            type="button"
                            onClick={() => seleccionarRol(r.key)}
                            className={`text-left p-3 sm:p-4 rounded-lg border transition-all duration-200 ${
                              activo
                                ? "border-[#0E9668] bg-[#D3F3E6]/60 shadow-sm"
                                : "border-[#DCE8E5] hover:border-[#0E9668] hover:bg-[#F3F8F7]"
                            }`}
                          >
                            <span
                              className={`material-symbols-outlined text-xl sm:text-2xl mb-1.5 sm:mb-2 block ${
                                activo ? "text-[#0E9668]" : "text-[#48605C]"
                              }`}
                            >
                              {r.icon}
                            </span>
                            <span className="block font-semibold text-xs sm:text-sm text-[#0F3D3E] leading-tight">
                              {r.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <span className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Tipo de documento</span>
                      <div className="grid grid-cols-2 gap-3">
                        {TIPOS_DOCUMENTO.map((d) => {
                          const activo = d.key === form.tipoDocumento;
                          const deshabilitado = d.key === "TI" && !tarjetaIdentidadPermitida;
                          return (
                            <button
                              key={d.key}
                              type="button"
                              disabled={deshabilitado}
                              onClick={() => actualizar("tipoDocumento", d.key)}
                              className={`flex items-center gap-2 px-4 py-3 rounded-lg border text-sm font-medium transition-all duration-200 ${
                                deshabilitado
                                  ? "border-[#DCE8E5] text-[#C6D2CE] bg-[#F8FAF9] cursor-not-allowed"
                                  : activo
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
                      {!tarjetaIdentidadPermitida && (
                        <p className="text-xs text-[#48605C] mt-2">
                          Médicos y personal administrativo deben registrarse con cédula de ciudadanía.
                        </p>
                      )}
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
                      <>
                        <Campo
                          id="fechaNacimiento"
                          label="Fecha de nacimiento"
                          type="date"
                          value={form.fechaNacimiento}
                          onChange={(v) => actualizar("fechaNacimiento", v)}
                          icon="calendar_month"
                        />

                        <div>
                          <label htmlFor="eps" className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
                            Entidad aseguradora (EPS)
                          </label>
                          <select
                            id="eps"
                            value={form.epsId ?? form.eps}
                            onChange={(e) => {
                              const seleccionada = epsDisponibles.find(
                                (eps) => String(eps.id ?? eps.nombre) === e.target.value
                              );
                              setForm((f) => ({
                                ...f,
                                eps: seleccionada?.nombre ?? e.target.value,
                                epsId: seleccionada?.id ?? null,
                              }));
                            }}
                            className="w-full px-4 py-3 border border-[#DCE8E5] rounded-lg text-[#1A2624] bg-white focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow"
                          >
                            {epsDisponibles.map((eps) => (
                              <option key={eps.id ?? eps.nombre} value={eps.id ?? eps.nombre}>
                                {eps.nombre}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    {rol === "medico" && (
                      <>
                        <div>
                          <label htmlFor="especialidad" className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
                            Especialidad médica
                          </label>
                          <div className="relative">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#48605C] text-xl pointer-events-none">
                              stethoscope
                            </span>
                            <select
                              id="especialidad"
                              value={form.especialidad}
                              onChange={(e) => actualizar("especialidad", e.target.value)}
                              className={`w-full appearance-none pl-10 pr-10 py-3 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow ${
                                form.especialidad
                                  ? "border-[#DCE8E5] text-[#1A2624]"
                                  : "border-[#DCE8E5] text-[#9AAFAB]"
                              }`}
                            >
                              <option value="" disabled>
                                Selecciona tu especialidad
                              </option>
                              {ESPECIALIDADES.map((esp) => (
                                <option key={esp} value={esp} className="text-[#1A2624]">
                                  {esp}
                                </option>
                              ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[#48605C] text-xl pointer-events-none">
                              expand_more
                            </span>
                          </div>
                        </div>
                        <Campo
                          id="numeroRegistroMedico"
                          label="Número de registro médico"
                          value={form.numeroRegistroMedico}
                          onChange={(v) => actualizar("numeroRegistroMedico", v)}
                          placeholder="RM-123456"
                          icon="badge"
                        />
                      </>
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

                    {ROLES_CON_AUTORIZACION.includes(rol) && (
                      <div className="flex items-start gap-2 bg-[#F3F8F7] border border-[#DCE8E5] text-[#48605C] text-sm rounded-lg px-4 py-3">
                        <span className="material-symbols-outlined text-lg text-[#0E9668]">info</span>
                        <span>
                          Tu cuenta de {rolInfo.label.toLowerCase()} deberá ser autorizada por un
                          superadministrador antes de poder usarla. Este proceso puede tardar hasta
                          2 días hábiles.
                        </span>
                      </div>
                    )}
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
            </>
          )}
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