import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { CLASSIFIABLE_WHERE, isClassifiable, MoneyFlags } from "../classifiable";

const spending: MoneyFlags = {
  direction: "OUTFLOW",
  fundingSource: "OWN_FUNDS",
  excludeFromSpending: false,
};

describe("isClassifiable", () => {
  test("los gastos de bolsillo y con crédito se clasifican", () => {
    assert.equal(isClassifiable(spending), true);
    assert.equal(isClassifiable({ ...spending, fundingSource: "CREDIT" }), true);
  });

  test("los ingresos no se clasifican", () => {
    assert.equal(isClassifiable({ ...spending, direction: "INFLOW" }), false);
  });

  test("los movimientos internos y excluidos no se clasifican", () => {
    assert.equal(isClassifiable({ ...spending, fundingSource: "INTERNAL" }), false);
    assert.equal(isClassifiable({ ...spending, excludeFromSpending: true }), false);
  });

  test("el filtro de Prisma dice lo mismo que el predicado", () => {
    const matchesWhere = (tx: MoneyFlags) =>
      tx.direction === CLASSIFIABLE_WHERE.direction &&
      (CLASSIFIABLE_WHERE.fundingSource.in as string[]).includes(tx.fundingSource) &&
      tx.excludeFromSpending === CLASSIFIABLE_WHERE.excludeFromSpending;

    for (const direction of ["OUTFLOW", "INFLOW"]) {
      for (const fundingSource of ["OWN_FUNDS", "CREDIT", "INTERNAL"]) {
        for (const excludeFromSpending of [true, false]) {
          const tx = { direction, fundingSource, excludeFromSpending };
          assert.equal(matchesWhere(tx), isClassifiable(tx), JSON.stringify(tx));
        }
      }
    }
  });
});
