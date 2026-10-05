export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
