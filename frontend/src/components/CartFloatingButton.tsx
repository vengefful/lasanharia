import { Link } from 'react-router-dom';
import { useCart } from '../store/cart';
import { formatMoney } from '../lib/format';

export function CartFloatingButton() {
  const count = useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
  const subtotal = useCart((s) => s.items.reduce((sum, i) => sum + i.price * i.quantity, 0));

  if (count === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-3">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/carrinho"
          className="pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl bg-tomato-600 px-5 py-4 text-white shadow-lg shadow-tomato-600/30 transition active:scale-[0.99]"
        >
          <span className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white/20 text-sm font-bold">
              {count}
            </span>
            <span className="font-semibold">Ver carrinho</span>
          </span>
          <span className="text-base font-bold tabular-nums">{formatMoney(subtotal)}</span>
        </Link>
      </div>
    </div>
  );
}
