import { useEffect, useState } from "react";
import axiosClient, { extraerMensajeError } from "../../api/axiosClient";
import { cargarEspecialidades } from "../../api/superadmin";

export default function RestriccionesFrecuencia() {
  const [restricciones, setRestricciones] = useState([]);
  const [editando, setEditando] = useState(null);
  const [dias, setDias] = useState("");
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    try { setRestricciones(await cargarEspecialidades()); }
    catch (err) { setError(extraerMensajeError(err, "No fue posible cargar las restricciones.")); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  function abrirEdicion(restriccion) {
    setEditando(restriccion);
    setDias(String(restriccion.dias_entre_citas));
    setError("");
  }

  async function guardar(event) {
    event.preventDefault();
    if (dias === "" || Number(dias) < 0) {
      setError("Indica una cantidad válida de días.");
      return;
    }
    try {
      await axiosClient.patch(`/restricciones-frecuencia/${editando.id}/`, { dias_entre_citas: Number(dias) });
      setMensaje("Restricción actualizada correctamente.");
      setEditando(null);
      await cargar();
    } catch (err) {
      setError(extraerMensajeError(err, "No fue posible actualizar la restricción."));
    }
  }

  return <div>
    <div className="mb-6"><p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Reglas de negocio</p><h1 className="sax-display text-2xl text-[#0F3D3E]">Restricciones de frecuencia</h1><p className="text-[#48605C] text-sm mt-1">Define los días mínimos entre dos citas de la misma especialidad.</p></div>
    {mensaje && <p className="mb-4 text-sm rounded-lg px-4 py-3 bg-[#D3F3E6] text-[#0F3D3E]">{mensaje}</p>}
    {error && <p className="mb-4 text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}
    {editando && <form onSubmit={guardar} className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 mb-6"><h2 className="sax-display text-lg text-[#0F3D3E] mb-4">Editar {editando.especialidad}</h2><label className="block text-sm font-medium text-[#0F3D3E]">Días mínimos entre citas<input type="number" min="0" required value={dias} onChange={(e) => setDias(e.target.value)} className="mt-1.5 w-full max-w-sm px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm" /></label><div className="flex gap-2 mt-5"><button type="submit" className="bg-[#0E9668] text-white px-5 py-2.5 rounded-full text-sm font-semibold">Guardar cambios</button><button type="button" onClick={() => setEditando(null)} className="px-4 py-2.5 text-sm text-[#48605C]">Cancelar</button></div></form>}
    {cargando ? <p className="text-sm text-[#48605C]">Cargando restricciones…</p> : <div className="space-y-4">{restricciones.map((restriccion) => <div key={restriccion.id} className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h3 className="font-semibold text-[#0F3D3E]">{restriccion.especialidad}</h3><p className="text-sm text-[#48605C] mt-1">Mínimo {restriccion.dias_entre_citas} {restriccion.dias_entre_citas === 1 ? "día" : "días"} entre citas por paciente.</p></div><button type="button" onClick={() => abrirEdicion(restriccion)} className="border border-[#0E9668] text-[#0E9668] px-3 py-1.5 rounded-full text-xs font-semibold">Editar</button></div>)}</div>}
  </div>;
}
