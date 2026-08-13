// Tope de cuánto hacia atrás mira el sync. El buzón tiene más de 5 años de
// historia (~2000 correos): traerla entera no cabe en el tiempo de una función
// serverless y no aporta nada al uso diario.
export const VENTANA_MAXIMA_DIAS = 30;

// Se solapa con el último sync para no perder correos que llegaron mientras
// corría, o que Gmail indexó con retraso.
export const SOLAPE_DIAS = 2;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * "Un mes máximo" es un TOPE, no una ventana fija.
 *
 * Si sincronizas seguido, arranca desde el último sync (menos el solape) y son
 * pocos correos. Si llevas meses sin sincronizar, se corta en 30 días.
 *
 * Una ventana fija de 30 días perdería datos en silencio: bastaría demorarse
 * cinco semanas para que la primera semana no la viera nadie nunca más.
 */
export const ventanaDesde = (ahora: Date, ultimoSync: Date | null): Date => {
  const tope = ahora.getTime() - VENTANA_MAXIMA_DIAS * DIA_MS;
  const desdeUltimo = ultimoSync ? ultimoSync.getTime() - SOLAPE_DIAS * DIA_MS : tope;

  // El más RECIENTE de los dos: nunca antes del tope, nunca después del último sync.
  return new Date(Math.max(tope, desdeUltimo));
};
