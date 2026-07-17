import { useEffect, useState } from "react";
import axiosClient, { extraerMensajeError } from "../../api/axiosClient";
import { cargarEps, cargarTopes } from "../../api/superadmin";

const PERIODOS = [
  { value: "SEMANAL", label: "Semanal" },
  { value: "MENSUAL", label: "Mensual" },
];

const FORM_VACIO = { eps: "", tipo_periodo: "MENSUAL", limite_citas: "", presupuesto_maximo: "" };

export default function TopesEps() {
  const [topes, setTopes] = useState([]);
  const [epsDisponibles, setEpsDisponibles] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [form, setForm] = useState(FORM_VACIO);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargarDatos = async () => {
    try {
      const [topesApi, epsApi] = await Promise.all([cargarTopes(), cargarEps()]);
      setTopes(topesApi);
      setEpsDisponibles(epsApi);
    } catch (err) {
      setError(extraerMensajeError(err, "No fue posible cargar los topes."));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargarDatos(); }, []);

  function abrirNuevo() {
    setForm({ ...FORM_VACIO, eps: String(epsDisponibles[0]?.id ?? "") });
    setEditandoId(null);
    setError("");
    setMostrarForm(true);
  }

  function abrirEdicion(tope) {
    setForm({
      eps: String(tope.epsId),
      tipo_periodo: tope.periodo.toUpperCase(),
      limite_citas: String(tope.maxCitas),
      presupuesto_maximo: tope.presupuestoMax == null ? "" : String(tope.presupuestoMax),
    });
    setEditandoId(tope.id);
    setError("");
    setMostrarForm(true);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.eps || Number(form.limite_citas) < 1) {
      setError("Selecciona una EPS e indica un límite de citas válido.");
      return;
    }
    const payload = {
      eps: Number(form.eps),
      tipo_periodo: form.tipo_periodo,
      limite_citas: Number(form.limite_citas),
      presupuesto_maximo: form.presupuesto_maximo === "" ? null : Number(form.presupuesto_maximo),
    };
    try {
      if (editandoId) await axiosClient.patch(`/topes-eps/${editandoId}/`, payload);
      else await axiosClient.post("/topes-eps/", payload);
      setMensaje(editandoId ? "Tope actualizado correctamente." : "Tope creado correctamente.");
      setMostrarForm(false);
      setEditandoId(null);
      await cargarDatos();
    } catch (err) {
      setError(extraerMensajeError(err, "No fue posible guardar el tope."));
    }
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
          <p className="text-[#48605C] text-sm mt-1">Configura el límite real de citas por EPS y período.</p>
        </div>
        <button type="button" onClick={abrirNuevo} disabled={!epsDisponibles.length} className="flex items-center gap-2 bg-[#0E9668] disabled:opacity-50 text-white pl-4 pr-5 py-2.5 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 shrink-0">
          <span className="material-symbols-outlined text-lg">add_circle</span>Nuevo tope
        </button>
      </div>

      {mensaje && <p className="mb-4 text-sm rounded-lg px-4 py-3 bg-[#D3F3E6] text-[#0F3D3E]">{mensaje}</p>}
      {error && <p className="mb-4 text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}

      {mostrarForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 mb-6">
          <h2 className="sax-display text-lg text-[#0F3D3E] mb-4">{editandoId ? "Editar tope" : "Nuevo tope"}</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="text-sm font-medium text-[#0F3D3E]">EPS
              <select value={form.eps} disabled={Boolean(editandoId)} onChange={(e) => setForm({ ...form, eps: e.target.value })} className="mt-1.5 w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm disabled:bg-[#F3F8F7]">
                <option value="">Selecciona una EPS</option>
                {epsDisponibles.map((eps) => <option key={eps.id} value={eps.id}>{eps.nombre}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-[#0F3D3E]">Período
              <select value={form.tipo_periodo} onChange={(e) => setForm({ ...form, tipo_periodo: e.target.value })} className="mt-1.5 w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm">
                {PERIODOS.map((periodo) => <option key={periodo.value} value={periodo.value}>{periodo.label}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-[#0F3D3E]">Máximo de citas
              <input type="number" min="1" required value={form.limite_citas} onChange={(e) => setForm({ ...form, limite_citas: e.target.value })} className="mt-1.5 w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm" />
            </label>
            <label className="text-sm font-medium text-[#0F3D3E]">Presupuesto máximo (opcional)
              <input type="number" min="0" value={form.presupuesto_maximo} onChange={(e) => setForm({ ...form, presupuesto_maximo: e.target.value })} className="mt-1.5 w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm" />
            </label>
          </div>
          <div className="flex items-center gap-2 mt-5"><button type="submit" className="bg-[#0E9668] text-white px-5 py-2.5 rounded-full text-sm font-semibold">Guardar</button><button type="button" onClick={() => setMostrarForm(false)} className="px-4 py-2.5 text-sm text-[#48605C]">Cancelar</button></div>
        </form>
      )}

      {cargando ? <p className="text-sm text-[#48605C]">Cargando topes…</p> : topes.length === 0 ? (
        <div className="bg-white border border-[#DCE8E5] rounded-2xl p-10 text-center text-[#48605C]">Aún no hay topes configurados.</div>
      ) : <div className="space-y-4">{topes.map((tope) => (
        <div key={tope.id} className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4"><div><div className="flex gap-2 items-center"><h3 className="font-semibold text-[#0F3D3E]">{tope.eps}</h3><span className="text-xs bg-[#F3F8F7] px-2 py-0.5 rounded-full capitalize">{tope.periodo}</span></div><p className="text-sm text-[#48605C] mt-1">{tope.uso.usadas} / {tope.maxCitas} citas usadas</p><div className="w-full sm:w-72 h-2 bg-[#F3F8F7] rounded-full mt-2 overflow-hidden"><div className={`h-full ${colorBarra(tope.uso.porcentaje)}`} style={{ width: `${Math.min(tope.uso.porcentaje, 100)}%` }} /></div></div><button type="button" onClick={() => abrirEdicion(tope)} className="border border-[#0E9668] text-[#0E9668] px-3 py-1.5 rounded-full text-xs font-semibold">Editar</button></div>
        </div>
      ))}</div>}
    </div>
  );
}
