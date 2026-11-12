import { AMOUNT_MAX, isPositiveAmount } from "./budget-input";
import { ParseResult } from "./input";

export const DEBT_KINDS = ["CREDIT_CARD", "LOAN", "OTHER"] as const;
export type DebtKind = (typeof DEBT_KINDS)[number];

export const DEBT_NAME_MAX_LENGTH = 60;
export const DEBT_NOTES_MAX_LENGTH = 500;
export const ANNUAL_RATE_MAX = 100;

export type DebtInput = {
  name?: string;
  kind?: DebtKind;
  balance?: number;
  annualRate?: number;
  monthlyPayment?: number;
  paidByOther?: boolean;
  notes?: string | null;
  archived?: boolean;
};

export type PaymentInput = {
  amount: number;
  paidAt: Date;
};

type Mode = "create" | "update";

// El saldo puede llegar a 0 (deuda cancelada que se conserva en el historial);
// la cuota y el abono, en cambio, siempre son positivos.
const isBalance = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= AMOUNT_MAX;

export const parseDebtInput = (body: unknown, mode: Mode): ParseResult<DebtInput> => {
  const raw = (body ?? {}) as Record<string, unknown>;
  const input: DebtInput = {};

  if (raw.name !== undefined || mode === "create") {
    if (typeof raw.name !== "string" || !raw.name.trim()) {
      return { ok: false, error: "`name` es obligatorio." };
    }
    if (raw.name.trim().length > DEBT_NAME_MAX_LENGTH) {
      return { ok: false, error: `\`name\` admite máximo ${DEBT_NAME_MAX_LENGTH} caracteres.` };
    }
    input.name = raw.name.trim();
  }

  if (raw.kind !== undefined) {
    if (!DEBT_KINDS.includes(raw.kind as DebtKind)) {
      return { ok: false, error: `\`kind\` debe ser uno de: ${DEBT_KINDS.join(", ")}.` };
    }
    input.kind = raw.kind as DebtKind;
  }

  if (raw.balance !== undefined || mode === "create") {
    if (!isBalance(raw.balance)) {
      return { ok: false, error: "`balance` debe ser un número mayor o igual a 0." };
    }
    input.balance = raw.balance;
  }

  if (raw.annualRate !== undefined || mode === "create") {
    const value = raw.annualRate;
    const isRate = typeof value === "number" && Number.isFinite(value);
    if (!isRate || value < 0 || value > ANNUAL_RATE_MAX) {
      return {
        ok: false,
        error: `\`annualRate\` debe ser la tasa efectiva anual entre 0 y ${ANNUAL_RATE_MAX}.`,
      };
    }
    input.annualRate = value;
  }

  if (raw.monthlyPayment !== undefined || mode === "create") {
    if (!isPositiveAmount(raw.monthlyPayment)) {
      return { ok: false, error: "`monthlyPayment` debe ser un número mayor que 0." };
    }
    input.monthlyPayment = raw.monthlyPayment;
  }

  if (raw.paidByOther !== undefined) {
    if (typeof raw.paidByOther !== "boolean") {
      return { ok: false, error: "`paidByOther` debe ser true o false." };
    }
    input.paidByOther = raw.paidByOther;
  }

  if (raw.notes !== undefined) {
    if (raw.notes !== null && typeof raw.notes !== "string") {
      return { ok: false, error: "`notes` debe ser texto o null." };
    }
    const notes = typeof raw.notes === "string" ? raw.notes.trim() : null;
    if (notes && notes.length > DEBT_NOTES_MAX_LENGTH) {
      return { ok: false, error: `\`notes\` admite máximo ${DEBT_NOTES_MAX_LENGTH} caracteres.` };
    }
    input.notes = notes || null;
  }

  if (raw.archived !== undefined) {
    if (mode === "create") return { ok: false, error: "`archived` no se envía al crear." };
    if (typeof raw.archived !== "boolean") {
      return { ok: false, error: "`archived` debe ser true o false." };
    }
    input.archived = raw.archived;
  }

  return { ok: true, value: input };
};

export const parsePaymentInput = (body: unknown, now: Date): ParseResult<PaymentInput> => {
  const raw = (body ?? {}) as Record<string, unknown>;

  if (!isPositiveAmount(raw.amount)) {
    return { ok: false, error: "`amount` debe ser un número mayor que 0." };
  }

  if (raw.paidAt === undefined) return { ok: true, value: { amount: raw.amount, paidAt: now } };

  const paidAt = typeof raw.paidAt === "string" ? new Date(raw.paidAt) : null;
  if (!paidAt || Number.isNaN(paidAt.getTime())) {
    return { ok: false, error: "`paidAt` debe ser una fecha ISO válida." };
  }
  if (paidAt.getTime() > now.getTime()) {
    return { ok: false, error: "`paidAt` no puede estar en el futuro." };
  }

  return { ok: true, value: { amount: raw.amount, paidAt } };
};

/// `extra` de la query del plan: vacío equivale a 0.
export const parseExtra = (value: unknown): ParseResult<number> => {
  if (value === undefined || value === "") return { ok: true, value: 0 };

  const extra = Number(value);
  if (!Number.isFinite(extra) || extra < 0 || extra > AMOUNT_MAX) {
    return { ok: false, error: "`extra` debe ser un número mayor o igual a 0." };
  }
  return { ok: true, value: extra };
};
