import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { getMedicoPorId } from "../../context/mockData";
import { ESTADOS_CITA, ESTADO_ACCENT, ESTADO_ICONO, capitalizarPrimera, StatCard } from "./AdminDashboard";

/* ============================================================
   TAB: Reportes (5.3) — vista de gráficos (donut + barras) con
   toggle a la vista de barras de progreso simples original.
   ============================================================ */

export default function TabReportes({ todasLasCitas }) {
  const [vista, setVista] = useState("graficos"); // 'graficos' | 'barras'

  const porEstado = {};
  const porEspecialidad = {};
  const porMedico = {};

  todasLasCitas.forEach((c) => {
    porEstado[c.estado] = (porEstado[c.estado] || 0) + 1;
    porEspecialidad[c.especialidad] = (porEspecialidad[c.especialidad] || 0) + 1;
    const medico = getMedicoPorId(c.medicoId);
    const nombreMedico = medico ? `${medico.nombre} ${medico.apellido}` : "—";
    porMedico[nombreMedico] = (porMedico[nombreMedico] || 0) + 1;
  });

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Estadísticas</p>
          <h1 className="sax-display text-2xl text-[#0F3D3E]">Reportes</h1>
          <p className="text-sm text-[#48605C] mt-1">Total de citas registradas: {todasLasCitas.length}</p>
        </div>

        <div className="flex bg-[#F3F8F7] rounded-full p-1">
          <button
            onClick={() => setVista("graficos")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 flex items-center gap-1.5 ${
              vista === "graficos" ? "bg-white text-[#0F3D3E] shadow-sm" : "text-[#48605C]"
            }`}
          >
            <span className="material-symbols-outlined text-base">donut_small</span>
            Gráficos
          </button>
          <button
            onClick={() => setVista("barras")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 flex items-center gap-1.5 ${
              vista === "barras" ? "bg-white text-[#0F3D3E] shadow-sm" : "text-[#48605C]"
            }`}
          >
            <span className="material-symbols-outlined text-base">table_rows</span>
            Barras simples
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {ESTADOS_CITA.map((estado) => {
          const acc = ESTADO_ACCENT[estado];
          return (
            <StatCard
              key={estado}
              icon={ESTADO_ICONO[estado]}
              valor={porEstado[estado] || 0}
              etiqueta={capitalizarPrimera(estado)}
              color={acc.color}
              tinte={acc.tinte}
            />
          );
        })}
      </div>

      {vista === "graficos" ? (
        <>
          <GraficoPastel
            titulo="Citas por estado"
            icon="donut_large"
            datos={porEstado}
            colorPorClave={ESTADO_ACCENT}
            formatearEtiqueta={capitalizarPrimera}
          />
          <GraficoBarras titulo="Citas por especialidad" icon="medical_information" datos={porEspecialidad} />
          <GraficoBarras titulo="Citas por médico" icon="stethoscope" datos={porMedico} />
        </>
      ) : (
        <>
          <BarraReporte
            titulo="Citas por estado"
            icon="donut_large"
            datos={porEstado}
            total={todasLasCitas.length}
            colorPorClave={ESTADO_ACCENT}
            formatearEtiqueta={capitalizarPrimera}
          />
          <BarraReporte
            titulo="Citas por especialidad"
            icon="medical_information"
            datos={porEspecialidad}
            total={todasLasCitas.length}
          />
          <BarraReporte
            titulo="Citas por médico"
            icon="stethoscope"
            datos={porMedico}
            total={todasLasCitas.length}
          />
        </>
      )}
    </div>
  );
}

function CabeceraReporte({ titulo, icon }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#D3F3E6] text-[#0E9668] shrink-0">
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </span>
      <h2 className="sax-display text-lg text-[#0F3D3E]">{titulo}</h2>
    </div>
  );
}

// Donut chart — usado para "Citas por estado" porque son pocas categorías
// fijas (agendada/reprogramada/completada/cancelada) y su color de marca
// (ESTADO_ACCENT) se traduce directamente a cada porción.
function GraficoPastel({ titulo, icon, datos, colorPorClave, formatearEtiqueta }) {
  const data = Object.entries(datos).map(([clave, valor]) => ({
    name: formatearEtiqueta ? formatearEtiqueta(clave) : clave,
    value: valor,
    color: colorPorClave?.[clave]?.color ?? "#0E9668",
  }));

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6">
      <CabeceraReporte titulo={titulo} icon={icon} />
      {data.length === 0 ? (
        <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-xl px-4 py-3">Sin datos todavía.</p>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DCE8E5", fontSize: 13 }} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 12, color: "#48605C" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// Barras horizontales — usado para especialidad y médico porque la
// cantidad de categorías puede crecer, y con barras horizontales el
// nombre de cada una se lee completo sin rotar texto.
function GraficoBarras({ titulo, icon, datos }) {
  const data = Object.entries(datos)
    .sort((a, b) => b[1] - a[1])
    .map(([clave, valor]) => ({ name: clave, valor }));

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6">
      <CabeceraReporte titulo={titulo} icon={icon} />
      {data.length === 0 ? (
        <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-xl px-4 py-3">Sin datos todavía.</p>
      ) : (
        <div style={{ height: Math.max(180, data.length * 44) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EDF2F1" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#48605C" }} axisLine={{ stroke: "#DCE8E5" }} tickLine={false} allowDecimals={false} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12, fill: "#0F3D3E" }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #DCE8E5", fontSize: 13 }} cursor={{ fill: "#F3F8F7" }} />
              <Bar dataKey="valor" fill="#0E9668" radius={[0, 8, 8, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function BarraReporte({ titulo, icon, datos, colorPorClave, total, formatearEtiqueta }) {
  const entradas = Object.entries(datos).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entradas.map(([, v]) => v));
  const totalReal = total || entradas.reduce((acc, [, v]) => acc + v, 0) || 1;

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6">
      <CabeceraReporte titulo={titulo} icon={icon} />

      {entradas.length === 0 ? (
        <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-xl px-4 py-3">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {entradas.map(([clave, valor]) => {
            const color = colorPorClave?.[clave]?.color ?? "#0E9668";
            const porcentaje = Math.round((valor / totalReal) * 100);
            const etiqueta = formatearEtiqueta ? formatearEtiqueta(clave) : clave;
            return (
              <div key={clave} className="flex items-center gap-3">
                <span className="text-sm text-[#0F3D3E] font-medium w-32 sm:w-40 shrink-0 truncate">{etiqueta}</span>
                <div className="flex-1 bg-[#F3F8F7] rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center justify-end px-2 transition-all duration-300"
                    style={{ width: `${Math.max((valor / max) * 100, 10)}%`, backgroundColor: color }}
                  >
                    <span className="sax-mono text-[10px] font-semibold text-white">{valor}</span>
                  </div>
                </div>
                <span className="text-xs text-[#48605C] w-10 text-right shrink-0">{porcentaje}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}