import type { Store } from '../types';

type Props = {
  store: Store;
};

export function Header({ store }: Props) {
  return (
    <header className="relative overflow-hidden bg-gradient-to-br from-tomato-600 via-tomato-500 to-ember-500 text-white">
      <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,white,transparent_40%),radial-gradient(circle_at_80%_60%,white,transparent_40%)]" />
      <div className="relative px-5 pb-6 pt-7 sm:px-8 sm:pt-9">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-tomato-100/90">Cardápio</p>
            <h1 className="mt-1 text-3xl font-bold leading-tight sm:text-4xl">{store.storeName}</h1>
            <p className="mt-1 text-sm text-tomato-50/90">{store.address}</p>
          </div>
          <StatusPill isOpen={store.isOpen} />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:max-w-md">
          <InfoChip
            icon="⏱"
            label="Preparo"
            value={store.preparationTime}
          />
          <InfoChip
            icon="💳"
            label="Pagamento"
            value="Pix · Cartão · Dinheiro"
          />
        </div>

        {store.announcement && (
          <div className="mt-4 rounded-xl bg-white/15 px-4 py-3 text-sm leading-relaxed backdrop-blur">
            <span className="mr-1.5">📣</span>
            {store.announcement}
          </div>
        )}
      </div>
    </header>
  );
}

function StatusPill({ isOpen }: { isOpen: boolean }) {
  return (
    <span
      className={`badge px-3 py-1 text-sm font-semibold backdrop-blur ${
        isOpen ? 'bg-emerald-500/95 text-white' : 'bg-stone-900/70 text-white'
      }`}
    >
      <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${isOpen ? 'bg-white' : 'bg-stone-300'}`} />
      {isOpen ? 'Aberto' : 'Fechado'}
    </span>
  );
}

function InfoChip({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-tomato-50/80">
        <span>{icon}</span>
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-medium leading-snug">{value}</div>
    </div>
  );
}
