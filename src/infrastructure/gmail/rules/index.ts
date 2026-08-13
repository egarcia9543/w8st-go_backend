import { EmailRule } from "./types";
import { paymentOutRule } from "./payment-out.rule";
import { transferOutRule } from "./transfer-out.rule";
import { transferInRule } from "./transfer-in.rule";
import { payrollRule } from "./payroll.rule";
import { purchaseRule } from "./purchase.rule";

// EL ORDEN ES PARTE DEL CONTRATO, no un detalle de estilo.
// Se evalúa de más específica a más genérica y gana la primera que matchea.
//
// Cuando aparezca una plantilla de pago de tarjeta de crédito, su regla va
// ANTES de payment-out: comparten el verbo "Pagaste" y la genérica se la
// tragaría, contando un traslado interno como gasto de bolsillo.
export const rules: EmailRule[] = [
  paymentOutRule,
  transferOutRule,
  transferInRule,
  payrollRule,
  purchaseRule,
];

export * from "./types";
