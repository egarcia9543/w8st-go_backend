// Colombia no tiene horario de verano: el offset es fijo UTC-5 todo el año.
const OFFSET_COLOMBIA = "-05:00";

// Las plantillas traen tres formas distintas de fecha/hora:
//   "12/08/2026 10:37:27"      -> año largo, con segundos, sin "a las"
//   "12/08/26 a las 15:58"     -> año corto
//   "27/07/2026 a las 16:29"   -> año largo
//
// La versión anterior concatenaba ":00" asumiendo HH:MM. Con "10:37:27" producía
// "T10:37:27:00" -> Invalid Date. Y sin offset explícito la fecha dependía de la
// zona del proceso: local en tu máquina, UTC en Vercel, resultados distintos.
export const parseDate = (dateStr: string, timeStr: string): Date => {
  const [day, month, year] = dateStr.split("/");
  const fullYear = year.length === 2 ? `20${year}` : year;

  const partesHora = timeStr.split(":");
  const hora = partesHora[0].padStart(2, "0");
  const minuto = (partesHora[1] ?? "00").padStart(2, "0");
  const segundo = (partesHora[2] ?? "00").padStart(2, "0");

  const iso =
    `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}` +
    `T${hora}:${minuto}:${segundo}${OFFSET_COLOMBIA}`;

  return new Date(iso);
};
