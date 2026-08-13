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
    assert.equal(tx.amount, 50000);
    assert.equal(tx.currency, "COP");
  });

  test("lee 'producto NNNN' sin asterisco", () => {
    assert.equal(tx.instrumentLast4, "4021");
    assert.equal(tx.instrumentKind, "ACCOUNT");
  });

  test("lee el beneficiario sin arrastrar puntuación", () => {
    assert.equal(tx.counterpartyName, "FUNDACION EJEMPLO");
  });

  // El caso que producía Invalid Date: fecha con segundos y sin "a las".
  test("lee la fecha con segundos y sin 'a las', en hora de Bogotá", () => {
    assert.ok(!Number.isNaN(tx.transactionDate.getTime()), "fecha inválida");
    assert.equal(tx.transactionDate.toISOString(), "2026-03-04T15:37:27.000Z");
  });
});

describe("transfer-out (#2: transferencia saliente)", () => {
  const tx = parsear(CUERPOS.transferenciaSaliente);

  test("clasifica como gasto de bolsillo", () => {
    assert.equal(tx.ruleName, "transfer-out");
    assert.equal(tx.direction, "OUTFLOW");
    assert.equal(tx.fundingSource, "OWN_FUNDS");
    assert.equal(tx.amount, 75000);
  });

  test("la llave capturada es la de la contraparte", () => {
    assert.equal(tx.counterpartyKey, "3001234567");
    assert.equal(tx.counterpartyName, "JUAN PEREZ GOMEZ");
  });

  test("detecta el canal Bre-b", () => {
    assert.equal(tx.channel, "Bre-b");
  });

  test("año de 2 dígitos", () => {
    assert.equal(tx.transactionDate.toISOString(), "2026-03-05T20:58:00.000Z");
  });
});

describe("transfer-in (#3: transferencia entrante)", () => {
  const tx = parsear(CUERPOS.transferenciaEntrante);

  test("clasifica como INGRESO", () => {
    assert.equal(tx.ruleName, "transfer-in");
    assert.equal(tx.direction, "INFLOW");
    assert.equal(tx.amount, 120000);
  });

  test("captura al remitente como contraparte", () => {
    assert.equal(tx.counterpartyName, "MARIA LOPEZ RUIZ");
  });

  // La llave del correo es la del PROPIO usuario, no la del remitente.
  // Guardarla como counterpartyKey sería el error que motivó el renombre.
  test("NO guarda la llave propia como contraparte", () => {
    assert.equal(tx.counterpartyKey, null);
  });

  test("captura la cuenta propia", () => {
    assert.equal(tx.instrumentLast4, "4021");
  });
});

describe("payroll (#4: nómina)", () => {
  const tx = parsear(CUERPOS.nomina);

  test("clasifica como INGRESO", () => {
    assert.equal(tx.ruleName, "payroll");
    assert.equal(tx.direction, "INFLOW");
    assert.equal(tx.fundingSource, "OWN_FUNDS");
    assert.equal(tx.amount, 3000000);
  });

  test("lee el empleador con 'Nomina' sin tilde", () => {
    assert.equal(tx.counterpartyName, "ACME S A");
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

  // Convención colombiana: 5.500,00 son 5500 pesos, no 5.5.
  test("lee el monto en convención colombiana", () => {
    assert.equal(tx.amount, 5500);
    assert.equal(tx.currency, "COP");
  });

  test("identifica la tarjeta de crédito", () => {
    assert.equal(tx.instrumentLast4, "3388");
    assert.equal(tx.instrumentKind, "CREDIT");
  });

  test("lee el comercio sin la coma que sigue", () => {
    assert.equal(tx.merchant, "TIENDA.COM/PAGO");
  });
});

describe("registro de reglas", () => {
  test("cada regla tiene un nombre único", () => {
    const nombres = rules.map((r) => r.name);
    assert.equal(new Set(nombres).size, nombres.length);
  });

  // El orden es contrato, pero lo que importa no es la posición absoluta sino
  // que las reglas específicas vayan antes que las genéricas con el mismo verbo.
  // Si aparece una regla de pago de TC, va antes de payment-out o esta se la
  // traga y cuenta un traslado interno como gasto de bolsillo.
  const posicion = (nombre: string) => rules.findIndex((r) => r.name === nombre);

  test("las reglas de 'pagaste' van de específica a genérica", () => {
    assert.ok(
      posicion("payment-qr") < posicion("payment-out"),
      "payment-qr debe evaluarse antes que payment-out"
    );
  });

  test("las reglas de 'Transferiste' van de específica a genérica", () => {
    assert.ok(posicion("payment-boton") < posicion("transfer-out"));
    assert.ok(posicion("transfer-to-account") < posicion("transfer-out"));
  });

  test("purchase-postfix se evalúa antes que purchase", () => {
    assert.ok(posicion("purchase-postfix") < posicion("purchase"));
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
    if (r.ok) assert.equal(r.transaction.amount, 5500);
  });

  test("cae a text/html y lo limpia cuando no hay text/plain", () => {
    const r = parseEmail(payloadHtml(CUERPOS.transferenciaSaliente));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.transaction.amount, 75000);
  });

  test("payload sin partes ni body -> NO_BODY", () => {
    const r = parseEmail({ mimeType: "text/plain" });
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "NO_BODY");
  });
});
