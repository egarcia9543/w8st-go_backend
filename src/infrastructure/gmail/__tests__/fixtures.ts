// Cuerpos de correo ANONIMIZADOS.
//
// Están calcados de plantillas reales de Bancolombia, pero todos los datos
// identificables son ficticios: números de cuenta y tarjeta, llaves, nombres de
// personas y empresas, montos y fechas.
//
// Lo que SÍ se conserva —porque es lo que los tests verifican— son las rarezas
// estructurales de cada plantilla:
//   - las dos convenciones de monto ($1,000.00 americana vs COP1.000,00 colombiana)
//   - montos sin decimales
//   - los tres formatos de fecha (con/sin "a las", con/sin segundos, año de 2 o 4 dígitos)
//   - uno, dos o ningún asterisco antes de los últimos 4 dígitos
//   - llaves numéricas y alfanuméricas
//
// No pongas correos reales aquí: este archivo va a control de versiones.
export const CUERPOS = {
  // #1 — Pago a tercero. "producto" sin asterisco, fecha CON segundos y SIN "a las".
  pagoTercero:
    "Bancolombia: Pagaste $50,000.00 a FUNDACION EJEMPLO desde tu producto 4021 el " +
    "04/03/2026 10:37:27. ¿Dudas? Llamanos al 6040000000. Estamos cerca",

  // #2 — Transferencia saliente por llave numérica. La llave es de la CONTRAPARTE.
  transferenciaSaliente:
    "Bancolombia: TITULAR, transferiste $75,000.00 a la llave 3001234567 desde tu " +
    "cuenta *4021 a JUAN PEREZ GOMEZ el 05/03/26 a las 15:58. Con Bre-b es de " +
    "una y gratis. Dudas al 018000000000.",

  // #3 — Transferencia entrante. OJO: la llave que aparece es la PROPIA, no la del remitente.
  transferenciaEntrante:
    "Bancolombia: TITULAR, recibiste una transferencia de MARIA LOPEZ RUIZ por " +
    "$120,000.00 en tu cuenta *4021 conectada a la llave 3009876543 el 06/03/26 a " +
    "las 15:09. Con llaves es de una y gratis. Dudas al 018000000000.",

  // #4 — Nómina. "Nomina" sin tilde y SIN últimos 4 dígitos.
  nomina:
    "Bancolombia: Recibiste un pago de Nomina de ACME S A por $3,000,000.00 en tu " +
    "cuenta de Ahorros el 28/02/2026 a las 16:29. Si tienes dudas, llamamos al " +
    "018000000000. A tu lado siempre.",

  // #5 — Compra con crédito. Monto en convención COLOMBIANA y coma antes de "el".
  compraCredito:
    "Bancolombia: Compraste COP5.500,00 en TIENDA.COM/PAGO con tu T.Cred *3388, el " +
    "07/03/2026 a las 09:22. Si tienes dudas, encuentranos aqui: 6040000000 o " +
    "018000000000. Estamos cerca.",

  // --- Segunda tanda: plantillas descubiertas por UnparsedEmail tras el primer sync ---

  // #6 — Pago por QR. Verbo "pagaste" compartido con payment-out.
  pagoQr:
    "Bancolombia: TITULAR DE PRUEBA pagaste $15,000.00 por codigo QR desde tu " +
    "cuenta *4021 a la llave 0011223344 el 09/03/2026 a las 12:47. Con codigo QR " +
    "es facil y de una. Dudas al 018000000000.",

  // #7 — Transferencia a cuenta. Monto SIN decimales y destino de 11 dígitos
  // con espacio tras el asterisco.
  transferenciaACuenta:
    "Bancolombia: Transferiste $60,000 desde tu cuenta *4021 a la cuenta * " +
    "01230000000 el 10/03/2026 a las 21:08. ¿Dudas? Llamanos al 018000000000. " +
    "Estamos cerca.",

  // #8 — Misma plantilla, cuenta origen SIN asterisco.
  transferenciaACuentaSinAsterisco:
    "Bancolombia: Transferiste $90,000.00 desde tu cuenta 4021 a la cuenta " +
    "*3040000000 el 11/03/2026 a las 18:07. ¿Dudas? Llamanos al 018000000000.",

  // #9 — Retiro en cajero. DOBLE asterisco y monto en convención colombiana.
  retiroCajero:
    "Bancolombia: Retiraste $80.000,00 en CAJERO001 de tu T.Deb **9915 el " +
    "12/03/2026 a las 12:40. Si tienes dudas, llamanos al 6040000000. Estamos cerca",

  // #10 — Transferencia con llave ALFANUMÉRICA. El patrón \d+ perdía estas.
  transferenciaLlaveAlfanumerica:
    "Bancolombia: TITULAR, transferiste $200,000.00 a la llave @destino456 desde tu " +
    "cuenta *4021 a PEDRO RAMIREZ el 13/03/26 a las 23:50. Con Bre-b es de una y " +
    "gratis. Dudas al 018000000000.",

  // #11 — Transferencia entrante con llave propia alfanumérica.
  transferenciaEntranteLlaveAlfanumerica:
    "Bancolombia: TITULAR, recibiste una transferencia de ANA GOMEZ SOTO por " +
    "$45,000.00 en tu cuenta *4021 conectada a la llave @usuario123 el 14/03/26 a " +
    "las 00:12. Con llaves es de una y gratis.",

  // #12 — Ingreso de proveedor: "pago PROVEEDOR", no "pago de Nomina".
  pagoProveedor:
    "Bancolombia: Recibiste un pago PROVEEDOR de FONDO EJEMPLO por $1,200,000.00 " +
    "en tu cuenta de Ahorros el 15/03/2026 a las 09:50. Si tienes dudas, llamanos " +
    "al 018000000000. A tu lado siempre.",

  // #13 — Compra con la tarjeta al FINAL, en una segunda frase.
  compraTarjetaAlFinal:
    "Bancolombia: Compraste COP19.900,00 en TIENDA.COM/PAGO, el 16/03/2026 a las " +
    "23:46. Esta compra esta asociada a T.Cred *3388. Si tienes dudas, encuentranos " +
    "aqui: 018000000000. Siempre contigo.",

  // #14 — Botón Bancolombia. La fecha va sin "el", tras un punto, con segundos.
  pagoBoton:
    "Bancolombia: Transferiste $33,450.75 por Boton Bancolombia a OPERADOR MOVIL " +
    "SA desde producto *4021. 10/03/2026 21:45:07 ¿Dudas? 018000000000.",
} as const;

// Correos del banco que NO son movimientos de dinero.
export const IGNORABLES = {
  inscripcionFacturas:
    "Bancolombia: Inscribiste las facturas Ejemplo convenio SERVICIOS PUBLICOS en " +
    "estado Inscrita. Si tienes dudas, encuentranos aqui: 6040000000.",

  marketing:
    "Logo Bancolombia [http://ejemplo.invalid/img/logo.png] " +
    "¡Te interesa!Tenemos novedadesBuenas noticias: La factura que inscribiste " +
    "SERVICIOS PUBLICOS con exito.",
} as const;

const b64 = (s: string): string => Buffer.from(s, "utf-8").toString("base64url");

/// Payload de Gmail con el text/plain anidado dos niveles, como los manda
/// Bancolombia: multipart/related > multipart/alternative > text/plain.
export const payloadAnidado = (cuerpo: string) => ({
  mimeType: "multipart/related",
  headers: [
    { name: "Subject", value: "Todo salió bien con tus movimientos" },
    { name: "From", value: "notificaciones@ejemplo.invalid" },
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
