import type { Category } from '../types';

type Props = {
  categories: Category[];
  activeId: number | null;
  onChange: (id: number) => void;
};

export function CategoryTabs({ categories, activeId, onChange }: Props) {
  return (
    <nav className="sticky top-0 z-10 -mx-5 mt-0 border-b border-stone-200/60 bg-cream-50/95 px-5 backdrop-blur sm:-mx-8 sm:px-8">
      <ul className="-mx-2 flex gap-1 overflow-x-auto py-2 scrollbar-none">
        {categories.map((c) => {
          const isActive = c.id === activeId;
          return (
            <li key={c.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onChange(c.id)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-tomato-600 text-white shadow-soft'
                    : 'bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-cream-100'
                }`}
              >
                {c.name}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
