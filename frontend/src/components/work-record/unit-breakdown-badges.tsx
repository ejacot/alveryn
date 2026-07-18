import { i18n } from "../../i18n";

export type UnitBreakdownBadgeItem = {
  id?: string;
  label: string;
  quantity: string;
  displayOrder?: number | null;
};

type Props = {
  items: UnitBreakdownBadgeItem[];
};

export function UnitBreakdownBadges({ items }: Props) {
  const sortedItems = items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftOrder = left.item.displayOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.item.displayOrder ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.index - right.index;
    })
    .map(({ item }) => item);

  if (!sortedItems.length) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      {sortedItems.map((unit) => (
        <span
          key={`${unit.id ?? unit.label}-${unit.quantity}`}
          className="inline-flex items-center gap-2 rounded-full bg-white/[0.055] px-2.5 py-1.5 text-sm font-semibold tracking-[-0.03em] text-white"
          aria-label={`${unit.label} ${unit.quantity}`}
          title={unit.label}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.12] text-[0.68rem] font-semibold text-white/78">
            {getUnitInitial(unit.label)}
          </span>
          <span>{unit.quantity}</span>
        </span>
      ))}
    </div>
  );
}

function getUnitInitial(name: string) {
  const firstLetter = name.trim().charAt(0);
  return firstLetter ? firstLetter.toLocaleUpperCase(i18n.resolvedLanguage) : "?";
}
