import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import {
  AMOUNT,
  DATE_TIME,
  LAST4,
  LLAVE,
  construir,
  limpiarTexto,
  normalizarMoneda,
} from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

export const transferOutRule: EmailRule = {
  name: "transfer-out",
  pattern: construir([
    String.raw`transferiste\s+`,
    AMOUNT, //                                  1: moneda  2: monto
    String.raw`\s+a\s+la\s+llave\s+`,
    LLAVE, //                                   3: llave de la contraparte
    String.raw`\s+desde\s+tu\s+(?:cuenta|producto)\s+`,
    LAST4, //                                   4: mi instrumento
    String.raw`\s+a\s+(.+?)\s+el\s+`, //         5: nombre de la contraparte
    DATE_TIME, //                               6: fecha   7: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, moneda, monto, llave, last4, nombre, fecha, hora] = match;

    return {
      type: "transferencia",
      direction: "OUTFLOW",
      fundingSource: "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: "cuenta",
      merchant: null,
      instrumentLast4: last4,
      instrumentKind: "ACCOUNT",
      channel: /bre-?b/i.test(match.input ?? "") ? "Bre-b" : null,
      counterpartyName: limpiarTexto(nombre),
      counterpartyKey: llave,
      transactionDate: parseDate(fecha, hora),
      ruleName: "transfer-out",
    };
  },
};
