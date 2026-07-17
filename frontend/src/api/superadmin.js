import axiosClient from "./axiosClient";

export function comoLista(data) {
  return Array.isArray(data) ? data : data?.results ?? [];
}

export function normalizarTope(tope) {
  return {
    id: tope.id,
    epsId: tope.eps,
    eps: tope.eps_nombre,
    periodo: tope.tipo_periodo.toLowerCase(),
    maxCitas: tope.limite_citas,
    presupuestoMax: tope.presupuesto_maximo == null ? null : Number(tope.presupuesto_maximo),
    uso: {
      usadas: tope.uso_actual?.usadas ?? 0,
      porcentaje: Number(tope.uso_actual?.porcentaje ?? 0),
    },
  };
}

export async function cargarTopes() {
  const { data } = await axiosClient.get("/topes-eps/");
  return comoLista(data).map(normalizarTope);
}

export async function cargarEps() {
  const { data } = await axiosClient.get("/eps/");
  return comoLista(data);
}

export async function cargarEspecialidades() {
  const { data } = await axiosClient.get("/restricciones-frecuencia/");
  return comoLista(data);
}

