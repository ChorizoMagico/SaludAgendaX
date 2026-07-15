import { useState, useSyncExternalStore } from "react";
import {
  subscribeUsuarios,
  getSolicitudesPendientes,
  aprobarSolicitud,
  rechazarSolicitud,
} from "../../context/mockData";

const ROL_INFO = {
  medico: { label: "Médico", icon: "stethoscope" },
  administrativo: { label: "Administrativo", icon: "admin_panel_settings" },
};

export default function SolicitudesPendientes() {
  const solicitudes = useSyncExternalStore(subscribeUsuarios, getSolicitudesPendientes);
  const [idRechazando, setIdRechazando] = useState(null);
  const [motivoRechazo, setMotivoRechazo] = useState("");
  const [mensaje, setMensaje] = useState(null); // { tipo: "ok" | "error", texto }

  function mostrarMensaje(tipo, texto) {
    setMensaje({ tipo, texto });
    setTimeout(() => setMensaje(null), 3000);
  }

  function handleAprobar(id, nombreCompleto) {
    const resultado = aprobarSolicitud(id);
    if (resultado.ok) {
      mostrarMensaje("ok", `Cuenta de ${nombreCompleto} aprobada.`);
    } else {
      mostrarMensaje("error", resultado.mensaje);
    }
  }

  function abrirRechazo(id) {
    setIdRechazando(id);
    setMotivoRechazo("");
  }

  function confirmarRechazo(nombreCompleto) {
    const resultado = rechazarSolicitud(idRechazando, motivoRechazo);
    setIdRechazando(null);
    setMotivoRechazo("");
    if (resultado.ok) {
      mostrarMensaje("ok", `Solicitud de ${nombreCompleto} rechazada.`);
    } else {
      mostrarMensaje("error", resultado.mensaje);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Cuentas pendientes</p>
        <h1 className="sax-display text-2xl text-[#0F3D3E]">Solicitudes de registro</h1>
        <p className="text-[#48605C] text-sm mt-1">
          Cuentas de médico y administrativo creadas por autorregistro, a la espera de tu autorización.
        </p>
      </div>

      {mensaje && (
        <div
          role="alert"
          className={`flex items-center gap-2 text-sm rounded-lg px-4 py-3 mb-4 ${
            mensaje.tipo === "ok"
              ? "bg-[#D3F3E6] border border-[#0E9668]/30 text-[#0F3D3E]"
              : "bg-[#FFDAD6] border border-[#BA1A1A]/30 text-[#BA1A1A]"
          }`}
        >
          <span className="material-symbols-outlined text-lg">
            {mensaje.tipo === "ok" ? "check_circle" : "error"}
          </span>
          {mensaje.texto}
        </div>
      )}

      {solicitudes.length === 0 ? (
        <div className="bg-white border border-[#DCE8E5] rounded-2xl p-10 text-center">
          <span className="material-symbols-outlined text-[#0E9668] text-4xl mb-2 block">task_alt</span>
          <p className="text-[#48605C]">No hay solicitudes pendientes por revisar.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {solicitudes.map((s) => {
            const info = ROL_INFO[s.rol];
            const nombreCompleto = `${s.nombre} ${s.apellido}`;
            const enRechazo = idRechazando === s.id;

            return (
              <div key={s.id} className="bg-white border border-[#DCE8E5] rounded-2xl p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span className="w-10 h-10 rounded-full bg-[#D3F3E6] text-[#0E9668] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-xl">{info.icon}</span>
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[#0F3D3E]">{nombreCompleto}</h3>
                        <span className="text-xs font-medium text-[#0E9668] bg-[#D3F3E6] px-2 py-0.5 rounded-full">
                          {info.label}
                        </span>
                      </div>
                      <p className="text-sm text-[#48605C] mt-0.5">
                        {s.correo} · CC {s.cedula}
                        {s.telefono ? ` · ${s.telefono}` : ""}
                      </p>
                      {s.rol === "medico" && (
                        <p className="text-sm text-[#48605C] mt-1">
                          {(s.especialidades || []).join(", ") || "Sin especialidad"} · Registro médico:{" "}
                          <span className="font-medium text-[#0F3D3E]">{s.numeroRegistro || "—"}</span>
                          {s.sede ? ` · ${s.sede}` : ""}
                        </p>
                      )}
                    </div>
                  </div>

                  {!enRechazo && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleAprobar(s.id, nombreCompleto)}
                        className="flex items-center gap-1.5 bg-[#0E9668] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
                      >
                        <span className="material-symbols-outlined text-lg">check</span>
                        Aprobar
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirRechazo(s.id)}
                        className="flex items-center gap-1.5 border border-[#BA1A1A] text-[#BA1A1A] px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#BA1A1A]/5 transition-colors duration-200"
                      >
                        <span className="material-symbols-outlined text-lg">close</span>
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>

                {enRechazo && (
                  <div className="mt-4 pt-4 border-t border-dashed border-[#DCE8E5]">
                    <label htmlFor={`motivo-${s.id}`} className="block text-sm font-medium text-[#0F3D3E] mb-1.5">
                      Motivo del rechazo (opcional)
                    </label>
                    <textarea
                      id={`motivo-${s.id}`}
                      value={motivoRechazo}
                      onChange={(e) => setMotivoRechazo(e.target.value)}
                      rows={2}
                      placeholder="Ej. El número de registro médico no pudo ser verificado."
                      className="w-full px-4 py-2.5 border border-[#DCE8E5] rounded-lg text-sm text-[#1A2624] placeholder:text-[#9AAFAB] focus:outline-none focus:ring-2 focus:ring-[#0E9668] focus:border-transparent transition-shadow"
                    />
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => confirmarRechazo(nombreCompleto)}
                        className="bg-[#BA1A1A] text-white px-4 py-2 rounded-full text-sm font-semibold hover:bg-[#9c1616] transition-colors duration-200"
                      >
                        Confirmar rechazo
                      </button>
                      <button
                        type="button"
                        onClick={() => setIdRechazando(null)}
                        className="px-4 py-2 rounded-full text-sm font-semibold text-[#48605C] hover:bg-[#F3F8F7] transition-colors duration-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}