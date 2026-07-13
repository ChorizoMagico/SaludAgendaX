// ─────────────────────────────────────────────────────────────────────────
// Piezas de interfaz reutilizadas por los dashboards de paciente y médico
// (y por cualquier dashboard futuro, p. ej. administrativo). El objetivo es
// que cada dashboard solo importe y componga, sin repetir la barra
// superior, la navegación responsive o los inputs de formulario.
// ─────────────────────────────────────────────────────────────────────────
import { Link } from "react-router-dom";

// ---------- Barra superior ----------
export function TopBar({ nombre }) {
  return (
    <header className="bg-white border-b border-[#DCE8E5] sticky top-0 z-30">
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[#0E9668] text-2xl">stethoscope</span>
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
// misma lista de tabs. tabs: [{ id, label, icon }]
export function DashboardNav({ tabs, activo, onChange }) {
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
              {t.label}
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
              className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-semibold transition-colors duration-200 ${
                activo === t.id ? "text-[#0E9668]" : "text-[#48605C]"
              }`}
            >
              <span className="material-symbols-outlined text-xl">{t.icon}</span>
              {t.label}
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
