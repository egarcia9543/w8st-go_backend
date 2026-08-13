// Cuerpos reales de correos de Bancolombia, con nombres y cuentas conservados
// tal cual llegaron (son datos del propio dueño de la app).
//
// Cada uno es una plantilla distinta. Si el banco cambia una, el test que la
// cubre falla y sabes exactamente cuál.
export const CUERPOS = {
  // #1 — Pago a tercero. Sin asterisco en "producto", fecha CON segundos y SIN "a las".
  pagoTercero:
    "Bancolombia: Pagaste $40,000.00 a FUNDACION PLAN desde tu producto 9577 el " +
    "12/08/2026 10:37:27. ¿Dudas? Llamanos al 6045109095. Estamos cerca",

  // #2 — Transferencia saliente por llave. La llave es de la CONTRAPARTE.
  transferenciaSaliente:
    "Bancolombia: ESTEBAN, transferiste $44,000.00 a la llave 1020302094 desde tu " +
    "cuenta *9577 a CAMILO GARCIA GARCIA el 12/08/26 a las 15:58. Con Bre-b es de " +
    "una y gratis. Dudas al 018000912345.",

  // #3 — Transferencia entrante. OJO: la llave que aparece es TUYA, no del remitente.
  transferenciaEntrante:
    "Bancolombia: ESTEBAN, recibiste una transferencia de CAMILO GARCIA GARCIA por " +
    "$335,000.00 en tu cuenta *9577 conectada a la llave 1010033459 el 12/08/26 a " +
    "las 15:09. Con llaves es de una y gratis. Dudas al 018000912345.",

  // #4 — Nómina. "Nomina" sin tilde y SIN últimos 4 dígitos.
  nomina:
    "Bancolombia: Recibiste un pago de Nomina de PRAGMA S A por $2,088,000.00 en tu " +
    "cuenta de Ahorros el 27/07/2026 a las 16:29. Si tienes dudas, llamamos al " +
    "018000931987. A tu lado siempre.",

  // #5 — Compra con crédito. Monto en convención COLOMBIANA y coma antes de "el".
  compraCredito:
    "Bancolombia: Compraste COP3.900,00 en APPLE.COM/BILL con tu T.Cred *7829, el " +
    "05/08/2026 a las 09:22. Si tienes dudas, encuentranos aqui: 6045109095 o " +
    "018000931987. Estamos cerca.",
} as const;

const b64 = (s: string): string => Buffer.from(s, "utf-8").toString("base64url");

/// Payload de Gmail con el text/plain anidado dos niveles, como los manda
/// Bancolombia: multipart/related > multipart/alternative > text/plain.
export const payloadAnidado = (cuerpo: string) => ({
  mimeType: "multipart/related",
  headers: [
    { name: "Subject", value: "Todo salió bien con tus movimientos" },
    { name: "From", value: "alertasynotificaciones@an.notificacionesbancolombia.com" },
  ],
  parts: [
    {
      mimeType: "multipart/alternative",
      parts: [
        { mimeType: "text/plain", body: { data: b64(cuerpo) } },
        { mimeType: "text/html", body: { data: b64(`<html><body>${cuerpo}</body></html>`) } },
      ],
    },
  ],
});

/// Payload solo-HTML, en tabla, como el que se ve en el render del correo.
export const payloadHtml = (cuerpo: string) => ({
  mimeType: "multipart/alternative",
  parts: [
    {
      mimeType: "text/html",
      body: {
        data: b64(
          `<html><body><table><tr><td style="color:#000">${cuerpo}</td>` +
            `<td>Controla tu dinero y gestiona tus gastos.</td></tr></table></body></html>`
        ),
      },
    },
  ],
});
