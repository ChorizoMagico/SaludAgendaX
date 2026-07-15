import { useState, useSyncExternalStore } from "react";
import format from "date-fns/format";
import addDays from "date-fns/addDays";
import {
  ESPECIALIDADES,
  SEDES,
  FRANJAS_MOCK,
  getMedicos,
  getMedicoPorId,
  getMedicosDisponibles,
  citasStore,
  pacienteTieneChoqueDeHorario,
  topeEpsExcedido,
  restriccionFrecuenciaExcedida,
} from "../../context/mockData";
import {
  TopBar,
  DashboardNav,
  navMobilePadding,
  Campo,
  CampoSolo,
  EstadoBadge,
  StepTracker,
  OpcionPill,
  BotonContinuar,
  FilaConfirmacion,
  ConfirmacionInline,
  EleccionInline,
} from "../../context/ui";
import { useAuth } from "../../context/AuthContext";

const TABS = [
  { id: "inicio", label: "Inicio", icon: "home" },
  { id: "citas", label: "Mis citas", icon: "calendar_month" },
  { id: "agendar", label: "Agendar", icon: "event_available" },
  { id: "perfil", label: "Mi perfil", icon: "person" },
];

const PASOS_WIZARD = ["Especialidad", "Sede", "Médico", "Horario", "Confirmar"];

// Franja de color por estado — reutilizada en tickets, stub y stepper
const ESTADO_ACCENT = {
  agendada: { linea: "#0E9668", tinte: "#D3F3E6", texto: "#0E9668" },
  reprogramada: { linea: "#8A6D00", tinte: "#F5EEDA", texto: "#8A6D00" },
  completada: { linea: "#48605C", tinte: "#EDF2F1", texto: "#48605C" },
  cancelada: { linea: "#BA1A1A", tinte: "#FFDAD6", texto: "#BA1A1A" },
};

function hoyISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function fechaPorDefecto() {
  return format(addDays(new Date(), 1), "yyyy-MM-dd");
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

export default function PacienteDashboard() {
  const { user: paciente, updateProfile } = useAuth();
  const [tab, setTab] = useState("inicio");

  // Todas las citas viven en un store compartido con el dashboard del
  // médico (misma fuente de datos mock); aquí solo nos quedamos con las
  // del paciente autenticado.
  const todasLasCitas = useSyncExternalStore(citasStore.subscribe, citasStore.getSnapshot);
  const citas = todasLasCitas.filter((c) => c.pacienteId === paciente.id);

  // ---------- Estado del wizard de agendamiento/reprogramación ----------
  // Pasos: 1 especialidad · 2 sede · 3 médico · 4 fecha + franja + motivo · 5 confirmación
  const [wizardPaso, setWizardPaso] = useState(1);
  const [wizardEspecialidad, setWizardEspecialidad] = useState("");
  const [wizardSede, setWizardSede] = useState("");
  const [wizardMedicoId, setWizardMedicoId] = useState(null);
  const [wizardFecha, setWizardFecha] = useState(fechaPorDefecto);
  const [wizardFranja, setWizardFranja] = useState(null);
  const [wizardMotivo, setWizardMotivo] = useState("");
  const [citaReprogramando, setCitaReprogramando] = useState(null);
  const [wizardMensaje, setWizardMensaje] = useState("");

  // Antes de entrar al wizard de reprogramación, se pregunta si se quiere
  // mantener el mismo médico o buscar otro.
  const [citaPreguntandoReprogramar, setCitaPreguntandoReprogramar] = useState(null);

  // Confirmación inline de cancelación
  const [citaCancelando, setCitaCancelando] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");

  const proximas = citas.filter((c) => c.estado === "agendada" || c.estado === "reprogramada");
  const historial = citas.filter((c) => c.estado === "completada" || c.estado === "cancelada");
  const proximaCita = [...proximas].sort((a, b) => a.fecha.localeCompare(b.fecha))[0];

  const medicosFiltrados = getMedicosDisponibles().filter(
    (m) => m.especialidades.includes(wizardEspecialidad) && m.sede === wizardSede
  );

  const sedesConMedico = SEDES.filter((sede) =>
    getMedicosDisponibles().some((m) => m.especialidades.includes(wizardEspecialidad) && m.sede === sede)
  );

  const medicoElegido = wizardMedicoId ? getMedicoPorId(wizardMedicoId) : null;

  // Franjas que ese médico ya tiene ocupadas (activas) en la fecha elegida.
  // Si estás reprogramando, tu propia cita actual no cuenta como "ocupada".
  const franjasOcupadas = new Set(
    todasLasCitas
      .filter(
        (c) =>
          c.medicoId === wizardMedicoId &&
          c.fecha === wizardFecha &&
          (c.estado === "agendada" || c.estado === "reprogramada") &&
          c.id !== citaReprogramando
      )
      .map((c) => c.hora)
  );

  // Oculta franjas que ya pasaron (si la fecha es hoy) o que ya están ocupadas
  const franjasDisponibles = FRANJAS_MOCK.filter(
    (f) => !franjaEsPasada(wizardFecha, f) && !franjasOcupadas.has(f)
  );

  function resetWizard() {
    setWizardPaso(1);
    setWizardEspecialidad("");
    setWizardSede("");
    setWizardMedicoId(null);
    setWizardFecha(fechaPorDefecto());
    setWizardFranja(null);
    setWizardMotivo("");
    setCitaReprogramando(null);
    setWizardMensaje("");
  }

  function irATab(id) {
    if (id === "agendar" && tab !== "agendar") {
      resetWizard();
    }
    // Si sales de "Mis citas" sin confirmar la
    // cancelación, se descarta y el tiquete vuelve a verse normal al volver.
    if (tab === "citas" && id !== "citas") {
      setCitaCancelando(null);
      setMotivoCancelacion("");
      setCitaPreguntandoReprogramar(null);
    }
    setTab(id);
  }

  // Arranca el wizard de reprogramación. mantenerMedico=true deja el
  // médico ya elegido y salta directo a horario; false solo conserva
  // especialidad+sede y deja elegir un médico distinto.
  function iniciarReprogramacion(cita, mantenerMedico) {
    setCitaReprogramando(cita.id);
    setWizardEspecialidad(cita.especialidad);
    setWizardSede(cita.sede);
    setWizardMedicoId(mantenerMedico ? cita.medicoId : null);
    setWizardMotivo(cita.motivo);
    setWizardFecha(cita.fecha < hoyISO() ? fechaPorDefecto() : cita.fecha);
    setWizardFranja(null);
    setWizardPaso(mantenerMedico ? 4 : 3);
    setCitaPreguntandoReprogramar(null);
    setTab("agendar");
  }

  function handleCambioFecha(e) {
    const nuevaFecha = e.target.value;
    setWizardFecha(nuevaFecha);
    if (wizardFranja && franjaEsPasada(nuevaFecha, wizardFranja)) {
      setWizardFranja(null);
    }
  }

  // Reglas de negocio del superadministrador: el paciente
  // no puede tener dos citas activas a la misma fecha y hora (con cualquier
  // médico), y la EPS del paciente no puede haber superado su tope de citas
  // o presupuesto vigente para esta especialidad.
  function validarReglasNegocio() {
    if (pacienteTieneChoqueDeHorario(paciente.id, wizardFecha, wizardFranja, citaReprogramando)) {
      return { ok: false, mensaje: "Ya tienes otra cita agendada en esa misma fecha y hora." };
    }

    const frecuencia = restriccionFrecuenciaExcedida(paciente.id, wizardEspecialidad, citaReprogramando);
    if (frecuencia.excedido) {
      return { ok: false, mensaje: frecuencia.mensaje };
    }

    const tope = topeEpsExcedido(paciente.id, wizardEspecialidad, citaReprogramando);
    if (tope.excedido) {
      return { ok: false, mensaje: tope.mensaje };
    }

    return { ok: true };
  }

  function confirmarCita() {
    if (wizardFecha < hoyISO() || franjaEsPasada(wizardFecha, wizardFranja)) {
      setWizardMensaje("Ese horario ya pasó. Elige una fecha u hora futura.");
      return;
    }

    // Verifica que nadie haya tomado esa franja mientras completabas el wizard.
    const horarioYaOcupado = todasLasCitas.some(
      (c) =>
        c.medicoId === wizardMedicoId &&
        c.fecha === wizardFecha &&
        c.hora === wizardFranja &&
        (c.estado === "agendada" || c.estado === "reprogramada") &&
        c.id !== citaReprogramando
    );
    if (horarioYaOcupado) {
      setWizardMensaje("Ese horario ya fue tomado por otro paciente. Elige otro horario.");
      setWizardPaso(4);
      return;
    }

    const { ok, mensaje } = validarReglasNegocio();
    if (!ok) {
      setWizardMensaje(mensaje);
      return;
    }

    // Si ese médico/fecha/hora tenía una cita cancelada de otro paciente
    // (o de este mismo paciente) ocupando el cupo, se libera al tomarla.
    const citaCanceladaEnEseEspacio = todasLasCitas.find(
      (c) =>
        c.medicoId === wizardMedicoId &&
        c.fecha === wizardFecha &&
        c.hora === wizardFranja &&
        c.estado === "cancelada" &&
        c.id !== citaReprogramando
    );
    if (citaCanceladaEnEseEspacio) {
      citasStore.eliminar(citaCanceladaEnEseEspacio.id);
    }

    if (citaReprogramando) {
      citasStore.actualizar(citaReprogramando, {
        medicoId: wizardMedicoId,
        especialidad: wizardEspecialidad,
        sede: wizardSede,
        fecha: wizardFecha,
        hora: wizardFranja,
        estado: "reprogramada",
        motivo: wizardMotivo,
      });
    } else {
      citasStore.agregar({
        pacienteId: paciente.id,
        medicoId: wizardMedicoId,
        especialidad: wizardEspecialidad,
        sede: wizardSede,
        fecha: wizardFecha,
        hora: wizardFranja,
        estado: "agendada",
        motivo: wizardMotivo,
      });
    }

    resetWizard();
    setTab("citas");
  }

  function confirmarCancelacion(id) {
    citasStore.actualizar(id, { estado: "cancelada" });
    setCitaCancelando(null);
    setMotivoCancelacion("");
  }

  return (
    <div className="min-h-screen bg-[#FBFDFC] text-[#1A2624] sax-root">
      <SaxStyles />
      <TopBar nombre={`${paciente.nombre} ${paciente.apellido}`} />

      <div className={`max-w-[1200px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row gap-8 ${navMobilePadding}`}>
        <DashboardNav tabs={TABS} activo={tab} onChange={irATab} />

        <main className="flex-1 min-w-0">
          {/* ---------------- INICIO ---------------- */}
          {tab === "inicio" && (
            <div className="flex flex-col gap-7">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">
                  Tu panel de salud
                </p>
                <h1 className="sax-display text-3xl text-[#0F3D3E]">Hola, {paciente.nombre}</h1>
              </div>

              {proximaCita ? (
                <TicketCita cita={proximaCita} medico={nombreMedico(proximaCita.medicoId)} destacada onVer={() => setTab("citas")} />
              ) : (
                <div className="rounded-2xl border border-dashed border-[#B9CDC8] bg-white/60 p-8 text-center">
                  <span className="material-symbols-outlined text-3xl text-[#9AAFAB]">event_busy</span>
                  <p className="text-[#48605C] mt-2">No tienes citas próximas agendadas.</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatChip icon="event_upcoming" valor={proximas.length} etiqueta="Citas próximas" color="#0E9668" tinte="#D3F3E6" />
                <StatChip icon="history" valor={citas.length} etiqueta="Historial total" color="#0F3D3E" tinte="#EDF2F1" />
                <StatChip icon="verified_user" valor={paciente.eps} etiqueta="Tu EPS" color="#8A6D00" tinte="#F5EEDA" truncar />
              </div>

              <button
                onClick={() => {
                  resetWizard();
                  setTab("agendar");
                }}
                className="self-start bg-[#0E9668] text-white pl-5 pr-6 py-3 rounded-full font-semibold hover:bg-[#0C7D57] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#0E9668]/20 transition-all duration-200 flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add_circle</span>
                Agendar nueva cita
              </button>
            </div>
          )}

          {/* ---------------- MIS CITAS ---------------- */}
          {tab === "citas" && (
            <div className="flex flex-col gap-9">
              <div>
                <h2 className="sax-display text-2xl text-[#0F3D3E] mb-4">Próximas citas</h2>
                {proximas.length === 0 && (
                  <p className="text-[#48605C] text-sm bg-white border border-[#DCE8E5] rounded-xl px-4 py-3">
                    No tienes citas próximas.
                  </p>
                )}
                <div className="flex flex-col gap-4">
                  {proximas.map((c) => (
                    <TicketCita
                      key={c.id}
                      cita={c}
                      medico={nombreMedico(c.medicoId)}
                      onReprogramar={() => setCitaPreguntandoReprogramar(c.id)}
                      onCancelar={() => setCitaCancelando(c.id)}
                    >
                      {citaPreguntandoReprogramar === c.id && (
                        <EleccionInline
                          pregunta={`¿Deseas reprogramar con Dr(a). ${nombreMedico(c.medicoId)} o buscar otro médico?`}
                          opciones={[
                            { label: `Mantener con Dr(a). ${nombreMedico(c.medicoId)}`, destacada: true, onClick: () => iniciarReprogramacion(c, true) },
                            { label: "Buscar otro médico", onClick: () => iniciarReprogramacion(c, false) },
                          ]}
                        />
                      )}

                      {citaCancelando === c.id && (
                        <ConfirmacionInline
                          pregunta="¿Seguro que quieres cancelar esta cita?"
                          textoConfirmar="Sí, cancelar cita"
                          onConfirmar={() => confirmarCancelacion(c.id)}
                          onCancelar={() => {
                            setCitaCancelando(null);
                            setMotivoCancelacion("");
                          }}
                        >
                          <input
                            type="text"
                            placeholder="Motivo (opcional)"
                            value={motivoCancelacion}
                            onChange={(e) => setMotivoCancelacion(e.target.value)}
                            className="w-full border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                          />
                        </ConfirmacionInline>
                      )}
                    </TicketCita>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="sax-display text-2xl text-[#0F3D3E] mb-4">Historial</h2>
                {historial.length === 0 && (
                  <p className="text-[#48605C] text-sm bg-white border border-[#DCE8E5] rounded-xl px-4 py-3">
                    Aún no tienes citas pasadas.
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {historial.map((c) => (
                    <TicketCita key={c.id} cita={c} medico={nombreMedico(c.medicoId)} compacta />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ---------------- AGENDAR / REPROGRAMAR (wizard) ---------------- */}
          {tab === "agendar" && (
            <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 md:p-8 max-w-xl shadow-sm">
              <h2 className="sax-display text-2xl text-[#0F3D3E] mb-5">
                {citaReprogramando ? "Reprogramar cita" : "Agendar nueva cita"}
              </h2>

              <StepTracker pasos={PASOS_WIZARD} actual={wizardPaso} />

              {/* Paso 1: especialidad */}
              {wizardPaso === 1 && (
                <div className="flex flex-col gap-4 mt-6">
                  <label className="text-sm font-semibold text-[#0F3D3E]">Elige una especialidad</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {ESPECIALIDADES.map((esp) => (
                      <OpcionPill
                        key={esp}
                        seleccionado={wizardEspecialidad === esp}
                        onClick={() => {
                          setWizardEspecialidad(esp);
                          setWizardSede("");
                          setWizardMedicoId(null);
                        }}
                        icon="medical_information"
                        label={esp}
                      />
                    ))}
                  </div>
                  <BotonContinuar disabled={!wizardEspecialidad} onClick={() => setWizardPaso(2)} />
                </div>
              )}

              {/* Paso 2: sede */}
              {wizardPaso === 2 && (
                <div className="flex flex-col gap-4 mt-6">
                  <label className="text-sm font-semibold text-[#0F3D3E]">Elige una sede</label>
                  {sedesConMedico.length === 0 && (
                    <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-lg px-4 py-3">
                      No hay médicos de {wizardEspecialidad} en ninguna sede todavía.
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {sedesConMedico.map((sede) => (
                      <OpcionPill
                        key={sede}
                        seleccionado={wizardSede === sede}
                        onClick={() => {
                          setWizardSede(sede);
                          setWizardMedicoId(null);
                        }}
                        icon="location_on"
                        label={sede}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <BotonContinuar disabled={!wizardSede} onClick={() => setWizardPaso(3)} />
                    <button onClick={() => { setMensaje(""); setWizardPaso(1); }} className="text-sm text-[#48605C] hover:underline">
                      ← Cambiar especialidad
                    </button>
                  </div>
                </div>
              )}

              {/* Paso 3: médico */}
              {wizardPaso === 3 && (
                <div className="flex flex-col gap-4 mt-6">
                  <label className="text-sm font-semibold text-[#0F3D3E]">
                    Médicos de {wizardEspecialidad} en {wizardSede}
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
                        seleccionado={wizardMedicoId === m.id}
                        onClick={() => setWizardMedicoId(m.id)}
                        icon="stethoscope"
                        label={`${m.nombre} ${m.apellido}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <BotonContinuar disabled={!wizardMedicoId} onClick={() => setWizardPaso(4)} />
                    <button onClick={() => { setMensaje(""); setWizardPaso(2); }} className="text-sm text-[#48605C] hover:underline">
                      ← Cambiar sede
                    </button>
                  </div>
                </div>
              )}

              {/* Paso 4: fecha + franja horaria + motivo */}
              {wizardPaso === 4 && (
                <div className="flex flex-col gap-4 mt-6">
                  <label className="text-sm font-semibold text-[#0F3D3E]">Elige una fecha</label>
                  <input
                    type="date"
                    value={wizardFecha}
                    min={hoyISO()}
                    onChange={handleCambioFecha}
                    className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm w-fit focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                  />

                  <label className="text-sm font-semibold text-[#0F3D3E] mt-2">Elige un horario disponible</label>
                  {franjasDisponibles.length === 0 ? (
                    <p className="text-sm text-[#48605C] bg-[#F3F8F7] rounded-lg px-4 py-3">
                      No quedan horarios disponibles para esta fecha. Elige otro día.
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {franjasDisponibles.map((f) => (
                        <button
                          key={f}
                          onClick={() => setWizardFranja(f)}
                          className={`sax-mono text-sm px-3 py-2 rounded-lg border text-center transition-colors duration-200 ${
                            wizardFranja === f
                              ? "border-[#0E9668] bg-[#D3F3E6] text-[#0E9668] font-semibold"
                              : "border-[#DCE8E5] hover:border-[#0E9668]"
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  )}

                  <label className="text-sm font-semibold text-[#0F3D3E] mt-2">Motivo de consulta (opcional)</label>
                  <textarea
                    value={wizardMotivo}
                    onChange={(e) => setWizardMotivo(e.target.value)}
                    rows={3}
                    className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                    placeholder="Cuéntanos brevemente el motivo de tu consulta"
                  />

                  <div className="flex items-center gap-4 mt-2">
                    <BotonContinuar disabled={!wizardFecha || !wizardFranja} onClick={() => setWizardPaso(5)} />
                    <button onClick={() => { setMensaje(""); setWizardPaso(3); }} className="text-sm text-[#48605C] hover:underline">
                      ← Cambiar médico
                    </button>
                  </div>
                </div>
              )}

              {/* Paso 5: confirmación */}
              {wizardPaso === 5 && (
                <div className="flex flex-col gap-4 mt-6">
                  <label className="text-sm font-semibold text-[#0F3D3E]">Confirma los datos de tu cita</label>

                  <div className="rounded-2xl border border-[#DCE8E5] overflow-hidden">
                    <div className="bg-[#0F3D3E] px-5 py-4 flex items-center gap-2 text-white">
                      <span className="material-symbols-outlined">confirmation_number</span>
                      <span className="sax-display text-lg">Resumen de tu cita</span>
                    </div>
                    <div className="bg-white divide-y divide-dashed divide-[#DCE8E5]">
                      <FilaConfirmacion icon="person" etiqueta="Paciente" valor={`${paciente.nombre} ${paciente.apellido}`} />
                      <FilaConfirmacion icon="call" etiqueta="Teléfono" valor={paciente.telefono} />
                      <FilaConfirmacion icon="mail" etiqueta="Correo" valor={paciente.correo} />
                      <FilaConfirmacion icon="medical_information" etiqueta="Especialidad" valor={wizardEspecialidad} />
                      <FilaConfirmacion
                        icon="stethoscope"
                        etiqueta="Médico"
                        valor={medicoElegido ? `${medicoElegido.nombre} ${medicoElegido.apellido}` : ""}
                      />
                      <FilaConfirmacion icon="location_on" etiqueta="Sede" valor={wizardSede} />
                      <FilaConfirmacion icon="event" etiqueta="Fecha" valor={wizardFecha} mono />
                      <FilaConfirmacion icon="schedule" etiqueta="Hora" valor={wizardFranja} mono />
                      <FilaConfirmacion icon="hourglass_top" etiqueta="Duración" valor="30 minutos" mono />
                      {wizardMotivo && <FilaConfirmacion icon="edit_note" etiqueta="Motivo" valor={wizardMotivo} />}
                    </div>
                  </div>

                  {wizardMensaje && (
                    <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{wizardMensaje}</p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 mt-2">
                    <button
                      onClick={confirmarCita}
                      className="bg-[#0E9668] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0C7D57] hover:shadow-lg hover:shadow-[#0E9668]/20 transition-all duration-200 flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg">check</span>
                      Confirmar cita
                    </button>
                    <button onClick={() => { setMensaje(""); setWizardPaso(4); }} className="text-sm text-[#48605C] hover:underline">
                      ← Volver y editar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ---------------- MI PERFIL ---------------- */}
          {tab === "perfil" && (
            <PerfilPaciente paciente={paciente} citasCount={citas.length} onGuardar={updateProfile} />
          )}
        </main>
      </div>
    </div>
  );

  function nombreMedico(medicoId) {
    const m = getMedicoPorId(medicoId);
    return m ? `${m.nombre} ${m.apellido}` : "—";
  }
}

/* ============================================================
   Componentes de presentación locales a este dashboard
   ============================================================ */

// Utilidades locales: reutilizan la fuente que ya carga el proyecto
// (font-sans de Tailwind) — sax-display solo ajusta peso/tracking,
// sax-mono usa el font-mono nativo de Tailwind, sin importar nada externo.
function SaxStyles() {
  return (
    <style>{`
      .sax-display { font-weight: 700; letter-spacing: -0.02em; }
      .sax-mono { font-family: ui-monospace, "SFMono-Regular", "Menlo", "Consolas", monospace; }
    `}</style>
  );
}

// Tarjeta de cita con estética de "tiquete" — franja de color por estado,
// costura punteada y talón inferior en tipografía mono.
function TicketCita({ cita, medico, destacada, onVer, onReprogramar, onCancelar, children }) {
  const acc = ESTADO_ACCENT[cita.estado] ?? ESTADO_ACCENT.agendada;
  const compacta = !onReprogramar && !onVer;

  return (
    <div
      className={`relative bg-white border border-[#DCE8E5] rounded-2xl overflow-hidden ${
        destacada ? "shadow-md shadow-[#0F3D3E]/5" : ""
      } ${compacta ? "opacity-90" : ""}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: acc.linea }} />
      <div className={`pl-6 pr-5 ${destacada ? "py-6" : "py-4"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {destacada && (
                <span className="text-xs font-semibold tracking-[0.12em] uppercase" style={{ color: acc.texto }}>
                  Tu próxima cita
                </span>
              )}
              {!destacada && <EstadoBadge estado={cita.estado} />}
            </div>
            <p className={`font-semibold text-[#0F3D3E] ${destacada ? "sax-display text-xl" : "text-base"}`}>
              {cita.especialidad} con {medico}
            </p>
            {cita.motivo && !compacta && (
              <p className="text-sm text-[#48605C] mt-1">Motivo: {cita.motivo}</p>
            )}
          </div>

          {(onVer || onReprogramar || onCancelar) && (
            <div className="flex gap-2 shrink-0">
              {onVer && (
                <button
                  onClick={onVer}
                  className="bg-[#0E9668] text-white px-5 py-2.5 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 shrink-0"
                >
                  Ver detalle
                </button>
              )}
              {onReprogramar && (
                <button
                  onClick={onReprogramar}
                  className="flex-1 sm:flex-none border border-[#0E9668] text-[#0E9668] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#0E9668]/5 transition-colors duration-200"
                >
                  Reprogramar
                </button>
              )}
              {onCancelar && (
                <button
                  onClick={onCancelar}
                  className="flex-1 sm:flex-none border border-[#BA1A1A] text-[#BA1A1A] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#BA1A1A]/5 transition-colors duration-200"
                >
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Talón — costura punteada + datos clave en mono, como el stub de un tiquete */}
        <div className="mt-3 pt-3 border-t border-dashed border-[#DCE8E5] flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="sax-mono text-sm text-[#48605C] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">event</span>
            {cita.fecha}
          </span>
          <span className="sax-mono text-sm font-semibold flex items-center gap-1.5" style={{ color: acc.texto }}>
            <span className="material-symbols-outlined text-base">schedule</span>
            {cita.hora}
          </span>
          <span className="sax-mono text-sm text-[#48605C] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">location_on</span>
            {cita.sede}
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}

function StatChip({ icon, valor, etiqueta, color, tinte, truncar }) {
  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 flex items-center gap-4">
      <span
        className="flex items-center justify-center w-11 h-11 rounded-full shrink-0"
        style={{ backgroundColor: tinte, color }}
      >
        <span className="material-symbols-outlined text-xl">{icon}</span>
      </span>
      <div className="min-w-0">
        <p className={`sax-display text-2xl text-[#0F3D3E] ${truncar ? "truncate" : ""}`}>{valor}</p>
        <p className="text-xs text-[#48605C] uppercase tracking-wide">{etiqueta}</p>
      </div>
    </div>
  );
}

function PerfilPaciente({ paciente, citasCount, onGuardar }) {
  const [form, setForm] = useState({
    nombre: paciente.nombre,
    apellido: paciente.apellido,
    correo: paciente.correo,
    telefono: paciente.telefono,
    direccion: paciente.direccion,
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
      <p className="text-sm text-[#48605C] mb-6 ml-[52px]">Tienes {citasCount} citas en tu historial.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Nombre" name="nombre" value={form.nombre} onChange={handleChange} />
          <Campo label="Apellido" name="apellido" value={form.apellido} onChange={handleChange} />
        </div>

        <Campo label="Correo electrónico" name="correo" type="email" value={form.correo} onChange={handleChange} />
        <Campo label="Teléfono" name="telefono" value={form.telefono} onChange={handleChange} />
        <Campo label="Dirección" name="direccion" value={form.direccion} onChange={handleChange} />

        <CampoSolo label="EPS" value={paciente.eps} hint="Asignada por administración. No editable." />

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