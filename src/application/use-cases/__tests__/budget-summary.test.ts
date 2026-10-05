import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  budgetStatus,
  buildBudgetSummary,
  incomeForMonth,
  monthProgress,
  SummaryCategory,
  SummaryGroup,
  SummaryTransaction,
} from "../budget-summary";

const groups: SummaryGroup[] = [
  { id: "needs", name: "Necesidades", kind: "SPENDING", targetPercent: 50, color: "#000", position: 0 },
  { id: "wants", name: "Gustos", kind: "SPENDING", targetPercent: 30, color: "#000", position: 1 },
  { id: "save", name: "Ahorro", kind: "SAVINGS", targetPercent: 20, color: "#000", position: 2 },
];

const category = (
  id: string,
  groupId: string | null,
  extra: Partial<SummaryCategory> = {}
): SummaryCategory => ({
  id,
  name: id,
  color: "#000",
  groupId,
  monthlyLimit: null,
  archived: false,
  position: 0,
  ...extra,
});

const categories = [
  category("market", "needs", { monthlyLimit: 800000, position: 0 }),
  category("fun", "wants", { monthlyLimit: 400000, position: 1 }),
  category("savings", "save", { monthlyLimit: 500000, position: 2 }),
];

const spend = (amount: number, categoryId: string | null, extra: Partial<SummaryTransaction> = {}) => ({
  amount,
  currency: "COP",
  categoryId,
  direction: "OUTFLOW",
  fundingSource: "OWN_FUNDS",
  excludeFromSpending: false,
  ...extra,
});

const MONTH = "2026-10";
const MID_MONTH = new Date("2026-10-16T17:00:00Z");
const incomes = [{ amount: 4000000, effectiveFrom: "2026-07" }];

const build = (transactions: SummaryTransaction[], overrides: Partial<Parameters<typeof buildBudgetSummary>[0]> = {}) =>
  buildBudgetSummary({ month: MONTH, now: MID_MONTH, transactions, categories, groups, incomes, ...overrides });

describe("incomeForMonth", () => {
  const rows = [
    { amount: 3000000, effectiveFrom: "2026-01" },
    { amount: 3500000, effectiveFrom: "2026-06" },
  ];

  test("usa el valor vigente más reciente", () => {
    assert.equal(incomeForMonth(rows, "2026-10")?.amount, 3500000);
  });

  test("un aumento no reescribe los meses anteriores", () => {
    assert.equal(incomeForMonth(rows, "2026-05")?.amount, 3000000);
  });

  test("antes del primer registro no hay ingreso", () => {
    assert.equal(incomeForMonth(rows, "2025-12"), null);
  });
});

describe("monthProgress", () => {
  test("es 0 al empezar el mes en Bogotá y 1 al terminar", () => {
    assert.equal(monthProgress(MONTH, new Date("2026-10-01T05:00:00Z")), 0);
    assert.equal(monthProgress(MONTH, new Date("2026-11-01T05:00:00Z")), 1);
  });

  test("meses pasados valen 1 y futuros 0", () => {
    assert.equal(monthProgress("2026-09", MID_MONTH), 1);
    assert.equal(monthProgress("2026-11", MID_MONTH), 0);
  });

  test("a mitad de mes ronda la mitad", () => {
    const progress = monthProgress(MONTH, MID_MONTH);
    assert.ok(progress > 0.45 && progress < 0.55, String(progress));
  });
});

describe("budgetStatus", () => {
  test("sin límite no hay estado", () => {
    assert.equal(budgetStatus("SPENDING", 100, null, 0.5), "NO_LIMIT");
    assert.equal(budgetStatus("SPENDING", 100, 0, 0.5), "NO_LIMIT");
  });

  test("pasarse del límite es OVER", () => {
    assert.equal(budgetStatus("SPENDING", 400, 400, 0.5), "OVER");
  });

  test("llegar al 80% es AT_RISK aunque el mes vaya avanzado", () => {
    assert.equal(budgetStatus("SPENDING", 80, 100, 0.95), "AT_RISK");
  });

  test("gastar más rápido que el mes es AT_RISK", () => {
    assert.equal(budgetStatus("SPENDING", 70, 100, 0.25), "AT_RISK");
    assert.equal(budgetStatus("SPENDING", 35, 100, 0.25), "OK");
  });

  test("el ahorro solo dice si llegó a la meta, sin aviso de ritmo", () => {
    assert.equal(budgetStatus("SAVINGS", 0, 500, 0.9), "PENDING");
    assert.equal(budgetStatus("SAVINGS", 500, 500, 0.1), "REACHED");
  });
});

describe("buildBudgetSummary", () => {
  test("suma por categoría y por grupo", () => {
    const summary = build([spend(300000, "market"), spend(100000, "market"), spend(50000, "fun")]);
    const needs = summary.groups.find((group) => group.id === "needs")!;

    assert.equal(needs.spent, 400000);
    assert.equal(needs.categories[0].count, 2);
    assert.equal(needs.percentOfIncome, 10);
    assert.equal(needs.limit, 2000000);
  });

  test("el ahorro no cuenta como gasto", () => {
    const summary = build([spend(200000, "market"), spend(500000, "savings")]);

    assert.equal(summary.totalSpent, 200000);
    assert.equal(summary.totalSaved, 500000);
    assert.equal(summary.groups.find((group) => group.id === "save")!.categories[0].status, "REACHED");
  });

  test("lo sin clasificar cuenta como gasto y queda visible aparte", () => {
    const summary = build([spend(100000, null), spend(50000, "fun")]);

    assert.deepEqual(summary.uncategorized, { spent: 100000, count: 1, percentOfIncome: 2.5 });
    assert.equal(summary.totalSpent, 150000);
  });

  test("ingreso = gastado + ahorrado + sin asignar", () => {
    const summary = build([spend(1000000, "market"), spend(300000, null), spend(500000, "savings")]);
    assert.equal(summary.totalSpent + summary.totalSaved + summary.unassigned!, 4000000);
  });

  test("el USD va aparte y no consume límites en COP", () => {
    const summary = build([spend(45.9, "fun", { currency: "USD" }), spend(10, null, { currency: "USD" })]);

    assert.deepEqual(summary.foreign, [{ currency: "USD", total: 55.9, count: 2 }]);
    assert.equal(summary.totalSpent, 0);
    assert.equal(summary.groups.find((group) => group.id === "wants")!.spent, 0);
  });

  test("ingresos, internos y excluidos no entran", () => {
    const summary = build([
      spend(1000, "market", { direction: "INFLOW" }),
      spend(1000, "market", { fundingSource: "INTERNAL" }),
      spend(1000, null, { excludeFromSpending: true }),
    ]);

    assert.equal(summary.totalSpent, 0);
    assert.equal(summary.uncategorized.count, 0);
  });

  test("lo comprado con crédito cuenta en el mes de la compra", () => {
    const summary = build([spend(90000, "fun", { fundingSource: "CREDIT" })]);
    assert.equal(summary.groups.find((group) => group.id === "wants")!.spent, 90000);
  });

  test("sin ingreso de referencia no hay porcentajes ni sin asignar", () => {
    const summary = build([spend(100000, "market")], { incomes: [] });

    assert.equal(summary.referenceIncome, null);
    assert.equal(summary.unassigned, null);
    assert.equal(summary.groups[0].percentOfIncome, null);
    assert.equal(summary.groups[0].status, "NO_LIMIT");
  });

  test("una categoría archivada solo aparece si tuvo movimientos", () => {
    const withArchived = [...categories, category("old", "wants", { archived: true, position: 9 })];

    const empty = build([], { categories: withArchived });
    assert.ok(!empty.groups.find((group) => group.id === "wants")!.categories.some((c) => c.id === "old"));

    const used = build([spend(1000, "old")], { categories: withArchived });
    assert.ok(used.groups.find((group) => group.id === "wants")!.categories.some((c) => c.id === "old"));
  });

  test("las categorías sin grupo se reportan aparte y cuentan como gasto", () => {
    const summary = build([spend(70000, "loose")], {
      categories: [...categories, category("loose", null)],
    });

    assert.equal(summary.ungrouped[0].spent, 70000);
    assert.equal(summary.totalSpent, 70000);
  });

  test("un gasto con categoría desconocida cae en sin clasificar", () => {
    const summary = build([spend(1000, "ghost")]);
    assert.equal(summary.uncategorized.count, 1);
  });
});
