import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseDebtInput, parseExtra, parsePaymentInput } from "../debt-input";

const NOW = new Date("2026-11-11T17:00:00Z");

describe("parseDebtInput", () => {
  test("al crear exige nombre, saldo, tasa y cuota", () => {
    assert.equal(parseDebtInput({ name: "Moto" }, "create").ok, false);
    assert.deepEqual(
      parseDebtInput(
        { name: " Moto ", balance: 28271965, annualRate: 23.43, monthlyPayment: 1291215 },
        "create"
      ),
      {
        ok: true,
        value: { name: "Moto", balance: 28271965, annualRate: 23.43, monthlyPayment: 1291215 },
      }
    );
  });

  test("al actualizar todo es opcional", () => {
    assert.deepEqual(parseDebtInput({}, "update"), { ok: true, value: {} });
  });

  test("el saldo admite 0 pero no negativos", () => {
    assert.equal(parseDebtInput({ balance: 0 }, "update").ok, true);
    assert.equal(parseDebtInput({ balance: -1 }, "update").ok, false);
  });

  test("la tasa va de 0 a 100 y la cuota es positiva", () => {
    assert.equal(parseDebtInput({ annualRate: 28.56 }, "update").ok, true);
    assert.equal(parseDebtInput({ annualRate: 120 }, "update").ok, false);
    assert.equal(parseDebtInput({ monthlyPayment: 0 }, "update").ok, false);
  });

  test("valida el tipo de deuda", () => {
    assert.equal(parseDebtInput({ kind: "LOAN" }, "update").ok, true);
    assert.equal(parseDebtInput({ kind: "HIPOTECA" }, "update").ok, false);
  });

  test("las notas vacías se guardan como null", () => {
    assert.deepEqual(parseDebtInput({ notes: "   " }, "update"), {
      ok: true,
      value: { notes: null },
    });
  });

  test("archived solo al actualizar", () => {
    assert.equal(parseDebtInput({ archived: true }, "update").ok, true);
    assert.equal(
      parseDebtInput(
        { name: "X", balance: 1, annualRate: 1, monthlyPayment: 1, archived: true },
        "create"
      ).ok,
      false
    );
  });
});

describe("parsePaymentInput", () => {
  test("sin fecha usa el momento actual", () => {
    assert.deepEqual(parsePaymentInput({ amount: 500000 }, NOW), {
      ok: true,
      value: { amount: 500000, paidAt: NOW },
    });
  });

  test("rechaza montos no positivos y fechas futuras o inválidas", () => {
    assert.equal(parsePaymentInput({ amount: 0 }, NOW).ok, false);
    assert.equal(parsePaymentInput({ amount: 1, paidAt: "mañana" }, NOW).ok, false);
    assert.equal(parsePaymentInput({ amount: 1, paidAt: "2026-12-01T00:00:00Z" }, NOW).ok, false);
    assert.equal(parsePaymentInput({ amount: 1, paidAt: "2026-11-03T15:00:00Z" }, NOW).ok, true);
  });
});

describe("parseExtra", () => {
  test("vacío es 0 y no admite negativos", () => {
    assert.deepEqual(parseExtra(undefined), { ok: true, value: 0 });
    assert.deepEqual(parseExtra("1220000"), { ok: true, value: 1220000 });
    assert.equal(parseExtra("-5").ok, false);
    assert.equal(parseExtra("mucho").ok, false);
  });
});
