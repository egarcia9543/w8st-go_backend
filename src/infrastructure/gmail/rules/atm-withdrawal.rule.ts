import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import { AMOUNT, DATE_TIME, LAST4, construir, limpiarTexto, normalizarMoneda } from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

// Retiro en cajero. Ver el fixture `retiroCajero` para la forma exacta del texto.
//
// Dos particularidades:
//  - DOBLE asterisco antes de los últimos 4 dígitos. El patrón LAST4 aceptaba
//    uno solo y por eso fallaba.
//  - Monto en convención colombiana, aunque otras plantillas de la misma cuenta
//    usan la americana.
//
// Es dinero propio saliendo: cuenta como gasto de bolsillo. Que después uses ese
// efectivo en algo no lo sabe el correo, así que el comercio queda como el cajero.
export const atmWithdrawalRule: EmailRule = {
  name: "atm-withdrawal",
  pattern: construir([
    String.raw`Retiraste\s+`,
    AMOUNT, //                                      1: moneda  2: monto
    String.raw`\s+en\s+(.+?)`, //                    3: cajero
    String.raw`\s+de\s+tu\s+T\.(Cred|Deb)\s+`, //    4: tipo
    LAST4, //                                       5: últimos 4
    String.raw`\s+el\s+`,
    DATE_TIME, //                                   6: fecha   7: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, moneda, monto, cajero, tipo, last4, fecha, hora] = match;
    const esCredito = tipo.toLowerCase() === "cred";

    return {
      // Un retiro con tarjeta de crédito es un avance: deuda, no dinero propio.
      type: esCredito ? "avance" : "retiro",
      direction: "OUTFLOW",
      fundingSource: esCredito ? "CREDIT" : "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: esCredito ? "tarjeta_credito" : "tarjeta_debito",
      merchant: limpiarTexto(cajero),
      instrumentLast4: last4,
      instrumentKind: esCredito ? "CREDIT" : "DEBIT",
      channel: "Cajero",
      counterpartyName: null,
      counterpartyKey: null,
      transactionDate: parseDate(fecha, hora),
      ruleName: "atm-withdrawal",
    };
  },
};
