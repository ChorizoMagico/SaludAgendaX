import { useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import {
  subscribeUsuarios,
  getSolicitudesPendientes,
  topesEpsStore,
  citasStore,
  getAlertasTopes,
} from "../../context/mockData";
import { TopBar, DashboardNav, navMobilePadding, DashboardStyles, DashboardBackground } from "../../context/ui";
import { useAuth } from "../../context/AuthContext";

import SolicitudesPendientes from "./SolicitudesPendientes";
import TopesEps from "./TopesEps";
import RestriccionesFrecuencia from "./RestriccionesFrecuencia";
import AlertasTopes from "./AlertasTopes";
import ReportesTopes from "./ReportesTopes";

// Secciones del panel — cada una vive en su propio archivo para no terminar
// con un componente gigante.
const SECCIONES = [
  { key: "solicitudes", label: "Solicitudes de registro", labelCorto: "Solicitudes", icon: "how_to_reg" },
  { key: "topes", label: "Topes de citas por EPS", labelCorto: "Topes", icon: "account_balance" },
  { key: "frecuencia", label: "Restricciones de frecuencia", labelCorto: "Frecuencia", icon: "event_repeat" },
  { key: "alertas", label: "Alertas de topes", labelCorto: "Alertas", icon: "warning" },
  { key: "reportes", label: "Reportes de topes", labelCorto: "Reportes", icon: "insights" },
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

  const tabs = SECCIONES.map((s) => ({
    id: s.key,
    label: s.label,
    labelCorto: s.labelCorto,
    icon: s.icon,
    badge: s.key === "solicitudes" ? totalSolicitudes : s.key === "alertas" ? totalAlertas : undefined,
    badgeColor: s.key === "alertas" ? "danger" : "default",
  }));

  return (
    <div className={`min-h-screen bg-[#FBFDFC] text-[#1A2624] ${navMobilePadding}`}>
      <DashboardBackground />
      <DashboardStyles />
      <TopBar nombre={`${superAdmin.nombre} ${superAdmin.apellido}`} />

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 flex flex-col md:flex-row gap-4 md:gap-6">
        <DashboardNav tabs={tabs} activo={seccionActiva} onChange={setSeccionActiva} />

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