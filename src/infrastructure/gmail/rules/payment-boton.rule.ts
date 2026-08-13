import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import { AMOUNT, DATE_TIME, LAST4, construir, limpiarTexto, normalizarMoneda } from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

// Pago con Botón Bancolombia (PSE).
// Ver el fixture `pagoBoton` para la forma exacta del texto.
//
// La fecha NO lleva "el" delante: va pegada al producto con un punto y trae
// segundos. Es el mismo caso que rompía parseDate en la muestra #1, y el motivo
// por el que DATE_TIME hace opcionales tanto "a las" como los segundos.
//
// Aunque el verbo es "Transferiste", esto es un pago a un comercio, no una
// transferencia entre personas: el beneficiario es una empresa.
export const paymentBotonRule: EmailRule = {
  name: "payment-boton",
  pattern: construir([
    String.raw`Transferiste\s+`,
    AMOUNT, //                                  1: moneda  2: monto
    String.raw`\s+por\s+Bot[oó]n\s+Bancolombia\s+a\s+(.+?)`, // 3: comercio
    String.raw`\s+desde\s+(?:producto|cuenta)\s+`,
    LAST4, //                                   4: mi instrumento
    String.raw`\s*\.?\s*`, //                    la fecha va sin "el", tras un punto
    DATE_TIME, //                               5: fecha   6: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, moneda, monto, comercio, last4, fecha, hora] = match;

    return {
      type: "pago",
      direction: "OUTFLOW",
      fundingSource: "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: "cuenta",
      merchant: limpiarTexto(comercio),
      instrumentLast4: last4,
      instrumentKind: "ACCOUNT",
      channel: "Boton Bancolombia",
      counterpartyName: limpiarTexto(comercio),
      counterpartyKey: null,
      transactionDate: parseDate(fecha, hora),
      ruleName: "payment-boton",
    };
  },
};
