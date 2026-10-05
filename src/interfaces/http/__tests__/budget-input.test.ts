import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { isPositiveAmount, parseCategoryInput, parseGroupInput } from "../budget-input";

describe("parseCategoryInput", () => {
  test("al crear exige nombre y color", () => {
    assert.equal(parseCategoryInput({ name: "Mascotas" }, "create").ok, false);
    assert.equal(parseCategoryInput({ color: "#123456" }, "create").ok, false);
    assert.deepEqual(parseCategoryInput({ name: " Mascotas ", color: "#ABCDEF" }, "create"), {
      ok: true,
      value: { name: "Mascotas", color: "#abcdef" },
    });
  });

  test("al actualizar todo es opcional", () => {
    assert.deepEqual(parseCategoryInput({}, "update"), { ok: true, value: {} });
  });

  test("el límite es positivo o null para quitarlo", () => {
    assert.equal(parseCategoryInput({ monthlyLimit: 400000 }, "update").ok, true);
    assert.equal(parseCategoryInput({ monthlyLimit: null }, "update").ok, true);
    assert.equal(parseCategoryInput({ monthlyLimit: 0 }, "update").ok, false);
    assert.equal(parseCategoryInput({ monthlyLimit: -1 }, "update").ok, false);
  });

  test("groupId acepta null para dejarla sin grupo", () => {
    assert.deepEqual(parseCategoryInput({ groupId: null }, "update"), {
      ok: true,
      value: { groupId: null },
    });
    assert.equal(parseCategoryInput({ groupId: 3 }, "update").ok, false);
  });

  test("archived solo al actualizar y debe ser booleano", () => {
    assert.equal(parseCategoryInput({ archived: true }, "update").ok, true);
    assert.equal(parseCategoryInput({ archived: "sí" }, "update").ok, false);
    assert.equal(
      parseCategoryInput({ name: "X", color: "#000000", archived: true }, "create").ok,
      false
    );
  });
});

describe("parseGroupInput", () => {
  const valid = { name: "Deudas", kind: "SPENDING", targetPercent: 10, color: "#475569" };

  test("al crear exige todos los campos", () => {
    assert.equal(parseGroupInput(valid, "create").ok, true);
    for (const field of Object.keys(valid)) {
      const partial: Record<string, unknown> = { ...valid };
      delete partial[field];
      assert.equal(parseGroupInput(partial, "create").ok, false, field);
    }
  });

  test("el porcentaje va de 0 a 100", () => {
    assert.equal(parseGroupInput({ targetPercent: 0 }, "update").ok, true);
    assert.equal(parseGroupInput({ targetPercent: 100 }, "update").ok, true);
    assert.equal(parseGroupInput({ targetPercent: 101 }, "update").ok, false);
    assert.equal(parseGroupInput({ targetPercent: -5 }, "update").ok, false);
  });

  test("kind solo acepta gasto o ahorro", () => {
    assert.equal(parseGroupInput({ kind: "SAVINGS" }, "update").ok, true);
    assert.equal(parseGroupInput({ kind: "INCOME" }, "update").ok, false);
  });
});

describe("isPositiveAmount", () => {
  test("acepta montos positivos finitos", () => {
    assert.equal(isPositiveAmount(4500000), true);
    for (const value of [0, -1, Infinity, Number.NaN, "4500000", null]) {
      assert.equal(isPositiveAmount(value), false, String(value));
    }
  });
});
