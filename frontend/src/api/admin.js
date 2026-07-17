import axiosClient from "./axiosClient";

const lista = (data) => (Array.isArray(data) ? data : data?.results ?? []);
const hora = (value) => value?.slice(0, 5) ?? "";

export function normalizarCita(cita) {
  const estado = String(cita.estado ?? "PENDIENTE").toLowerCase();
  return {
    ...cita,
    id: cita.id,
    fecha: cita.fecha,
    hora: hora(cita.hora_inicio),
    horaFin: hora(cita.hora_fin),
    estado: ({ pendiente: "agendada", agendada: "agendada", cancelada: "cancelada", completada: "completada", reprogramada: "reprogramada" })[estado] ?? estado,
    pacienteId: cita.paciente,
    medicoId: cita.medico,
    especialidadId: cita.especialidad,
    especialidad: cita.especialidad_nombre ?? "Sin especialidad",
    sede: cita.sede_nombre ?? "Sin sede",
    pacienteNombre: cita.paciente_nombre ?? "Paciente",
    medicoNombre: cita.medico_nombre ?? "Médico",
    motivo: cita.motivo_consulta,
  };
}

export function normalizarPaciente(paciente) {
  return {
    ...paciente,
    nombre: paciente.nombres,
    apellido: paciente.apellidos,
    cedula: paciente.num_documento,
    correo: paciente.email,
    epsId: paciente.eps,
  };
}

export function normalizarMedico(medico) {
  return {
    ...medico,
    nombre: medico.nombres,
    apellido: medico.apellidos,
    cedula: medico.num_documento,
    correo: medico.email,
    sedeId: medico.sede,
    sede: medico.sede_nombre ?? "Sin sede",
    especialidades: (medico.especialidades ?? []).map((item) => item.nombre),
    especialidadIds: (medico.especialidades ?? []).map((item) => item.id),
  };
}

export async function cargarCitas(params = {}) {
  const { data } = await axiosClient.get("/citas/", { params: { page_size: 100, ...params } });
  return lista(data).map(normalizarCita);
}
export async function cargarPacientes(params = {}) {
  const { data } = await axiosClient.get("/pacientes/", { params });
  return lista(data).map(normalizarPaciente);
}
export async function crearPaciente(payload) { const { data } = await axiosClient.post("/pacientes/", payload); return normalizarPaciente(data); }
export async function actualizarPaciente(id, payload) { const { data } = await axiosClient.patch(`/pacientes/${id}/`, payload); return normalizarPaciente(data); }
export async function eliminarPaciente(id) { await axiosClient.delete(`/pacientes/${id}/`); }

export async function cargarMedicos(params = {}) {
  const { data } = await axiosClient.get("/medicos/", { params });
  return lista(data).map(normalizarMedico);
}
export async function crearMedico(payload) { const { data } = await axiosClient.post("/medicos/", payload); return normalizarMedico(data); }
export async function actualizarMedico(id, payload) { const { data } = await axiosClient.patch(`/medicos/${id}/`, payload); return normalizarMedico(data); }
export async function eliminarMedico(id) { await axiosClient.delete(`/medicos/${id}/`); }

export async function cargarEspecialidades() { const { data } = await axiosClient.get("/especialidades/"); return lista(data); }
export async function crearEspecialidad(payload) { const { data } = await axiosClient.post("/especialidades/", payload); return data; }
export async function eliminarEspecialidad(id) { await axiosClient.delete(`/especialidades/${id}/`); }
export async function cargarSedes() { const { data } = await axiosClient.get("/sedes/"); return lista(data); }
export async function crearSede(payload) { const { data } = await axiosClient.post("/sedes/", payload); return data; }
export async function eliminarSede(id) { await axiosClient.delete(`/sedes/${id}/`); }
export async function cargarEps() { const { data } = await axiosClient.get("/eps/"); return lista(data); }

export async function crearCita(payload) {
  const { data } = await axiosClient.post("/citas/", payload);
  return normalizarCita(data.data ?? data);
}
export async function cancelarCita(id, motivo = "Cancelada por administración") { await axiosClient.post(`/citas/${id}/cancelar/`, { motivo }); }
export async function reprogramarCita(id, payload) { const { data } = await axiosClient.patch(`/citas/${id}/reprogramar/`, payload); return normalizarCita(data.data ?? data.cita ?? data); }
export async function cargarOcupacion(params = {}) { const { data } = await axiosClient.get("/dashboard/ocupacion/", { params }); return data; }
