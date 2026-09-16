import { diaBogota } from "./bogota";

export const DIA_CORTE_MIN = 1;
export const DIA_CORTE_MAX = 31;
export const DIAS_GRACIA_MIN = 0;
export const DIAS_GRACIA_MAX = 60;

const MS_DIA = 24 * 60 * 60 * 1000;

export interface BillingCycle {
  label: string;
  from: Date;
  to: Date;
  closesOn: Date;
  paymentDueDate: Date | null;
}

const pad = (n: number): string => String(n).padStart(2, "0");

const diasDelMes = (anio: number, mes: number): number =>
  new Date(Date.UTC(anio, mes, 0)).getUTCDate();

const fechaBogota = (anio: number, mes: number, dia: number): Date =>
  new Date(`${String(anio).padStart(4, "0")}-${pad(mes)}-${pad(dia)}T00:00:00-05:00`);

const corteDe = (anio: number, mes: number, cutoffDay: number): Date =>
  fechaBogota(anio, mes, Math.min(cutoffDay, diasDelMes(anio, mes)));

const mesAnterior = (anio: number, mes: number): [number, number] =>
  mes === 1 ? [anio - 1, 12] : [anio, mes - 1];

const mesSiguiente = (anio: number, mes: number): [number, number] =>
  mes === 12 ? [anio + 1, 1] : [anio, mes + 1];

export const esDiaDeCorteValido = (valor: number): boolean =>
  Number.isInteger(valor) && valor >= DIA_CORTE_MIN && valor <= DIA_CORTE_MAX;

export const esDiasDeGraciaValido = (valor: number): boolean =>
  Number.isInteger(valor) && valor >= DIAS_GRACIA_MIN && valor <= DIAS_GRACIA_MAX;

export const cicloPorMes = (
  mes: string,
  cutoffDay: number,
  graceDays: number | null
): BillingCycle => {
  const [anio, numeroDeMes] = mes.split("-").map(Number);

  const closesOn = corteDe(anio, numeroDeMes, cutoffDay);
  const [anioPrevio, mesPrevio] = mesAnterior(anio, numeroDeMes);

  return {
    label: `${String(anio).padStart(4, "0")}-${pad(numeroDeMes)}`,
    from: new Date(corteDe(anioPrevio, mesPrevio, cutoffDay).getTime() + MS_DIA),
    to: new Date(closesOn.getTime() + MS_DIA),
    closesOn,
    paymentDueDate:
      graceDays === null ? null : new Date(closesOn.getTime() + graceDays * MS_DIA),
  };
};

export const cicloDeFecha = (
  fecha: Date,
  cutoffDay: number,
  graceDays: number | null
): BillingCycle => {
  const [anio, mes, dia] = diaBogota(fecha).split("-").map(Number);
  const corte = Math.min(cutoffDay, diasDelMes(anio, mes));

  const [anioCierre, mesCierre] = dia <= corte ? [anio, mes] : mesSiguiente(anio, mes);

  return cicloPorMes(`${anioCierre}-${pad(mesCierre)}`, cutoffDay, graceDays);
};

export const cicloVigente = (
  ahora: Date,
  cutoffDay: number,
  graceDays: number | null
): BillingCycle => cicloDeFecha(ahora, cutoffDay, graceDays);

export const usaCicloDeFacturacion = (
  kind: string,
  cutoffDay: number | null
): cutoffDay is number => kind === "CREDIT" && cutoffDay !== null;

export const cicloSerializado = (ciclo: BillingCycle) => ({
  label: ciclo.label,
  from: ciclo.from.toISOString(),
  to: ciclo.to.toISOString(),
  closesOn: ciclo.closesOn.toISOString(),
  paymentDueDate: ciclo.paymentDueDate ? ciclo.paymentDueDate.toISOString() : null,
});
