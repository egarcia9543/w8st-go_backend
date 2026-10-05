import prisma from "../../infrastructure/database/prisma";

export const DEFAULT_WISHLIST_TIERS = [
  { label: "S", color: "#ef4444" },
  { label: "A", color: "#f97316" },
  { label: "B", color: "#eab308" },
  { label: "C", color: "#22c55e" },
  { label: "D", color: "#3b82f6" },
] as const;

export const ensureWishlistTiers = async (userId: string): Promise<void> => {
  const existing = await prisma.wishlistTier.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.wishlistTier.createMany({
    data: DEFAULT_WISHLIST_TIERS.map((tier, position) => ({ userId, position, ...tier })),
    skipDuplicates: true,
  });
};
