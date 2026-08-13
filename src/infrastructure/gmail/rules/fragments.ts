// Fragmentos compartidos por las reglas. Repetirlos en cada regex fue lo que
// dejó tres formatos de fecha sin soportar durante meses.

// Captura 2 grupos: (fecha, hora).
// Tolera: año de 2 o 4 dígitos, "a las" opcional, segundos opcionales.
export const DATE_TIME = String.raw`(\d{1,2}\/\d{1,2}\/\d{2,4})(?:\s*,)?(?:\s+a\s+las)?\s+(\d{1,2}:\d{2}(?::\d{2})?)`;

// Captura 2 grupos: (moneda, monto). La moneda puede venir pegada al número
// ("COP3.900,00") o ausente ("$44,000.00" -> el símbolo va en el grupo).
export const AMOUNT = String.raw`(COP|USD|\$)\s*([\d.,]+)`;

// Últimos 4 dígitos de un instrumento. Los asteriscos varían entre plantillas:
// "cuenta *NNNN", "producto NNNN" y "T.Deb **NNNN" son las tres formas vistas.
export const LAST4 = String.raw`\*{0,2}\s?(\d{4})`;

// Una llave de Bre-b NO es siempre numérica: las hay de solo dígitos y
// alfanuméricas con arroba. El patrón original usaba \d+ y por eso se perdían
// todas las segundas.
export const LLAVE = String.raw`([\w@.\-]+)`;

// Número de cuenta destino: longitud variable (10-11 dígitos), no 4.
// Y el asterisco a veces trae un espacio detrás.
export const CUENTA_DESTINO = String.raw`\*?\s*(\d+)`;

export const normalizarMoneda = (raw: string): string =>
  raw === "$" ? "COP" : raw.toUpperCase();

export const construir = (partes: string[]): RegExp =>
  new RegExp(partes.join(""), "i");

// Los nombres capturados con (.+?) arrastran puntuación del final de la frase.
export const limpiarTexto = (raw: string): string =>
  raw.replace(/\s+/g, " ").replace(/[.,;:]+$/, "").trim();
