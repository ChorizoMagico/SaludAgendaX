import { useEffect, useState, useSyncExternalStore } from "react";
import {
  topesEpsStore,
  citasStore,
  getAlertasTopes,
  alertasRevisadasStore,
  alertaFueRevisada,
} from "../../context/mockData";
import axiosClient, { extraerMensajeError } from "../../api/axiosClient";

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== "false";

export default function AlertasTopes({ onIrATopes }) {
  const [alertasReales, setAlertasReales] = useState([]);
  const [errorApi, setErrorApi] = useState("");
  // Suscripciones puramente reactivas: el % de uso depende tanto de los
  // topes configurados como de las citas registradas, así que este
  // componente se debe re-renderizar si cualquiera de los dos cambia.
  useSyncExternalStore(topesEpsStore.subscribe, topesEpsStore.getSnapshot);
  useSyncExternalStore(citasStore.subscribe, citasStore.getSnapshot);

  // Igual que arriba: se lee del store compartido (no de un useState local)
  // para que "marcar revisada" persista aunque se salga de esta pantalla.
  const revisadas = useSyncExternalStore(alertasRevisadasStore.subscribe, alertasRevisadasStore.getSnapshot);

  useEffect(() => {
    if (USE_MOCK) return;
    axiosClient.get("/alertas-topes/")
      .then(({ data }) => setAlertasReales((data.alertas ?? []).map((alerta) => ({
        id: alerta.id,
        eps: alerta.eps_nombre,
        especialidad: null,
        periodo: `${alerta.periodo_inicio} - ${alerta.periodo_fin}`,
        maxCitas: null,
        presupuestoMax: null,
        uso: { porcentaje: Math.round(Number(alerta.porcentaje_uso)), usadas: null, gastado: null },
      }))))
      .catch((error) => setErrorApi(extraerMensajeError(error, "No fue posible cargar las alertas.")));
  }, []);

  const alertasFuente = USE_MOCK ? getAlertasTopes() : alertasReales;
  const alertas = alertasFuente.filter((a) => !alertaFueRevisada(a.id, a.uso.porcentaje, revisadas));

  function marcarRevisada(id, porcentajeActual) {
    alertasRevisadasStore.marcar(id, porcentajeActual);
  }

  // Misma paleta de acentos que ESTADO_ACCENT (AdminDashboard/TabCitas):
  // ámbar para "reprogramada"-like, rojo para estados críticos/cancelados.
  function nivelDeAlerta(porcentaje) {
    if (porcentaje >= 100) return { accent: "#BA1A1A", badge: "bg-[#BA1A1A] text-white", texto: "Agotado" };
    if (porcentaje >= 95) return { accent: "#BA1A1A", badge: "bg-[#FFDAD6] text-[#BA1A1A]", texto: "Crítico" };
    return { accent: "#8A6D00", badge: "bg-[#F5EEDA] text-[#8A6D00]", texto: "Alerta" };
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-xs font-semibold tracking-[0.14em] uppercase text-[#0E9668] mb-1">Monitoreo</p>
        <h1 className="sax-display text-2xl text-[#0F3D3E]">Alertas de topes</h1>
        <p className="text-[#48605C] text-sm mt-1">
          Topes de EPS que alcanzaron el 80% o más de su uso en el período actual.
        </p>
      </div>
      {errorApi && <p className="mb-4 text-sm text-[#BA1A1A] bg-[#FFDAD6] px-3 py-2 rounded-lg">{errorApi}</p>}

      {alertas.length === 0 ? (
        <div className="bg-white border border-[#DCE8E5] rounded-2xl p-10 text-center">
          <span className="material-symbols-outlined text-[#0E9668] text-4xl mb-2 block">task_alt</span>
          <p className="text-[#48605C]">No hay topes cerca de agotarse en este momento.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {alertas.map((a) => {
            const nivel = nivelDeAlerta(a.uso.porcentaje);
            return (
              <div key={a.id} className="relative bg-white border border-[#DCE8E5] rounded-2xl overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ backgroundColor: nivel.accent }} />
                <div className="pl-6 pr-5 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: nivel.accent === "#BA1A1A" ? "#FFDAD6" : "#F5EEDA", color: nivel.accent }}
                    >
                      <span className="material-symbols-outlined text-xl">warning</span>
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-[#0F3D3E]">{a.eps}</h3>
                        <span className="text-xs font-medium text-[#48605C] bg-[#F3F8F7] px-2 py-0.5 rounded-full">
                          {a.especialidad || "Todas las especialidades"}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${nivel.badge}`}>
                          {a.uso.porcentaje}% · {nivel.texto}
                        </span>
                      </div>
                      <p className="text-sm text-[#48605C] mt-1">
                        {a.uso.usadas != null ? `${a.uso.usadas} de ${a.maxCitas} citas usadas` : "Alerta registrada"} ({a.periodo})
                        {a.presupuestoMax != null && a.uso.gastado != null &&
                          ` · $${a.uso.gastado.toLocaleString("es-CO")} de $${a.presupuestoMax.toLocaleString("es-CO")}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={onIrATopes}
                      className="flex items-center gap-1.5 bg-[#0E9668] text-white px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-[#0C7D57] transition-colors duration-200"
                    >
                      <span className="material-symbols-outlined text-lg">account_balance</span>
                      Ver tope
                    </button>
                    <button
                      type="button"
                      onClick={() => marcarRevisada(a.id, a.uso.porcentaje)}
                      className="px-3 py-1.5 rounded-full text-sm font-semibold text-[#48605C] hover:bg-[#F3F8F7] transition-colors duration-200"
                    >
                      Marcar revisada
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
