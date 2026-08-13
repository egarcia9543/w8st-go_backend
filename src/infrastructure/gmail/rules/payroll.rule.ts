import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import { AMOUNT, DATE_TIME, construir, limpiarTexto, normalizarMoneda } from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

// Dos variantes de la misma plantilla, que se diferencian solo en el tipo de pago:
//   "Recibiste un pago de Nomina de <pagador> por <monto> en tu cuenta de Ahorros el ..."
//   "Recibiste un pago PROVEEDOR de <pagador> por <monto> en tu cuenta de Ahorros el ..."
//
// La primera versión exigía literalmente "pago de Nomina" y por eso perdía la
// segunda — que además traía los ingresos más grandes del periodo.
// Ver los fixtures `nomina` y `pagoProveedor`.
//
// Particularidades:
//  - "Nomina" viene SIN tilde. El banco no es consistente entre plantillas.
//  - No trae últimos 4 dígitos: solo "cuenta de Ahorros". El ingreso queda sin
//    instrumento asociado, que es justo por lo que Transaction.cardId es nullable.

const TIPOS: Record<string, string> = {
  nomina: "nomina",
  proveedor: "pago_proveedor",
};

// ̀-ͯ es el bloque de diacríticos combinantes: tras normalize("NFD")
// la tilde queda como carácter aparte y esto la elimina. Se escribe con escapes
// y no con los caracteres literales, que cualquier editor puede re-normalizar.
const DIACRITICOS = new RegExp("[\\u0300-\\u036f]", "g");

const normalizarTipo = (raw: string): string => {
  const clave = raw.toLowerCase().normalize("NFD").replace(DIACRITICOS, "");
  return TIPOS[clave] ?? "ingreso";
};

export const payrollRule: EmailRule = {
  name: "payroll",
  pattern: construir([
    // El tipo de pago puede ir con "de" delante ("pago de Nomina") o sin él
    // ("pago PROVEEDOR").
    String.raw`recibiste\s+un\s+pago\s+(?:de\s+)?(\S+)\s+de\s+(.+?)`, // 1: tipo  2: pagador
    String.raw`\s+por\s+`,
    AMOUNT, //                                                          3: moneda 4: monto
    String.raw`\s+en\s+tu\s+cuenta(?:\s+de\s+(\w+))?`, //                5: tipo de cuenta
    String.raw`\s+el\s+`,
    DATE_TIME, //                                                       6: fecha  7: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, tipo, pagador, moneda, monto, tipoCuenta, fecha, hora] = match;

    return {
      type: normalizarTipo(tipo),
      direction: "INFLOW",
      fundingSource: "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: "cuenta",
      merchant: null,
      instrumentLast4: null,
      instrumentKind: null,
      channel: tipoCuenta ? limpiarTexto(tipoCuenta) : null,
      counterpartyName: limpiarTexto(pagador),
      counterpartyKey: null,
      transactionDate: parseDate(fecha, hora),
      ruleName: "payroll",
    };
  },
};
