import { useEffect, useState } from "react";
import axiosClient, { extraerMensajeError } from "../../api/axiosClient";

export default function AlertasTopes({ onIrATopes }) {
  const [alertas, setAlertas] = useState([]);
  const [revisadas, setRevisadas] = useState(new Set());
  const [error, setError] = useState("");

  useEffect(() => {
    axiosClient.get("/alertas-topes/")
      .then(({ data }) => setAlertas((data.alertas ?? []).map((alerta) => ({
        id: alerta.id,
        eps: alerta.eps_nombre,
        porcentaje: Math.round(Number(alerta.porcentaje_uso)),
        periodo: `${alerta.periodo_inicio} - ${alerta.periodo_fin}`,
      })))
      .catch((err) => setError(extraerMensajeError(err, "No fue posible cargar las alertas.")));
  }, []);

  const visibles = alertas.filter((alerta) => !revisadas.has(alerta.id));
  const nivel = (porcentaje) => porcentaje >= 100 ? ["#BA1A1A", "Agotado"] : porcentaje >= 95 ? ["#BA1A1A", "Crítico"] : ["#8A6D00", "Alerta"];

  return <div>
    <div className="mb-6"><p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Monitoreo</p><h1 className="sax-display text-2xl text-[#0F3D3E]">Alertas de topes</h1><p className="text-[#48605C] text-sm mt-1">Alertas reales enviadas cuando una EPS alcanza el 80% de su tope.</p></div>
    {error && <p className="mb-4 text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}
    {visibles.length === 0 ? <div className="bg-white border border-[#DCE8E5] rounded-2xl p-10 text-center text-[#48605C]">No hay topes cerca de agotarse en este momento.</div> : <div className="space-y-4">{visibles.map((alerta) => { const [color, texto] = nivel(alerta.porcentaje); return <div key={alerta.id} className="relative bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6" style={{ borderLeftWidth: "6px", borderLeftColor: color }}><div className="flex flex-col sm:flex-row justify-between gap-4"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-[#0F3D3E]">{alerta.eps}</h3><span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${color}20`, color }}>{alerta.porcentaje}% · {texto}</span></div><p className="text-sm text-[#48605C] mt-1">Período: {alerta.periodo}</p></div><div className="flex gap-2"><button type="button" onClick={onIrATopes} className="bg-[#0E9668] text-white px-3 py-1.5 rounded-full text-sm font-semibold">Ver tope</button><button type="button" onClick={() => setRevisadas((actuales) => new Set([...actuales, alerta.id]))} className="px-3 py-1.5 text-sm text-[#48605C]">Marcar revisada</button></div></div></div>; })}</div>}
  </div>;
}
