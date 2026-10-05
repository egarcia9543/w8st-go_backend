import { isClassifiable, MoneyFlags } from "./classifiable";
import { finDeMes, inicioDeMes } from "../../infrastructure/date/bogota";

export const PRIMARY_CURRENCY = "COP";
export const AT_RISK_RATIO = 0.8;
export const PACE_TOLERANCE = 0.15;

export type GroupKind = "SPENDING" | "SAVINGS";
export type BudgetStatus = "OK" | "AT_RISK" | "OVER" | "REACHED" | "PENDING" | "NO_LIMIT";

export type SummaryTransaction = MoneyFlags & {
  amount: number;
  currency: string;
  categoryId: string | null;
};

export type SummaryCategory = {
  id: string;
  name: string;
  color: string;
  groupId: string | null;
  monthlyLimit: number | null;
  archived: boolean;
  position: number;
};

export type SummaryGroup = {
  id: string;
  name: string;
  kind: GroupKind;
  targetPercent: number;
  color: string;
  position: number;
};

export type IncomeRow = { amount: number; effectiveFrom: string };

export type CategorySummary = {
  id: string;
  name: string;
  color: string;
  limit: number | null;
  spent: number;
  count: number;
  percentOfIncome: number | null;
  status: BudgetStatus;
};

export type GroupSummary = {
  id: string;
  name: string;
  kind: GroupKind;
  targetPercent: number;
  color: string;
  limit: number | null;
  spent: number;
  percentOfIncome: number | null;
  status: BudgetStatus;
  categories: CategorySummary[];
};

export type BudgetSummary = {
  month: string;
  monthProgress: number;
  referenceIncome: IncomeRow | null;
  totalSpent: number;
  totalSaved: number;
  unassigned: number | null;
  groups: GroupSummary[];
  ungrouped: CategorySummary[];
  uncategorized: { spent: number; count: number; percentOfIncome: number | null };
  foreign: { currency: string; total: number; count: number }[];
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const roundMoney = (value: number) => Math.round(value * 100) / 100;
const roundPercent = (value: number) => Math.round(value * 10) / 10;
const byPosition = <T extends { position: number }>(a: T, b: T) => a.position - b.position;

export const incomeForMonth = (rows: IncomeRow[], month: string): IncomeRow | null =>
  [...rows]
    .filter((row) => row.effectiveFrom <= month)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null;

export const monthProgress = (month: string, now: Date): number => {
  const start = inicioDeMes(month).getTime();
  const end = finDeMes(month).getTime();
  return clamp((now.getTime() - start) / (end - start), 0, 1);
};

export const budgetStatus = (
  kind: GroupKind,
  spent: number,
  limit: number | null,
  progress: number
): BudgetStatus => {
  if (limit === null || limit <= 0) return "NO_LIMIT";

  const ratio = spent / limit;

  if (kind === "SAVINGS") return ratio >= 1 ? "REACHED" : "PENDING";
  if (ratio >= 1) return "OVER";
  if (ratio >= AT_RISK_RATIO || ratio > progress + PACE_TOLERANCE) return "AT_RISK";
  return "OK";
};

export const buildBudgetSummary = (input: {
  month: string;
  now: Date;
  transactions: SummaryTransaction[];
  categories: SummaryCategory[];
  groups: SummaryGroup[];
  incomes: IncomeRow[];
}): BudgetSummary => {
  const progress = monthProgress(input.month, input.now);
  const income = incomeForMonth(input.incomes, input.month);

  const categoryById = new Map(input.categories.map((category) => [category.id, category]));
  const groupById = new Map(input.groups.map((group) => [group.id, group]));

  const totals = new Map<string, { spent: number; count: number }>();
  const uncategorized = { spent: 0, count: 0 };
  const foreign = new Map<string, { total: number; count: number }>();

  for (const tx of input.transactions) {
    if (!isClassifiable(tx)) continue;

    if (tx.currency !== PRIMARY_CURRENCY) {
      const entry = foreign.get(tx.currency) ?? { total: 0, count: 0 };
      foreign.set(tx.currency, { total: entry.total + tx.amount, count: entry.count + 1 });
      continue;
    }

    const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined;
    if (!category) {
      uncategorized.spent += tx.amount;
      uncategorized.count += 1;
      continue;
    }

    const entry = totals.get(category.id) ?? { spent: 0, count: 0 };
    totals.set(category.id, { spent: entry.spent + tx.amount, count: entry.count + 1 });
  }

  const percentOfIncome = (value: number) =>
    income && income.amount > 0 ? roundPercent((value / income.amount) * 100) : null;

  const kindOf = (category: SummaryCategory): GroupKind =>
    (category.groupId && groupById.get(category.groupId)?.kind) || "SPENDING";

  const isVisible = (category: SummaryCategory) =>
    !category.archived || (totals.get(category.id)?.count ?? 0) > 0;

  const summarizeCategory = (category: SummaryCategory): CategorySummary => {
    const { spent, count } = totals.get(category.id) ?? { spent: 0, count: 0 };

    return {
      id: category.id,
      name: category.name,
      color: category.color,
      limit: category.monthlyLimit,
      spent: roundMoney(spent),
      count,
      percentOfIncome: percentOfIncome(spent),
      status: budgetStatus(kindOf(category), spent, category.monthlyLimit, progress),
    };
  };

  const visibleCategories = input.categories.filter(isVisible).sort(byPosition);

  const groups = [...input.groups].sort(byPosition).map((group): GroupSummary => {
    const categories = visibleCategories
      .filter((category) => category.groupId === group.id)
      .map(summarizeCategory);
    const spent = categories.reduce((sum, category) => sum + category.spent, 0);
    const limit = income ? roundMoney((income.amount * group.targetPercent) / 100) : null;

    return {
      id: group.id,
      name: group.name,
      kind: group.kind,
      targetPercent: group.targetPercent,
      color: group.color,
      limit,
      spent: roundMoney(spent),
      percentOfIncome: percentOfIncome(spent),
      status: budgetStatus(group.kind, spent, limit, progress),
      categories,
    };
  });

  const ungrouped = visibleCategories
    .filter((category) => !category.groupId || !groupById.has(category.groupId))
    .map(summarizeCategory);

  let categorizedSpent = 0;
  let totalSaved = 0;
  for (const category of input.categories) {
    const spent = totals.get(category.id)?.spent ?? 0;
    if (kindOf(category) === "SAVINGS") totalSaved += spent;
    else categorizedSpent += spent;
  }

  const totalSpent = categorizedSpent + uncategorized.spent;

  return {
    month: input.month,
    monthProgress: roundPercent(progress * 100) / 100,
    referenceIncome: income ? { amount: income.amount, effectiveFrom: income.effectiveFrom } : null,
    totalSpent: roundMoney(totalSpent),
    totalSaved: roundMoney(totalSaved),
    unassigned: income ? roundMoney(income.amount - totalSpent - totalSaved) : null,
    groups,
    ungrouped,
    uncategorized: {
      spent: roundMoney(uncategorized.spent),
      count: uncategorized.count,
      percentOfIncome: percentOfIncome(uncategorized.spent),
    },
    foreign: [...foreign.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, { total, count }]) => ({ currency, total: roundMoney(total), count })),
  };
};
