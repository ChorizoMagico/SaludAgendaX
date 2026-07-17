import { useEffect, useState, useSyncExternalStore } from "react";
import { getMedicos, getMedicoPorId, getPacientePorId, citasStore } from "../../context/mockData";
import { TopBar, DashboardNav, DashboardBackground, navMobilePadding, EstadoBadge, DashboardStyles } from "../../context/ui";
import { useAuth } from "../../context/AuthContext";
import axiosClient, { extraerMensajeError } from "../../api/axiosClient";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

import TabCitas from "./AdminCitas";
import { TabMedicos, TabEspecialidades } from "./AdminMedicosEspecialidades";
import TabPacientes from "./AdminPacientes";
import TabReportes from "./AdminReportes";

const TABS = [
  { id: "inicio", label: "Dashboard", icon: "dashboard" },
  { id: "citas", label: "Citas", icon: "calendar_month" },
  { id: "medicos", label: "Médicos", icon: "stethoscope" },
  { id: "especialidades", label: "Especialidades", icon: "medical_information" },
  { id: "pacientes", label: "Pacientes", icon: "groups" },
  { id: "reportes", label: "Reportes", icon: "bar_chart" },
];

// ---------- Constantes y componentes compartidos entre tabs ----------
// Se exportan desde aquí (el archivo "principal") para que AdminCitas,
// AdminPacientes y AdminReportes los reutilicen sin duplicar código.

export const ESTADOS_CITA = ["agendada", "reprogramada", "completada", "cancelada"];

export const ESTADO_ACCENT = {
  agendada: { color: "#0E9668", tinte: "#D3F3E6" },
  reprogramada: { color: "#8A6D00", tinte: "#F5EEDA" },
  completada: { color: "#48605C", tinte: "#EDF2F1" },
  cancelada: { color: "#BA1A1A", tinte: "#FFDAD6" },
};

export const ESTADO_ICONO = {
  agendada: "event_available",
  reprogramada: "update",
  completada: "task_alt",
  cancelada: "cancel",
};

// Muestra "Agendada", "Completada", etc. sin tocar el valor real (que sigue
// en minúscula para comparaciones y para las llaves de ESTADO_ACCENT/ESTADO_ICONO).
export function capitalizarPrimera(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

export function StatCard({ icon, valor, etiqueta, color, tinte, truncar }) {
  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 flex items-center gap-4">
      <span
        className="flex items-center justify-center w-11 h-11 rounded-full shrink-0"
        style={{ backgroundColor: tinte, color }}
      >
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className={`sax-display text-xl text-[#0F3D3E] ${truncar ? "truncate" : ""}`}>{valor}</p>
        <p className="text-xs text-[#48605C] uppercase tracking-wide">{etiqueta}</p>
      </div>
    </div>
  );
}

export function FilaCitaResumen({ cita }) {
  const acc = ESTADO_ACCENT[cita.estado] ?? ESTADO_ACCENT.agendada;
  const medico = getMedicoPorId(cita.medicoId);
  const paciente = getPacientePorId(cita.pacienteId);
  return (
    <div className="flex items-center justify-between bg-white border border-[#DCE8E5] rounded-xl px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <span className="sax-mono text-sm font-semibold shrink-0" style={{ color: acc.color }}>
          {cita.hora}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[#0F3D3E] text-sm truncate">
            {paciente ? `${paciente.nombre} ${paciente.apellido}` : "—"} · {cita.especialidad}
          </p>
          <p className="text-xs text-[#48605C] truncate">
            {medico ? `Dr(a). ${medico.nombre} ${medico.apellido}` : "—"} · {cita.sede}
          </p>
        </div>
      </div>
      <EstadoBadge estado={cita.estado} />
    </div>
  );
}

export default function AdminDashboard() {
  const { user: admin } = useAuth();
  const [tab, setTab] = useState("inicio");
  const [citasReales, setCitasReales] = useState([]);
  const [errorApi, setErrorApi] = useState("");

  const todasLasCitas = useSyncExternalStore(citasStore.subscribe, citasStore.getSnapshot);
  useEffect(() => {
    if (USE_MOCK) return;
    axiosClient.get("/citas/", { params: { page_size: 100 } })
      .then(({ data }) => setCitasReales(data.results ?? data))
      .catch((error) => setErrorApi(extraerMensajeError(error, "No fue posible cargar las citas.")));
  }, []);
  const citas = USE_MOCK ? todasLasCitas : citasReales.map((cita) => ({
    id: cita.id,
    fecha: cita.fecha,
    hora: cita.hora_inicio?.slice(0, 5),
    estado: cita.estado === "CANCELADA" ? "cancelada" : "agendada",
    especialidad: cita.especialidad_nombre,
    pacienteNombre: cita.paciente_nombre || "Paciente",
    medicoNombre: cita.medico_nombre || "Médico",
  }));

  return (
    <div className="min-h-screen bg-[#FBFDFC] text-[#1A2624]">
      <DashboardBackground />
      <DashboardStyles />
      <TopBar nombre={`${admin.nombre} ${admin.apellido}`} />

      <div className={`max-w-[1200px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8 ${navMobilePadding}`}>
        <DashboardNav tabs={TABS} activo={tab} onChange={setTab} />

        <main className="flex-1 min-w-0">
          {errorApi && <p className="mb-4 text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{errorApi}</p>}
          {tab === "inicio" && <TabInicio todasLasCitas={citas} onIrACitas={() => setTab("citas")} />}
          {tab === "citas" && <TabCitas todasLasCitas={citas} />}
          {tab === "medicos" && <TabMedicos todasLasCitas={citas} />}
          {tab === "especialidades" && <TabEspecialidades />}
          {tab === "pacientes" && <TabPacientes todasLasCitas={citas} />}
          {tab === "reportes" && <TabReportes todasLasCitas={citas} />}
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: Dashboard principal (flujo 5.1)
   ============================================================ */

function TabInicio({ todasLasCitas, onIrACitas }) {
  const hoy = hoyISO();

  const citasHoy = todasLasCitas.filter((c) => c.fecha === hoy);
  const completadasHoy = citasHoy.filter((c) => c.estado === "completada").length;
  const pendientesHoy = citasHoy.filter((c) => c.estado === "agendada" || c.estado === "reprogramada").length;
  const canceladasHoy = citasHoy.filter((c) => c.estado === "cancelada").length;

  const activas = todasLasCitas.filter((c) => c.estado === "agendada" || c.estado === "reprogramada").length;
  const ocupacion = todasLasCitas.length === 0 ? 0 : Math.round((activas / todasLasCitas.length) * 100);

  const medicos = getMedicos();
  const medicosActivos = medicos.filter((m) => m.activo !== false).length;

  const conteoPorEspecialidad = {};
  todasLasCitas.forEach((c) => {
    conteoPorEspecialidad[c.especialidad] = (conteoPorEspecialidad[c.especialidad] || 0) + 1;
  });
  const especialidadTop = Object.entries(conteoPorEspecialidad).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Panel administrativo</p>
        <h1 className="sax-display text-3xl text-[#0F3D3E]">Resumen general</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon="event" valor={citasHoy.length} etiqueta="Citas hoy" color="#0F3D3E" tinte="#EDF2F1" />
        <StatCard icon="check_circle" valor={completadasHoy} etiqueta="Completadas hoy" color="#48605C" tinte="#EDF2F1" />
        <StatCard icon="hourglass_top" valor={pendientesHoy} etiqueta="Pendientes hoy" color="#0E9668" tinte="#D3F3E6" />
        <StatCard icon="cancel" valor={canceladasHoy} etiqueta="Canceladas hoy" color="#BA1A1A" tinte="#FFDAD6" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon="donut_large" valor={`${ocupacion}%`} etiqueta="Citas activas del total" color="#0E9668" tinte="#D3F3E6" />
        <StatCard icon="stethoscope" valor={medicosActivos} etiqueta="Médicos activos" color="#0F3D3E" tinte="#EDF2F1" />
        <StatCard
          icon="medical_information"
          valor={especialidadTop ? especialidadTop[0] : "—"}
          etiqueta="Especialidad más demandada"
          color="#8A6D00"
          tinte="#F5EEDA"
          truncar
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="sax-display text-xl text-[#0F3D3E]">Citas de hoy</h2>
          <button onClick={onIrACitas} className="text-sm font-semibold text-[#0E9668] hover:underline">
            Ver todas las citas →
          </button>
        </div>
        {citasHoy.length === 0 ? (
          <p className="text-sm text-[#48605C] bg-white border border-[#DCE8E5] rounded-xl px-4 py-3">
            No hay citas programadas para hoy.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {citasHoy
              .sort((a, b) => a.hora.localeCompare(b.hora))
              .map((c) => (
                <FilaCitaResumen key={c.id} cita={c} />
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
