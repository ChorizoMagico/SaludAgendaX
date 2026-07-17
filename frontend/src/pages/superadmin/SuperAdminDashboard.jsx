import { useEffect, useState } from "react";
import { TopBar, DashboardNav, navMobilePadding, DashboardStyles, DashboardBackground } from "../../context/ui";
import { useAuth } from "../../context/AuthContext";
import axiosClient from "../../api/axiosClient";
import SolicitudesPendientes from "./SolicitudesPendientes";
import TopesEps from "./TopesEps";
import RestriccionesFrecuencia from "./RestriccionesFrecuencia";
import AlertasTopes from "./AlertasTopes";
import ReportesTopes from "./ReportesTopes";

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
  const [contadores, setContadores] = useState({ solicitudes: 0, alertas: 0 });

  useEffect(() => {
    Promise.all([axiosClient.get("/solicitudes-pendientes/"), axiosClient.get("/alertas-topes/")])
      .then(([solicitudes, alertas]) => setContadores({
        solicitudes: solicitudes.data?.total ?? solicitudes.data?.solicitudes?.length ?? 0,
        alertas: alertas.data?.total ?? alertas.data?.alertas?.length ?? 0,
      }))
      .catch(() => setContadores({ solicitudes: 0, alertas: 0 }));
  }, []);

  const tabs = SECCIONES.map((seccion) => ({
    id: seccion.key, label: seccion.label, labelCorto: seccion.labelCorto, icon: seccion.icon,
    badge: seccion.key === "solicitudes" ? contadores.solicitudes : seccion.key === "alertas" ? contadores.alertas : undefined,
    badgeColor: seccion.key === "alertas" ? "danger" : "default",
  }));

  return <div className={`min-h-screen bg-[#FBFDFC] text-[#1A2624] ${navMobilePadding}`}>
    <DashboardBackground /><DashboardStyles /><TopBar nombre={`${superAdmin.nombre} ${superAdmin.apellido}`} />
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-8 py-6 md:py-8 flex flex-col md:flex-row gap-4 md:gap-6">
      <DashboardNav tabs={tabs} activo={seccionActiva} onChange={setSeccionActiva} />
      <main className="flex-1 min-w-0">
        {seccionActiva === "solicitudes" && <SolicitudesPendientes />}
        {seccionActiva === "topes" && <TopesEps />}
        {seccionActiva === "frecuencia" && <RestriccionesFrecuencia />}
        {seccionActiva === "alertas" && <AlertasTopes onIrATopes={() => setSeccionActiva("topes")} />}
        {seccionActiva === "reportes" && <ReportesTopes />}
      </main>
    </div>
  </div>;
}
