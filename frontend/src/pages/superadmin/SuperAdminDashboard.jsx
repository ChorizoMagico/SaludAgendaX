import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import {
  subscribeUsuarios,
  getSolicitudesPendientes,
  topesEpsStore,
  citasStore,
  getAlertasTopes,
} from "../../context/mockData";
import { TopBar, navMobilePadding, DashboardStyles } from "../../context/ui";
import { useAuth } from "../../context/AuthContext";

import SolicitudesPendientes from "./SolicitudesPendientes";
import TopesEps from "./TopesEps";
import RestriccionesFrecuencia from "./RestriccionesFrecuencia";
import AlertasTopes from "./AlertasTopes";
import ReportesTopes from "./ReportesTopes";

// Secciones del panel — cada una vive en su propio archivo para no terminar
// con un componente gigante. `badge` es una función porque el conteo debe
// recalcularse en cada render (depende de los stores reactivos de abajo).
const SECCIONES = [
  { key: "solicitudes", label: "Solicitudes de registro", icon: "how_to_reg" },
  { key: "topes", label: "Topes de citas por EPS", icon: "account_balance" },
  { key: "frecuencia", label: "Restricciones de frecuencia", icon: "event_repeat" },
  { key: "alertas", label: "Alertas de topes", icon: "warning" },
  { key: "reportes", label: "Reportes de topes", icon: "insights" },
];

export default function SuperAdminDashboard() {
  const { user: superAdmin } = useAuth();
  const [seccionActiva, setSeccionActiva] = useState("solicitudes");

  // Suscripciones que solo existen para recalcular los contadores de las
  // pestañas (solicitudes pendientes / alertas críticas) cada vez que algo
  // relevante cambia en los stores compartidos.
  useSyncExternalStore(subscribeUsuarios, () => getSolicitudesPendientes().length);
  useSyncExternalStore(topesEpsStore.subscribe, topesEpsStore.getSnapshot);
  useSyncExternalStore(citasStore.subscribe, citasStore.getSnapshot);

  const totalSolicitudes = getSolicitudesPendientes().length;
  const totalAlertas = getAlertasTopes().length;

  const contadores = {
    solicitudes: totalSolicitudes,
    alertas: totalAlertas,
  };

  return (
    <div className="min-h-screen bg-[#FBFDFC] text-[#1A2624]">
      <DashboardStyles />
      <TopBar nombre={`${superAdmin.nombre} ${superAdmin.apellido}`} />

      <div className={`max-w-[1200px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-6 ${navMobilePadding}`}>
        {/* Navegación lateral */}
        <nav className="md:w-64 shrink-0">
          <div className="bg-white border border-[#DCE8E5] rounded-2xl p-2 flex md:flex-col gap-1 overflow-x-auto">
            {SECCIONES.map((s) => {
              const activo = s.key === seccionActiva;
              const contador = contadores[s.key];
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSeccionActiva(s.key)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-colors duration-200 ${
                    activo
                      ? "bg-[#D3F3E6] text-[#0F3D3E]"
                      : "text-[#48605C] hover:bg-[#F3F8F7]"
                  }`}
                >
                  <span className={`material-symbols-outlined text-xl ${activo ? "text-[#0E9668]" : ""}`}>
                    {s.icon}
                  </span>
                  <span className="flex-1 text-left">{s.label}</span>
                  {!!contador && (
                    <span
                      className={`text-xs font-bold rounded-full min-w-[1.4rem] h-5 px-1.5 flex items-center justify-center ${
                        s.key === "alertas" ? "bg-[#FFDAD6] text-[#BA1A1A]" : "bg-[#0E9668] text-white"
                      }`}
                    >
                      {contador}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Contenido de la sección activa */}
        <main className="flex-1 min-w-0">
          {seccionActiva === "solicitudes" && <SolicitudesPendientes />}
          {seccionActiva === "topes" && <TopesEps />}
          {seccionActiva === "frecuencia" && <RestriccionesFrecuencia />}
          {seccionActiva === "alertas" && <AlertasTopes onIrATopes={() => setSeccionActiva("topes")} />}
          {seccionActiva === "reportes" && <ReportesTopes />}
        </main>
      </div>
    </div>
  );
}