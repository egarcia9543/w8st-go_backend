import { isHexColor, ParseResult } from "./input";

export const BUDGET_GROUP_KINDS = ["SPENDING", "SAVINGS"] as const;
export type BudgetGroupKind = (typeof BUDGET_GROUP_KINDS)[number];

export const BUDGET_NAME_MAX_LENGTH = 40;
export const AMOUNT_MAX = 1e12;

export type CategoryInput = {
  name?: string;
  color?: string;
  groupId?: string | null;
  monthlyLimit?: number | null;
  archived?: boolean;
};

export type GroupInput = {
  name?: string;
  kind?: BudgetGroupKind;
  targetPercent?: number;
  color?: string;
};

type Mode = "create" | "update";

const parseName = (value: unknown, mode: Mode): ParseResult<string | undefined> => {
  if (value === undefined && mode === "update") return { ok: true, value: undefined };
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: "`name` es obligatorio." };
  }
  if (value.trim().length > BUDGET_NAME_MAX_LENGTH) {
    return { ok: false, error: `\`name\` admite máximo ${BUDGET_NAME_MAX_LENGTH} caracteres.` };
  }
  return { ok: true, value: value.trim() };
};

const parseColor = (value: unknown, mode: Mode): ParseResult<string | undefined> => {
  if (value === undefined && mode === "update") return { ok: true, value: undefined };
  if (!isHexColor(value)) return { ok: false, error: "`color` debe tener el formato #rrggbb." };
  return { ok: true, value: value.toLowerCase() };
};

export const isPositiveAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0 && value <= AMOUNT_MAX;

export const parseCategoryInput = (body: unknown, mode: Mode): ParseResult<CategoryInput> => {
  const raw = (body ?? {}) as Record<string, unknown>;
  const input: CategoryInput = {};

  const name = parseName(raw.name, mode);
  if (!name.ok) return name;
  if (name.value !== undefined) input.name = name.value;

  const color = parseColor(raw.color, mode);
  if (!color.ok) return color;
  if (color.value !== undefined) input.color = color.value;

  if (raw.groupId !== undefined) {
    if (raw.groupId !== null && typeof raw.groupId !== "string") {
      return { ok: false, error: "`groupId` debe ser un id o null." };
    }
    input.groupId = raw.groupId;
  }

  if (raw.monthlyLimit !== undefined) {
    if (raw.monthlyLimit !== null && !isPositiveAmount(raw.monthlyLimit)) {
      return { ok: false, error: "`monthlyLimit` debe ser un número mayor que 0 o null." };
    }
    input.monthlyLimit = raw.monthlyLimit;
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

export const parseGroupInput = (body: unknown, mode: Mode): ParseResult<GroupInput> => {
  const raw = (body ?? {}) as Record<string, unknown>;
  const input: GroupInput = {};

  const name = parseName(raw.name, mode);
  if (!name.ok) return name;
  if (name.value !== undefined) input.name = name.value;

  const color = parseColor(raw.color, mode);
  if (!color.ok) return color;
  if (color.value !== undefined) input.color = color.value;

  if (raw.kind !== undefined || mode === "create") {
    if (!BUDGET_GROUP_KINDS.includes(raw.kind as BudgetGroupKind)) {
      return { ok: false, error: `\`kind\` debe ser uno de: ${BUDGET_GROUP_KINDS.join(", ")}.` };
    }
    input.kind = raw.kind as BudgetGroupKind;
  }

  if (raw.targetPercent !== undefined || mode === "create") {
    const value = raw.targetPercent;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      return { ok: false, error: "`targetPercent` debe ser un número entre 0 y 100." };
    }
    input.targetPercent = value;
  }

  return { ok: true, value: input };
};
