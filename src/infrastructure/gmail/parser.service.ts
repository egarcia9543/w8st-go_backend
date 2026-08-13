import { extractBody } from "./parsing/html";
import { rules } from "./rules";
import { motivoParaIgnorar } from "./rules/ignorables";
import { ParsedTransaction } from "./rules/types";

export type { ParsedTransaction } from "./rules/types";

export type ParseFailure = "NO_BODY" | "NO_MATCH" | "PARSE_ERROR" | "IGNORED";

export type ParseResult =
  | { ok: true; transaction: ParsedTransaction; body: string }
  | { ok: false; reason: ParseFailure; body: string; error?: string };

// Aplica el registro de reglas sobre un cuerpo ya extraído y limpio.
// Separado de parseEmail para poder testear sin construir un payload de Gmail.
export const parseBody = (body: string): ParseResult => {
  if (!body.trim()) return { ok: false, reason: "NO_BODY", body };

  for (const rule of rules) {
    const match = body.match(rule.pattern);
    if (!match) continue;

    try {
      const transaction = rule.parse(match);

      // Una fecha inválida entra a la base como null y rompe los agregados en
      // silencio. Mejor tratarlo como fallo y conservar el correo para revisar.
      if (Number.isNaN(transaction.transactionDate.getTime())) {
        return {
          ok: false,
          reason: "PARSE_ERROR",
          body,
          error: `${rule.name}: fecha inválida`,
        };
      }

      if (!Number.isFinite(transaction.amount)) {
        return {
          ok: false,
          reason: "PARSE_ERROR",
          body,
          error: `${rule.name}: monto inválido`,
        };
      }

      return { ok: true, transaction, body };
    } catch (err) {
      return {
        ok: false,
        reason: "PARSE_ERROR",
        body,
        error: `${rule.name}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Los ignorables se evalúan DESPUÉS de las reglas, nunca antes. Al revés, un
  // patrón demasiado laxo puede tragarse movimientos reales sin dejar rastro:
  // "código de seguridad" aparece en el pie de casi todos los correos del banco,
  // y descartó 53 compras en silencio antes de invertir este orden.
  const ignorable = motivoParaIgnorar(body);
  if (ignorable) return { ok: false, reason: "IGNORED", body, error: ignorable };

  return { ok: false, reason: "NO_MATCH", body };
};

export const parseEmail = (payload: unknown): ParseResult =>
  parseBody(extractBody(payload));
