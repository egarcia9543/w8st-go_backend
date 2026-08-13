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

export const paymentOutRule: EmailRule = {
  name: "payment-out",
  pattern: construir([
    String.raw`Pagaste\s+`,
    AMOUNT, //                                          1: moneda  2: monto
    String.raw`\s+a\s+(.+?)`, //                         3: beneficiario
    String.raw`\s+desde\s+tu\s+(?:producto|cuenta)\s+`,
    LAST4, //                                           4: mi instrumento
    String.raw`\s+el\s+`,
    DATE_TIME, //                                       5: fecha   6: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, moneda, monto, beneficiario, last4, fecha, hora] = match;

    return {
      type: "pago",
      direction: "OUTFLOW",
      fundingSource: "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: "cuenta",
      merchant: limpiarTexto(beneficiario),
      instrumentLast4: last4,
      instrumentKind: "ACCOUNT",
      channel: null,
      counterpartyName: limpiarTexto(beneficiario),
      counterpartyKey: null,
      transactionDate: parseDate(fecha, hora),
      ruleName: "payment-out",
    };
  },
};
