/** Items whose window contains `now` (`startsAt <= now < endsAt`): under way right now, not just planned for today. */
export const activeNow = <T extends { startsAt: string; endsAt: string }>(items: readonly T[], now = Date.now()): T[] =>
  items.filter((i) => Date.parse(i.startsAt) <= now && now < Date.parse(i.endsAt));
