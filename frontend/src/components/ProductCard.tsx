import type { Product } from '../types';
import { formatMoney } from '../lib/format';
import { useCart } from '../store/cart';

type Props = {
  product: Product;
  disabled?: boolean;
};

export function ProductCard({ product, disabled }: Props) {
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.find((i) => i.productId === product.id)?.quantity ?? 0);
  const blocked = disabled || !product.available;

  return (
    <article className={`card relative flex gap-4 p-4 ${blocked ? 'opacity-70' : ''}`}>
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-24 w-24 shrink-0 rounded-xl object-cover ring-1 ring-stone-200"
          loading="lazy"
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-cream-100 text-3xl ring-1 ring-stone-200">
          🍝
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <h3 className="text-base font-bold leading-snug text-stone-900">{product.name}</h3>
          {product.featured && (
            <span className="badge bg-amber-100 text-amber-800">⭐ favorito</span>
          )}
        </div>
        <p className="mt-1 line-clamp-2 text-sm text-stone-600">{product.description}</p>

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <span className="text-lg font-bold text-tomato-700">{formatMoney(product.price)}</span>
          {product.available ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => add(product, 1)}
              className="btn-primary px-4 py-2 text-sm"
              aria-label={`Adicionar ${product.name} ao carrinho`}
            >
              {inCart > 0 ? `+1  (${inCart})` : 'Adicionar'}
            </button>
          ) : (
            <span className="badge bg-stone-200 text-stone-700">indisponível</span>
          )}
        </div>
      </div>
    </article>
  );
}
