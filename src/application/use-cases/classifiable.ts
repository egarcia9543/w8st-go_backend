import { Prisma } from "@prisma/client";

export type MoneyFlags = {
  direction: string;
  fundingSource: string;
  excludeFromSpending: boolean;
};

const SPENDING_SOURCES: string[] = ["OWN_FUNDS", "CREDIT"];

export const isClassifiable = (tx: MoneyFlags): boolean =>
  tx.direction === "OUTFLOW" &&
  SPENDING_SOURCES.includes(tx.fundingSource) &&
  !tx.excludeFromSpending;

export const CLASSIFIABLE_WHERE = {
  direction: "OUTFLOW",
  fundingSource: { in: ["OWN_FUNDS", "CREDIT"] },
  excludeFromSpending: false,
} satisfies Prisma.TransactionWhereInput;
