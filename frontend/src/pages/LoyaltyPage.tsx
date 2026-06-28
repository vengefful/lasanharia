import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import type { LoyaltyInfo } from '../types';

const REWARD_THRESHOLD = 10;

export function LoyaltyPage() {
  const [phone, setPhone] = useState('');
  const [info, setInfo] = useState<LoyaltyInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Busca com debounce ao digitar; só quando o telefone tem pelo menos 8 dígitos.
  useEffect(() => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) {
      setInfo(null);
      setError(null);
      return;
    }
    setLoading(true);
    const handle = setTimeout(() => {
      api
        .getLoyalty(digits)
        .then((data) => {
          setInfo(data);
          setError(null);
        })
        .catch((err: Error) => {
          setInfo(null);
          setError(err instanceof ApiError ? err.message : 'Não consegui consultar agora.');
        })
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(handle);
  }, [phone]);

  return (
    <div className="mx-auto min-h-full max-w-md bg-cream-50 px-5 pb-12 pt-6 sm:px-8">
      <div className="flex items-center gap-2">
        <Link
          to="/"
          className="grid h-10 w-10 place-items-center rounded-full bg-white ring-1 ring-stone-200"
        >
          ←
        </Link>
        <h1 className="text-2xl font-bold">🍒 Meus pontos</h1>
      </div>

      <p className="mt-2 text-sm text-stone-600">
        A cada <strong>10 lasanhas</strong>, ganhe <strong>1 grátis</strong>. Digite seu
        telefone para ver seu saldo.
      </p>

      <div className="card mt-5 p-5">
        <label className="text-sm font-medium text-stone-700">Seu telefone</label>
        <input
          autoFocus
          type="tel"
          inputMode="tel"
          className="input mt-1"
          placeholder="(82) 99141-3741"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        {phone.replace(/\D/g, '').length > 0 &&
          phone.replace(/\D/g, '').length < 8 && (
            <p className="mt-2 text-xs text-stone-500">
              Digite o telefone completo com DDD.
            </p>
          )}

        {loading && <p className="mt-4 text-sm text-stone-500">Buscando…</p>}

        {error && (
          <p className="mt-4 rounded-lg bg-tomato-50 px-3 py-2 text-sm text-tomato-700 ring-1 ring-tomato-100">
            {error}
          </p>
        )}

        {!loading && !error && info && info.exists === false && (
          <div className="mt-4 rounded-xl bg-cream-100 p-4 text-sm text-stone-700">
            <div className="font-semibold">Ainda não está no programa.</div>
            <p className="mt-1">
              Faça seu primeiro pedido pelo cardápio e marque "Quero acumular" no checkout —
              você é cadastrado automaticamente e começa a juntar pontos a cada lasanha
              entregue.
            </p>
            <Link to="/" className="btn-primary mt-3 inline-flex px-4 py-2 text-sm">
              Ver cardápio
            </Link>
          </div>
        )}

        {!loading && !error && info && info.exists === true && (
          <ResultCard info={info} />
        )}
      </div>

      <div className="mt-4 text-center text-xs text-stone-500">
        Pontos creditados <strong>após a entrega</strong> do pedido. Cancelamento estorna.
      </div>
    </div>
  );
}

function ResultCard({ info }: { info: Extract<LoyaltyInfo, { exists: true }> }) {
  const toNext = REWARD_THRESHOLD - (info.points % REWARD_THRESHOLD);
  const progress = ((info.points % REWARD_THRESHOLD) / REWARD_THRESHOLD) * 100;

  return (
    <div className="mt-4 grid gap-4">
      <div className="rounded-2xl bg-gradient-to-br from-tomato-600 to-ember-500 p-5 text-white shadow-soft">
        <div className="text-xs uppercase tracking-widest text-tomato-100/90">Olá,</div>
        <div className="text-xl font-bold">{info.name}</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-tomato-100/80">Saldo</div>
            <div className="text-3xl font-bold tabular-nums">{info.points}</div>
            <div className="text-xs text-tomato-100/80">pontos</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-tomato-100/80">Disponíveis</div>
            <div className="text-3xl font-bold tabular-nums">{info.rewardsAvailable}</div>
            <div className="text-xs text-tomato-100/80">
              lasanha{info.rewardsAvailable === 1 ? '' : 's'} grátis
            </div>
          </div>
        </div>
      </div>

      {info.rewardsAvailable >= 1 ? (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-100">
          🎁 Você já pode resgatar! No próximo pedido, marque <strong>"Usar 1 lasanha grátis"</strong>.
        </div>
      ) : (
        <div>
          <div className="flex justify-between text-xs text-stone-600">
            <span>Próxima recompensa</span>
            <span className="tabular-nums">faltam {toNext} pts</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-cream-100">
            <div
              className="h-full bg-tomato-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="text-xs text-stone-500">
        Total acumulado no histórico:{' '}
        <span className="font-semibold tabular-nums">{info.totalEarned}</span> pontos.
      </div>

      <Link to="/" className="btn-primary inline-flex justify-center">
        Ver cardápio
      </Link>
    </div>
  );
}
