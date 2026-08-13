import { parseAmount } from "../parsing/amount";
import { parseDate } from "../parsing/date";
import {
  AMOUNT,
  DATE_TIME,
  construir,
  limpiarTexto,
  normalizarMoneda,
} from "./fragments";
import { EmailRule, ParsedTransaction } from "./types";

export const payrollRule: EmailRule = {
  name: "payroll",
  pattern: construir([
    String.raw`recibiste\s+un\s+pago\s+de\s+n[oó]mina\s+de\s+(.+?)`, // 1: empleador
    String.raw`\s+por\s+`,
    AMOUNT, //                                                         2: moneda 3: monto
    String.raw`\s+en\s+tu\s+cuenta(?:\s+de\s+(\w+))?`, //               4: tipo de cuenta
    String.raw`\s+el\s+`,
    DATE_TIME, //                                                      5: fecha  6: hora
  ]),

  parse(match: RegExpMatchArray): ParsedTransaction {
    const [, empleador, moneda, monto, tipoCuenta, fecha, hora] = match;

    return {
      type: "nomina",
      direction: "INFLOW",
      fundingSource: "OWN_FUNDS",
      amount: parseAmount(monto),
      currency: normalizarMoneda(moneda),
      paymentMethod: "cuenta",
      merchant: null,
      instrumentLast4: null,
      instrumentKind: null,
      channel: tipoCuenta ? limpiarTexto(tipoCuenta) : null,
      counterpartyName: limpiarTexto(empleador),
      counterpartyKey: null,
      transactionDate: parseDate(fecha, hora),
      ruleName: "payroll",
    };
  },
};
