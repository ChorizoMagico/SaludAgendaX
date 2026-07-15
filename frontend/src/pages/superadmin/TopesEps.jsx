import { useState, useSyncExternalStore } from "react";
import { topesEpsStore, getUsoTope, EPS_DISPONIBLES, ESPECIALIDADES } from "../../context/mockData";

const PERIODOS = [
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
];

const FORM_VACIO = {
  eps: EPS_DISPONIBLES[0],
  especialidad: "",
  periodo: "mensual",
  maxCitas: "",
  presupuestoMax: "",
  costoPorCita: "",
};

export default function TopesEps() {
  const topes = useSyncExternalStore(topesEpsStore.subscribe, topesEpsStore.getSnapshot);
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

  function abrirEdicion(tope) {
    setForm({
      eps: tope.eps,
      especialidad: tope.especialidad || "",
      periodo: tope.periodo,
      maxCitas: String(tope.maxCitas ?? ""),
      presupuestoMax: tope.presupuestoMax != null ? String(tope.presupuestoMax) : "",
      costoPorCita: tope.costoPorCita != null ? String(tope.costoPorCita) : "",
    });
    setEditandoId(tope.id);
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
    if (!form.maxCitas || Number(form.maxCitas) <= 0) {
      setError("El máximo de citas debe ser un número positivo.");
      return;
    }

    const datos = {
      eps: form.eps,
      especialidad: form.especialidad || null,
      periodo: form.periodo,
      maxCitas: Number(form.maxCitas),
      presupuestoMax: form.presupuestoMax ? Number(form.presupuestoMax) : null,
      costoPorCita: form.costoPorCita ? Number(form.costoPorCita) : null,
    };

    if (editandoId) {
      topesEpsStore.actualizar(editandoId, datos);
      mostrarMensaje("Tope actualizado correctamente.");
    } else {
      const resultado = topesEpsStore.agregar(datos);
      if (!resultado.ok) {
        setError(resultado.mensaje);
        return;
      }
      mostrarMensaje("Tope creado correctamente.");
    }
    cerrarForm();
  }

  function colorBarra(porcentaje) {
    if (porcentaje >= 100) return "bg-[#BA1A1A]";
    if (porcentaje >= 80) return "bg-[#8A6D00]";
    return "bg-[#0E9668]";
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Reglas de negocio</p>
          <h1 className="sax-display text-2xl text-[#0F3D3E]">Topes de citas por EPS</h1>
          <p className="text-[#48605C] text-sm mt-1">
            Define cuántas citas (y cuánto presupuesto) puede consumir cada EPS por período.
          </p>
        </div>
        <button
          type="button"
          onClick={abrirNuevo}
          className="flex items-center gap-2 bg-[#0E9668] text-white pl-4 pr-5 py-2.5 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 shrink-0"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Nuevo tope
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
          <h2 className="sax-display text-lg text-[#0F3D3E] mb-4">{editandoId ? "Editar tope" : "Nuevo tope"}</h2>

          {error && (
            <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg mb-4">{error}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#0F3D3E] mb-1.5">EPS</label>
              <select
                value={form.eps}
                onChange={(e) => setForm({ ...form, eps: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent"
              >
                {EPS_DISPONIBLES.map((eps) => (
                  <option key={eps} value={eps}>{eps}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Especialidad</label>
              <select
                value={form.especialidad}
                onChange={(e) => setForm({ ...form, especialidad: e.target.value })}
                className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent"
              >
                <option value="">Todas las especialidades</option>
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
              <label className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Máximo de citas</label>
              <input
                type="number"
                min="1"
                value={form.maxCitas}
                onChange={(e) => setForm({ ...form, maxCitas: e.target.value })}
                placeholder="Ej. 40"
                className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Presupuesto máximo (opcional)</label>
              <input
                type="number"
                min="0"
                value={form.presupuestoMax}
                onChange={(e) => setForm({ ...form, presupuestoMax: e.target.value })}
                placeholder="Ej. 6000000"
                className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#0F3D3E] mb-1.5">Costo por cita (opcional)</label>
              <input
                type="number"
                min="0"
                value={form.costoPorCita}
                onChange={(e) => setForm({ ...form, costoPorCita: e.target.value })}
                placeholder="Ej. 45000"
                className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button
              type="submit"
              className="bg-[#0E9668] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
            >
              {editandoId ? "Guardar cambios" : "Crear tope"}
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

      {topes.length === 0 ? (
        <div className="bg-white border border-[#DCE8E5] rounded-2xl p-10 text-center">
          <span className="material-symbols-outlined text-[#0E9668] text-4xl mb-2 block">account_balance</span>
          <p className="text-[#48605C]">Aún no hay topes configurados.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topes.map((tope) => {
            const uso = getUsoTope(tope);
            return (
              <div
                key={tope.id}
                className={`bg-white border rounded-2xl p-5 sm:p-6 border-[#DCE8E5] ${!tope.activo ? "opacity-60" : ""}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-[#0F3D3E]">{tope.eps}</h3>
                      <span className="text-xs font-medium text-[#0E9668] bg-[#D3F3E6] px-2 py-0.5 rounded-full">
                        {tope.especialidad || "Todas las especialidades"}
                      </span>
                      <span className="text-xs font-medium text-[#48605C] bg-[#F3F8F7] px-2 py-0.5 rounded-full capitalize">
                        {tope.periodo}
                      </span>
                      {!tope.activo && (
                        <span className="text-xs font-medium text-[#BA1A1A] bg-[#FFDAD6] px-2 py-0.5 rounded-full">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#48605C] mt-1">
                      {uso.usadas} / {tope.maxCitas} citas usadas
                      {tope.presupuestoMax != null && uso.gastado != null &&
                        ` · $${uso.gastado.toLocaleString("es-CO")} de $${tope.presupuestoMax.toLocaleString("es-CO")}`}
                    </p>
                    <div className="w-full sm:w-72 h-2 bg-[#F3F8F7] rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full ${colorBarra(uso.porcentaje)}`}
                        style={{ width: `${Math.min(uso.porcentaje, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => abrirEdicion(tope)}
                      className="flex items-center gap-1.5 border border-[#0E9668] text-[#0E9668] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#0E9668]/5 transition-colors duration-200"
                    >
                      <span className="material-symbols-outlined text-lg">edit</span>
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => topesEpsStore.toggleActivo(tope.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200 ${
                        tope.activo
                          ? "border-[#BA1A1A] text-[#BA1A1A] hover:bg-[#BA1A1A]/5"
                          : "border-[#0E9668] text-[#0E9668] hover:bg-[#0E9668]/5"
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {tope.activo ? "toggle_off" : "toggle_on"}
                      </span>
                      {tope.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}