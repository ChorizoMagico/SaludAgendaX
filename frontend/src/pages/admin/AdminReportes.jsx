import { useMemo } from "react";
import { BarChart, Bar, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ESTADOS_CITA, ESTADO_ACCENT, ESTADO_ICONO, capitalizarPrimera, StatCard } from "./AdminDashboard";

const agrupar = (citas, clave) => Object.entries(citas.reduce((total, cita) => ({ ...total, [clave(cita)]: (total[clave(cita)] ?? 0) + 1 }), {})).map(([nombre, total]) => ({ nombre, total })).sort((a,b) => b.total-a.total);
export default function TabReportes({ citas }) {
  const estado = useMemo(() => agrupar(citas, (c) => capitalizarPrimera(c.estado)), [citas]);
  const especialidad = useMemo(() => agrupar(citas, (c) => c.especialidad), [citas]);
  const medico = useMemo(() => agrupar(citas, (c) => c.medicoNombre), [citas]);
  const conteo = Object.fromEntries(estado.map((x) => [x.nombre.toLowerCase(), x.total]));
  return <div className="flex flex-col gap-8 max-w-3xl"><div><p className="text-xs font-semibold tracking-[.14em] uppercase text-[#0E9668]">Estadísticas</p><h1 className="sax-display text-2xl text-[#0F3D3E]">Reportes</h1><p className="text-sm text-[#48605C] mt-1">Datos obtenidos de las citas registradas en el sistema.</p></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-4">{ESTADOS_CITA.map((item) => <StatCard key={item} icon={ESTADO_ICONO[item]} valor={conteo[item] ?? 0} etiqueta={capitalizarPrimera(item)} color={ESTADO_ACCENT[item].color} tinte={ESTADO_ACCENT[item].tinte} />)}</div><Grafica titulo="Citas por estado" datos={estado}/><Grafica titulo="Citas por especialidad" datos={especialidad}/><Grafica titulo="Citas por médico" datos={medico}/></div>;
}
function Grafica({ titulo, datos }) { return <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5"><h2 className="sax-display text-lg text-[#0F3D3E] mb-4">{titulo}</h2>{datos.length ? <div style={{height:Math.max(190,datos.length*42)}}><ResponsiveContainer width="100%" height="100%"><BarChart data={datos} layout="vertical" margin={{left:16,right:24}}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" allowDecimals={false}/><YAxis type="category" dataKey="nombre" width={130}/><Tooltip/><Legend/><Bar dataKey="total" name="Citas" fill="#0E9668" radius={[0,8,8,0]}/></BarChart></ResponsiveContainer></div> : <p className="text-sm text-[#48605C]">Sin datos todavía.</p>}</div>; }
