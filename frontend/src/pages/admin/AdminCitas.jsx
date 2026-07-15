import { useMemo, useState, useSyncExternalStore } from "react";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import startOfMonth from "date-fns/startOfMonth";
import addMonths from "date-fns/addMonths";
import getDay from "date-fns/getDay";
import addDays from "date-fns/addDays";
import addMinutes from "date-fns/addMinutes";
import es from "date-fns/locale/es";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import "react-big-calendar/lib/css/react-big-calendar.css";

import {
  ESPECIALIDADES,
  SEDES,
  FRANJAS_MOCK,
  DURACION_CITA_MIN,
  getMedicos,
  getMedicoPorId,
  getMedicosDisponibles,
  getPacientesConCedula,
  getPacientePorId,
  citasStore,
  excepcionesStore,
  pacienteTieneChoqueDeHorario,
  topeEpsExcedido,
  restriccionFrecuenciaExcedida,
} from "../../context/mockData";

import {
  StepTracker,
  OpcionPill,
  BotonContinuar,
  FilaConfirmacion,
  ConfirmacionInline,
  EleccionInline,
  EstadoBadge,
} from "../../context/ui";
import { ESTADOS_CITA, ESTADO_ACCENT, capitalizarPrimera } from "./AdminDashboard";

// Pasos del wizard de agendamiento/reprogramación administrado. Cuando se
// agenda una cita nueva se antepone el paso de buscar al paciente; al
// reprogramar ese paso no aplica porque el paciente ya está definido.
const PASOS_WIZARD_NUEVA = ["Paciente", "Especialidad", "Sede", "Médico", "Horario", "Confirmar"];
const PASOS_WIZARD_REPROGRAMAR = ["Especialidad", "Sede", "Médico", "Horario", "Confirmar"];

// ---------- react-big-calendar: localizador en español, semana empieza en lunes ----------
// (mismo localizador que usa MedicoMiAgenda — se define aquí también porque
// dateFnsLocalizer no se puede compartir vía ui.jsx sin arrastrar date-fns
// hasta ese módulo; solo el CSS/tipografía del calendario vive en ui.jsx.)
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { locale: es, weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

// Índice del día (getDay(): 0=domingo … 6=sábado) -> nombre usado en medico.horario.
// Mismo mapeo que usa MedicoMiAgenda para saber qué día laboral corresponde a una fecha.
const NOMBRE_POR_INDICE_HORARIO = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes" };

function hoyISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function combinarFechaYHora(fechaStr, horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  const d = new Date(`${fechaStr}T00:00:00`);
  d.setHours(h, m, 0, 0);
  return d;
}

function franjaEsPasada(fechaStr, horaStr) {
  if (!fechaStr || !horaStr) return false;
  return combinarFechaYHora(fechaStr, horaStr) < new Date();
}

// Convierte "HH:mm" a minutos desde medianoche, para comparar rangos fácilmente
function horaAMinutos(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

// ¿Esta franja (fechaStr + horaStr) cae dentro de alguna excepción
// (bloqueo/feriado/vacaciones) que el médico registró para ese día? Si la
// excepción es de día completo, bloquea toda la fecha; si es un rango de
// horas, solo bloquea las franjas dentro de ese rango.
function franjaBloqueadaPorExcepcion(excepcionesDelMedico, fechaStr, horaStr) {
  const minutos = horaAMinutos(horaStr);
  return excepcionesDelMedico.some((ex) => {
    if (ex.fecha !== fechaStr) return false;
    if (ex.todoDia) return true;
    return minutos >= horaAMinutos(ex.horaInicio) && minutos < horaAMinutos(ex.horaFin);
  });
}

/* ============================================================
   TAB: Citas — búsqueda avanzada (5.2) + agendar (3.2) +
   cancelar/reprogramar (3.3/3.4)
   ============================================================ */

export default function TabCitas({ todasLasCitas }) {
  const [vista, setVista] = useState("lista"); // 'lista' | 'agendar' | 'reprogramar'
  const [citaEnAccion, setCitaEnAccion] = useState(null);
  const [mantenerMedicoEnAccion, setMantenerMedicoEnAccion] = useState(true);
  const [formato, setFormato] = useState("lista"); // 'lista' | 'calendario'

  // Solo un panel de "reprogramar/cancelar" puede estar abierto a la vez,
  // sin importar el formato (lista o calendario) en el que se abrió.
  const [accionAbierta, setAccionAbierta] = useState(null); // { citaId, tipo } | null

  const [filtros, setFiltros] = useState({ desde: "", hasta: "", medicoId: "", especialidad: "", sede: "", estado: "" });
  // Mensaje de validación cuando "Hasta" queda antes que "Desde" (o viceversa).
  const [errorFechas, setErrorFechas] = useState("");

  const medicos = getMedicos();

  const citasFiltradas = useMemo(() => {
    return todasLasCitas
      .filter((c) => (filtros.desde ? c.fecha >= filtros.desde : true))
      .filter((c) => (filtros.hasta ? c.fecha <= filtros.hasta : true))
      .filter((c) => (filtros.medicoId ? c.medicoId === Number(filtros.medicoId) : true))
      .filter((c) => (filtros.especialidad ? c.especialidad === filtros.especialidad : true))
      .filter((c) => (filtros.sede ? c.sede === filtros.sede : true))
      .filter((c) => (filtros.estado ? c.estado === filtros.estado : true))
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }, [todasLasCitas, filtros]);

  // "Hasta" nunca puede quedar antes que "Desde": si el usuario mueve
  // "Desde" más allá de "Hasta", ajustamos "Hasta" a la misma fecha en vez
  // de dejar un rango inválido; si mueve "Hasta" antes de "Desde", se
  // rechaza el cambio y se muestra un aviso.
  function cambiarDesde(valor) {
    if (filtros.hasta && valor > filtros.hasta) {
      setErrorFechas("La fecha 'Desde' no puede ser posterior a 'Hasta'; se ajustó 'Hasta' a la misma fecha.");
      setFiltros({ ...filtros, desde: valor, hasta: valor });
      return;
    }
    setErrorFechas("");
    setFiltros({ ...filtros, desde: valor });
  }

  function cambiarHasta(valor) {
    if (filtros.desde && valor < filtros.desde) {
      setErrorFechas("La fecha 'Hasta' no puede ser anterior a 'Desde'.");
      return;
    }
    setErrorFechas("");
    setFiltros({ ...filtros, hasta: valor });
  }

  function iniciarReprogramacion(cita, mantenerMedico) {
    setCitaEnAccion(cita);
    setMantenerMedicoEnAccion(mantenerMedico);
    setVista("reprogramar");
    setAccionAbierta(null);
  }

  function iniciarAgendar() {
    setCitaEnAccion(null);
    setVista("agendar");
  }

  function abrirAccion(citaId, tipo) {
    setAccionAbierta((prev) => (prev?.citaId === citaId && prev?.tipo === tipo ? null : { citaId, tipo }));
  }

  function cerrarAccion() {
    setAccionAbierta(null);
  }

  if (vista === "agendar" || vista === "reprogramar") {
    return (
      <WizardAgendarAdmin
        citaAReprogramar={vista === "reprogramar" ? citaEnAccion : null}
        mantenerMedico={mantenerMedicoEnAccion}
        todasLasCitas={todasLasCitas}
        onTerminar={() => {
          setVista("lista");
          setCitaEnAccion(null);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Búsqueda avanzada</p>
          <h1 className="sax-display text-2xl text-[#0F3D3E]">Citas</h1>
        </div>
        <button
          onClick={iniciarAgendar}
          className="bg-[#0E9668] text-white pl-4 pr-5 py-2.5 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Agendar cita para un paciente
        </button>
      </div>

      <div className="bg-white border border-[#DCE8E5] rounded-2xl p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#48605C] uppercase">Desde</label>
          <input
            type="date"
            value={filtros.desde}
            max={filtros.hasta || undefined}
            onChange={(e) => cambiarDesde(e.target.value)}
            className="border border-[#DCE8E5] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#48605C] uppercase">Hasta</label>
          <input
            type="date"
            value={filtros.hasta}
            min={filtros.desde || undefined}
            onChange={(e) => cambiarHasta(e.target.value)}
            className="border border-[#DCE8E5] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#48605C] uppercase">Médico</label>
          <select
            value={filtros.medicoId}
            onChange={(e) => setFiltros({ ...filtros, medicoId: e.target.value })}
            className="border border-[#DCE8E5] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          >
            <option value="">Todos</option>
            {medicos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre} {m.apellido}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#48605C] uppercase">Especialidad</label>
          <select
            value={filtros.especialidad}
            onChange={(e) => setFiltros({ ...filtros, especialidad: e.target.value })}
            className="border border-[#DCE8E5] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          >
            <option value="">Todas</option>
            {ESPECIALIDADES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#48605C] uppercase">Sede</label>
          <select
            value={filtros.sede}
            onChange={(e) => setFiltros({ ...filtros, sede: e.target.value })}
            className="border border-[#DCE8E5] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          >
            <option value="">Todas</option>
            {SEDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#48605C] uppercase">Estado</label>
          <select
            value={filtros.estado}
            onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
            className="border border-[#DCE8E5] rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          >
            <option value="">Todos</option>
            {ESTADOS_CITA.map((e) => (
              <option key={e} value={e}>
                {capitalizarPrimera(e)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {errorFechas && (
        <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg -mt-3">{errorFechas}</p>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-[#48605C]">
          <span className="font-semibold text-[#0F3D3E]">{citasFiltradas.length}</span> citas encontradas
        </p>

        <div className="flex bg-[#F3F8F7] rounded-full p-1">
          <button
            onClick={() => setFormato("lista")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 flex items-center gap-1.5 ${
              formato === "lista" ? "bg-white text-[#0F3D3E] shadow-sm" : "text-[#48605C]"
            }`}
          >
            <span className="material-symbols-outlined text-base">list</span>
            Lista
          </button>
          <button
            onClick={() => setFormato("calendario")}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-200 flex items-center gap-1.5 ${
              formato === "calendario" ? "bg-white text-[#0F3D3E] shadow-sm" : "text-[#48605C]"
            }`}
          >
            <span className="material-symbols-outlined text-base">calendar_month</span>
            Calendario
          </button>
        </div>
      </div>

      {formato === "lista" ? (
        citasFiltradas.length === 0 ? (
          <p className="text-sm text-[#48605C] bg-white border border-[#DCE8E5] rounded-xl px-4 py-3">
            No hay citas que coincidan con los filtros.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {citasFiltradas.map((c) => (
              <FilaCitaAdmin
                key={c.id}
                cita={c}
                onReprogramar={(mantener) => iniciarReprogramacion(c, mantener)}
                accionAbierta={accionAbierta?.citaId === c.id ? accionAbierta.tipo : null}
                onAbrirAccion={(tipo) => abrirAccion(c.id, tipo)}
                onCerrarAccion={cerrarAccion}
              />
            ))}
          </div>
        )
      ) : (
        <VistaCalendarioAdmin
          citas={citasFiltradas}
          onReprogramar={iniciarReprogramacion}
          citaSeleccionadaId={accionAbierta?.citaId ?? null}
        />
      )}
    </div>
  );
}

function FilaCitaAdmin({ cita, onReprogramar, accionAbierta, onAbrirAccion, onCerrarAccion }) {
  const acc = ESTADO_ACCENT[cita.estado] ?? ESTADO_ACCENT.agendada;
  const medico = getMedicoPorId(cita.medicoId);
  const paciente = getPacientePorId(cita.pacienteId);
  const esActiva = cita.estado === "agendada" || cita.estado === "reprogramada";
  const nombreMedico = medico ? `${medico.nombre} ${medico.apellido}` : "el médico actual";

  function cancelar() {
    citasStore.actualizar(cita.id, { estado: "cancelada" });
    onCerrarAccion();
  }

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
        <div className="flex items-center gap-4 min-w-0">
          <div className="text-center shrink-0">
            <p className="sax-mono text-sm font-semibold" style={{ color: acc.color }}>
              {cita.hora}
            </p>
            <p className="sax-mono text-xs text-[#48605C]">{cita.fecha}</p>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-[#0F3D3E] text-sm truncate">
              {paciente ? `${paciente.nombre} ${paciente.apellido}` : "—"}
            </p>
            <p className="text-xs text-[#48605C] truncate">
              {cita.especialidad} · {medico ? `Dr(a). ${medico.nombre} ${medico.apellido}` : "—"} · {cita.sede}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <EstadoBadge estado={cita.estado} />
          {esActiva && (
            <>
              <button
                onClick={() => onAbrirAccion("reprogramar")}
                className="border border-[#0E9668] text-[#0E9668] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#0E9668]/5 transition-colors duration-200"
              >
                Reprogramar
              </button>
              <button
                onClick={() => onAbrirAccion("cancelar")}
                className="border border-[#BA1A1A] text-[#BA1A1A] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#BA1A1A]/5 transition-colors duration-200"
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </div>

      {accionAbierta === "reprogramar" && (
        <div className="px-5 pb-4">
          <EleccionInline
            pregunta={`¿Deseas reprogramar con Dr(a). ${nombreMedico} o buscar otro médico?`}
            opciones={[
              { label: `Mantener con Dr(a). ${nombreMedico}`, destacada: true, onClick: () => onReprogramar(true) },
              { label: "Buscar otro médico", onClick: () => onReprogramar(false) },
            ]}
          />
        </div>
      )}

      {accionAbierta === "cancelar" && (
        <div className="px-5 pb-4">
          <ConfirmacionInline
            pregunta="¿Confirmas cancelar esta cita?"
            textoConfirmar="Sí, cancelar"
            onConfirmar={cancelar}
            onCancelar={onCerrarAccion}
          />
        </div>
      )}
    </div>
  );
}

// ---------- Vista de calendario para citas (formato alterno al listado) ----------
// Mismo dataset filtrado (citas) y mismas acciones de reprogramar/cancelar
// que la vista de lista, presentadas como en el calendario de MedicoMiAgenda
// pero mostrando el médico de cada cita (aquí hay varios, no uno solo).
function VistaCalendarioAdmin({ citas, onReprogramar }) {
  const [vistaCalendario, setVistaCalendario] = useState(Views.WORK_WEEK);
  const [fechaCalendario, setFechaCalendario] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [citaActiva, setCitaActiva] = useState(null);
  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [preguntandoReprogramar, setPreguntandoReprogramar] = useState(false);

  const eventos = useMemo(
    () =>
      citas.map((c) => {
        const inicio = combinarFechaYHora(c.fecha, c.hora);
        const medico = getMedicoPorId(c.medicoId);
        const paciente = getPacientePorId(c.pacienteId);
        return {
          id: c.id,
          title: `${paciente ? `${paciente.nombre} ${paciente.apellido}` : "—"} · Dr(a). ${medico ? medico.apellido : "—"}`,
          start: inicio,
          // OJO: antes se usaba addHours(inicio, DURACION_CITA_MIN), lo cual
          // sumaba 30 HORAS (no minutos) a la cita, haciendo que apareciera
          // extendida por más de un día en el calendario. Con addMinutes se
          // respeta la duración real (30 minutos) de cada cita.
          end: addMinutes(inicio, DURACION_CITA_MIN),
          resource: c,
        };
      }),
    [citas]
  );

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

  // Igual que en la lista: al seleccionar otra cita se cierra cualquier
  // panel de reprogramar/cancelar que hubiera quedado abierto.
  function seleccionarCita(cita) {
    setCitaActiva(cita);
    setConfirmandoCancelar(false);
    setPreguntandoReprogramar(false);
  }

  function cancelar() {
    citasStore.actualizar(citaActiva.id, { estado: "cancelada" });
    setConfirmandoCancelar(false);
    setCitaActiva(null);
  }

  function eventPropGetter(event) {
    const colores = { completada: "#48605C", cancelada: "#BA1A1A", reprogramada: "#8A6D00" };
    return {
      style: {
        backgroundColor: colores[event.resource.estado] ?? "#0E9668",
        borderRadius: "6px",
        border: "none",
        fontSize: "0.75rem",
      },
    };
  }

  const esActiva = citaActiva && (citaActiva.estado === "agendada" || citaActiva.estado === "reprogramada");
  const medicoActiva = citaActiva ? getMedicoPorId(citaActiva.medicoId) : null;
  const pacienteActiva = citaActiva ? getPacientePorId(citaActiva.pacienteId) : null;
  const nombreMedicoActiva = medicoActiva ? `${medicoActiva.nombre} ${medicoActiva.apellido}` : "el médico actual";

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
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
            <button onClick={irAHoy} className="text-sm font-semibold text-[#0E9668] hover:underline px-2">
              Hoy
            </button>
          </div>
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
            onSelectEvent={(event) => seleccionarCita(event.resource)}
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

      {citaActiva && (
        <aside className="lg:w-80 shrink-0 bg-white border border-[#DCE8E5] rounded-2xl overflow-hidden h-fit shadow-sm">
          <div
            className="px-6 py-4 flex justify-between items-center"
            style={{ backgroundColor: ESTADO_ACCENT[citaActiva.estado]?.color ?? "#0E9668" }}
          >
            <h3 className="sax-display text-lg text-white">Detalle de la cita</h3>
            <button onClick={() => setCitaActiva(null)} className="text-white/80 hover:text-white">
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
          <dl className="flex flex-col gap-3 text-sm p-6">
            <DetalleFilaAdmin
              icon="person"
              etiqueta="Paciente"
              valor={pacienteActiva ? `${pacienteActiva.nombre} ${pacienteActiva.apellido}` : "—"}
            />
            <DetalleFilaAdmin
              icon="stethoscope"
              etiqueta="Médico"
              valor={medicoActiva ? `Dr(a). ${medicoActiva.nombre} ${medicoActiva.apellido}` : "—"}
            />
            <DetalleFilaAdmin icon="medical_information" etiqueta="Especialidad" valor={citaActiva.especialidad} />
            <DetalleFilaAdmin icon="location_on" etiqueta="Sede" valor={citaActiva.sede} />
            <DetalleFilaAdmin
              icon="schedule"
              etiqueta="Fecha y hora"
              valor={`${citaActiva.fecha} · ${citaActiva.hora}`}
              mono
            />
            {citaActiva.motivo && <DetalleFilaAdmin icon="edit_note" etiqueta="Motivo" valor={citaActiva.motivo} />}
            <DetalleFilaAdmin icon="info" etiqueta="Estado" valor={capitalizarPrimera(citaActiva.estado)} />
          </dl>

          {esActiva && (
            <div className="px-6 pb-6 flex flex-col gap-3">
              {!preguntandoReprogramar && !confirmandoCancelar && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setPreguntandoReprogramar(true)}
                    className="flex-1 border border-[#0E9668] text-[#0E9668] px-3 py-2 rounded-full text-sm font-semibold hover:bg-[#0E9668]/5 transition-colors duration-200"
                  >
                    Reprogramar
                  </button>
                  <button
                    onClick={() => setConfirmandoCancelar(true)}
                    className="flex-1 border border-[#BA1A1A] text-[#BA1A1A] px-3 py-2 rounded-full text-sm font-semibold hover:bg-[#BA1A1A]/5 transition-colors duration-200"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {preguntandoReprogramar && (
                <EleccionInline
                  pregunta={`¿Deseas reprogramar con Dr(a). ${nombreMedicoActiva} o buscar otro médico?`}
                  opciones={[
                    {
                      label: `Mantener con Dr(a). ${nombreMedicoActiva}`,
                      destacada: true,
                      onClick: () => onReprogramar(citaActiva, true),
                    },
                    { label: "Buscar otro médico", onClick: () => onReprogramar(citaActiva, false) },
                  ]}
                />
              )}

              {confirmandoCancelar && (
                <ConfirmacionInline
                  pregunta="¿Confirmas cancelar esta cita?"
                  textoConfirmar="Sí, cancelar"
                  onConfirmar={cancelar}
                  onCancelar={() => setConfirmandoCancelar(false)}
                />
              )}
            </div>
          )}
        </aside>
      )}
    </div>
  );
}

function DetalleFilaAdmin({ icon, etiqueta, valor, mono, capitalizar }) {
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

// ---------- Wizard de agendamiento / reprogramación en nombre del paciente (3.2, 3.4) ----------
// Mismo flujo y componentes que el wizard del paciente (src/context/ui.jsx):
// especialidad → sede → médico → horario → confirmar. Aquí se antepone un
// paso para buscar al paciente cuando se agenda una cita nueva.
//
// El paso de horario ahora respeta dos restricciones adicionales que antes
// no se validaban en este wizard administrativo (aunque sí en el calendario
// de MedicoMiAgenda): (1) el horario laboral configurado por día para el
// médico elegido (medico.horario) y (2) las excepciones puntuales que ese
// médico haya registrado (bloqueos, feriados, vacaciones), vía
// excepcionesStore — el mismo store que ahora alimenta el calendario del
// médico, así que ambas pantallas quedan sincronizadas.

function WizardAgendarAdmin({ citaAReprogramar, mantenerMedico, todasLasCitas, onTerminar }) {
  const pasos = citaAReprogramar ? PASOS_WIZARD_REPROGRAMAR : PASOS_WIZARD_NUEVA;

  const [paso, setPaso] = useState(() => {
    if (!citaAReprogramar) return 1;
    return mantenerMedico ? 4 : 3; // Horario=4 o Médico=3 dentro de PASOS_WIZARD_REPROGRAMAR
  });

  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [pacienteId, setPacienteId] = useState(citaAReprogramar ? citaAReprogramar.pacienteId : null);
  const [especialidad, setEspecialidad] = useState(citaAReprogramar ? citaAReprogramar.especialidad : "");
  const [sede, setSede] = useState(citaAReprogramar ? citaAReprogramar.sede : "");
  const [medicoId, setMedicoId] = useState(
    citaAReprogramar ? (mantenerMedico ? citaAReprogramar.medicoId : null) : null
  );
  const [fecha, setFecha] = useState(citaAReprogramar ? citaAReprogramar.fecha : hoyISO());
  const [franja, setFranja] = useState(null);
  const [motivo, setMotivo] = useState(citaAReprogramar ? citaAReprogramar.motivo : "");
  const [mensaje, setMensaje] = useState("");

  const pacienteElegido = pacienteId ? getPacientePorId(pacienteId) : null;
  const medicoElegido = medicoId ? getMedicoPorId(medicoId) : null;

  // Excepciones (bloqueos/feriados/vacaciones) del médico elegido, desde el
  // store compartido con MedicoMiAgenda.
  const todasLasExcepciones = useSyncExternalStore(excepcionesStore.subscribe, excepcionesStore.getSnapshot);
  const excepcionesDelMedico = useMemo(
    () => todasLasExcepciones.filter((ex) => ex.medicoId === medicoId),
    [todasLasExcepciones, medicoId]
  );

  const resultadosPacientes = useMemo(() => {
    const q = busquedaPaciente.trim().toLowerCase();
    if (!q) return [];
    return getPacientesConCedula().filter(
      (p) =>
        p.cedula.includes(q) ||
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
        p.correo.toLowerCase().includes(q)
    );
  }, [busquedaPaciente]);

  const sedesConMedico = SEDES.filter((s) =>
    getMedicosDisponibles().some((m) => m.especialidades.includes(especialidad) && m.sede === s)
  );

  const medicosFiltrados = getMedicosDisponibles().filter(
    (m) => m.especialidades.includes(especialidad) && m.sede === sede
  );

  const franjasOcupadas = new Set(
    todasLasCitas
      .filter(
        (c) =>
          c.medicoId === medicoId &&
          c.fecha === fecha &&
          (c.estado === "agendada" || c.estado === "reprogramada") &&
          c.id !== citaAReprogramar?.id
      )
      .map((c) => c.hora)
  );

  // Horario laboral del médico elegido para el día de la fecha seleccionada.
  // null si cae en fin de semana o si ese día en particular no tiene franja
  // asignada (día libre para ese médico).
  const horarioDelDia = useMemo(() => {
    if (!medicoElegido || !fecha) return null;
    const diaNombre = NOMBRE_POR_INDICE_HORARIO[getDay(new Date(`${fecha}T00:00:00`))];
    if (!diaNombre) return null;
    return medicoElegido.horario?.[diaNombre] ?? null;
  }, [medicoElegido, fecha]);

  // ¿Toda la fecha elegida está bloqueada por una excepción de día completo?
  const diaBloqueadoPorExcepcion = useMemo(
    () => excepcionesDelMedico.some((ex) => ex.fecha === fecha && ex.todoDia),
    [excepcionesDelMedico, fecha]
  );

  const franjasDisponibles = FRANJAS_MOCK.filter((f) => {
    if (franjaEsPasada(fecha, f)) return false;
    if (franjasOcupadas.has(f)) return false;
    if (!horarioDelDia) return false; // fuera del horario laboral de este médico ese día
    const minutos = horaAMinutos(f);
    if (minutos < horaAMinutos(horarioDelDia.inicio) || minutos >= horaAMinutos(horarioDelDia.fin)) return false;
    if (franjaBloqueadaPorExcepcion(excepcionesDelMedico, fecha, f)) return false; // bloqueo/feriado/vacaciones
    return true;
  });

  // Índices de paso dentro del arreglo `pasos` según si hay paso de paciente o no
  const pasoEspecialidad = citaAReprogramar ? 1 : 2;
  const pasoSede = citaAReprogramar ? 2 : 3;
  const pasoMedico = citaAReprogramar ? 3 : 4;
  const pasoHorario = citaAReprogramar ? 4 : 5;
  const pasoConfirmar = citaAReprogramar ? 5 : 6;

  function confirmar() {
    if (!fecha || !franja) {
      setMensaje("Elige fecha y hora.");
      return;
    }
    if (fecha < hoyISO() || franjaEsPasada(fecha, franja)) {
      setMensaje("Ese horario ya pasó. Elige una fecha u hora futura.");
      return;
    }
    if (!horarioDelDia) {
      setMensaje("El médico no atiende ese día. Elige otra fecha.");
      return;
    }
    const minutos = horaAMinutos(franja);
    if (minutos < horaAMinutos(horarioDelDia.inicio) || minutos >= horaAMinutos(horarioDelDia.fin)) {
      setMensaje("Ese horario está fuera del horario laboral del médico.");
      return;
    }
    if (franjaBloqueadaPorExcepcion(excepcionesDelMedico, fecha, franja)) {
      setMensaje("El médico tiene un bloqueo, feriado o vacaciones en ese horario. Elige otro horario o fecha.");
      return;
    }

    if (pacienteTieneChoqueDeHorario(pacienteId, fecha, franja, citaAReprogramar?.id)) {
      setMensaje("Este paciente ya tiene otra cita agendada en esa misma fecha y hora.");
      return;
    }

    const frecuencia = restriccionFrecuenciaExcedida(pacienteId, especialidad, citaAReprogramar?.id);
    if (frecuencia.excedido) {
      setMensaje(frecuencia.mensaje);
      return;
    }

    const tope = topeEpsExcedido(pacienteId, especialidad, citaAReprogramar?.id);
    if (tope.excedido) {
      setMensaje(tope.mensaje);
      return;
    }

    const ocupado = todasLasCitas.some(
      (c) =>
        c.medicoId === medicoId &&
        c.fecha === fecha &&
        c.hora === franja &&
        (c.estado === "agendada" || c.estado === "reprogramada") &&
        c.id !== citaAReprogramar?.id
    );
    if (ocupado) {
      setMensaje("Ese horario ya fue tomado. Elige otro.");
      return;
    }

    const canceladaEnEseEspacio = todasLasCitas.find(
      (c) =>
        c.medicoId === medicoId &&
        c.fecha === fecha &&
        c.hora === franja &&
        c.estado === "cancelada" &&
        c.id !== citaAReprogramar?.id
    );
    if (canceladaEnEseEspacio) {
      citasStore.eliminar(canceladaEnEseEspacio.id);
    }

    if (citaAReprogramar) {
      citasStore.actualizar(citaAReprogramar.id, {
        medicoId,
        especialidad,
        sede,
        fecha,
        hora: franja,
        estado: "reprogramada",
        motivo,
      });
    } else {
      citasStore.agregar({
        pacienteId,
        medicoId,
        especialidad,
        sede,
        fecha,
        hora: franja,
        estado: "agendada",
        motivo,
        creadaPor: "administrativo",
      });
    }

    onTerminar();
  }

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 md:p-8 max-w-xl shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="sax-display text-2xl text-[#0F3D3E]">
          {citaAReprogramar ? "Reprogramar cita" : "Agendar cita para un paciente"}
        </h2>
        <button onClick={onTerminar} className="text-sm text-[#48605C] hover:underline">
          ← Volver al listado
        </button>
      </div>

      <StepTracker pasos={pasos} actual={paso} />

      {/* Paso: buscar paciente (solo si es cita nueva) */}
      {!citaAReprogramar && paso === 1 && (
        <div className="flex flex-col gap-3 mt-6">
          <label className="text-sm font-semibold text-[#0F3D3E]">Busca al paciente (documento, nombre o correo)</label>
          <input
            type="text"
            value={busquedaPaciente}
            onChange={(e) => setBusquedaPaciente(e.target.value)}
            placeholder="Ej: 1000000001 o Juan Pérez"
            className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          />
          {busquedaPaciente.trim() && (
            <div className="flex flex-col gap-2">
              {resultadosPacientes.length === 0 && (
                <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-lg px-4 py-3">
                  No se encontró ningún paciente con esos datos.
                </p>
              )}
              {resultadosPacientes.map((p) => (
                <OpcionPill
                  key={p.id}
                  seleccionado={pacienteId === p.id}
                  icon="person"
                  label={`${p.nombre} ${p.apellido}`}
                  sublabel={`CC ${p.cedula} · ${p.correo} · ${p.eps}`}
                  onClick={() => {
                    setPacienteId(p.id);
                    setPaso(2);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Paso: especialidad */}
      {paso === pasoEspecialidad && (
        <div className="flex flex-col gap-4 mt-6">
          {pacienteElegido && (
            <div className="bg-[#F3F8F7] rounded-xl px-4 py-3 flex items-center justify-between">
              <p className="text-sm text-[#0F3D3E]">
                Paciente: <span className="font-semibold">{pacienteElegido.nombre} {pacienteElegido.apellido}</span>
              </p>
              {!citaAReprogramar && (
                <button onClick={() => setPaso(1)} className="text-xs text-[#0E9668] hover:underline font-semibold">
                  Cambiar
                </button>
              )}
            </div>
          )}

          <label className="text-sm font-semibold text-[#0F3D3E]">Elige una especialidad</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ESPECIALIDADES.map((esp) => (
              <OpcionPill
                key={esp}
                seleccionado={especialidad === esp}
                icon="medical_information"
                label={esp}
                onClick={() => {
                  setEspecialidad(esp);
                  setSede("");
                  setMedicoId(null);
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-4 mt-2">
            <BotonContinuar disabled={!especialidad} onClick={() => setPaso(pasoSede)} />
            {!citaAReprogramar && (
              <button onClick={() => { setMensaje(""); setPaso(1); }} className="text-sm text-[#48605C] hover:underline">
                ← Cambiar paciente
              </button>
            )}
          </div>
        </div>
      )}

      {/* Paso: sede */}
      {paso === pasoSede && (
        <div className="flex flex-col gap-4 mt-6">
          <label className="text-sm font-semibold text-[#0F3D3E]">Elige una sede</label>
          {sedesConMedico.length === 0 ? (
            <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-lg px-4 py-3">
              No hay médicos activos de {especialidad} en ninguna sede.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sedesConMedico.map((s) => (
                <OpcionPill
                  key={s}
                  seleccionado={sede === s}
                  icon="location_on"
                  label={s}
                  onClick={() => {
                    setSede(s);
                    setMedicoId(null);
                  }}
                />
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2">
            <BotonContinuar disabled={!sede} onClick={() => setPaso(pasoMedico)} />
            <button onClick={() => { setMensaje(""); setPaso(pasoEspecialidad); }} className="text-sm text-[#48605C] hover:underline">
              ← Cambiar especialidad
            </button>
          </div>
        </div>
      )}

      {/* Paso: médico */}
      {paso === pasoMedico && (
        <div className="flex flex-col gap-4 mt-6">
          <label className="text-sm font-semibold text-[#0F3D3E]">
            Médicos de {especialidad} en {sede}
          </label>
          {medicosFiltrados.length === 0 && (
            <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-lg px-4 py-3">
              No hay médicos de esta especialidad en la sede elegida todavía.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {medicosFiltrados.map((m) => (
              <OpcionPill
                key={m.id}
                seleccionado={medicoId === m.id}
                icon="stethoscope"
                label={`${m.nombre} ${m.apellido}`}
                onClick={() => {
                  setMedicoId(m.id);
                  setFranja(null);
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-4 mt-2">
            <BotonContinuar disabled={!medicoId} onClick={() => setPaso(pasoHorario)} />
            <button onClick={() => { setMensaje(""); setPaso(pasoSede); }} className="text-sm text-[#48605C] hover:underline">
              ← Cambiar sede
            </button>
          </div>
        </div>
      )}

      {/* Paso: fecha + hora + motivo */}
      {paso === pasoHorario && (
        <div className="flex flex-col gap-4 mt-6">
          {pacienteElegido && (
            <div className="bg-[#F3F8F7] rounded-xl px-4 py-3">
              <p className="text-sm text-[#0F3D3E]">
                Paciente: <span className="font-semibold">{pacienteElegido.nombre} {pacienteElegido.apellido}</span> ·{" "}
                {especialidad} con {medicoElegido?.nombre} {medicoElegido?.apellido} · {sede}
              </p>
            </div>
          )}

          <label className="text-sm font-semibold text-[#0F3D3E]">Fecha</label>
          <input
            type="date"
            value={fecha}
            min={hoyISO()}
            onChange={(e) => {
              setFecha(e.target.value);
              setFranja(null);
            }}
            className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm w-fit focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          />

          <label className="text-sm font-semibold text-[#0F3D3E] mt-2">Horario disponible</label>
          {!horarioDelDia ? (
            <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-lg px-4 py-3">
              El médico no atiende este día. Elige otra fecha.
            </p>
          ) : diaBloqueadoPorExcepcion ? (
            <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-lg px-4 py-3">
              El médico tiene un bloqueo, feriado o vacaciones programado este día. Elige otra fecha.
            </p>
          ) : franjasDisponibles.length === 0 ? (
            <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-lg px-4 py-3">
              No quedan horarios disponibles para esta fecha. Elige otro día.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {franjasDisponibles.map((f) => (
                <button
                  key={f}
                  onClick={() => setFranja(f)}
                  className={`sax-mono text-sm px-3 py-2 rounded-lg border text-center transition-colors duration-200 ${
                    franja === f
                      ? "border-[#0E9668] bg-[#D3F3E6] text-[#0E9668] font-semibold"
                      : "border-[#DCE8E5] hover:border-[#0E9668]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          )}

          <label className="text-sm font-semibold text-[#0F3D3E] mt-2">Motivo (opcional)</label>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          />

          <p className="text-xs text-[#48605C]">Duración de la cita: {DURACION_CITA_MIN} minutos.</p>

          <div className="flex items-center gap-4 mt-2">
            <BotonContinuar disabled={!fecha || !franja} onClick={() => setPaso(pasoConfirmar)} />
            <button onClick={() => { setMensaje(""); setPaso(pasoMedico); }} className="text-sm text-[#48605C] hover:underline">
              ← Cambiar médico
            </button>
          </div>
        </div>
      )}

      {/* Paso: confirmación */}
      {paso === pasoConfirmar && (
        <div className="flex flex-col gap-4 mt-6">
          <label className="text-sm font-semibold text-[#0F3D3E]">Confirma los datos de la cita</label>

          <div className="rounded-2xl border border-[#DCE8E5] overflow-hidden">
            <div className="bg-[#0F3D3E] px-5 py-4 flex items-center gap-2 text-white">
              <span className="material-symbols-outlined">confirmation_number</span>
              <span className="sax-display text-lg">Resumen de la cita</span>
            </div>
            <div className="bg-white divide-y divide-dashed divide-[#DCE8E5]">
              <FilaConfirmacion icon="person" etiqueta="Paciente" valor={pacienteElegido ? `${pacienteElegido.nombre} ${pacienteElegido.apellido}` : ""} />
              <FilaConfirmacion icon="medical_information" etiqueta="Especialidad" valor={especialidad} />
              <FilaConfirmacion icon="stethoscope" etiqueta="Médico" valor={medicoElegido ? `${medicoElegido.nombre} ${medicoElegido.apellido}` : ""} />
              <FilaConfirmacion icon="location_on" etiqueta="Sede" valor={sede} />
              <FilaConfirmacion icon="event" etiqueta="Fecha" valor={fecha} mono />
              <FilaConfirmacion icon="schedule" etiqueta="Hora" valor={franja} mono />
              <FilaConfirmacion icon="hourglass_top" etiqueta="Duración" valor={`${DURACION_CITA_MIN} minutos`} mono />
              {motivo && <FilaConfirmacion icon="edit_note" etiqueta="Motivo" valor={motivo} />}
            </div>
          </div>

          {mensaje && <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{mensaje}</p>}

          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <button
              onClick={confirmar}
              className="bg-[#0E9668] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">check</span>
              {citaAReprogramar ? "Confirmar reprogramación" : "Confirmar cita"}
            </button>
            <button onClick={() => { setMensaje(""); setPaso(pasoHorario); }} className="text-sm text-[#48605C] hover:underline">
              ← Volver y editar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}