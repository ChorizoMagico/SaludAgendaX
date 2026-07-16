// ─────────────────────────────────────────────────────────────────────────
// Piezas de interfaz reutilizadas por los dashboards de paciente, médico y
// administrativo (y por cualquier dashboard futuro). El objetivo es que
// cada dashboard solo importe y componga, sin repetir la barra superior,
// la navegación responsive, los inputs de formulario ni el wizard de
// agendamiento.
// ─────────────────────────────────────────────────────────────────────────
import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../img/favicon.png";

// ---------- Barra superior ----------
export function TopBar({ nombre }) {
  return (
    <header className="bg-white/70 backdrop-blur-md border-b border-[#DCE8E5] sticky top-0 z-30">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img src={logo} alt="SaludAgendaX" className="w-7 h-7 md:w-8 md:h-8 object-contain" />
          <span className="font-bold text-[#0F3D3E]">SaludAgendaX</span>
        </div>
        <div className="flex items-center gap-4">
          {nombre && <span className="hidden sm:block text-sm text-[#48605C]">{nombre}</span>}
          <Link
            to="/"
            className="text-sm text-[#48605C] hover:text-[#BA1A1A] transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-lg">logout</span>
            <span className="hidden sm:inline">Cerrar sesión</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

// ---------- Navegación responsive ----------
// Nav lateral en desktop (md+) y barra fija abajo en mobile, a partir de la
// misma lista de tabs.
export function DashboardNav({ tabs, activo, onChange }) {
  const badgeClase = (color) =>
    color === "danger" ? "bg-[#FFDAD6] text-[#BA1A1A]" : "bg-[#0E9668] text-white";

  return (
    <>
      <nav className="hidden md:block md:w-56 shrink-0">
        <div className="flex flex-col gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded font-semibold text-sm whitespace-nowrap transition-colors duration-200 ${
                activo === t.id ? "bg-[#0E9668] text-white" : "text-[#48605C] hover:bg-[#EDF4F2]"
              }`}
            >
              <span className="material-symbols-outlined text-lg">{t.icon}</span>
              <span className="flex-1 text-left">{t.label}</span>
              {!!t.badge && (
                <span
                  className={`text-xs font-bold rounded-full min-w-[1.4rem] h-5 px-1.5 flex items-center justify-center shrink-0 ${
                    activo === t.id ? "bg-white/25 text-white" : badgeClase(t.badgeColor)
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-[#DCE8E5] z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors duration-200 ${
                activo === t.id ? "text-[#0E9668]" : "text-[#48605C]"
              }`}
            >
              <span className="relative">
                <span className="material-symbols-outlined text-xl">{t.icon}</span>
                {!!t.badge && (
                  <span
                    className={`absolute -top-1 -right-2 text-[10px] font-bold rounded-full min-w-[1.1rem] h-[1.1rem] px-1 flex items-center justify-center ${badgeClase(
                      t.badgeColor
                    )}`}
                  >
                    {t.badge}
                  </span>
                )}
              </span>
              {t.labelCorto ?? t.label}
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

// Padding inferior para que la barra fija de mobile no tape el contenido.
// Úsalo en el contenedor del dashboard: className={`... ${navMobilePadding}`}
export const navMobilePadding = "pb-24 md:pb-8";

// ---------- Estilos compartidos ----------
// Tipografía de marca (sax-display / sax-mono) + overrides de
// react-big-calendar. Antes vivían duplicados como un componente local
// `SaxStyles` en cada pantalla que usa calendario (MedicoMiAgenda,
// AdminDashboard); ahora se centralizan aquí para no repetir el CSS cada
// vez que una pantalla nueva agregue una vista de calendario.
export function DashboardStyles() {
  return (
    <style>{`
      .sax-display { font-weight: 700; letter-spacing: -0.02em; }
      .sax-mono { font-family: ui-monospace, "SFMono-Regular", "Menlo", "Consolas", monospace; }

      /* Estilos de marca aplicados sobre el CSS por defecto de react-big-calendar */
      .saludagendax-calendar .rbc-today { background-color: #EDF7F4; }
      .saludagendax-calendar .rbc-header {
        padding: 8px 4px;
        font-size: 0.75rem;
        font-weight: 600;
        color: #48605C;
        border-color: #DCE8E5;
      }
      .saludagendax-calendar .rbc-time-content,
      .saludagendax-calendar .rbc-time-header-content,
      .saludagendax-calendar .rbc-time-view,
      .saludagendax-calendar .rbc-month-view,
      .saludagendax-calendar .rbc-timeslot-group {
        border-color: #DCE8E5;
      }
      .saludagendax-calendar .rbc-off-range-bg {
        background-color: #F7FAF9;
      }
      .saludagendax-calendar .rbc-current-time-indicator {
        background-color: #0E9668;
      }
      .saludagendax-calendar .rbc-event:focus {
        outline: 2px solid #0E9668;
      }
      @media (max-width: 640px) {
        .saludagendax-calendar .rbc-label { font-size: 0.65rem; }
        .saludagendax-calendar .rbc-event { font-size: 0.65rem; padding: 1px 3px; }
      }
    `}</style>
  );
}

// ---------- Fondo decorativo de los dashboards ----------
export function DashboardBackground() {
  return (
    <div className="sax-dashboard-bg">
      <div className="sax-blob-1" />
      <div className="sax-blob-2" />
      <div className="sax-blob-3" />
      <div className="sax-blob-4" />
    </div>
  );
}

// ---------- Campos de formulario ----------
export function Campo({ label, name, value, onChange, disabled, type = "text", hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[#0F3D3E]">{label}</label>
      <input
        type={type}
        name={name}
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        className={`border border-[#DCE8E5] rounded px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668] ${
          disabled ? "bg-[#F3F8F7] text-[#48605C] cursor-not-allowed" : ""
        }`}
      />
      {hint && <span className="text-xs text-[#48605C]">{hint}</span>}
    </div>
  );
}

// Campo de contraseña con botón de mostrar/ocultar (ojo). Se usa en los
// formularios de registro (médico, paciente) en vez de <Campo type="password">,
// para que quien lo llena pueda verificar lo que escribió antes de enviar.
export function CampoPassword({ label, name, value, onChange, disabled, hint }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[#0F3D3E]">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          value={value ?? ""}
          onChange={onChange}
          disabled={disabled}
          className={`w-full border border-[#DCE8E5] rounded px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668] ${
            disabled ? "bg-[#F3F8F7] text-[#48605C] cursor-not-allowed" : ""
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          tabIndex={-1}
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9AAFAB] hover:text-[#48605C] transition-colors disabled:pointer-events-none"
        >
          <span className="material-symbols-outlined text-lg">
            {visible ? "visibility_off" : "visibility"}
          </span>
        </button>
      </div>
      {hint && <span className="text-xs text-[#48605C]">{hint}</span>}
    </div>
  );
}

// Campo de solo lectura para datos asignados por administración
// (EPS del paciente, especialidades y sede del médico).
export function CampoSolo({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-[#0F3D3E]">{label}</label>
      <p className="border border-[#DCE8E5] rounded px-4 py-2.5 text-sm bg-[#F3F8F7] text-[#48605C]">{value}</p>
      {hint && <span className="text-xs text-[#48605C]">{hint}</span>}
    </div>
  );
}

// ---------- Estado de citas ----------
export const ESTADO_STYLES = {
  agendada: "bg-[#D3F3E6] text-[#0E9668]",
  completada: "bg-[#E5EFEC] text-[#48605C]",
  cancelada: "bg-[#FFDAD6] text-[#BA1A1A]",
  reprogramada: "bg-[#FFF3CD] text-[#8A6D00]",
};

export function EstadoBadge({ estado }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${ESTADO_STYLES[estado] ?? ""}`}>
      {estado}
    </span>
  );
}

// ---------- Wizard de agendamiento/reprogramación de citas ----------
// Compartido entre el dashboard de paciente (agenda para sí mismo) y el
// dashboard administrativo (agenda en nombre de un paciente): ambos usan
// los mismos 5 pasos finales (Especialidad → Sede → Médico → Horario →
// Confirmar); el admin simplemente antepone un paso de "Paciente".

// Rastreador de pasos — el orden sí importa (flujo real, no decorativo).
export function StepTracker({ pasos, actual }) {
  return (
    <div className="flex items-center">
      {pasos.map((label, i) => {
        const paso = i + 1;
        const hecho = paso < actual;
        const activo = paso === actual;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0 w-16">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold sax-mono transition-colors duration-200 ${
                  hecho
                    ? "bg-[#0E9668] text-white"
                    : activo
                    ? "bg-white border-2 border-[#0E9668] text-[#0E9668]"
                    : "bg-[#F3F8F7] text-[#9AAFAB]"
                }`}
              >
                {hecho ? <span className="material-symbols-outlined text-base">check</span> : paso}
              </div>
              <span
                className={`text-[11px] uppercase tracking-wide text-center leading-tight hidden sm:block ${
                  activo ? "text-[#0F3D3E] font-semibold" : "text-[#9AAFAB]"
                }`}
              >
                {label}
              </span>
            </div>
            {paso !== pasos.length && (
              <div className={`h-0.5 flex-1 mx-1 rounded ${hecho ? "bg-[#0E9668]" : "bg-[#DCE8E5]"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Opción seleccionable de una lista (especialidad, sede, paciente, etc).
export function OpcionPill({ seleccionado, onClick, icon, label, sublabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 text-sm text-left px-4 py-3 rounded-xl border transition-colors duration-200 ${
        seleccionado
          ? "border-[#0E9668] bg-[#D3F3E6] text-[#0E9668] font-semibold"
          : "border-[#DCE8E5] hover:border-[#0E9668]"
      }`}
    >
      {icon && <span className="material-symbols-outlined text-lg shrink-0">{icon}</span>}
      <span className="min-w-0">
        <span className="block truncate">{label}</span>
        {sublabel && <span className="block text-xs font-normal text-[#48605C] truncate">{sublabel}</span>}
      </span>
      {seleccionado && <span className="material-symbols-outlined text-lg ml-auto shrink-0">check_circle</span>}
    </button>
  );
}

export function BotonContinuar({ disabled, onClick, label = "Continuar" }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="self-start bg-[#0E9668] text-white px-6 py-2.5 rounded-full font-semibold hover:bg-[#0C7D57] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-200 mt-2 flex items-center gap-1.5"
    >
      {label}
      <span className="material-symbols-outlined text-lg">arrow_forward</span>
    </button>
  );
}

export function FilaConfirmacion({ etiqueta, valor, icon, mono }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 gap-4">
      <dt className="text-[#48605C] text-sm flex items-center gap-2">
        {icon && <span className="material-symbols-outlined text-lg text-[#9AAFAB]">{icon}</span>}
        {etiqueta}
      </dt>
      <dd className={`font-semibold text-[#0F3D3E] text-right ${mono ? "sax-mono" : ""}`}>{valor}</dd>
    </div>
  );
}

// ---------- Confirmaciones inline ----------
// Confirmación de una acción destructiva o irreversible (cancelar cita,
// eliminar médico, eliminar especialidad/sede...). Aparece en el propio
// lugar donde se pidió la acción, sin usar un modal aparte.
export function ConfirmacionInline({ pregunta, textoConfirmar = "Sí, confirmar", textoCancelar = "No, mantener", onConfirmar, onCancelar, children }) {
  return (
    <div className="pt-3 border-t border-dashed border-[#DCE8E5]">
      <p className="text-sm font-semibold text-[#0F3D3E] mb-2">{pregunta}</p>
      {children}
      <div className="flex flex-col sm:flex-row gap-2 mt-1">
        <button
          onClick={onConfirmar}
          className="bg-[#BA1A1A] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {textoConfirmar}
        </button>
        <button
          onClick={onCancelar}
          className="text-[#48605C] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#EDF4F2] transition-colors"
        >
          {textoCancelar}
        </button>
      </div>
    </div>
  );
}

// Aviso de que una acción no se puede realizar en este momento (p. ej. un
// médico con citas activas). No es un sí/no: solo explica y se cierra.
export function AvisoBloqueo({ mensaje, onCerrar }) {
  return (
    <div className="pt-3 border-t border-dashed border-[#DCE8E5]">
      <div className="bg-[#FFF3CD] border border-[#E3B34D] text-[#8A6D00] text-sm rounded-lg px-4 py-3 flex items-start gap-2">
        <span className="material-symbols-outlined text-lg shrink-0">warning</span>
        <span>{mensaje}</span>
      </div>
      {onCerrar && (
        <button onClick={onCerrar} className="text-xs text-[#48605C] hover:underline mt-2">
          Entendido
        </button>
      )}
    </div>
  );
}

// Elección entre dos o más caminos posibles (no destructiva). Se usa, por
// ejemplo, al reprogramar: mantener el mismo médico o buscar otro.
export function EleccionInline({ pregunta, opciones }) {
  return (
    <div className="pt-3 border-t border-dashed border-[#DCE8E5]">
      <p className="text-sm font-semibold text-[#0F3D3E] mb-2">{pregunta}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        {opciones.map((op) => (
          <button
            key={op.label}
            onClick={op.onClick}
            className={
              op.destacada
                ? "bg-[#0E9668] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
                : "border border-[#0E9668] text-[#0E9668] px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#0E9668]/5 transition-colors duration-200"
            }
          >
            {op.label}
          </button>
        ))}
      </div>
    </div>
  );
}