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

export const purchaseRule: EmailRule = {
  name: "purchase",
  pattern: construir([
    String.raw`Compraste\s+`,
    AMOUNT, //                      1: moneda   2: monto
    String.raw`\s+en\s+(.+?)`, //    3: comercio
    String.raw`\s+con\s+tu\s+T\.(Cred|Deb)\s+`, // 4: tipo
    LAST4, //                       5: últimos 4
    String.raw`\s*,?\s*el\s+`,
    DATE_TIME, //                   6: fecha    7: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, moneda, monto, comercio, tipo, last4, fecha, hora] = match;
    const esCredito = tipo.toLowerCase() === "cred";

    return {
      type: "compra",
      direction: "OUTFLOW",
      fundingSource: esCredito ? "CREDIT" : "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: esCredito ? "tarjeta_credito" : "tarjeta_debito",
      merchant: limpiarTexto(comercio),
      instrumentLast4: last4,
      instrumentKind: esCredito ? "CREDIT" : "DEBIT",
      channel: null,
      counterpartyName: null,
      counterpartyKey: null,
      transactionDate: parseDate(fecha, hora),
      ruleName: "purchase",
    };
  },
};
