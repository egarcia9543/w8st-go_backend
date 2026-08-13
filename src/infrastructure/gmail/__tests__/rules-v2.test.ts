import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseBody } from "../parser.service";
import { rules } from "../rules";
import { CUERPOS, IGNORABLES } from "./fixtures";

const parsear = (cuerpo: string) => {
  const r = parseBody(cuerpo);
  assert.equal(r.ok, true, `no matcheó: ${"error" in r ? r.error : ""}`);
  if (!r.ok) throw new Error("inalcanzable");
  return r.transaction;
};

// --- Las tres correcciones ---

describe("corrección: llaves alfanuméricas", () => {
  // El patrón usaba \d+ y perdía 7 correos por un solo carácter.
  test("transferencia saliente a llave con arroba", () => {
    const tx = parsear(CUERPOS.transferenciaLlaveAlfanumerica);
    assert.equal(tx.ruleName, "transfer-out");
    assert.equal(tx.counterpartyKey, "@destino456");
    assert.equal(tx.counterpartyName, "PEDRO RAMIREZ");
    assert.equal(tx.amount, 200000);
  });

  test("transferencia entrante con llave propia alfanumérica", () => {
    const tx = parsear(CUERPOS.transferenciaEntranteLlaveAlfanumerica);
    assert.equal(tx.ruleName, "transfer-in");
    assert.equal(tx.direction, "INFLOW");
    assert.equal(tx.amount, 45000);
    assert.equal(tx.counterpartyName, "ANA GOMEZ SOTO");
    // Sigue sin guardarse: la llave del correo es la PROPIA, no la del remitente.
    assert.equal(tx.counterpartyKey, null);
  });
});

describe("corrección: doble asterisco en la tarjeta", () => {
  test("retiro con T.Deb **NNNN", () => {
    const tx = parsear(CUERPOS.retiroCajero);
    assert.equal(tx.instrumentLast4, "9915");
    assert.equal(tx.instrumentKind, "DEBIT");
  });
});

describe("corrección: pagos recibidos que no son nómina", () => {
  // Eran los ingresos más grandes del periodo y seguían invisibles porque la
  // regla exigía literalmente "pago de Nomina".
  test("pago PROVEEDOR entra como ingreso", () => {
    const tx = parsear(CUERPOS.pagoProveedor);
    assert.equal(tx.ruleName, "payroll");
    assert.equal(tx.direction, "INFLOW");
    assert.equal(tx.type, "pago_proveedor");
    assert.equal(tx.amount, 1200000);
    assert.equal(tx.counterpartyName, "FONDO EJEMPLO");
  });

  test("la nómina original sigue funcionando", () => {
    const tx = parsear(CUERPOS.nomina);
    assert.equal(tx.type, "nomina");
    assert.equal(tx.counterpartyName, "ACME S A");
    assert.equal(tx.amount, 3000000);
  });
});

// --- Las cinco reglas nuevas ---

describe("payment-qr", () => {
  const tx = parsear(CUERPOS.pagoQr);

  test("gasto de bolsillo por canal QR", () => {
    assert.equal(tx.ruleName, "payment-qr");
    assert.equal(tx.direction, "OUTFLOW");
    assert.equal(tx.fundingSource, "OWN_FUNDS");
    assert.equal(tx.channel, "QR");
    assert.equal(tx.amount, 15000);
  });

  test("identifica cuenta origen y llave destino", () => {
    assert.equal(tx.instrumentLast4, "4021");
    assert.equal(tx.counterpartyKey, "0011223344");
  });
});

describe("transfer-to-account", () => {
  // Monto sin decimales: con el parseAmount viejo esto entraba mil veces menor.
  test("monto SIN decimales se lee como miles", () => {
    const tx = parsear(CUERPOS.transferenciaACuenta);
    assert.equal(tx.ruleName, "transfer-to-account");
    assert.equal(tx.amount, 60000);
    assert.equal(tx.counterpartyKey, "01230000000");
  });

  test("cuenta origen sin asterisco", () => {
    const tx = parsear(CUERPOS.transferenciaACuentaSinAsterisco);
    assert.equal(tx.instrumentLast4, "4021");
    assert.equal(tx.amount, 90000);
    assert.equal(tx.counterpartyKey, "3040000000");
  });
});

describe("atm-withdrawal", () => {
  const tx = parsear(CUERPOS.retiroCajero);

  test("retiro con débito es dinero propio", () => {
    assert.equal(tx.ruleName, "atm-withdrawal");
    assert.equal(tx.type, "retiro");
    assert.equal(tx.fundingSource, "OWN_FUNDS");
    assert.equal(tx.merchant, "CAJERO001");
  });

  // Convención colombiana en esta plantilla, americana en las de transferencia.
  test("monto en convención colombiana", () => {
    assert.equal(tx.amount, 80000);
  });
});

describe("purchase-postfix", () => {
  const tx = parsear(CUERPOS.compraTarjetaAlFinal);

  test("encuentra la tarjeta aunque venga después de la fecha", () => {
    assert.equal(tx.ruleName, "purchase-postfix");
    assert.equal(tx.fundingSource, "CREDIT");
    assert.equal(tx.instrumentLast4, "3388");
    assert.equal(tx.amount, 19900);
    assert.equal(tx.merchant, "TIENDA.COM/PAGO");
  });
});

describe("payment-boton", () => {
  const tx = parsear(CUERPOS.pagoBoton);

  test("lee la fecha sin 'el' y con segundos", () => {
    assert.equal(tx.ruleName, "payment-boton");
    assert.ok(!Number.isNaN(tx.transactionDate.getTime()));
    assert.equal(tx.transactionDate.toISOString(), "2026-03-11T02:45:07.000Z");
  });

  test("el beneficiario es un comercio y conserva los centavos", () => {
    assert.equal(tx.merchant, "OPERADOR MOVIL SA");
    assert.equal(tx.amount, 33450.75);
    assert.equal(tx.channel, "Boton Bancolombia");
  });
});

// --- Ignorables ---

describe("correos que no son movimientos", () => {
  test("inscripción de facturas se ignora, no es error", () => {
    const r = parseBody(IGNORABLES.inscripcionFacturas);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "IGNORED");
  });

  test("marketing se ignora", () => {
    const r = parseBody(IGNORABLES.marketing);
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, "IGNORED");
  });
});

// --- La garantía que protege el orden del registro ---

describe("no hay ambigüedad entre reglas", () => {
  test("ningún cuerpo matchea dos reglas distintas", () => {
    for (const [nombre, cuerpo] of Object.entries(CUERPOS)) {
      const coincidencias = rules.filter((r) => r.pattern.test(cuerpo)).map((r) => r.name);
      assert.equal(
        coincidencias.length,
        1,
        `"${nombre}" matcheó ${coincidencias.length}: ${coincidencias.join(", ")}`
      );
    }
  });
});
