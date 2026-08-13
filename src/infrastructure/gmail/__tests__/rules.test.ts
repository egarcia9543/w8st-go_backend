import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseBody, parseEmail } from "../parser.service";
import { rules } from "../rules";
import { CUERPOS, payloadAnidado, payloadHtml } from "./fixtures";

const parsear = (cuerpo: string) => {
  const r = parseBody(cuerpo);
  assert.equal(r.ok, true, `no matcheó ninguna regla: ${"error" in r ? r.error : r.reason}`);
  if (!r.ok) throw new Error("inalcanzable");
  return r.transaction;
};

describe("payment-out (#1: Pagaste a tercero)", () => {
  const tx = parsear(CUERPOS.pagoTercero);

  test("clasifica como gasto de bolsillo", () => {
    assert.equal(tx.ruleName, "payment-out");
    assert.equal(tx.direction, "OUTFLOW");
    assert.equal(tx.fundingSource, "OWN_FUNDS");
  });

  test("lee el monto en convención americana", () => {
    assert.equal(tx.amount, 40000);
    assert.equal(tx.currency, "COP");
  });

  test("lee 'producto 9577' sin asterisco", () => {
    assert.equal(tx.instrumentLast4, "9577");
    assert.equal(tx.instrumentKind, "ACCOUNT");
  });

  test("lee el beneficiario sin arrastrar puntuación", () => {
    assert.equal(tx.counterpartyName, "FUNDACION PLAN");
  });

  // El caso que producía Invalid Date: fecha con segundos y sin "a las".
  test("lee la fecha con segundos y sin 'a las', en hora de Bogotá", () => {
    assert.ok(!Number.isNaN(tx.transactionDate.getTime()), "fecha inválida");
    assert.equal(tx.transactionDate.toISOString(), "2026-08-12T15:37:27.000Z");
  });
});

describe("transfer-out (#2: transferencia saliente)", () => {
  const tx = parsear(CUERPOS.transferenciaSaliente);

  test("clasifica como gasto de bolsillo", () => {
    assert.equal(tx.ruleName, "transfer-out");
    assert.equal(tx.direction, "OUTFLOW");
    assert.equal(tx.fundingSource, "OWN_FUNDS");
    assert.equal(tx.amount, 44000);
  });

  test("la llave capturada es la de la contraparte", () => {
    assert.equal(tx.counterpartyKey, "1020302094");
    assert.equal(tx.counterpartyName, "CAMILO GARCIA GARCIA");
  });

  test("detecta el canal Bre-b", () => {
    assert.equal(tx.channel, "Bre-b");
  });

  test("año de 2 dígitos", () => {
    assert.equal(tx.transactionDate.toISOString(), "2026-08-12T20:58:00.000Z");
  });
});

describe("transfer-in (#3: transferencia entrante)", () => {
  const tx = parsear(CUERPOS.transferenciaEntrante);

  test("clasifica como INGRESO", () => {
    assert.equal(tx.ruleName, "transfer-in");
    assert.equal(tx.direction, "INFLOW");
    assert.equal(tx.amount, 335000);
  });

  test("captura al remitente como contraparte", () => {
    assert.equal(tx.counterpartyName, "CAMILO GARCIA GARCIA");
  });

  // La llave 1010033459 es la del PROPIO usuario, no la del remitente.
  // Guardarla como counterpartyKey sería el error que motivó el renombre.
  test("NO guarda la llave propia como contraparte", () => {
    assert.equal(tx.counterpartyKey, null);
  });

  test("captura la cuenta propia", () => {
    assert.equal(tx.instrumentLast4, "9577");
  });
});

describe("payroll (#4: nómina)", () => {
  const tx = parsear(CUERPOS.nomina);

  test("clasifica como INGRESO", () => {
    assert.equal(tx.ruleName, "payroll");
    assert.equal(tx.direction, "INFLOW");
    assert.equal(tx.fundingSource, "OWN_FUNDS");
    assert.equal(tx.amount, 2088000);
  });

  test("lee el empleador con 'Nomina' sin tilde", () => {
    assert.equal(tx.counterpartyName, "PRAGMA S A");
  });

  // Sin últimos 4 dígitos: por esto Transaction.cardId es nullable.
  test("no inventa un instrumento cuando el correo no lo trae", () => {
    assert.equal(tx.instrumentLast4, null);
    assert.equal(tx.instrumentKind, null);
  });
});

describe("purchase (#5: compra con tarjeta de crédito)", () => {
  const tx = parsear(CUERPOS.compraCredito);

  test("clasifica como CRÉDITO, no como bolsillo", () => {
    assert.equal(tx.ruleName, "purchase");
    assert.equal(tx.direction, "OUTFLOW");
    assert.equal(tx.fundingSource, "CREDIT");
  });

  // Convención colombiana: 3.900,00 son 3900 pesos, no 3.9.
  test("lee el monto en convención colombiana", () => {
    assert.equal(tx.amount, 3900);
    assert.equal(tx.currency, "COP");
  });

  test("identifica la tarjeta de crédito", () => {
    assert.equal(tx.instrumentLast4, "7829");
    assert.equal(tx.instrumentKind, "CREDIT");
  });

  test("lee el comercio sin la coma que sigue", () => {
    assert.equal(tx.merchant, "APPLE.COM/BILL");
  });
});

describe("registro de reglas", () => {
  test("cada regla tiene un nombre único", () => {
    const nombres = rules.map((r) => r.name);
    assert.equal(new Set(nombres).size, nombres.length);
  });

  // El orden es contrato: si aparece una regla de pago de TC, va antes de
  // payment-out o esta se la traga y cuenta un traslado interno como gasto.
  test("payment-out es la primera del registro", () => {
    assert.equal(rules[0].name, "payment-out");
  });

  test("ningún cuerpo matchea dos reglas distintas", () => {
    for (const [nombre, cuerpo] of Object.entries(CUERPOS)) {
      const coincidencias = rules.filter((r) => r.pattern.test(cuerpo)).map((r) => r.name);
      assert.equal(
        coincidencias.length,
        1,
        `"${nombre}" matcheó ${coincidencias.length} reglas: ${coincidencias.join(", ")}`
      );
    }
  });
});

describe("fallos", () => {
  test("cuerpo vacío -> NO_BODY", () => {
    const r = parseBody("");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "NO_BODY");
  });

  test("texto desconocido -> NO_MATCH", () => {
    const r = parseBody("Bancolombia: Tu clave fue actualizada el 01/01/2026.");
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "NO_MATCH");
  });
});

describe("extracción del cuerpo desde el payload de Gmail", () => {
  // El bug que descartaba correos antes de evaluar un solo regex: el extractor
  // solo miraba payload.parts, no part.parts.
  test("encuentra text/plain anidado dos niveles", () => {
    const r = parseEmail(payloadAnidado(CUERPOS.compraCredito));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.transaction.amount, 3900);
  });

  test("cae a text/html y lo limpia cuando no hay text/plain", () => {
    const r = parseEmail(payloadHtml(CUERPOS.transferenciaSaliente));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.transaction.amount, 44000);
  });

  test("payload sin partes ni body -> NO_BODY", () => {
    const r = parseEmail({ mimeType: "text/plain" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "NO_BODY");
  });
});
