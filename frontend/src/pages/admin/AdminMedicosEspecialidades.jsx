import { useEffect, useState } from "react";
import {
  ESPECIALIDADES,
  SEDES,
  DIAS_SEMANA,
  getMedicosGestionables,
  registrarMedico,
  toggleActivoUsuario,
  eliminarMedico,
  agregarEspecialidad,
  eliminarEspecialidad,
  agregarSede,
  eliminarSede,
} from "../../context/mockData";
import { Campo, CampoPassword, ConfirmacionInline, AvisoBloqueo } from "../../context/ui";

// Copia editable del horario de un médico: cada día se clona por separado
// para poder tocar inicio/fin sin mutar el objeto original hasta guardar.
function clonarHorarioParaEdicion(horario) {
  return Object.fromEntries(Object.entries(horario || {}).map(([dia, franja]) => [dia, { ...franja }]));
}

// "HH:mm" -> minutos desde medianoche, para comparar rangos de horario.
function horaAMinutos(horaStr) {
  const [h, m] = horaStr.split(":").map(Number);
  return h * 60 + m;
}

// Nombre del día de la semana (en español, con la misma acentuación que
// usa DIAS_SEMANA/medico.horario) a partir de una fecha "yyyy-MM-dd".
const DIA_JS_A_NOMBRE = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
function nombreDiaDeFecha(fechaStr) {
  return DIA_JS_A_NOMBRE[new Date(`${fechaStr}T00:00:00`).getDay()];
}

function hoyISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ============================================================
   TAB: Gestión de médicos (2.1, 2.2)
   ============================================================ */

export function TabMedicos({ todasLasCitas }) {
  const [vista, setVista] = useState("lista"); // 'lista' | 'nuevo'
  const [medicoEditando, setMedicoEditando] = useState(null);
  const [, forzarRefresco] = useState(0);

  // Búsqueda/filtro: por nombre (texto libre) + especialidad y sede (selects).
  // Los tres se combinan con AND, igual que los filtros de la pestaña Citas.
  const [busqueda, setBusqueda] = useState("");
  const [filtroEspecialidad, setFiltroEspecialidad] = useState("");
  const [filtroSede, setFiltroSede] = useState("");

  const medicos = getMedicosGestionables();

  const medicosFiltrados = (() => {
    const q = busqueda.trim().toLowerCase();
    return medicos.filter((m) => {
      const coincideNombre = q ? `${m.nombre} ${m.apellido}`.toLowerCase().includes(q) : true;
      const coincideEspecialidad = filtroEspecialidad ? m.especialidades.includes(filtroEspecialidad) : true;
      const coincideSede = filtroSede ? m.sede === filtroSede : true;
      return coincideNombre && coincideEspecialidad && coincideSede;
    });
  })();

  function refrescar() {
    forzarRefresco((n) => n + 1);
  }

  if (vista === "nuevo") {
    return (
      <FormularioNuevoMedico
        onCancelar={() => setVista("lista")}
        onCreado={() => {
          setVista("lista");
          refrescar();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Gestión</p>
          <h1 className="sax-display text-2xl text-[#0F3D3E]">Médicos</h1>
        </div>
        <button
          onClick={() => setVista("nuevo")}
          className="bg-[#0E9668] text-white pl-4 pr-5 py-2.5 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Nuevo médico
        </button>
      </div>

      <div className="bg-white border border-[#DCE8E5] rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 sm:col-span-1">
          <label className="text-xs font-semibold text-[#48605C] uppercase">Nombre</label>
          <div className="relative">
            <span className="material-symbols-outlined text-lg text-[#9AAFAB] absolute left-2.5 top-1/2 -translate-y-1/2">
              search
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre"
              className="w-full border border-[#DCE8E5] rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[#48605C] uppercase">Especialidad</label>
          <select
            value={filtroEspecialidad}
            onChange={(e) => setFiltroEspecialidad(e.target.value)}
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
            value={filtroSede}
            onChange={(e) => setFiltroSede(e.target.value)}
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
      </div>

      <p className="text-sm text-[#48605C] -mt-2">
        <span className="font-semibold text-[#0F3D3E]">{medicosFiltrados.length}</span> médico
        {medicosFiltrados.length === 1 ? "" : "s"} encontrado{medicosFiltrados.length === 1 ? "" : "s"}
      </p>

      {medicosFiltrados.length === 0 && (
        <p className="text-sm text-[#48605C] bg-white border border-[#DCE8E5] rounded-xl px-4 py-3">
          No hay médicos que coincidan con los filtros.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {medicosFiltrados.map((m) => {
          // Todas las citas activas (agendada/reprogramada) de este médico,
          // sin filtrar por fecha aquí — TarjetaMedico decide cuáles son
          // futuras al validar cambios de horario.
          const citasActivasDelMedico = todasLasCitas.filter(
            (c) => c.medicoId === m.id && (c.estado === "agendada" || c.estado === "reprogramada")
          );
          return (
            <TarjetaMedico
              key={m.id}
              medico={m}
              citasActivasDelMedico={citasActivasDelMedico}
              enEdicion={medicoEditando === m.id}
              onEditar={() => setMedicoEditando(medicoEditando === m.id ? null : m.id)}
              onGuardado={() => {
                setMedicoEditando(null);
                refrescar();
              }}
              onToggleActivo={() => {
                toggleActivoUsuario(m.id);
                refrescar();
              }}
              onEliminar={() => {
                const res = eliminarMedico(m.id);
                if (res.ok) refrescar();
                return res;
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function TarjetaMedico({ medico, citasActivasDelMedico, enEdicion, onEditar, onGuardado, onToggleActivo, onEliminar }) {
  const [especialidadesSel, setEspecialidadesSel] = useState(medico.especialidades);
  const [sedeSel, setSedeSel] = useState(medico.sede);
  const [horarioSel, setHorarioSel] = useState(() => clonarHorarioParaEdicion(medico.horario));
  const [error, setError] = useState("");

  // "bloqueo" es el mensaje que se muestra cuando se intenta desactivar o
  // eliminar a un médico que todavía tiene citas activas asignadas.
  const [bloqueo, setBloqueo] = useState(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const activo = medico.activo !== false;
  const citasActivasCount = citasActivasDelMedico.length;
  const tieneCitasActivas = citasActivasCount > 0;

  // Cada vez que se abre el modo edición, se parte de los datos actuales
  // del médico — así no se arrastran cambios sin guardar de una edición
  // anterior que se haya cerrado sin confirmar.
  useEffect(() => {
    if (enEdicion) {
      setEspecialidadesSel(medico.especialidades);
      setSedeSel(medico.sede);
      setHorarioSel(clonarHorarioParaEdicion(medico.horario));
      setError("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enEdicion]);

  function toggleEspecialidad(esp) {
    setEspecialidadesSel((prev) => (prev.includes(esp) ? prev.filter((e) => e !== esp) : [...prev, esp]));
  }

  // Activa/desactiva un día como laborable. Al activarlo se propone un
  // horario por defecto (08:00–16:00) que el admin puede ajustar después.
  function toggleDiaActivo(dia) {
    setHorarioSel((prev) => {
      const copia = { ...prev };
      if (copia[dia]) {
        delete copia[dia];
      } else {
        copia[dia] = { inicio: "08:00", fin: "16:00" };
      }
      return copia;
    });
  }

  function cambiarHorarioDia(dia, campo, valor) {
    setHorarioSel((prev) => ({ ...prev, [dia]: { ...prev[dia], [campo]: valor } }));
  }

  function guardar() {
    if (especialidadesSel.length === 0) {
      setError("Debe quedar al menos una especialidad asignada.");
      return;
    }

    const diasActivos = Object.keys(horarioSel);
    if (diasActivos.length === 0) {
      setError("El médico debe tener al menos un día laboral en su horario.");
      return;
    }
    for (const dia of diasActivos) {
      const { inicio, fin } = horarioSel[dia];
      if (!inicio || !fin) {
        setError(`Completa la hora de inicio y fin del ${dia}.`);
        return;
      }
      if (inicio >= fin) {
        setError(`En ${dia}, la hora de inicio debe ser antes que la hora de fin.`);
        return;
      }
    }

    // Verificación clave: no se puede quitar un día laboral (dejarlo
    // libre) ni recortar su rango de horas si el médico ya tiene citas
    // ACTIVAS (agendada/reprogramada) y FUTURAS (hoy en adelante) que
    // caigan en ese día de la semana y queden fuera del nuevo horario.
    // Sin esto, el admin podía "liberar" un día completo aunque el
    // médico ya tuviera pacientes citados ahí, dejando la cita huérfana.
    const hoy = hoyISO();
    const citasFuturasActivas = citasActivasDelMedico.filter((c) => c.fecha >= hoy);

    for (const dia of DIAS_SEMANA) {
      const horarioAnterior = medico.horario?.[dia];
      if (!horarioAnterior) continue; // ya era día libre antes: nada que proteger

      const citasEseDia = citasFuturasActivas.filter((c) => nombreDiaDeFecha(c.fecha) === dia);
      if (citasEseDia.length === 0) continue; // no hay citas ese día de la semana: cambio seguro

      const horarioNuevo = horarioSel[dia];

      if (!horarioNuevo) {
        setError(
          `No puedes dejar el ${dia} como día libre: el médico tiene ${citasEseDia.length} cita${
            citasEseDia.length === 1 ? "" : "s"
          } agendada${citasEseDia.length === 1 ? "" : "s"} ese día (próxima: ${citasEseDia[0].fecha} ${
            citasEseDia[0].hora
          }). Reprograma o cancela esas citas antes de liberar el día.`
        );
        return;
      }

      const inicioNuevoMin = horaAMinutos(horarioNuevo.inicio);
      const finNuevoMin = horaAMinutos(horarioNuevo.fin);
      const citaFueraDeRango = citasEseDia.find((c) => {
        const min = horaAMinutos(c.hora);
        return min < inicioNuevoMin || min >= finNuevoMin;
      });

      if (citaFueraDeRango) {
        setError(
          `No puedes cambiar el horario del ${dia} a ${horarioNuevo.inicio}–${horarioNuevo.fin}: hay una cita el ${citaFueraDeRango.fecha} a las ${citaFueraDeRango.hora} que quedaría fuera de ese rango. Reprograma esa cita antes de reducir el horario.`
        );
        return;
      }
    }

    setError("");
    import("../../context/mockData").then(({ actualizarUsuarioMock }) => {
      actualizarUsuarioMock(medico.id, { especialidades: especialidadesSel, sede: sedeSel, horario: horarioSel });
      onGuardado();
    });
  }

  function intentarDesactivar() {
    if (activo && tieneCitasActivas) {
      setBloqueo(
        `No puedes desactivar a este médico: tiene ${citasActivasCount} cita${citasActivasCount === 1 ? "" : "s"} activa${citasActivasCount === 1 ? "" : "s"}. Reprograma esas citas con otro médico antes de continuar.`
      );
      return;
    }
    setBloqueo(null);
    onToggleActivo();
  }

  function intentarEliminar() {
    if (tieneCitasActivas) {
      setBloqueo(
        `No puedes eliminar a este médico: tiene ${citasActivasCount} cita${citasActivasCount === 1 ? "" : "s"} activa${citasActivasCount === 1 ? "" : "s"}. Reprograma esas citas con otro médico antes de continuar.`
      );
      return;
    }
    setBloqueo(null);
    setConfirmandoEliminar(true);
  }

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-10 h-10 rounded-full bg-[#D3F3E6] text-[#0E9668] shrink-0">
            <span className="material-symbols-outlined text-xl">stethoscope</span>
          </span>
          <div className="min-w-0">
            <p className="font-semibold text-[#0F3D3E] text-sm truncate">
              {medico.nombre} {medico.apellido}
              {!activo && <span className="ml-2 text-xs font-semibold text-[#BA1A1A]">(inactivo)</span>}
            </p>
            <p className="text-xs text-[#48605C] truncate">
              {medico.especialidades.join(", ")} · {medico.sede} · {citasActivasCount} citas activas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onEditar}
            className="border border-[#0E9668] text-[#0E9668] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#0E9668]/5 transition-colors duration-200"
          >
            {enEdicion ? "Cerrar" : "Editar"}
          </button>
          <button
            onClick={intentarDesactivar}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors duration-200 ${
              activo
                ? "border-[#BA1A1A] text-[#BA1A1A] hover:bg-[#BA1A1A]/5"
                : "border-[#0E9668] text-[#0E9668] hover:bg-[#0E9668]/5"
            }`}
          >
            {activo ? "Desactivar" : "Activar"}
          </button>
          <button
            onClick={intentarEliminar}
            className="border border-[#BA1A1A] text-[#BA1A1A] px-2.5 py-1.5 rounded-full text-xs font-semibold hover:bg-[#BA1A1A]/5 transition-colors duration-200 flex items-center"
            title="Eliminar médico"
          >
            <span className="material-symbols-outlined text-base">delete</span>
          </button>
        </div>
      </div>

      {bloqueo && (
        <div className="px-5 pb-4">
          <AvisoBloqueo mensaje={bloqueo} onCerrar={() => setBloqueo(null)} />
        </div>
      )}

      {confirmandoEliminar && (
        <div className="px-5 pb-4">
          <ConfirmacionInline
            pregunta={`¿Confirmas eliminar a ${medico.nombre} ${medico.apellido}? Esta acción no se puede deshacer.`}
            textoConfirmar="Sí, eliminar"
            onConfirmar={() => {
              setConfirmandoEliminar(false);
              const res = onEliminar();
              if (!res.ok) setBloqueo(res.mensaje);
            }}
            onCancelar={() => setConfirmandoEliminar(false)}
          />
        </div>
      )}

      {enEdicion && (
        <div className="px-5 pb-5 border-t border-dashed border-[#DCE8E5] pt-4 flex flex-col gap-5">
          <div>
            <label className="text-sm font-semibold text-[#0F3D3E] mb-2 block">Especialidades</label>
            <div className="flex flex-wrap gap-2">
              {ESPECIALIDADES.map((esp) => (
                <button
                  key={esp}
                  onClick={() => toggleEspecialidad(esp)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-200 ${
                    especialidadesSel.includes(esp)
                      ? "border-[#0E9668] bg-[#D3F3E6] text-[#0E9668] font-semibold"
                      : "border-[#DCE8E5] text-[#48605C] hover:border-[#0E9668]"
                  }`}
                >
                  {esp}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#0F3D3E] mb-2 block">Sede</label>
            <select
              value={sedeSel}
              onChange={(e) => setSedeSel(e.target.value)}
              className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
            >
              {SEDES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-semibold text-[#0F3D3E] mb-2 block">Horario laboral</label>
            <div className="flex flex-col gap-2">
              {DIAS_SEMANA.map((dia) => {
                const diaActivo = !!horarioSel[dia];
                return (
                  <div
                    key={dia}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 flex-wrap transition-colors duration-200 ${
                      diaActivo ? "border-[#0E9668] bg-[#F3F8F7]" : "border-[#DCE8E5]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDiaActivo(dia)}
                      className={`flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border shrink-0 w-28 transition-colors duration-200 ${
                        diaActivo
                          ? "border-[#0E9668] bg-[#0E9668] text-white"
                          : "border-[#DCE8E5] text-[#48605C] hover:border-[#0E9668]"
                      }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {diaActivo ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      {dia}
                    </button>

                    {diaActivo ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={horarioSel[dia].inicio}
                          onChange={(e) => cambiarHorarioDia(dia, "inicio", e.target.value)}
                          className="sax-mono border border-[#DCE8E5] rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                        />
                        <span className="text-xs text-[#9AAFAB]">a</span>
                        <input
                          type="time"
                          value={horarioSel[dia].fin}
                          onChange={(e) => cambiarHorarioDia(dia, "fin", e.target.value)}
                          className="sax-mono border border-[#DCE8E5] rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-[#9AAFAB]">Día libre</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}
          <button
            onClick={guardar}
            className="self-start bg-[#0E9668] text-white px-5 py-2 rounded-full text-sm font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
          >
            Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
}

function FormularioNuevoMedico({ onCancelar, onCreado }) {
  const [form, setForm] = useState({
    cedula: "",
    password: "",
    nombre: "",
    apellido: "",
    correo: "",
    telefono: "",
    direccion: "",
    numeroRegistro: "",
    sede: SEDES[0] || "",
  });
  const [especialidadesSel, setEspecialidadesSel] = useState([]);
  const [error, setError] = useState("");

  function toggleEspecialidad(esp) {
    setEspecialidadesSel((prev) => (prev.includes(esp) ? prev.filter((e) => e !== esp) : [...prev, esp]));
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.cedula || !form.password || !form.nombre || !form.apellido || !form.correo) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    if (especialidadesSel.length === 0) {
      setError("Selecciona al menos una especialidad.");
      return;
    }
    if (!form.sede) {
      setError("Selecciona una sede.");
      return;
    }
    registrarMedico({ ...form, especialidades: especialidadesSel });
    onCreado();
  }

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 md:p-8 max-w-xl shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="sax-display text-2xl text-[#0F3D3E]">Nuevo médico</h2>
        <button onClick={onCancelar} className="text-sm text-[#48605C] hover:underline">
          ← Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Cédula" name="cedula" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} />
          <CampoPassword
            label="Contraseña temporal"
            name="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Nombre" name="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Campo label="Apellido" name="apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
        </div>
        <Campo label="Correo" name="correo" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Teléfono" name="telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <Campo label="Dirección" name="direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
        </div>
        <Campo
            label="N.º de registro médico"
            name="numeroRegistro"
            value={form.numeroRegistro}
            onChange={(e) => setForm({ ...form, numeroRegistro: e.target.value })}
        />

        <div>
          <label className="text-sm font-semibold text-[#0F3D3E] mb-2 block">Especialidades</label>
          <div className="flex flex-wrap gap-2">
            {ESPECIALIDADES.map((esp) => (
              <button
                type="button"
                key={esp}
                onClick={() => toggleEspecialidad(esp)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors duration-200 ${
                  especialidadesSel.includes(esp)
                    ? "border-[#0E9668] bg-[#D3F3E6] text-[#0E9668] font-semibold"
                    : "border-[#DCE8E5] text-[#48605C] hover:border-[#0E9668]"
                }`}
              >
                {esp}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-[#0F3D3E] mb-2 block">Sede</label>
          <select
            value={form.sede}
            onChange={(e) => setForm({ ...form, sede: e.target.value })}
            className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          >
            {SEDES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          className="self-start bg-[#0E9668] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
        >
          Registrar médico
        </button>
      </form>
    </div>
  );
}

/* ============================================================
   TAB: Gestión de especialidades y sedes — CRUD (2.2 / pantalla 15)
   ============================================================ */

export function TabEspecialidades() {
  // Estado local que refleja ESPECIALIDADES/SEDES del mockData. Se guarda
  // aquí (y no solo se lee el módulo directamente) para poder actualizar la
  // UI al instante después de agregar/eliminar, sin esperar a que el tab se
  // desmonte y remonte al cambiar de sección y volver.
  const [especialidades, setEspecialidades] = useState(ESPECIALIDADES);
  const [sedes, setSedes] = useState(SEDES);

  // Un único estado de "eliminar pendiente", compartido entre los dos
  // paneles: abrir la confirmación de eliminar en un panel cierra
  // automáticamente cualquier otro cuadro (de eliminar o de agregar) que
  // hubiera quedado abierto en el otro panel, y viceversa.
  const [pendienteEliminar, setPendienteEliminar] = useState(null); // { panel, valor } | null

  function refrescarEspecialidades() {
    setEspecialidades([...ESPECIALIDADES]);
  }
  function refrescarSedes() {
    setSedes([...SEDES]);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Catálogo</p>
        <h1 className="sax-display text-2xl text-[#0F3D3E]">Especialidades y sedes</h1>
        <p className="text-sm text-[#48605C] mt-1">
          Solo se puede eliminar un registro si ningún médico está asignado a él.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <PanelCatalogo
          panelId="especialidades"
          titulo="Especialidades médicas"
          icon="medical_information"
          items={especialidades}
          placeholder="Nueva especialidad"
          entidadLabel="especialidad"
          onAgregar={agregarEspecialidad}
          onEliminar={eliminarEspecialidad}
          onCambio={refrescarEspecialidades}
          pendienteEliminar={pendienteEliminar}
          onAbrirEliminar={(valor) => setPendienteEliminar({ panel: "especialidades", valor })}
          onCerrarEliminar={() => setPendienteEliminar(null)}
        />
        <PanelCatalogo
          panelId="sedes"
          titulo="Sedes"
          icon="location_on"
          items={sedes}
          placeholder="Nueva sede"
          entidadLabel="sede"
          onAgregar={agregarSede}
          onEliminar={eliminarSede}
          onCambio={refrescarSedes}
          pendienteEliminar={pendienteEliminar}
          onAbrirEliminar={(valor) => setPendienteEliminar({ panel: "sedes", valor })}
          onCerrarEliminar={() => setPendienteEliminar(null)}
        />
      </div>
    </div>
  );
}

// Panel de catálogo reutilizable: lista de chips + formulario de alta +
// confirmación inline antes de eliminar. Se usa tanto para especialidades
// como para sedes, evitando duplicar el mismo layout dos veces.
function PanelCatalogo({
  panelId,
  titulo,
  icon,
  items,
  placeholder,
  entidadLabel,
  onAgregar,
  onEliminar,
  onCambio,
  pendienteEliminar,
  onAbrirEliminar,
  onCerrarEliminar,
}) {
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState("");

  const eliminarActivo = pendienteEliminar?.panel === panelId ? pendienteEliminar.valor : null;

  function agregar(e) {
    e.preventDefault();
    const res = onAgregar(nuevo);
    if (!res.ok) {
      setError(res.mensaje);
      return;
    }
    setError("");
    setNuevo("");
    onCerrarEliminar();
    onCambio();
  }

  function confirmarEliminar() {
    const res = onEliminar(eliminarActivo);
    if (!res.ok) {
      setError(res.mensaje);
      onCerrarEliminar();
      return;
    }
    setError("");
    onCerrarEliminar();
    onCambio();
  }

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="flex items-center justify-center w-9 h-9 rounded-full bg-[#D3F3E6] text-[#0E9668] shrink-0">
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </span>
        <div className="min-w-0">
          <h2 className="sax-display text-lg text-[#0F3D3E]">{titulo}</h2>
          <p className="text-xs text-[#48605C]">
            {items.length} registrada{items.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <form onSubmit={agregar} className="flex gap-2">
        <input
          type="text"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onFocus={onCerrarEliminar}
          placeholder={placeholder}
          className="flex-1 border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
        />
        <button
          type="submit"
          className="bg-[#0E9668] text-white w-10 h-10 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 flex items-center justify-center shrink-0"
          title="Agregar"
        >
          <span className="material-symbols-outlined text-lg">add</span>
        </button>
      </form>

      {error && <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}

      <div className="flex flex-wrap gap-2">
        {items.length === 0 && <p className="text-sm text-[#48605C]">Sin registros todavía.</p>}
        {items.map((item) => (
          <span
            key={item}
            className="flex items-center gap-1.5 bg-[#F3F8F7] border border-[#DCE8E5] rounded-full pl-3.5 pr-1.5 py-1.5 text-sm font-semibold text-[#0F3D3E]"
          >
            {item}
            <button
              onClick={() => onAbrirEliminar(item)}
              className="flex items-center justify-center w-5 h-5 rounded-full text-[#9AAFAB] hover:bg-[#FFDAD6] hover:text-[#BA1A1A] transition-colors"
              title={`Eliminar ${item}`}
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </span>
        ))}
      </div>

      {eliminarActivo && (
        <ConfirmacionInline
          pregunta={`¿Eliminar la ${entidadLabel} "${eliminarActivo}"? Esta acción no se puede deshacer.`}
          textoConfirmar="Sí, eliminar"
          onConfirmar={confirmarEliminar}
          onCancelar={onCerrarEliminar}
        />
      )}
    </div>
  );
}