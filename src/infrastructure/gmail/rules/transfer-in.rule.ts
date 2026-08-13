import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import {
  AMOUNT,
  DATE_TIME,
  LAST4,
  construir,
  limpiarTexto,
  normalizarMoneda,
} from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

export const transferInRule: EmailRule = {
  name: "transfer-in",
  pattern: construir([
    String.raw`recibiste\s+una\s+transferencia\s+de\s+(.+?)`, // 1: remitente
    String.raw`\s+por\s+`,
    AMOUNT, //                                                  2: moneda  3: monto
    String.raw`\s+en\s+tu\s+cuenta\s+`,
    LAST4, //                                                   4: mi instrumento
    String.raw`(?:\s+conectada\s+a\s+la\s+llave\s+\d+)?`, //     (mi llave: se ignora)
    String.raw`\s+el\s+`,
    DATE_TIME, //                                               5: fecha   6: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, remitente, moneda, monto, last4, fecha, hora] = match;

    return {
      type: "transferencia",
      direction: "INFLOW",
      fundingSource: "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: "cuenta",
      merchant: null,
      instrumentLast4: last4,
      instrumentKind: "ACCOUNT",
      channel: /llaves|bre-?b/i.test(match.input ?? "") ? "Bre-b" : null,
      counterpartyName: limpiarTexto(remitente),
      counterpartyKey: null,
      transactionDate: parseDate(fecha, hora),
      ruleName: "transfer-in",
    };
  },
};
