import { Router, Request, Response } from "express";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { currentUserId } from "../current-user";
import { ensureCategories } from "../../../application/use-cases/ensure-categories";

export const categoriesRouter = Router();

categoriesRouter.use(requireAuth);

type CategoryRow = {
  id: string;
  name: string;
  color: string;
  groupId: string | null;
  monthlyLimit: number | null;
  archived: boolean;
  position: number;
};

const serializeCategory = (category: CategoryRow) => ({
  id: category.id,
  name: category.name,
  color: category.color,
  groupId: category.groupId,
  monthlyLimit: category.monthlyLimit,
  archived: category.archived,
  position: category.position,
});

categoriesRouter.get("/categories", async (req: Request, res: Response) => {
  const { includeArchived } = req.query as { includeArchived?: string };
  const userId = currentUserId(req);

  await ensureCategories(userId);

  const archivedFilter = includeArchived === "true" ? {} : { archived: false };

  const [groups, ungrouped] = await Promise.all([
    prisma.budgetGroup.findMany({
      where: { userId },
      orderBy: { position: "asc" },
      include: { categories: { where: archivedFilter, orderBy: { position: "asc" } } },
    }),
    prisma.category.findMany({
      where: { userId, groupId: null, ...archivedFilter },
      orderBy: { position: "asc" },
    }),
  ]);

  res.json({
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      kind: group.kind,
      targetPercent: group.targetPercent,
      color: group.color,
      position: group.position,
      categories: group.categories.map(serializeCategory),
    })),
    ungrouped: ungrouped.map(serializeCategory),
  });
});
