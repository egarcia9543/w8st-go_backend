import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../../infrastructure/database/prisma";
import { requireAuth } from "../middlewares/auth.middleware";
import { currentUserId } from "../current-user";
import { ensureCategories } from "../../../application/use-cases/ensure-categories";
import { parseCategoryInput, parseGroupInput } from "../budget-input";

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

type GroupRow = {
  id: string;
  name: string;
  kind: string;
  targetPercent: number;
  color: string;
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

const serializeGroup = (group: GroupRow) => ({
  id: group.id,
  name: group.name,
  kind: group.kind,
  targetPercent: group.targetPercent,
  color: group.color,
  position: group.position,
});

const isDuplicateName = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";

const DUPLICATE_CATEGORY = "Ya tienes una categoría con ese nombre.";
const DUPLICATE_GROUP = "Ya tienes un grupo con ese nombre.";
const UNKNOWN_GROUP = "`groupId` no corresponde a ningún grupo.";

const findOwnGroup = (userId: string, id: string) =>
  prisma.budgetGroup.findFirst({ where: { id, userId }, select: { id: true } });

const findOwnCategory = (userId: string, id: string) =>
  prisma.category.findFirst({ where: { id, userId }, select: { id: true } });

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
      ...serializeGroup(group),
      categories: group.categories.map(serializeCategory),
    })),
    ungrouped: ungrouped.map(serializeCategory),
  });
});

categoriesRouter.post("/categories", async (req: Request, res: Response) => {
  const parsed = parseCategoryInput(req.body, "create");
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const { name, color, groupId, monthlyLimit } = parsed.value;

  if (groupId && !(await findOwnGroup(userId, groupId))) {
    return res.status(400).json({ error: UNKNOWN_GROUP });
  }

  const position = await prisma.category.count({ where: { userId } });

  try {
    const category = await prisma.category.create({
      data: {
        userId,
        position,
        name: name!,
        color: color!,
        groupId: groupId ?? null,
        monthlyLimit: monthlyLimit ?? null,
      },
    });
    res.status(201).json(serializeCategory(category));
  } catch (error) {
    if (isDuplicateName(error)) return res.status(409).json({ error: DUPLICATE_CATEGORY });
    throw error;
  }
});

categoriesRouter.patch("/categories/:id", async (req: Request, res: Response) => {
  const parsed = parseCategoryInput(req.body, "update");
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const id = String(req.params.id);

  if (!(await findOwnCategory(userId, id))) {
    return res.status(404).json({ error: "Categoría no encontrada." });
  }
  if (parsed.value.groupId && !(await findOwnGroup(userId, parsed.value.groupId))) {
    return res.status(400).json({ error: UNKNOWN_GROUP });
  }

  try {
    const category = await prisma.category.update({ where: { id }, data: parsed.value });
    res.json(serializeCategory(category));
  } catch (error) {
    if (isDuplicateName(error)) return res.status(409).json({ error: DUPLICATE_CATEGORY });
    throw error;
  }
});

categoriesRouter.post("/budget-groups", async (req: Request, res: Response) => {
  const parsed = parseGroupInput(req.body, "create");
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const { name, kind, targetPercent, color } = parsed.value;
  const position = await prisma.budgetGroup.count({ where: { userId } });

  try {
    const group = await prisma.budgetGroup.create({
      data: { userId, position, name: name!, kind: kind!, targetPercent: targetPercent!, color: color! },
    });
    res.status(201).json(serializeGroup(group));
  } catch (error) {
    if (isDuplicateName(error)) return res.status(409).json({ error: DUPLICATE_GROUP });
    throw error;
  }
});

categoriesRouter.patch("/budget-groups/:id", async (req: Request, res: Response) => {
  const parsed = parseGroupInput(req.body, "update");
  if (!parsed.ok) return res.status(400).json({ error: parsed.error });

  const userId = currentUserId(req);
  const id = String(req.params.id);

  if (!(await findOwnGroup(userId, id))) {
    return res.status(404).json({ error: "Grupo no encontrado." });
  }

  try {
    const group = await prisma.budgetGroup.update({ where: { id }, data: parsed.value });
    res.json(serializeGroup(group));
  } catch (error) {
    if (isDuplicateName(error)) return res.status(409).json({ error: DUPLICATE_GROUP });
    throw error;
  }
});

categoriesRouter.delete("/budget-groups/:id", async (req: Request, res: Response) => {
  const userId = currentUserId(req);
  const id = String(req.params.id);

  if (!(await findOwnGroup(userId, id))) {
    return res.status(404).json({ error: "Grupo no encontrado." });
  }

  await prisma.budgetGroup.delete({ where: { id } });
  res.status(204).end();
});
