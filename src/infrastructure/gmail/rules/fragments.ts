// Fragmentos compartidos por las reglas. Repetirlos en cada regex fue lo que
// dejó tres formatos de fecha sin soportar durante meses.

// Captura 2 grupos: (fecha, hora).
// Tolera: año de 2 o 4 dígitos, "a las" opcional, segundos opcionales.
export const DATE_TIME = String.raw`(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s*,)?(?:\s+a\s+las)?\s+(\d{1,2}:\d{2}(?::\d{2})?)`;

// Captura 2 grupos: (moneda, monto). La moneda puede venir pegada al número
// ("COP3.900,00") o ausente ("$44,000.00" -> el símbolo va en el grupo).
export const AMOUNT = String.raw`(COP|USD|\$)\s*([\d.,]+)`;

// Últimos 4 dígitos de un instrumento. El asterisco es opcional: las plantillas
// dicen "cuenta *9577" pero también "producto 9577".
export const LAST4 = String.raw`\*?\s?(\d{4})`;

export const normalizarMoneda = (raw: string): string =>
  raw === "$" ? "COP" : raw.toUpperCase();

export const construir = (partes: string[]): RegExp =>
  new RegExp(partes.join(""), "i");

// Los nombres capturados con (.+?) arrastran puntuación del final de la frase.
export const limpiarTexto = (raw: string): string =>
  raw.replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
