// Deliberadamente sin importar nada de Prisma: el parser no debe depender de la
// base de datos. Los literales coinciden con los enums del schema.
export type Direction = "OUTFLOW" | "INFLOW";
export type FundingSource = "OWN_FUNDS" | "CREDIT" | "INTERNAL";
export type CardKind = "CREDIT" | "DEBIT" | "ACCOUNT";

export type ParsedTransaction = {
  type: string;
  direction: Direction;
  fundingSource: FundingSource;
  amount: number;
  currency: string;
  /// @deprecated Se sigue poblando para no romper el front hasta la Fase 3.
  paymentMethod: string | null;
  merchant: string | null;
  instrumentLast4: string | null;
  instrumentKind: CardKind | null;
  channel: string | null;
  counterpartyName: string | null;
  counterpartyKey: string | null;
  transactionDate: Date;
  ruleName: string;
};

export interface EmailRule {
  /// Identificador estable: se guarda en Transaction.ruleName para trazabilidad.
  name: string;
  pattern: RegExp;
  parse(match: RegExpMatchArray): ParsedTransaction;
}
