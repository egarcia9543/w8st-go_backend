import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { addMonths, buildDebtPlan, monthlyRate, PlanDebt } from "../debt-plan";

const debt = (id: string, extra: Partial<PlanDebt> = {}): PlanDebt => ({
  id,
  name: id,
  balance: 1000000,
  annualRate: 0,
  monthlyPayment: 100000,
  paidByOther: false,
  ...extra,
});

describe("monthlyRate", () => {
  test("convierte la tasa efectiva anual en su equivalente mensual", () => {
    assert.ok(Math.abs(monthlyRate(28.5582) - 0.021155) < 1e-5);
    assert.equal(monthlyRate(0), 0);
  });
});

describe("addMonths", () => {
  test("cruza de año", () => {
    assert.equal(addMonths("2026-11", 0), "2026-11");
    assert.equal(addMonths("2026-11", 2), "2027-01");
    assert.equal(addMonths("2026-12", 13), "2028-01");
  });
});

describe("buildDebtPlan", () => {
  test("sin intereses ni extra, cada deuda dura saldo / cuota", () => {
    const plan = buildDebtPlan({ debts: [debt("a")], extraPerMonth: 0, startMonth: "2026-11" });

    assert.equal(plan.debts[0].months, 10);
    assert.equal(plan.debts[0].payoffMonth, "2027-08");
    assert.equal(plan.debtFreeMonth, "2027-08");
    assert.equal(plan.totalInterest, 0);
  });

  test("ordena por avalancha: primero la tasa más alta", () => {
    const plan = buildDebtPlan({
      debts: [debt("moto", { annualRate: 23.43 }), debt("tarjeta", { annualRate: 28.56 })],
      extraPerMonth: 0,
      startMonth: "2026-11",
    });

    assert.deepEqual(
      plan.debts.map((d) => [d.id, d.order]),
      [
        ["tarjeta", 1],
        ["moto", 2],
      ]
    );
  });

  test("el extra se abona a la de mayor tasa y adelanta su salida", () => {
    const base = buildDebtPlan({
      debts: [debt("cara", { annualRate: 28 }), debt("barata", { annualRate: 10 })],
      extraPerMonth: 0,
      startMonth: "2026-11",
    });
    const conExtra = buildDebtPlan({
      debts: [debt("cara", { annualRate: 28 }), debt("barata", { annualRate: 10 })],
      extraPerMonth: 400000,
      startMonth: "2026-11",
    });

    const cara = (plan: typeof base) => plan.debts.find((d) => d.id === "cara")!;
    assert.ok(cara(conExtra).months! < cara(base).months!);
    assert.ok(conExtra.totalInterest < base.totalInterest);
  });

  test("la cuota que libera una deuda cancelada pasa a la siguiente", () => {
    const plan = buildDebtPlan({
      debts: [debt("corta", { balance: 200000 }), debt("larga", { balance: 1000000 })],
      extraPerMonth: 0,
      startMonth: "2026-11",
    });

    // Sin la cuota liberada, "larga" tardaría 10 meses.
    assert.ok(plan.debts.find((d) => d.id === "larga")!.months! < 10);
  });

  test("las deudas que paga otra persona no reciben extra ni cuentan en el total", () => {
    const plan = buildDebtPlan({
      debts: [debt("mía"), debt("mamá", { paidByOther: true })],
      extraPerMonth: 500000,
      startMonth: "2026-11",
    });

    assert.equal(plan.totalBalance, 1000000);
    assert.equal(plan.monthlyPayment, 100000);
    assert.equal(plan.paidByOther[0].months, 10);
  });

  test("si la cuota no cubre los intereses no hay fecha de salida", () => {
    const plan = buildDebtPlan({
      debts: [debt("eterna", { annualRate: 30, monthlyPayment: 10000 })],
      extraPerMonth: 0,
      startMonth: "2026-11",
    });

    assert.equal(plan.debts[0].payoffMonth, null);
    assert.equal(plan.debtFreeMonth, null);
  });

  test("sin deudas propias ya estás libre desde el mes de inicio", () => {
    const plan = buildDebtPlan({ debts: [], extraPerMonth: 0, startMonth: "2026-11" });

    assert.equal(plan.debtFreeMonth, "2026-11");
    assert.deepEqual(plan.debts, []);
  });
});
