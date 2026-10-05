import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { moveItem, removeItem, Slot } from "../wishlist-order";

const tier = (tierId: string, ...ids: string[]): Slot[] =>
  ids.map((id, position) => ({ id, tierId, position }));

const apply = (slots: Slot[], changes: Slot[]): Record<string, string[]> => {
  const updated = new Map(slots.map((slot) => [slot.id, slot]));
  for (const change of changes) updated.set(change.id, change);

  const result: Record<string, Slot[]> = {};
  for (const slot of updated.values()) (result[slot.tierId] ??= []).push(slot);

  return Object.fromEntries(
    Object.entries(result).map(([tierId, tierSlots]) => [
      tierId,
      tierSlots.sort((a, b) => a.position - b.position).map((slot) => slot.id),
    ])
  );
};

const positionsAreDense = (slots: Slot[], changes: Slot[]) => {
  const updated = new Map(slots.map((slot) => [slot.id, slot]));
  for (const change of changes) updated.set(change.id, change);
  const byTier = new Map<string, number[]>();
  for (const slot of updated.values()) {
    byTier.set(slot.tierId, [...(byTier.get(slot.tierId) ?? []), slot.position]);
  }
  for (const positions of byTier.values()) {
    assert.deepEqual(
      [...positions].sort((a, b) => a - b),
      positions.map((_, index) => index)
    );
  }
};

describe("moveItem", () => {
  const slots = [...tier("S", "a", "b", "c"), ...tier("A", "x", "y")];

  test("reordena dentro del mismo tier", () => {
    const changes = moveItem(slots, "c", "S", 0);
    assert.deepEqual(apply(slots, changes), { S: ["c", "a", "b"], A: ["x", "y"] });
    positionsAreDense(slots, changes);
  });

  test("mueve a otro tier y renumera ambos", () => {
    const changes = moveItem(slots, "a", "A", 1);
    assert.deepEqual(apply(slots, changes), { S: ["b", "c"], A: ["x", "a", "y"] });
    positionsAreDense(slots, changes);
  });

  test("mueve a un tier vacío", () => {
    const changes = moveItem(slots, "b", "B", 0);
    assert.deepEqual(apply(slots, changes), { S: ["a", "c"], A: ["x", "y"], B: ["b"] });
    positionsAreDense(slots, changes);
  });

  test("un índice fuera de rango se ajusta a los extremos", () => {
    assert.deepEqual(apply(slots, moveItem(slots, "a", "A", 99)).A, ["x", "y", "a"]);
    assert.deepEqual(apply(slots, moveItem(slots, "c", "S", -5)).S, ["c", "a", "b"]);
  });

  test("solo devuelve las filas que cambian", () => {
    assert.deepEqual(moveItem(slots, "b", "S", 1), []);
    assert.deepEqual(
      moveItem(slots, "y", "A", 0).map((slot) => slot.id).sort(),
      ["x", "y"]
    );
  });

  test("corrige posiciones con huecos de antes", () => {
    const gapped: Slot[] = [
      { id: "a", tierId: "S", position: 0 },
      { id: "b", tierId: "S", position: 4 },
      { id: "c", tierId: "S", position: 9 },
    ];
    positionsAreDense(gapped, moveItem(gapped, "a", "S", 2));
  });

  test("falla si el ítem no está entre los slots", () => {
    assert.throws(() => moveItem(slots, "zzz", "S", 0));
  });
});

describe("removeItem", () => {
  const slots = [...tier("S", "a", "b", "c"), ...tier("A", "x")];

  test("cierra el hueco que deja el ítem", () => {
    const changes = removeItem(slots, "a");
    assert.deepEqual(changes, [
      { id: "b", tierId: "S", position: 0 },
      { id: "c", tierId: "S", position: 1 },
    ]);
  });

  test("quitar el último no cambia nada", () => {
    assert.deepEqual(removeItem(slots, "c"), []);
  });
});
