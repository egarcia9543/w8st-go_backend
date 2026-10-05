import prisma from "../../infrastructure/database/prisma";

type DefaultGroup = {
  name: string;
  kind: "SPENDING" | "SAVINGS";
  targetPercent: number;
  color: string;
  categories: { name: string; color: string }[];
};

export const DEFAULT_BUDGET_GROUPS: DefaultGroup[] = [
  {
    name: "Necesidades",
    kind: "SPENDING",
    targetPercent: 50,
    color: "#3b82f6",
    categories: [
      { name: "Vivienda", color: "#2563eb" },
      { name: "Mercado", color: "#16a34a" },
      { name: "Transporte", color: "#0891b2" },
      { name: "Salud", color: "#dc2626" },
      { name: "Educación", color: "#7c3aed" },
      { name: "Deudas", color: "#475569" },
    ],
  },
  {
    name: "Gustos",
    kind: "SPENDING",
    targetPercent: 30,
    color: "#f97316",
    categories: [
      { name: "Comida fuera", color: "#ea580c" },
      { name: "Ocio", color: "#db2777" },
      { name: "Suscripciones", color: "#9333ea" },
      { name: "Compras", color: "#ca8a04" },
      { name: "Otros", color: "#78716c" },
    ],
  },
  {
    name: "Ahorro",
    kind: "SAVINGS",
    targetPercent: 20,
    color: "#10b981",
    categories: [
      { name: "Ahorro", color: "#059669" },
      { name: "Inversión", color: "#0d9488" },
    ],
  },
];

export const ensureCategories = async (userId: string): Promise<void> => {
  const [groups, categories] = await Promise.all([
    prisma.budgetGroup.count({ where: { userId } }),
    prisma.category.count({ where: { userId } }),
  ]);
  if (groups > 0 || categories > 0) return;

  await prisma.budgetGroup.createMany({
    data: DEFAULT_BUDGET_GROUPS.map(({ categories: _, ...group }, position) => ({
      userId,
      position,
      ...group,
    })),
    skipDuplicates: true,
  });

  const created = await prisma.budgetGroup.findMany({
    where: { userId },
    select: { id: true, name: true },
  });
  const groupIdByName = new Map(created.map((group) => [group.name, group.id]));

  let position = 0;
  await prisma.category.createMany({
    data: DEFAULT_BUDGET_GROUPS.flatMap((group) =>
      group.categories.map((category) => ({
        userId,
        position: position++,
        groupId: groupIdByName.get(group.name) ?? null,
        ...category,
      }))
    ),
    skipDuplicates: true,
  });
};
