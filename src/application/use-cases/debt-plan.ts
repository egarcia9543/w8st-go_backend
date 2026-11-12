export const MAX_PLAN_MONTHS = 600;

// Por debajo de un peso el saldo se da por cancelado: los centavos que deja el
// redondeo de la tasa mensual no deben alargar el plan un mes más.
const PAID_OFF_EPSILON = 1;

export const DEBT_STRATEGIES = ["CARDS_FIRST", "AVALANCHE"] as const;
export type DebtStrategy = (typeof DEBT_STRATEGIES)[number];

export type PlanDebt = {
  id: string;
  name: string;
  kind: string;
  balance: number;
  annualRate: number;
  monthlyPayment: number;
  paidByOther: boolean;
};

export type DebtPayoff = {
  id: string;
  name: string;
  order: number;
  annualRate: number;
  balance: number;
  receivesExtra: boolean;
  payoffMonth: string | null;
  months: number | null;
  interestPaid: number;
};

export type DebtPlan = {
  strategy: DebtStrategy;
  startMonth: string;
  extraPerMonth: number;
  monthlyPayment: number;
  totalBalance: number;
  totalInterest: number;
  debtFreeMonth: string | null;
  debts: DebtPayoff[];
  paidByOther: DebtPayoff[];
};

/// Tasa efectiva anual (23.43 = 23,43 %) -> tasa efectiva mensual equivalente.
export const monthlyRate = (annualRatePercent: number): number =>
  Math.pow(1 + annualRatePercent / 100, 1 / 12) - 1;

/// "2026-11" + 2 -> "2027-01"
export const addMonths = (month: string, count: number): string => {
  const [year, mon] = month.split("-").map(Number);
  const index = year * 12 + (mon - 1) + count;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
};

// Avalancha: primero la tasa más alta; a igual tasa, el saldo más pequeño, que
// libera su cuota antes.
const byAvalanche = (a: PlanDebt, b: PlanDebt) =>
  b.annualRate - a.annualRate || a.balance - b.balance;

// Tarjetas primero: las tarjetas que cobran interés, de menor a mayor saldo
// (se ven en cero cuanto antes); después los créditos por tasa; al final lo
// que está al 0 %, que solo paga su cuota.
const cardsFirstTier = (debt: PlanDebt) =>
  debt.annualRate === 0 ? 2 : debt.kind === "CREDIT_CARD" ? 0 : 1;

const byCardsFirst = (a: PlanDebt, b: PlanDebt) =>
  cardsFirstTier(a) - cardsFirstTier(b) ||
  (cardsFirstTier(a) === 0 ? a.balance - b.balance : byAvalanche(a, b));

// Con "Tarjetas primero" lo que no cobra interés no se adelanta: no hay ahorro
// en pagarlo antes y la plata rinde más en la moto.
const receivesExtra = (debt: PlanDebt, strategy: DebtStrategy) =>
  strategy === "AVALANCHE" || debt.annualRate > 0;

/**
 * Simula mes a mes el pago de las deudas: cada deuda paga su cuota, y el
 * `extraPerMonth` más las cuotas que se van liberando al cancelar deudas se
 * abonan a la primera de la lista según la estrategia. Las deudas que paga
 * otra persona (`paidByOther`) se proyectan solo con su cuota y no reciben extra.
 */
export const buildDebtPlan = (input: {
  debts: PlanDebt[];
  extraPerMonth: number;
  startMonth: string;
  strategy?: DebtStrategy;
}): DebtPlan => {
  const strategy = input.strategy ?? "CARDS_FIRST";
  const order = strategy === "AVALANCHE" ? byAvalanche : byCardsFirst;

  const own = input.debts.filter((debt) => !debt.paidByOther).sort(order);
  const others = input.debts.filter((debt) => debt.paidByOther).sort(byAvalanche);

  const ownResult = simulate(own, input.extraPerMonth, input.startMonth, (debt) =>
    receivesExtra(debt, strategy)
  );
  const othersResult = simulate(others, 0, input.startMonth, () => false);

  // Si alguna deuda no se cancela dentro del horizonte (la cuota no cubre ni
  // los intereses), no hay fecha de salida que prometer.
  const pending = ownResult.some((debt) => debt.months === null);
  const lastMonth = Math.max(1, ...ownResult.map((debt) => debt.months ?? 0));

  return {
    strategy,
    startMonth: input.startMonth,
    extraPerMonth: input.extraPerMonth,
    monthlyPayment: own.reduce((sum, debt) => sum + debt.monthlyPayment, 0),
    totalBalance: own.reduce((sum, debt) => sum + debt.balance, 0),
    totalInterest: ownResult.reduce((sum, debt) => sum + debt.interestPaid, 0),
    debtFreeMonth: pending ? null : addMonths(input.startMonth, lastMonth - 1),
    debts: ownResult,
    paidByOther: othersResult,
  };
};

const simulate = (
  debts: PlanDebt[],
  extraPerMonth: number,
  startMonth: string,
  takesExtra: (debt: PlanDebt) => boolean
): DebtPayoff[] => {
  const extraAllowed = debts.map(takesExtra);
  const balances = debts.map((debt) => debt.balance);
  const interest = debts.map(() => 0);
  const months: (number | null)[] = debts.map((debt) =>
    debt.balance <= PAID_OFF_EPSILON ? 0 : null
  );
  const rates = debts.map((debt) => monthlyRate(debt.annualRate));

  for (let month = 1; month <= MAX_PLAN_MONTHS && months.some((m) => m === null); month++) {
    // Cuotas liberadas por deudas ya canceladas: se suman al extra.
    let pool = extraPerMonth;

    debts.forEach((debt, i) => {
      if (months[i] !== null) {
        pool += debt.monthlyPayment;
        return;
      }

      const accrued = balances[i] * rates[i];
      interest[i] += accrued;
      balances[i] += accrued;

      const payment = Math.min(debt.monthlyPayment, balances[i]);
      balances[i] -= payment;
      pool += debt.monthlyPayment - payment;
    });

    for (let i = 0; i < debts.length && pool > 0; i++) {
      if (months[i] !== null || !extraAllowed[i]) continue;
      const abono = Math.min(pool, balances[i]);
      balances[i] -= abono;
      pool -= abono;
    }

    debts.forEach((_, i) => {
      if (months[i] === null && balances[i] <= PAID_OFF_EPSILON) months[i] = month;
    });
  }

  return debts.map((debt, i) => ({
    id: debt.id,
    name: debt.name,
    order: i + 1,
    annualRate: debt.annualRate,
    balance: debt.balance,
    receivesExtra: extraAllowed[i],
    months: months[i],
    payoffMonth: months[i] === null ? null : addMonths(startMonth, Math.max(months[i]! - 1, 0)),
    interestPaid: Math.round(interest[i]),
  }));
};
