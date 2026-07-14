import { useMemo, useState } from "react";
import {
  EPS_DISPONIBLES,
  getPacientesConCedula,
  registrarPaciente,
  actualizarPaciente,
  eliminarPaciente,
} from "../../context/mockData";
import { Campo, CampoPassword, CampoSolo, AvisoBloqueo, ConfirmacionInline } from "../../context/ui";
import { FilaCitaResumen } from "./AdminDashboard";

/* ============================================================
   TAB: Búsqueda de pacientes (5.2 / pantalla 17) + CRUD
   ============================================================ */

export default function TabPacientes({ todasLasCitas }) {
  const [busqueda, setBusqueda] = useState("");
  const [pacienteVer, setPacienteVer] = useState(null);
  const [vista, setVista] = useState("lista"); // 'lista' | 'nuevo'
  const [editando, setEditando] = useState(false);
  const [bloqueo, setBloqueo] = useState(null);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  // Contador de refresco: getPacientesConCedula() lee MOCK_USERS directamente
  // (no es un store reactivo), así que el useMemo de abajo necesita este
  // contador en sus dependencias o nunca se vuelve a calcular tras crear,
  // editar o eliminar un paciente (aunque el componente sí se re-renderice).
  const [refrescoContador, setRefrescoContador] = useState(0);

  function refrescar() {
    setRefrescoContador((n) => n + 1);
  }

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const todos = getPacientesConCedula();
    if (!q) return todos;
    return todos.filter(
      (p) =>
        p.cedula.includes(q) ||
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(q) ||
        p.correo.toLowerCase().includes(q)
    );
  }, [busqueda, refrescoContador]);

  if (vista === "nuevo") {
    return (
      <FormularioNuevoPaciente
        onCancelar={() => setVista("lista")}
        onCreado={() => {
          setVista("lista");
          refrescar();
        }}
      />
    );
  }

  if (pacienteVer) {
    const citasPaciente = todasLasCitas
      .filter((c) => c.pacienteId === pacienteVer.id)
      .sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
    const citasActivasCount = citasPaciente.filter(
      (c) => c.estado === "agendada" || c.estado === "reprogramada"
    ).length;

    if (editando) {
      return (
        <FormularioEditarPaciente
          paciente={pacienteVer}
          onCancelar={() => setEditando(false)}
          onGuardado={(actualizado) => {
            setEditando(false);
            setPacienteVer(actualizado);
            refrescar();
          }}
        />
      );
    }

    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <button
          onClick={() => {
            setPacienteVer(null);
            setBloqueo(null);
            setConfirmandoEliminar(false);
          }}
          className="text-sm text-[#48605C] hover:underline self-start"
        >
          ← Volver a la búsqueda
        </button>
        <div className="bg-white border border-[#DCE8E5] rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h2 className="sax-display text-2xl text-[#0F3D3E] mb-1">
                {pacienteVer.nombre} {pacienteVer.apellido}
              </h2>
              <p className="text-sm text-[#48605C]">
                CC {pacienteVer.cedula} · {pacienteVer.correo} · {pacienteVer.telefono} · {pacienteVer.eps}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setEditando(true)}
                className="border border-[#0E9668] text-[#0E9668] px-3 py-1.5 rounded-full text-xs font-semibold hover:bg-[#0E9668]/5 transition-colors duration-200"
              >
                Editar
              </button>
              <button
                onClick={() => {
                  if (citasActivasCount > 0) {
                    setBloqueo(
                      `No puedes eliminar a este paciente: tiene ${citasActivasCount} cita${citasActivasCount === 1 ? "" : "s"} activa${citasActivasCount === 1 ? "" : "s"}. Cancela o reprograma esas citas antes de continuar.`
                    );
                    return;
                  }
                  setBloqueo(null);
                  setConfirmandoEliminar(true);
                }}
                className="border border-[#BA1A1A] text-[#BA1A1A] px-2.5 py-1.5 rounded-full text-xs font-semibold hover:bg-[#BA1A1A]/5 transition-colors duration-200 flex items-center"
                title="Eliminar paciente"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>

          {bloqueo && (
            <div className="mt-4">
              <AvisoBloqueo mensaje={bloqueo} onCerrar={() => setBloqueo(null)} />
            </div>
          )}

          {confirmandoEliminar && (
            <div className="mt-4">
              <ConfirmacionInline
                pregunta={`¿Confirmas eliminar a ${pacienteVer.nombre} ${pacienteVer.apellido}? Esta acción no se puede deshacer.`}
                textoConfirmar="Sí, eliminar"
                onConfirmar={() => {
                  const res = eliminarPaciente(pacienteVer.id);
                  if (!res.ok) {
                    setBloqueo(res.mensaje);
                    setConfirmandoEliminar(false);
                    return;
                  }
                  setConfirmandoEliminar(false);
                  setPacienteVer(null);
                  refrescar();
                }}
                onCancelar={() => setConfirmandoEliminar(false)}
              />
            </div>
          )}
        </div>
        <h3 className="sax-display text-lg text-[#0F3D3E]">Historial de citas ({citasPaciente.length})</h3>
        {citasPaciente.length === 0 ? (
          <p className="text-sm text-[#48605C] bg-white border border-[#DCE8E5] rounded-xl px-4 py-3">
            Este paciente no tiene citas registradas.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {citasPaciente.map((c) => (
              <FilaCitaResumen key={c.id} cita={c} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Búsqueda</p>
          <h1 className="sax-display text-2xl text-[#0F3D3E]">Pacientes</h1>
        </div>
        <button
          onClick={() => setVista("nuevo")}
          className="bg-[#0E9668] text-white pl-4 pr-5 py-2.5 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200 flex items-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">person_add</span>
          Nuevo paciente
        </button>
      </div>

      <input
        type="text"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por documento, nombre o correo"
        className="border border-[#DCE8E5] rounded-lg px-4 py-2.5 text-sm max-w-md focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
      />

      <p className="text-sm text-[#48605C]">
        <span className="font-semibold text-[#0F3D3E]">{resultados.length}</span> pacientes
      </p>

      <div className="flex flex-col gap-2">
        {resultados.map((p) => (
          <button
            key={p.id}
            onClick={() => setPacienteVer(p)}
            className="flex items-center justify-between text-left bg-white border border-[#DCE8E5] rounded-xl px-4 py-3 hover:border-[#0E9668] transition-colors duration-200"
          >
            <div>
              <p className="font-semibold text-[#0F3D3E] text-sm">
                {p.nombre} {p.apellido}
              </p>
              <p className="text-xs text-[#48605C]">
                CC {p.cedula} · {p.correo} · {p.eps}
              </p>
            </div>
            <span className="material-symbols-outlined text-[#9AAFAB]">chevron_right</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function FormularioNuevoPaciente({ onCancelar, onCreado }) {
  const [form, setForm] = useState({
    cedula: "",
    password: "",
    nombre: "",
    apellido: "",
    correo: "",
    telefono: "",
    direccion: "",
    eps: "",
  });
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.cedula || !form.password || !form.nombre || !form.apellido || !form.correo || !form.eps) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    if (!/^\d+$/.test(form.cedula.trim())) {
      setError("La cédula solo debe contener números.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.correo.trim())) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }

    const pacientesActuales = getPacientesConCedula();
    const cedulaDuplicada = pacientesActuales.some((p) => p.cedula === form.cedula.trim());
    if (cedulaDuplicada) {
      setError("Ya existe un paciente registrado con esa cédula.");
      return;
    }
    const correoDuplicado = pacientesActuales.some(
      (p) => p.correo.toLowerCase() === form.correo.trim().toLowerCase()
    );
    if (correoDuplicado) {
      setError("Ya existe un paciente registrado con ese correo.");
      return;
    }

    const res = registrarPaciente(form);
    if (res && res.ok === false) {
      setError(res.mensaje || "No se pudo registrar el paciente.");
      return;
    }
    onCreado();
  }

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 md:p-8 max-w-xl shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="sax-display text-2xl text-[#0F3D3E]">Nuevo paciente</h2>
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
        <div>
          <label className="text-sm font-semibold text-[#0F3D3E] mb-2 block">EPS</label>
          <select
            value={form.eps}
            onChange={(e) => setForm({ ...form, eps: e.target.value })}
            className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          >
            <option value="">Selecciona una EPS</option>
            {EPS_DISPONIBLES.map((eps) => (
              <option key={eps} value={eps}>
                {eps}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}

        <button
          type="submit"
          className="self-start bg-[#0E9668] text-white px-6 py-3 rounded-full font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
        >
          Registrar paciente
        </button>
      </form>
    </div>
  );
}

function FormularioEditarPaciente({ paciente, onCancelar, onGuardado }) {
  const [form, setForm] = useState({
    nombre: paciente.nombre || "",
    apellido: paciente.apellido || "",
    correo: paciente.correo || "",
    telefono: paciente.telefono || "",
    direccion: paciente.direccion || "",
    eps: paciente.eps || "",
  });
  const [error, setError] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.nombre || !form.apellido || !form.correo || !form.eps) {
      setError("Completa todos los campos obligatorios.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.correo.trim())) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }
    const correoDuplicado = getPacientesConCedula().some(
      (p) => p.id !== paciente.id && p.correo.toLowerCase() === form.correo.trim().toLowerCase()
    );
    if (correoDuplicado) {
      setError("Ya existe otro paciente registrado con ese correo.");
      return;
    }

    const res = actualizarPaciente(paciente.id, form);
    if (res && res.ok === false) {
      setError(res.mensaje || "No se pudieron guardar los cambios.");
      return;
    }
    onGuardado({ ...paciente, ...form });
  }

  return (
    <div className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6 md:p-8 max-w-xl shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h2 className="sax-display text-2xl text-[#0F3D3E]">Editar paciente</h2>
        <button onClick={onCancelar} className="text-sm text-[#48605C] hover:underline">
          ← Volver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <CampoSolo label="Cédula" value={paciente.cedula} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Nombre" name="nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Campo label="Apellido" name="apellido" value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} />
        </div>
        <Campo label="Correo" name="correo" type="email" value={form.correo} onChange={(e) => setForm({ ...form, correo: e.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Campo label="Teléfono" name="telefono" value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
          <Campo label="Dirección" name="direccion" value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
        </div>
        <div>
          <label className="text-sm font-semibold text-[#0F3D3E] mb-2 block">EPS</label>
          <select
            value={form.eps}
            onChange={(e) => setForm({ ...form, eps: e.target.value })}
            className="border border-[#DCE8E5] rounded-lg px-3 py-2 text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-[#0E9668]"
          >
            <option value="">Selecciona una EPS</option>
            {EPS_DISPONIBLES.map((eps) => (
              <option key={eps} value={eps}>
                {eps}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{error}</p>}

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