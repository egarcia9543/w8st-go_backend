export type Slot = { id: string; tierId: string; position: number };

const groupByTier = (slots: Slot[]): Map<string, string[]> => {
  const tiers = new Map<string, Slot[]>();

  for (const slot of slots) {
    tiers.set(slot.tierId, [...(tiers.get(slot.tierId) ?? []), slot]);
  }

  return new Map(
    [...tiers.entries()].map(([tierId, tierSlots]) => [
      tierId,
      [...tierSlots].sort((a, b) => a.position - b.position).map((slot) => slot.id),
    ])
  );
};

const changedSlots = (original: Slot[], tiers: Map<string, string[]>): Slot[] => {
  const before = new Map(original.map((slot) => [slot.id, slot]));
  const changes: Slot[] = [];

  for (const [tierId, ids] of tiers) {
    ids.forEach((id, position) => {
      const previous = before.get(id);
      if (!previous || previous.tierId !== tierId || previous.position !== position) {
        changes.push({ id, tierId, position });
      }
    });
  }

  return changes;
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const moveItem = (
  slots: Slot[],
  itemId: string,
  toTierId: string,
  toIndex: number
): Slot[] => {
  const item = slots.find((slot) => slot.id === itemId);
  if (!item) throw new Error(`Item ${itemId} is not among the given slots.`);

  const tiers = groupByTier(slots);
  tiers.set(item.tierId, tiers.get(item.tierId)!.filter((id) => id !== itemId));

  const target = tiers.get(toTierId) ?? [];
  target.splice(clamp(Math.trunc(toIndex), 0, target.length), 0, itemId);
  tiers.set(toTierId, target);

  return changedSlots(slots, tiers);
};

export const removeItem = (slots: Slot[], itemId: string): Slot[] => {
  const remaining = slots.filter((slot) => slot.id !== itemId);
  return changedSlots(remaining, groupByTier(remaining));
};
