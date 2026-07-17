import { useEffect, useMemo, useState } from "react";
import { cargarTopes } from "../../api/superadmin";
import { extraerMensajeError } from "../../api/axiosClient";

const PERIODOS_FILTRO = [
  { value: "todos", label: "Todos" },
  { value: "semanal", label: "Semanal" },
  { value: "mensual", label: "Mensual" },
];

// Mismos umbrales que AlertasTopes/TopesEps, pero acá cubrimos también el
// tramo "normal" porque este reporte muestra el panorama completo, no solo
// lo que está en riesgo.
function nivelUso(porcentaje) {
  if (porcentaje >= 100) return { key: "agotado", label: "Agotado", color: "#BA1A1A", tinte: "#FFDAD6" };
  if (porcentaje >= 95) return { key: "critico", label: "Crítico", color: "#BA1A1A", tinte: "#FFDAD6" };
  if (porcentaje >= 80) return { key: "alerta", label: "Alerta", color: "#8A6D00", tinte: "#F5EEDA" };
  return { key: "normal", label: "Normal", color: "#0E9668", tinte: "#D3F3E6" };
}

// Para el donut agrupamos crítico + agotado en un solo bloque rojo, así el
// resumen visual queda en 3 franjas (normal / alerta / crítico-agotado)
// en vez de fragmentarse en cuatro tonos casi iguales.
function bucketDonut(nivelKey) {
  if (nivelKey === "agotado" || nivelKey === "critico") return "critico";
  return nivelKey;
}

function StatCard({ icon, valor, etiqueta, color, tinte, sub }) {
  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 flex items-start gap-4">
      <span
        className="flex items-center justify-center w-11 h-11 rounded-full shrink-0"
        style={{ backgroundColor: tinte, color }}
      >
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className="sax-display text-2xl text-[#0F3D3E] leading-tight">{valor}</p>
        <p className="text-xs text-[#48605C] uppercase tracking-wide mt-0.5">{etiqueta}</p>
        {sub && <p className="text-xs text-[#8A6D00] mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export default function ReportesTopes() {
  const [topes, setTopes] = useState([]);
  const [error, setError] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");

  useEffect(() => {
    cargarTopes().then(setTopes).catch((err) => setError(extraerMensajeError(err, "No fue posible cargar el reporte.")));
  }, []);

  const reporte = useMemo(() => {
    const activos = topes.filter((t) => filtroPeriodo === "todos" || t.periodo === filtroPeriodo);

    const porEps = new Map();
    const conteoDonut = { normal: 0, alerta: 0, critico: 0 };

    activos.forEach((tope) => {
      const uso = tope.uso;
      const nivel = nivelUso(uso.porcentaje);
      conteoDonut[bucketDonut(nivel.key)] += 1;

      if (!porEps.has(tope.eps)) {
        porEps.set(tope.eps, {
          eps: tope.eps,
          maxCitas: 0,
          usadas: 0,
          gastado: 0,
          presupuestoMax: 0,
          tienePresupuesto: false,
          especialidades: [],
        });
      }
      const acc = porEps.get(tope.eps);
      acc.maxCitas += tope.maxCitas;
      acc.usadas += uso.usadas;
      if (tope.presupuestoMax != null) {
        acc.tienePresupuesto = true;
        acc.presupuestoMax += tope.presupuestoMax;
        // El backend registra el tope presupuestal, pero no un costo por
        // cita; por eso no se inventa un gasto en el reporte.
        acc.gastado += 0;
      }
      acc.especialidades.push({
        especialidad: "Todas las especialidades",
        periodo: tope.periodo,
        usadas: uso.usadas,
        maxCitas: tope.maxCitas,
        porcentaje: uso.porcentaje,
        nivel: nivelUso(uso.porcentaje),
      });
    });

    const entidades = Array.from(porEps.values())
      .map((e) => ({
        ...e,
        porcentaje: e.maxCitas === 0 ? 0 : Math.round((e.usadas / e.maxCitas) * 100),
      }))
      .sort((a, b) => b.porcentaje - a.porcentaje);

    const totalMax = entidades.reduce((s, e) => s + e.maxCitas, 0);
    const totalUsadas = entidades.reduce((s, e) => s + e.usadas, 0);
    const totalGastado = entidades.reduce((s, e) => s + e.gastado, 0);
    const totalPresupuesto = entidades.reduce((s, e) => s + e.presupuestoMax, 0);
    const usoPromedio = totalMax === 0 ? 0 : Math.round((totalUsadas / totalMax) * 100);
    const enAlerta = entidades.filter((e) => e.porcentaje >= 80).length;

    const totalTopes = conteoDonut.normal + conteoDonut.alerta + conteoDonut.critico;

    return { entidades, conteoDonut, totalTopes, usoPromedio, enAlerta, totalGastado, totalPresupuesto };
  }, [topes, filtroPeriodo]);

  const { entidades, conteoDonut, totalTopes, usoPromedio, enAlerta, totalGastado, totalPresupuesto } = reporte;

  // Construye el gradiente cónico del donut a partir de los 3 buckets.
  const donutGradient = useMemo(() => {
    if (totalTopes === 0) return "conic-gradient(#EDF2F1 0% 100%)";
    const pNormal = (conteoDonut.normal / totalTopes) * 100;
    const pAlerta = (conteoDonut.alerta / totalTopes) * 100;
    const pCritico = (conteoDonut.critico / totalTopes) * 100;
    const c1 = pNormal;
    const c2 = c1 + pAlerta;
    const c3 = c2 + pCritico;
    return `conic-gradient(#0E9668 0% ${c1}%, #8A6D00 ${c1}% ${c2}%, #BA1A1A ${c2}% ${c3}%)`;
  }, [conteoDonut, totalTopes]);

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Reportes</p>
        <h1 className="sax-display text-2xl text-[#0F3D3E]">Utilización de topes por entidad</h1>
        <p className="text-[#48605C] text-sm mt-1">
          Panorama del consumo de citas y presupuesto configurado para cada EPS.
        </p>
      </div>
      {error && <p className="mb-4 text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}

      {/* Filtro de período */}
      <div className="flex items-center gap-1 bg-white border border-[#DCE8E5] rounded-full p-1 w-fit mb-6">
        {PERIODOS_FILTRO.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => setFiltroPeriodo(p.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
              filtroPeriodo === p.value
                ? "bg-[#0E9668] text-white"
                : "text-[#48605C] hover:bg-[#F3F8F7]"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {entidades.length === 0 ? (
        <div className="bg-white border border-[#DCE8E5] rounded-2xl p-10 text-center">
          <span className="material-symbols-outlined text-[#0E9668] text-4xl mb-2 block">bar_chart</span>
          <p className="text-[#48605C]">No hay topes activos para este período.</p>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <StatCard
              icon="account_balance"
              valor={entidades.length}
              etiqueta="Entidades con topes"
              color="#0F3D3E"
              tinte="#EDF2F1"
            />
            <StatCard
              icon="donut_large"
              valor={`${usoPromedio}%`}
              etiqueta="Uso promedio global"
              color="#0E9668"
              tinte="#D3F3E6"
            />
            <StatCard
              icon="warning"
              valor={enAlerta}
              etiqueta="Entidades en alerta (≥80%)"
              color="#BA1A1A"
              tinte="#FFDAD6"
            />
            <StatCard
              icon="paid"
              valor={totalPresupuesto > 0 ? `${Math.round((totalGastado / totalPresupuesto) * 100)}%` : "—"}
              etiqueta="Presupuesto consumido"
              color="#8A6D00"
              tinte="#F5EEDA"
              sub={
                totalPresupuesto > 0
                  ? `$${totalGastado.toLocaleString("es-CO")} de $${totalPresupuesto.toLocaleString("es-CO")}`
                  : "Sin presupuesto configurado"
              }
            />
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-4 mb-6">
            {/* Barras horizontales por EPS */}
            <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6">
              <h2 className="sax-display text-lg text-[#0F3D3E] mb-1">Uso por EPS</h2>
              <p className="text-xs text-[#48605C] mb-5">Citas usadas frente al máximo configurado, todas las especialidades sumadas.</p>
              <div className="space-y-4">
                {entidades.map((e) => {
                  const nivel = nivelUso(e.porcentaje);
                  return (
                    <div key={e.eps}>
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="font-semibold text-[#0F3D3E] text-sm truncate">{e.eps}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-[#48605C] sax-mono">
                            {e.usadas}/{e.maxCitas}
                          </span>
                          <span
                            className="text-xs font-bold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: nivel.tinte, color: nivel.color }}
                          >
                            {e.porcentaje}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-[#F3F8F7] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(e.porcentaje, 100)}%`, backgroundColor: nivel.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Donut de distribución por nivel */}
            <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 flex flex-col items-center">
              <h2 className="sax-display text-lg text-[#0F3D3E] self-start mb-1">Distribución de riesgo</h2>
              <p className="text-xs text-[#48605C] self-start mb-5">Por tope configurado, no por entidad.</p>

              <div
                className="w-40 h-40 rounded-full flex items-center justify-center shrink-0"
                style={{ background: donutGradient }}
              >
                <div className="w-24 h-24 rounded-full bg-white flex flex-col items-center justify-center">
                  <span className="sax-display text-2xl text-[#0F3D3E]">{totalTopes}</span>
                  <span className="text-[10px] text-[#48605C] uppercase tracking-wide">topes</span>
                </div>
              </div>

              <div className="w-full mt-6 space-y-2">
                {[
                  { key: "normal", label: "Normal", color: "#0E9668" },
                  { key: "alerta", label: "Alerta", color: "#8A6D00" },
                  { key: "critico", label: "Crítico / agotado", color: "#BA1A1A" },
                ].map((b) => (
                  <div key={b.key} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-[#48605C]">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      {b.label}
                    </span>
                    <span className="font-semibold text-[#0F3D3E]">{conteoDonut[b.key]}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Detalle por entidad */}
          <div>
            <h2 className="sax-display text-lg text-[#0F3D3E] mb-3">Detalle por entidad</h2>
            <div className="space-y-4">
              {entidades.map((e) => {
                const nivel = nivelUso(e.porcentaje);
                return (
                  <div key={e.eps} className="relative bg-white border border-[#DCE8E5] rounded-2xl overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: nivel.color }} />
                    <div className="pl-6 pr-5 py-5 sm:py-6">
                      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                            style={{ backgroundColor: nivel.tinte, color: nivel.color }}
                          >
                            <span className="material-symbols-outlined text-xl">account_balance</span>
                          </span>
                          <div>
                            <h3 className="font-semibold text-[#0F3D3E]">{e.eps}</h3>
                            <p className="text-xs text-[#48605C]">
                              {e.especialidades.length} tope{e.especialidades.length === 1 ? "" : "s"} configurado
                              {e.especialidades.length === 1 ? "" : "s"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {e.tienePresupuesto && (
                            <span className="text-xs text-[#48605C] sax-mono">
                              ${e.gastado.toLocaleString("es-CO")} / ${e.presupuestoMax.toLocaleString("es-CO")}
                            </span>
                          )}
                          <span
                            className="text-xs font-bold px-2.5 py-1 rounded-full"
                            style={{ backgroundColor: nivel.tinte, color: nivel.color }}
                          >
                            {e.porcentaje}% · {nivel.label}
                          </span>
                        </div>
                      </div>

                      <div className="w-full h-2 bg-[#F3F8F7] rounded-full overflow-hidden mb-4">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.min(e.porcentaje, 100)}%`, backgroundColor: nivel.color }}
                        />
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {e.especialidades.map((esp, i) => (
                          <span
                            key={i}
                            className="text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5"
                            style={{ backgroundColor: esp.nivel.tinte, color: esp.nivel.color }}
                          >
                            {esp.especialidad}
                            <span className="opacity-70">
                              {esp.usadas}/{esp.maxCitas} · {esp.porcentaje}%
                            </span>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
