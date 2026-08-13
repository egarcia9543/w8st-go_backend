// Colombia no observa horario de verano: el offset es -05:00 fijo, siempre.
// Eso es lo que hace correcto agrupar con una resta constante en vez de una
// librería de zonas horarias.
const OFFSET_MS = 5 * 60 * 60 * 1000;

// Agrupar con transactionDate.toISOString().slice(0,7) agrupaba en UTC: una
// compra del 31 de julio a las 8pm en Bogotá caía en agosto.
export const mesBogota = (fecha: Date): string =>
  new Date(fecha.getTime() - OFFSET_MS).toISOString().slice(0, 7);

export const diaBogota = (fecha: Date): string =>
  new Date(fecha.getTime() - OFFSET_MS).toISOString().slice(0, 10);

/// "2026-07" -> instante UTC del 2026-07-01T00:00:00-05:00
export const inicioDeMes = (mes: string): Date => new Date(`${mes}-01T00:00:00-05:00`);

export const finDeMes = (mes: string): Date => {
  const inicio = inicioDeMes(mes);
  const siguiente = new Date(inicio);
  siguiente.setUTCMonth(siguiente.getUTCMonth() + 1);
  return siguiente;
};

const MES_VALIDO = /^\d{4}-\d{2}$/;

export const esMesValido = (mes: string): boolean =>
  MES_VALIDO.test(mes) && !Number.isNaN(inicioDeMes(mes).getTime());
