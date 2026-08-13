import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import {
  AMOUNT,
  CUENTA_DESTINO,
  DATE_TIME,
  LAST4,
  construir,
  normalizarMoneda,
} from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

// Transferencia a una cuenta, no a una llave. Plantilla distinta de transfer-out.
// Ver el fixture `transferenciaACuenta` para la forma exacta del texto.
//
// Tres detalles que rompían cualquier patrón prestado de otra regla:
//  - El monto puede venir SIN decimales. Con el parseAmount viejo un monto de
//    diez mil entraba como diez.
//  - La cuenta origen a veces no lleva asterisco.
//  - La cuenta destino tiene 10-11 dígitos, no 4, y a veces trae un espacio
//    después del asterisco.
//
// No hay nombre de destinatario, solo el número. Se sintetiza una etiqueta
// legible para que la tabla del front no muestre una fila en blanco.
export const transferToAccountRule: EmailRule = {
  name: "transfer-to-account",
  pattern: construir([
    String.raw`Transferiste\s+`,
    AMOUNT, //                              1: moneda  2: monto
    String.raw`\s+desde\s+tu\s+(?:cuenta|producto)\s+`,
    LAST4, //                               3: mi instrumento
    String.raw`\s+a\s+la\s+cuenta\s+`,
    CUENTA_DESTINO, //                      4: cuenta destino
    String.raw`\s+el\s+`,
    DATE_TIME, //                           5: fecha   6: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, moneda, monto, last4, destino, fecha, hora] = match;

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
      channel: null,
      counterpartyName: `Cuenta *${destino.slice(-4)}`,
      counterpartyKey: destino,
      transactionDate: parseDate(fecha, hora),
      ruleName: "transfer-to-account",
    };
  },
};
