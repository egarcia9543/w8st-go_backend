import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import { AMOUNT, DATE_TIME, LAST4, construir, limpiarTexto, normalizarMoneda } from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

// Segunda plantilla de compra, con la tarjeta al FINAL en vez de en medio:
//
//   habitual:  "Compraste <monto> en <comercio> con tu T.Cred *NNNN, el <fecha>"
//   esta:      "Compraste <monto> en <comercio>, el <fecha>.
//               Esta compra esta asociada a T.Cred *NNNN."
//
// Mismo banco, mismo comercio, misma tarjeta, dos redacciones. Por eso la regla
// no puede ser una sola con partes opcionales: el orden de los datos cambia.
// Ver los fixtures `compraCredito` y `compraTarjetaAlFinal`.
export const purchasePostfixRule: EmailRule = {
  name: "purchase-postfix",
  pattern: construir([
    String.raw`Compraste\s+`,
    AMOUNT, //                              1: moneda  2: monto
    String.raw`\s+en\s+(.+?)`, //            3: comercio
    String.raw`\s*,?\s*el\s+`,
    DATE_TIME, //                           4: fecha   5: hora
    String.raw`\.?\s*Esta\s+compra\s+esta\s+asociada\s+a\s+T\.(Cred|Deb)\s+`, // 6: tipo
    LAST4, //                               7: últimos 4
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, moneda, monto, comercio, fecha, hora, tipo, last4] = match;
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
      ruleName: "purchase-postfix",
    };
  },
};
