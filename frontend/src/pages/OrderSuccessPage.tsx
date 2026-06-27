import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

type LastOrder = { orderNumber: number; url: string; message: string };

export function OrderSuccessPage() {
  const { orderNumber } = useParams<{ orderNumber: string }>();
  const [last, setLast] = useState<LastOrder | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('lasanharia-last-order');
    if (!raw) return;
    try {
      setLast(JSON.parse(raw) as LastOrder);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="mx-auto min-h-full max-w-2xl bg-cream-50 px-5 pb-12 pt-10 text-center sm:px-8">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-4xl">
        ✅
      </div>
      <h1 className="mt-5 text-3xl font-bold">Pedido #{orderNumber} enviado</h1>
      <p className="mt-2 text-stone-600">
        Abrimos o WhatsApp da loja com a mensagem pronta. Confirme por lá para a gente começar a
        preparar.
      </p>

      {last && last.url && (
        <a href={last.url} target="_blank" rel="noopener" className="btn-primary mx-auto mt-6 inline-flex">
          Abrir WhatsApp de novo
        </a>
      )}

      {last?.message && (
        <details className="card mx-auto mt-6 max-w-md p-4 text-left">
          <summary className="cursor-pointer text-sm font-semibold text-stone-700">
            Ver mensagem enviada
          </summary>
          <pre className="mt-3 whitespace-pre-wrap text-sm text-stone-700">{last.message}</pre>
        </details>
      )}

      <Link to="/" className="btn-ghost mt-6 inline-flex">
        Voltar ao cardápio
      </Link>
    </div>
  );
}
