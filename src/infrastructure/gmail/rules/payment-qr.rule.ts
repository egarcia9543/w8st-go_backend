import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import { AMOUNT, DATE_TIME, LAST4, LLAVE, construir, normalizarMoneda } from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

// Pago por código QR — la plantilla más frecuente de las que faltaban.
// Ver el fixture `pagoQr` para la forma exacta del texto.
//
// Comparte el verbo "pagaste" con payment-out pero la estructura es distinta:
// allá el beneficiario va justo después del monto ("Pagaste $X a Y desde..."),
// aquí va el canal ("pagaste $X por codigo QR desde..."). No se pisan, pero esta
// va primero en el registro por ser la más específica de las dos.
export const paymentQrRule: EmailRule = {
  name: "payment-qr",
  pattern: construir([
    String.raw`pagaste\s+`,
    AMOUNT, //                          1: moneda  2: monto
    String.raw`\s+por\s+c[oó]digo\s+QR\s+desde\s+tu\s+(?:cuenta|producto)\s+`,
    LAST4, //                           3: mi instrumento
    String.raw`\s+a\s+la\s+llave\s+`,
    LLAVE, //                           4: llave del beneficiario
    String.raw`\s+el\s+`,
    DATE_TIME, //                       5: fecha   6: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, moneda, monto, last4, llave, fecha, hora] = match;

    return {
      type: "pago",
      direction: "OUTFLOW",
      fundingSource: "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: "cuenta",
      merchant: null,
      instrumentLast4: last4,
      instrumentKind: "ACCOUNT",
      channel: "QR",
      // La plantilla no trae nombre del comercio, solo la llave.
      counterpartyName: `Llave ${llave}`,
      counterpartyKey: llave,
      transactionDate: parseDate(fecha, hora),
      ruleName: "payment-qr",
    };
  },
};
