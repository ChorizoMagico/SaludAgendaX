import { useMemo, useState, useSyncExternalStore } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import startOfMonth from "date-fns/startOfMonth";
import addMonths from "date-fns/addMonths";
import getDay from "date-fns/getDay";
import addDays from "date-fns/addDays";
import addMinutes from "date-fns/addMinutes";
import es from "date-fns/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { DIAS_SEMANA, getPacientePorId, citasStore, excepcionesStore, DURACION_CITA_MIN } from "../../context/mockData";
import { TopBar, DashboardNav, navMobilePadding, Campo, CampoSolo, DashboardStyles } from "../../context/ui";
import { useAuth } from "../../context/AuthContext";

const TABS = [
  { id: "agenda", label: "Mi agenda", icon: "calendar_month" },
  { id: "especialidades", label: "Especialidades", icon: "medical_information" },
  { id: "disponibilidad", label: "Disponibilidad", icon: "schedule" },
  { id: "perfil", label: "Mi perfil", icon: "person" },
];

const TIPO_EXCEPCION = {
  bloqueo: { icon: "block", label: "Bloqueo", color: "#48605C", tinte: "#EDF2F1" },
  feriado: { icon: "celebration", label: "Feriado", color: "#8A6D00", tinte: "#F5EEDA" },
  vacacion: { icon: "flight_takeoff", label: "Vacaciones", color: "#0E9668", tinte: "#D3F3E6" },
};

// ---------- react-big-calendar: localizador en español, semana empieza en lunes ----------

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: es, weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

// Índice del día (getDay(): 0=domingo … 6=sábado) -> nombre usado en el horario del médico
const NOMBRE_POR_INDICE = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };

function combinarFechaYHora(fecha, horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  const d = new Date(fecha);
  d.setHours(h, m, 0, 0);
  return d;
}

function hoyISO() {
  return format(new Date(), "yyyy-MM-dd");
}

// Convierte "HH:mm" a minutos desde medianoche, para comparar rangos fácilmente
function horaAMinutos(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

// ¿El rango [inicioMin, finMin) se solapa con alguna cita ACTIVA
// (agendada/reprogramada) de este médico en esa fecha? Cada cita ocupa
// DURACION_CITA_MIN minutos desde su hora de inicio. Las citas canceladas
// o completadas no cuentan: ya no ocupan el horario.
function rangoChocaConCitaActiva(citasDelMedico, fechaStr, inicioMin, finMin) {
  return citasDelMedico.some((c) => {
    if (c.fecha !== fechaStr) return false;
    if (c.estado !== "agendada" && c.estado !== "reprogramada") return false;
    const citaInicio = horaAMinutos(c.hora);
    const citaFin = citaInicio + DURACION_CITA_MIN;
    return inicioMin < citaFin && citaInicio < finMin;
  });
}

export default function MedicoMiAgenda() {
  const { user: medico, updateProfile } = useAuth();
  const [tab, setTab] = useState("agenda");

  const todasLasCitas = useSyncExternalStore(citasStore.subscribe, citasStore.getSnapshot);
  const citas = todasLasCitas.filter((c) => c.medicoId === medico.id);

  // Excepciones ahora viven en un store compartido (excepcionesStore) en
  // vez de estado local: así el panel administrativo (TabCitas) también
  // puede consultarlas al agendar/reprogramar citas por un paciente y
  // evitar ofrecer horarios que este médico ya bloqueó.
  const todasLasExcepciones = useSyncExternalStore(excepcionesStore.subscribe, excepcionesStore.getSnapshot);
  const excepciones = todasLasExcepciones.filter((ex) => ex.medicoId === medico.id);

  const [vistaCalendario, setVistaCalendario] = useState(Views.WORK_WEEK); // WORK_WEEK = lunes a viernes
  const [fechaCalendario, setFechaCalendario] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [citaActiva, setCitaActiva] = useState(null); // detalle en panel lateral
  const [nuevaExcepcion, setNuevaExcepcion] = useState({
    fecha: "",
    tipo: "bloqueo",
    todoDia: true,
    horaInicio: "07:00",
    horaFin: "17:00",
    motivo: "",
  });
  const [errorExcepcion, setErrorExcepcion] = useState("");

  // Convierte las citas (con fecha/hora reales) en eventos para react-big-calendar.
  // El evento dura exactamente DURACION_CITA_MIN minutos (antes se forzaba
  // a 1 hora fija con addHours, sin importar la duración real de la cita).
  const eventos = useMemo(
    () =>
      citas.map((c) => {
        const inicio = combinarFechaYHora(new Date(`${c.fecha}T00:00:00`), c.hora);
        return {
          id: c.id,
          title: `${nombrePaciente(c.pacienteId)} — ${c.motivo || c.especialidad}`,
          start: inicio,
          end: addMinutes(inicio, DURACION_CITA_MIN),
          resource: c,
        };
      }),
    [citas]
  );

  // Citas que caen dentro del período visible (mes seleccionado, o semana si estás en Día/Semana)
  const citasDelPeriodo = useMemo(() => {
    if (vistaCalendario === Views.MONTH) {
      return citas.filter((c) => {
        const d = new Date(`${c.fecha}T00:00:00`);
        return d.getFullYear() === fechaCalendario.getFullYear() && d.getMonth() === fechaCalendario.getMonth();
      });
    }
    const inicioSemana = startOfWeek(fechaCalendario, { weekStartsOn: 1 });
    const finSemana = addDays(inicioSemana, 6);
    return citas.filter((c) => {
      const d = new Date(`${c.fecha}T00:00:00`);
      return d >= inicioSemana && d <= finSemana;
    });
  }, [citas, fechaCalendario, vistaCalendario]);

  const activasCount = citasDelPeriodo.filter((c) => c.estado === "agendada" || c.estado === "reprogramada").length;

  // Opciones del selector de mes: 3 meses atrás a 8 meses adelante desde hoy
  const opcionesDeMes = useMemo(() => {
    const base = startOfMonth(new Date());
    return Array.from({ length: 12 }, (_, i) => {
      const d = addMonths(base, i - 3);
      return { value: format(d, "yyyy-MM"), etiqueta: format(d, "MMMM yyyy", { locale: es }), fecha: d };
    });
  }, []);

  function navegar(delta) {
    if (vistaCalendario === Views.MONTH) {
      setFechaCalendario((d) => addMonths(d, delta));
    } else if (vistaCalendario === Views.DAY) {
      setFechaCalendario((d) => addDays(d, delta));
    } else {
      setFechaCalendario((d) => addDays(d, delta * 7));
    }
  }

  function irAHoy() {
    setFechaCalendario(vistaCalendario === Views.MONTH ? startOfMonth(new Date()) : startOfWeek(new Date(), { weekStartsOn: 1 }));
  }

  function irAMes(e) {
    const opt = opcionesDeMes.find((o) => o.value === e.target.value);
    if (!opt) return;
    setVistaCalendario(Views.MONTH);
    setFechaCalendario(startOfMonth(opt.fecha));
  }

  function eliminarCita(id) {
    citasStore.eliminar(id);
    setCitaActiva(null);
  }

  function agregarExcepcion(e) {
    e.preventDefault();
    setErrorExcepcion("");
    if (!nuevaExcepcion.fecha) return;

    if (nuevaExcepcion.fecha < hoyISO()) {
      setErrorExcepcion("No puedes bloquear una fecha que ya pasó.");
      return;
    }

    if (!nuevaExcepcion.todoDia) {
      if (nuevaExcepcion.horaInicio >= nuevaExcepcion.horaFin) {
        setErrorExcepcion("La hora de inicio debe ser antes que la hora de fin.");
        return;
      }
    }

    const horaReferencia = nuevaExcepcion.todoDia ? "23:59" : nuevaExcepcion.horaFin;
    const finExcepcion = combinarFechaYHora(new Date(`${nuevaExcepcion.fecha}T00:00:00`), horaReferencia);
    if (finExcepcion < new Date()) {
      setErrorExcepcion("Ese horario ya pasó. Elige una fecha u hora futura.");
      return;
    }

    // No se puede bloquear un rango (o el día completo) si ya hay una cita
    // activa de un paciente dentro de ese rango: primero hay que reprogramarla
    // o cancelarla, o bien bloquear solo las horas libres.
    const inicioMin = nuevaExcepcion.todoDia ? 0 : horaAMinutos(nuevaExcepcion.horaInicio);
    const finMin = nuevaExcepcion.todoDia ? 24 * 60 : horaAMinutos(nuevaExcepcion.horaFin);

    if (rangoChocaConCitaActiva(citas, nuevaExcepcion.fecha, inicioMin, finMin)) {
      setErrorExcepcion(
        nuevaExcepcion.todoDia
          ? "No puedes bloquear el día completo: tienes citas agendadas ese día. Bloquea solo las franjas sin citas, o reprograma/cancela esas citas primero."
          : "Ese rango de horas choca con una cita ya agendada. Elige otro horario o reprograma esa cita primero."
      );
      return;
    }

    excepcionesStore.agregar({ ...nuevaExcepcion, medicoId: medico.id });
    setNuevaExcepcion({
      fecha: "",
      tipo: "bloqueo",
      todoDia: true,
      horaInicio: "07:00",
      horaFin: "17:00",
      motivo: "",
    });
  }

  function eliminarExcepcion(id) {
    excepcionesStore.eliminar(id);
  }

  // Color del evento según estado (agendada / completada / reprogramada / cancelada)
  function eventPropGetter(event) {
    const colores = {
      completada: "#48605C",
      cancelada: "#BA1A1A",
      reprogramada: "#8A6D00",
    };
    return {
      style: {
        backgroundColor: colores[event.resource.estado] ?? "#0E9668",
        borderRadius: "6px",
        border: "none",
        fontSize: "0.75rem",
      },
    };
  }

  function excepcionesEnFecha(fechaStr) {
    return excepciones.filter((ex) => ex.fecha === fechaStr);
  }

  // Sombrea el día completo cuando hay un bloqueo de "todo el día" (vacaciones, feriado, bloqueo largo)
  function dayPropGetter(date) {
    const fechaStr = format(date, "yyyy-MM-dd");
    const exDia = excepcionesEnFecha(fechaStr).find((ex) => ex.todoDia);
    if (exDia) {
      const t = TIPO_EXCEPCION[exDia.tipo];
      return {
        style: {
          backgroundColor: t.tinte,
          backgroundImage: `repeating-linear-gradient(135deg, ${t.color}30, ${t.color}30 8px, transparent 8px, transparent 16px)`,
        },
      };
    }
    return {};
  }

  // Sombrea franjas fuera del horario del médico y franjas bloqueadas
  // puntualmente. Usa `medico.horario` (editable por administración por
  // médico) en vez de la plantilla genérica HORARIO_BASE — antes esta
  // franja siempre mostraba el mismo horario "de fábrica" sin importar lo
  // que el admin hubiera configurado para este médico en particular.
  function slotPropGetter(date) {
    const fechaStr = format(date, "yyyy-MM-dd");
    const hhmm = format(date, "HH:mm");

    const exFranja = excepcionesEnFecha(fechaStr).find(
      (ex) => !ex.todoDia && hhmm >= ex.horaInicio && hhmm < ex.horaFin
    );
    if (exFranja) {
      const t = TIPO_EXCEPCION[exFranja.tipo];
      return {
        style: {
          backgroundColor: t.tinte,
          backgroundImage: `repeating-linear-gradient(135deg, ${t.color}40, ${t.color}40 6px, transparent 6px, transparent 12px)`,
          borderLeft: `3px solid ${t.color}`,
        },
      };
    }

    const diaNombre = NOMBRE_POR_INDICE[getDay(date)];
    const horario = diaNombre && medico.horario?.[diaNombre];
    if (!horario) {
      return {
        style: {
          backgroundColor: "#EAEEEC",
          backgroundImage: "repeating-linear-gradient(135deg, #D5DEDA 0, #D5DEDA 4px, transparent 4px, transparent 11px)",
        },
      };
    }

    const dentroDeHorario = hhmm >= horario.inicio && hhmm < horario.fin;
    return {
      style: {
        backgroundColor: dentroDeHorario ? "#FFFFFF" : "#EAEEEC",
        backgroundImage: dentroDeHorario
          ? "none"
          : "repeating-linear-gradient(135deg, #D5DEDA 0, #D5DEDA 4px, transparent 4px, transparent 11px)",
      },
    };
  }

  return (
    <div className="min-h-screen bg-[#FBFDFC] text-[#1A2624]">
      <DashboardStyles />
      <TopBar nombre={`${medico.nombre} ${medico.apellido}`} />

      <div className={`max-w-[1200px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8 ${navMobilePadding}`}>
        <DashboardNav tabs={TABS} activo={tab} onChange={setTab} />

        <main className="flex-1 min-w-0">
          {/* ---------------- MI AGENDA ---------------- */}
          {tab === "agenda" && (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
                  <div>
                    <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">
                      Dr(a). {medico.apellido}
                    </p>
                    <h1 className="sax-display text-2xl text-[#0F3D3E]">Mi agenda</h1>
                  </div>
                  <div className="flex bg-[#F3F8F7] rounded-full p-1">
                    <button
                      onClick={() => setVistaCalendario(Views.DAY)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                        vistaCalendario === Views.DAY ? "bg-white text-[#0F3D3E] shadow-sm" : "text-[#48605C]"
                      }`}
                    >
                      Día
                    </button>
                    <button
                      onClick={() => setVistaCalendario(Views.WORK_WEEK)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                        vistaCalendario === Views.WORK_WEEK ? "bg-white text-[#0F3D3E] shadow-sm" : "text-[#48605C]"
                      }`}
                    >
                      Semana
                    </button>
                    <button
                      onClick={() => setVistaCalendario(Views.MONTH)}
                      className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 ${
                        vistaCalendario === Views.MONTH ? "bg-white text-[#0F3D3E] shadow-sm" : "text-[#48605C]"
                      }`}
                    >
                      Mes
                    </button>
                  </div>
                </div>

                <p className="text-sm text-[#48605C] mb-3">
                  Tienes <span className="font-semibold text-[#0F3D3E]">{activasCount}</span> citas activas{" "}
                  {vistaCalendario === Views.MONTH ? "este mes" : "esta semana"}.
                </p>

                {/* Cabecera propia del calendario: mes/semana en español + navegación + filtro por mes */}
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => navegar(-1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F3F8F7] text-[#48605C] transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">chevron_left</span>
                    </button>
                    <span className="sax-display text-base text-[#0F3D3E] capitalize min-w-[170px] text-center">
                      {vistaCalendario === Views.MONTH
                        ? format(fechaCalendario, "MMMM yyyy", { locale: es })
                        : vistaCalendario === Views.DAY
                        ? format(fechaCalendario, "EEEE d 'de' MMMM", { locale: es })
                        : `Semana del ${format(startOfWeek(fechaCalendario, { weekStartsOn: 1 }), "d MMM", { locale: es })}`}
                    </span>
                    <button
                      onClick={() => navegar(1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F3F8F7] text-[#48605C] transition-colors"
                    >
                      <span className="material-symbols-outlined text-xl">chevron_right</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs text-[#48605C] font-semibold uppercase tracking-wide">
                      Ver mes
                    </label>
                    <select
                      value={format(fechaCalendario, "yyyy-MM")}
                      onChange={irAMes}
                      className="border border-[#DCE8E5] rounded-lg px-2.5 py-1.5 text-sm capitalize focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                    >
                      {opcionesDeMes.map((o) => (
                        <option key={o.value} value={o.value} className="capitalize">
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={irAHoy}
                      className="text-sm font-semibold text-[#0E9668] hover:underline px-1"
                    >
                      Hoy
                    </button>
                  </div>
                </div>

                {/* Leyenda */}
                <div className="flex flex-wrap gap-2 mb-4 text-xs">
                  <Leyenda color="#0E9668" label="Agendada" />
                  <Leyenda color="#8A6D00" label="Reprogramada" />
                  <Leyenda color="#48605C" label="Completada" />
                  <Leyenda
                    label="Fuera de horario"
                    estilo={{
                      backgroundColor: "#EAEEEC",
                      backgroundImage:
                        "repeating-linear-gradient(135deg, #B9C6C1 0, #B9C6C1 2px, transparent 2px, transparent 5px)",
                    }}
                  />
                  <Leyenda
                    label="Bloqueado"
                    estilo={{
                      backgroundColor: "#EDF2F1",
                      backgroundImage:
                        "repeating-linear-gradient(135deg, #48605C 0, #48605C 2px, transparent 2px, transparent 5px)",
                    }}
                  />
                </div>

                <div className="border border-[#DCE8E5] rounded-2xl overflow-hidden bg-white p-1.5 sm:p-2 shadow-sm saludagendax-calendar">
                  <Calendar
                    localizer={localizer}
                    culture="es"
                    events={eventos}
                    view={vistaCalendario}
                    onView={setVistaCalendario}
                    date={fechaCalendario}
                    onNavigate={setFechaCalendario}
                    views={[Views.MONTH, Views.WORK_WEEK, Views.DAY]}
                    toolbar={false}
                    min={new Date(1970, 0, 1, 7, 0)}
                    max={new Date(1970, 0, 1, 17, 0)}
                    step={30}
                    timeslots={2}
                    style={{ height: 500 }}
                    className="!h-[500px] sm:!h-[600px]"
                    eventPropGetter={eventPropGetter}
                    slotPropGetter={slotPropGetter}
                    dayPropGetter={dayPropGetter}
                    onSelectEvent={(event) => setCitaActiva(event.resource)}
                    messages={{
                      today: "Hoy",
                      previous: "Anterior",
                      next: "Siguiente",
                      day: "Día",
                      week: "Semana",
                      work_week: "Semana",
                      month: "Mes",
                      showMore: (total) => `+${total} más`,
                      noEventsInRange: "No hay citas en este rango.",
                    }}
                  />
                </div>
              </div>

              {/* Panel de detalle de cita — estilo talón de tiquete */}
              {citaActiva && (
                <aside className="lg:w-80 shrink-0 bg-white border border-[#DCE8E5] rounded-2xl overflow-hidden h-fit shadow-sm">
                  <div
                    className="px-6 py-4 flex justify-between items-center"
                    style={{ backgroundColor: ESTADO_COLOR[citaActiva.estado] ?? "#0E9668" }}
                  >
                    <h3 className="sax-display text-lg text-white">Detalle de la cita</h3>
                    <button onClick={() => setCitaActiva(null)} className="text-white/80 hover:text-white">
                      <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                  </div>
                  <dl className="flex flex-col gap-3 text-sm p-6">
                    <DetalleFila icon="person" etiqueta="Paciente" valor={nombrePaciente(citaActiva.pacienteId)} />
                    <DetalleFila icon="medical_information" etiqueta="Especialidad" valor={citaActiva.especialidad} />
                    <DetalleFila icon="location_on" etiqueta="Sede" valor={citaActiva.sede} />
                    <DetalleFila
                      icon="schedule"
                      etiqueta="Fecha y hora"
                      valor={`${citaActiva.fecha} · ${citaActiva.hora}`}
                      mono
                    />
                    <DetalleFila icon="edit_note" etiqueta="Motivo" valor={citaActiva.motivo} />
                    <DetalleFila icon="info" etiqueta="Estado" valor={citaActiva.estado} capitalizar />
                  </dl>

                  {citaActiva.estado === "cancelada" && (
                    <div className="px-6 pb-6">
                      <button
                        onClick={() => eliminarCita(citaActiva.id)}
                        className="w-full bg-[#BA1A1A] text-white px-4 py-2.5 rounded-full text-sm font-semibold hover:opacity-90 transition-colors duration-200 flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                        Eliminar cita cancelada
                      </button>
                      <p className="text-xs text-[#48605C] mt-2 text-center">
                        Si no la eliminas, otro paciente
                        puede agendar en este horario y la cita cancelada se borrará automáticamente.
                      </p>
                    </div>
                  )}
                </aside>
              )}
            </div>
          )}

          {/* ---------------- ESPECIALIDADES (+ sede) ---------------- */}
          {tab === "especialidades" && (
            <div className="max-w-lg flex flex-col gap-9">
              <div>
                <h1 className="sax-display text-2xl text-[#0F3D3E] mb-2">Mis especialidades</h1>
                <p className="text-sm text-[#48605C] mb-6">
                  Asignadas a tu perfil por el personal administrativo. No son editables desde aquí.
                </p>
                <div className="flex flex-wrap gap-3">
                  {medico.especialidades.map((esp) => (
                    <div
                      key={esp}
                      className="flex items-center gap-2 bg-[#D3F3E6] text-[#0E9668] px-4 py-2 rounded-full font-semibold text-sm"
                    >
                      <span className="material-symbols-outlined text-lg">verified</span>
                      {esp}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="sax-display text-xl text-[#0F3D3E] mb-2">Mi sede</h2>
                <p className="text-sm text-[#48605C] mb-4">También asignada por administración.</p>
                <div className="flex items-center gap-3 bg-white border border-[#DCE8E5] px-5 py-4 rounded-2xl w-fit shadow-sm">
                  <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#D3F3E6] text-[#0E9668] shrink-0">
                    <span className="material-symbols-outlined text-xl">location_on</span>
                  </span>
                  <span className="font-semibold text-[#0F3D3E]">{medico.sede}</span>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- DISPONIBILIDAD ---------------- */}
          {tab === "disponibilidad" && (
            <div className="flex flex-col gap-9 max-w-2xl">
              <div>
                <h1 className="sax-display text-2xl text-[#0F3D3E] mb-2">Mi horario</h1>
                <p className="text-sm text-[#48605C] mb-4">
                  Definido por el personal administrativo.
                </p>
                <div className="border border-[#DCE8E5] rounded-2xl overflow-hidden shadow-sm">
                  {DIAS_SEMANA.map((d, i) => {
                    const franja = medico.horario?.[d];
                    return (
                      <div
                        key={d}
                        className={`flex items-center justify-between px-5 py-3.5 text-sm ${
                          i % 2 === 0 ? "bg-white" : "bg-[#F3F8F7]"
                        }`}
                      >
                        <span className="font-semibold text-[#0F3D3E] flex items-center gap-2">
                          <span className="material-symbols-outlined text-lg text-[#9AAFAB]">calendar_today</span>
                          {d}
                        </span>
                        <span className="sax-mono text-[#48605C]">
                          {franja ? `${franja.inicio} – ${franja.fin}` : "Día libre"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h2 className="sax-display text-xl text-[#0F3D3E] mb-2">Excepciones</h2>
                <p className="text-sm text-[#48605C] mb-4">
                  Bloquea fechas puntuales por vacaciones, feriados o imprevistos. Puedes bloquear el día completo
                  o solo un rango de horas. No se puede bloquear un horario donde ya tengas una cita agendada.
                </p>

                <form
                  onSubmit={agregarExcepcion}
                  className="bg-white border border-[#DCE8E5] rounded-2xl p-5 flex flex-col gap-4 mb-6 shadow-sm"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-[#0F3D3E]">Fecha</label>
                      <input
                        type="date"
                        value={nuevaExcepcion.fecha}
                        min={hoyISO()}
                        onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, fecha: e.target.value })}
                        className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-semibold text-[#0F3D3E]">Tipo</label>
                      <select
                        value={nuevaExcepcion.tipo}
                        onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, tipo: e.target.value })}
                        className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                      >
                        <option value="bloqueo">Bloqueo</option>
                        <option value="feriado">Feriado</option>
                        <option value="vacacion">Vacaciones</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-sm font-semibold text-[#0F3D3E]">
                    <input
                      type="checkbox"
                      checked={nuevaExcepcion.todoDia}
                      onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, todoDia: e.target.checked })}
                      className="w-4 h-4 accent-[#0E9668]"
                    />
                    Bloquear el día completo
                  </label>

                  {!nuevaExcepcion.todoDia && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-[#0F3D3E]">Desde</label>
                        <input
                          type="time"
                          value={nuevaExcepcion.horaInicio}
                          onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, horaInicio: e.target.value })}
                          className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-semibold text-[#0F3D3E]">Hasta</label>
                        <input
                          type="time"
                          value={nuevaExcepcion.horaFin}
                          onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, horaFin: e.target.value })}
                          className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#0F3D3E]">Motivo (opcional)</label>
                    <input
                      type="text"
                      value={nuevaExcepcion.motivo}
                      onChange={(e) => setNuevaExcepcion({ ...nuevaExcepcion, motivo: e.target.value })}
                      className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                    />
                  </div>

                  {errorExcepcion && (
                    <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{errorExcepcion}</p>
                  )}

                  <button
                    type="submit"
                    className="self-start bg-[#0E9668] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-[#0C7D57] transition-colors duration-200 flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                    Agregar excepción
                  </button>
                </form>

                {excepciones.length === 0 ? (
                  <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-xl px-4 py-3">
                    No tienes excepciones registradas.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {excepciones.map((ex) => {
                      const t = TIPO_EXCEPCION[ex.tipo];
                      return (
                        <div
                          key={ex.id}
                          className="flex items-center justify-between border border-[#DCE8E5] rounded-2xl px-4 py-3 bg-white"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
                              style={{ backgroundColor: t.tinte, color: t.color }}
                            >
                              <span className="material-symbols-outlined text-lg">{t.icon}</span>
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[#0F3D3E] text-sm">
                                {t.label} <span className="sax-mono font-normal text-[#48605C]">{ex.fecha}</span>
                                {!ex.todoDia && (
                                  <span className="sax-mono font-normal text-[#48605C]">
                                    {" "}
                                    · {ex.horaInicio}–{ex.horaFin}
                                  </span>
                                )}
                              </p>
                              {ex.motivo && <p className="text-xs text-[#48605C] truncate">{ex.motivo}</p>}
                            </div>
                          </div>
                          <button
                            onClick={() => eliminarExcepcion(ex.id)}
                            className="text-[#BA1A1A] hover:bg-[#FFDAD6] p-2 rounded-full transition-colors shrink-0"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------- MI PERFIL ---------------- */}
          {tab === "perfil" && <PerfilMedico medico={medico} onGuardar={updateProfile} />}
        </main>
      </div>
    </div>
  );

  function nombrePaciente(pacienteId) {
    const p = getPacientePorId(pacienteId);
    return p ? `${p.nombre} ${p.apellido}` : "—";
  }
}

const ESTADO_COLOR = {
  agendada: "#0E9668",
  reprogramada: "#8A6D00",
  completada: "#48605C",
  cancelada: "#BA1A1A",
};

/* ============================================================
   Componentes de presentación locales a esta pantalla
   ============================================================ */

function Leyenda({ color, label, estilo }) {
  return (
    <span className="flex items-center gap-1.5 bg-white border border-[#DCE8E5] rounded-full pl-1.5 pr-3 py-1 text-[#48605C]">
      <span
        className="w-3 h-3 rounded-full inline-block border border-[#DCE8E5]"
        style={estilo ?? { backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function DetalleFila({ icon, etiqueta, valor, mono, capitalizar }) {
  return (
    <div className="flex items-start gap-3">
      <span className="material-symbols-outlined text-lg text-[#9AAFAB] mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <dt className="text-[#48605C] text-xs uppercase tracking-wide">{etiqueta}</dt>
        <dd className={`font-semibold text-[#0F3D3E] ${mono ? "sax-mono" : ""} ${capitalizar ? "capitalize" : ""}`}>
          {valor}
        </dd>
      </div>
    </div>
  );
}

function PerfilMedico({ medico, onGuardar }) {
  const [form, setForm] = useState({
    nombre: medico.nombre,
    apellido: medico.apellido,
    correo: medico.correo,
    telefono: medico.telefono,
    direccion: medico.direccion,
  });
  const [guardado, setGuardado] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
    setGuardado(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await onGuardar(form);
    setGuardado(true);
  }

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 md:p-8 max-w-lg shadow-sm">
      <div className="flex items-center gap-3 mb-1">
        <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#D3F3E6] text-[#0E9668] shrink-0">
          <span className="material-symbols-outlined text-xl">person</span>
        </span>
        <h2 className="sax-display text-2xl text-[#0F3D3E]">Mi perfil</h2>
      </div>
      <p className="text-sm text-[#48605C] mb-6 ml-[52px]">
        Actualiza tus datos de contacto. Tu sede y especialidades las gestiona administración.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Nombre" name="nombre" value={form.nombre} onChange={handleChange} />
          <Campo label="Apellido" name="apellido" value={form.apellido} onChange={handleChange} />
        </div>

        <Campo label="Correo electrónico" name="correo" type="email" value={form.correo} onChange={handleChange} />
        <Campo label="Teléfono" name="telefono" value={form.telefono} onChange={handleChange} />
        <Campo label="Dirección" name="direccion" value={form.direccion} onChange={handleChange} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <CampoSolo label="Sede" value={medico.sede} />
          <CampoSolo label="Especialidades" value={medico.especialidades.join(", ")} />
        </div>

        {guardado && (
          <p className="text-sm text-[#0E9668] bg-[#D3F3E6] px-3 py-2 rounded-lg flex items-center gap-2">
            <span className="material-symbols-outlined text-lg">check_circle</span>
            Cambios guardados correctamente.
          </p>
        )}

        <button
          type="submit"
          className="self-start bg-[#0E9668] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
        >
          Guardar cambios
        </button>
      </form>
    </div>
  );
}