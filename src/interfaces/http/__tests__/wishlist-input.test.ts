import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { parseItemInput, parseTierInput } from "../wishlist-input";

const valid = { name: "Audífonos", price: 1200000 };

describe("parseItemInput", () => {
  test("al crear exige nombre y precio", () => {
    assert.equal(parseItemInput({}, "create").ok, false);
    assert.equal(parseItemInput({ name: "X" }, "create").ok, false);
    assert.equal(parseItemInput({ price: 10 }, "create").ok, false);
    assert.equal(parseItemInput(valid, "create").ok, true);
  });

  test("al actualizar todo es opcional", () => {
    assert.deepEqual(parseItemInput({}, "update"), { ok: true, value: {} });
  });

  test("rechaza precios no positivos o no numéricos", () => {
    for (const price of [0, -5, Number.NaN, Infinity, "100"]) {
      assert.equal(parseItemInput({ ...valid, price }, "create").ok, false, String(price));
    }
  });

  test("solo acepta COP y USD", () => {
    assert.equal(parseItemInput({ ...valid, currency: "USD" }, "create").ok, true);
    assert.equal(parseItemInput({ ...valid, currency: "EUR" }, "create").ok, false);
  });

  test("las URLs deben ser http(s)", () => {
    assert.equal(parseItemInput({ imageUrl: "https://x.com/a.png" }, "update").ok, true);
    assert.equal(parseItemInput({ imageUrl: "javascript:alert(1)" }, "update").ok, false);
    assert.equal(parseItemInput({ productUrl: "ftp://x.com" }, "update").ok, false);
    assert.equal(parseItemInput({ productUrl: "no es url" }, "update").ok, false);
  });

  test("texto vacío en campos opcionales se guarda como null", () => {
    const result = parseItemInput({ notes: "   ", imageUrl: "" }, "update");
    assert.deepEqual(result, { ok: true, value: { notes: null, imageUrl: null } });
  });

  test("recorta espacios del nombre", () => {
    const result = parseItemInput({ ...valid, name: "  Kindle  " }, "create");
    assert.ok(result.ok && result.value.name === "Kindle");
  });

  test("status no se acepta al crear, sí al actualizar", () => {
    assert.equal(parseItemInput({ ...valid, status: "BOUGHT" }, "create").ok, false);
    assert.equal(parseItemInput({ status: "BOUGHT" }, "update").ok, true);
    assert.equal(parseItemInput({ status: "LOST" }, "update").ok, false);
  });
});

describe("parseTierInput", () => {
  test("acepta etiqueta y color válidos", () => {
    assert.deepEqual(parseTierInput({ label: " Ya mismo ", color: "#EF4444" }), {
      ok: true,
      value: { label: "Ya mismo", color: "#ef4444" },
    });
  });

  test("rechaza etiqueta vacía y colores mal formados", () => {
    assert.equal(parseTierInput({ label: "  " }).ok, false);
    assert.equal(parseTierInput({ color: "red" }).ok, false);
    assert.equal(parseTierInput({ color: "#fff" }).ok, false);
  });
});
