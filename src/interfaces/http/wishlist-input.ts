export const WISHLIST_STATUSES = ["WANTED", "BOUGHT", "DISCARDED"] as const;
export const WISHLIST_CURRENCIES = ["COP", "USD"] as const;

export type WishlistStatus = (typeof WISHLIST_STATUSES)[number];
export type WishlistCurrency = (typeof WISHLIST_CURRENCIES)[number];

export const NAME_MAX_LENGTH = 120;
export const NOTES_MAX_LENGTH = 1000;
export const URL_MAX_LENGTH = 2048;
export const LABEL_MAX_LENGTH = 40;
export const PRICE_MAX = 1e12;

export const isWishlistStatus = (value: unknown): value is WishlistStatus =>
  typeof value === "string" && WISHLIST_STATUSES.includes(value as WishlistStatus);

const isCurrency = (value: unknown): value is WishlistCurrency =>
  typeof value === "string" && WISHLIST_CURRENCIES.includes(value as WishlistCurrency);

const isHttpUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);

export type ItemInput = {
  name?: string;
  price?: number;
  currency?: WishlistCurrency;
  productUrl?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
  status?: WishlistStatus;
};

export type TierInput = { label?: string; color?: string };

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

const optionalText = (
  value: unknown,
  field: string,
  maxLength: number
): ParseResult<string | null | undefined> => {
  if (value === undefined) return { ok: true, value: undefined };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: `\`${field}\` debe ser texto.` };

  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { ok: false, error: `\`${field}\` admite máximo ${maxLength} caracteres.` };
  }

  return { ok: true, value: trimmed || null };
};

const optionalUrl = (value: unknown, field: string): ParseResult<string | null | undefined> => {
  const text = optionalText(value, field, URL_MAX_LENGTH);
  if (!text.ok || !text.value) return text;
  if (!isHttpUrl(text.value)) {
    return { ok: false, error: `\`${field}\` debe ser una URL http(s).` };
  }
  return text;
};

export const parseItemInput = (body: unknown, mode: "create" | "update"): ParseResult<ItemInput> => {
  const raw = (body ?? {}) as Record<string, unknown>;
  const input: ItemInput = {};

  if (raw.name !== undefined || mode === "create") {
    if (typeof raw.name !== "string" || !raw.name.trim()) {
      return { ok: false, error: "`name` es obligatorio." };
    }
    if (raw.name.trim().length > NAME_MAX_LENGTH) {
      return { ok: false, error: `\`name\` admite máximo ${NAME_MAX_LENGTH} caracteres.` };
    }
    input.name = raw.name.trim();
  }

  if (raw.price !== undefined || mode === "create") {
    if (typeof raw.price !== "number" || !Number.isFinite(raw.price) || raw.price <= 0) {
      return { ok: false, error: "`price` debe ser un número mayor que 0." };
    }
    if (raw.price > PRICE_MAX) return { ok: false, error: "`price` es demasiado grande." };
    input.price = raw.price;
  }

  if (raw.currency !== undefined) {
    if (!isCurrency(raw.currency)) {
      return { ok: false, error: `\`currency\` debe ser uno de: ${WISHLIST_CURRENCIES.join(", ")}.` };
    }
    input.currency = raw.currency;
  }

  if (raw.status !== undefined) {
    if (mode === "create") return { ok: false, error: "`status` no se envía al crear." };
    if (!isWishlistStatus(raw.status)) {
      return { ok: false, error: `\`status\` debe ser uno de: ${WISHLIST_STATUSES.join(", ")}.` };
    }
    input.status = raw.status;
  }

  const productUrl = optionalUrl(raw.productUrl, "productUrl");
  if (!productUrl.ok) return productUrl;
  if (productUrl.value !== undefined) input.productUrl = productUrl.value;

  const imageUrl = optionalUrl(raw.imageUrl, "imageUrl");
  if (!imageUrl.ok) return imageUrl;
  if (imageUrl.value !== undefined) input.imageUrl = imageUrl.value;

  const notes = optionalText(raw.notes, "notes", NOTES_MAX_LENGTH);
  if (!notes.ok) return notes;
  if (notes.value !== undefined) input.notes = notes.value;

  return { ok: true, value: input };
};

export const parseTierInput = (body: unknown): ParseResult<TierInput> => {
  const raw = (body ?? {}) as Record<string, unknown>;
  const input: TierInput = {};

  if (raw.label !== undefined) {
    if (typeof raw.label !== "string" || !raw.label.trim()) {
      return { ok: false, error: "`label` no puede estar vacío." };
    }
    if (raw.label.trim().length > LABEL_MAX_LENGTH) {
      return { ok: false, error: `\`label\` admite máximo ${LABEL_MAX_LENGTH} caracteres.` };
    }
    input.label = raw.label.trim();
  }

  if (raw.color !== undefined) {
    if (!isHexColor(raw.color)) return { ok: false, error: "`color` debe tener el formato #rrggbb." };
    input.color = raw.color.toLowerCase();
  }

  return { ok: true, value: input };
};
