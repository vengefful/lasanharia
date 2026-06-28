import { useEffect, useRef } from 'react';
import type { Category } from '../types';

type Props = {
  categories: Category[];
  activeId: number | null;
  onChange: (id: number) => void;
};

export function CategoryTabs({ categories, activeId, onChange }: Props) {
  const listRef = useRef<HTMLUListElement>(null);

  // Centraliza horizontalmente a aba ativa SEM mexer no scroll vertical da página
  // (motivo de não usar element.scrollIntoView — em alguns navegadores ele mexe
  // no scroll vertical mesmo com block:'nearest' quando o pai tem overflow).
  useEffect(() => {
    const list = listRef.current;
    if (!list || activeId == null) return;
    const btn = list.querySelector<HTMLElement>(`[data-tab="${activeId}"]`);
    if (!btn) return;
    const target = btn.offsetLeft - list.clientWidth / 2 + btn.clientWidth / 2;
    list.scrollTo({ left: target, behavior: 'smooth' });
  }, [activeId]);

  return (
    <nav className="sticky top-0 z-10 -mx-5 mt-0 border-b border-stone-200/60 bg-cream-50/95 px-5 backdrop-blur sm:-mx-8 sm:px-8">
      <ul
        ref={listRef}
        className="-mx-2 flex gap-1 overflow-x-auto py-2 scrollbar-none"
      >
        {categories.map((c) => {
          const isActive = c.id === activeId;
          return (
            <li key={c.id} className="shrink-0">
              <button
                type="button"
                data-tab={c.id}
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
