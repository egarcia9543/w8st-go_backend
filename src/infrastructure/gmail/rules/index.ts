import { EmailRule } from "./types";
import { paymentQrRule } from "./payment-qr.rule";
import { paymentBotonRule } from "./payment-boton.rule";
import { paymentOutRule } from "./payment-out.rule";
import { transferOutRule } from "./transfer-out.rule";
import { transferToAccountRule } from "./transfer-to-account.rule";
import { transferInRule } from "./transfer-in.rule";
import { payrollRule } from "./payroll.rule";
import { atmWithdrawalRule } from "./atm-withdrawal.rule";
import { purchaseRule } from "./purchase.rule";
import { purchasePostfixRule } from "./purchase-postfix.rule";

// EL ORDEN ES PARTE DEL CONTRATO, no un detalle de estilo.
// Se evalúa de más específica a más genérica y gana la primera que matchea.
//
// Los agrupamientos que importan:
//
//  - payment-qr antes que payment-out: comparten el verbo "pagaste". Hoy no se
//    pisan (una lleva "por codigo QR", la otra "a <beneficiario>"), pero la
//    específica va primero por si el banco relaja la redacción.
//
//  - payment-boton y transfer-to-account antes que transfer-out: los tres
//    empiezan con "Transferiste".
//
//  - Cuando aparezca una plantilla de pago de tarjeta de crédito, su regla va
//    ANTES de payment-out: comparten el verbo y la genérica se la tragaría,
//    contando un traslado interno como gasto de bolsillo.
//
// Hay un test que verifica que ningún cuerpo real matchee dos reglas.
export const rules: EmailRule[] = [
  paymentQrRule,
  paymentBotonRule,
  paymentOutRule,
  transferToAccountRule,
  transferOutRule,
  transferInRule,
  payrollRule,
  atmWithdrawalRule,
  purchasePostfixRule,
  purchaseRule,
];

export * from "./types";
export { motivoParaIgnorar, IGNORABLES } from "./ignorables";
