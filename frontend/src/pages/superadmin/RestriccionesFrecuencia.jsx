import { useState, useSyncExternalStore } from "react";
import { restriccionesFrecuenciaStore, ESPECIALIDADES } from "../../context/mockData";

const PERIODOS = [
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
];

const FORM_VACIO = { especialidad: ESPECIALIDADES[0], periodo: "mensual", maxCitasPorPaciente: "" };

export default function RestriccionesFrecuencia() {
  const restricciones = useSyncExternalStore(
    restriccionesFrecuenciaStore.subscribe,
    restriccionesFrecuenciaStore.getSnapshot
  );
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  function mostrarMensaje(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(null), 3000);
  }

  function abrirNuevo() {
    setForm(FORM_VACIO);
    setEditandoId(null);
    setError(null);
    setMostrarForm(true);
  }

  function abrirEdicion(r) {
    setForm({
      especialidad: r.especialidad,
      periodo: r.periodo,
      maxCitasPorPaciente: String(r.maxCitasPorPaciente),
    });
    setEditandoId(r.id);
    setError(null);
    setMostrarForm(true);
  }

  function cerrarForm() {
    setMostrarForm(false);
    setEditandoId(null);
    setError(null);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.maxCitasPorPaciente || Number(form.maxCitasPorPaciente) <= 0) {
      setError("El máximo de citas por paciente debe ser un número positivo.");
      return;
    }

    const datos = {
      especialidad: form.especialidad,
      periodo: form.periodo,
      maxCitasPorPaciente: Number(form.maxCitasPorPaciente),
    };

    if (editandoId) {
      restriccionesFrecuenciaStore.actualizar(editandoId, datos);
      mostrarMensaje("Restricción actualizada correctamente.");
    } else {
      const resultado = restriccionesFrecuenciaStore.agregar(datos);
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      mostrarMensaje("Restricción creada correctamente.");
    }
    cerrarForm();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Reglas de negocio</p>
          <h1 className="sax-display text-2xl text-[#0F3D3E]">Restricciones de frecuencia</h1>
          <p className="text-[#48605C] text-sm mt-1">
            Limita cuántas citas puede agendar un mismo paciente por especialidad en un período.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="flex items-center gap-2 bg-[#0E9668] text-white pl-4 pr-5 py-2.5 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Nueva restricción
        </button>
      </div>

      {mensaje && (
        <div
          role="alert"
          className="flex items-center gap-2 text-sm rounded-lg px-4 py-3 mb-4 bg-[#D3F3E6] border border-[#0E9668]/30 text-[#0F3D3E]"
        >
          <span className="material-symbols-outlined text-lg">check_circle</span>
          {mensaje}
        </div>
      )}

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 mb-6">
          <h2 className="sax-display text-lg text-[#0F3D3E] mb-4">{editandoId ? "Editar restricción" : "Nueva restricción"}</h2>

          {error && (
            <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg mb-4">{error}</p>
          )}

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Especialidad</label>
              <select
                value={form.especialidad}
                onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent"
              >
                {ESPECIALIDADES.map((esp) => (
                  <option key={esp} value={esp}>{esp}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Período</label>
              <select
                value={form.periodo}
                onChange={(e) => setForm({ ...form, periodo: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent"
              >
                {PERIODOS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Máx. citas por paciente</label>
              <input
                type="number"
                min="1"
                value={form.maxCitasPorPaciente}
                onChange={(e) => setForm({ ...form, maxCitasPorPaciente: e.target.value })}
                placeholder="Ej. 2"
                className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button
              type="submit"
              className="bg-[#0E9668] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
            >
              {editandoId ? "Guardar cambios" : "Crear restricción"}
            </button>
            <button
              type="button"
              onClick={cerrarForm}
              className="px-4 py-2.5 rounded-full text-sm font-semibold text-[#48605C] hover:bg-[#F3F8F7] transition-colors duration-200"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {restricciones.length === 0 ? (
        <div className="bg-white border border-[#DCE8E5] rounded-2xl p-10 text-center">
          <span className="material-symbols-outlined text-[#0E9668] text-4xl mb-2 block">event_repeat</span>
          <p className="text-[#48605C]">Aún no hay restricciones de frecuencia configuradas.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {restricciones.map((r) => (
            <div
              key={r.id}
              className={`bg-white border rounded-2xl p-5 sm:p-6 border-[#DCE8E5] ${!r.activo ? "opacity-60" : ""}`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-[#0F3D3E]">{r.especialidad}</h3>
                    <span className="text-xs font-medium text-[#48605C] bg-[#F3F8F7] px-2 py-0.5 rounded-full capitalize">
                      {r.periodo}
                    </span>
                    {!r.activo && (
                      <span className="text-xs font-medium text-[#BA1A1A] bg-[#FFDAD6] px-2 py-0.5 rounded-full">
                        Inactiva
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#48605C] mt-1">
                    Máximo {r.maxCitasPorPaciente} {r.maxCitasPorPaciente === 1 ? "cita" : "citas"} por paciente, por{" "}
                    {r.periodo === "semanal" ? "semana" : "mes"}.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => abrirEdicion(r)}
                    className="flex items-center gap-1.5 border border-[#0E9668] text-[#0E9668] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#0E9668]/5 transition-colors duration-200"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => restriccionesFrecuenciaStore.toggleActivo(r.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200 ${
                      r.activo
                        ? "border-[#BA1A1A] text-[#BA1A1A] hover:bg-[#BA1A1A]/5"
                        : "border-[#0E9668] text-[#0E9668] hover:bg-[#0E9668]/5"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      {r.activo ? "toggle_off" : "toggle_on"}
                    </span>
                    {r.activo ? "Desactivar" : "Activar"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}