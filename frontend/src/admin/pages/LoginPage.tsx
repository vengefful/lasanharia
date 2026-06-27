import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { adminApi, AdminApiError } from '../api';
import { useAdminAuth } from '../auth';

type LocationState = { from?: string };

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = useAdminAuth((s) => s.token);
  const login = useAdminAuth((s) => s.login);

  const [email, setEmail] = useState('admin@admin.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Já logado? volta para onde estava (ou /admin/summary).
  if (token) {
    const from = (location.state as LocationState | null)?.from ?? '/admin/summary';
    return <Navigate to={from} replace />;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const resp = await adminApi.login(email.trim(), password);
      login(resp.token, resp.admin.email);
      const from = (location.state as LocationState | null)?.from ?? '/admin/summary';
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof AdminApiError) setError(err.message);
      else setError('Não consegui entrar. Tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-full place-items-center bg-cream-50 px-4 py-10">
      <div className="card w-full max-w-sm p-6">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-tomato-600 text-white">
            🍝
          </span>
          <div>
            <h1 className="text-xl font-bold">Painel Lasanharia</h1>
            <p className="text-xs text-stone-500">Entrar como administrador</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div>
            <label className="text-sm font-medium text-stone-700">E-mail</label>
            <input
              required
              type="email"
              className="input mt-1"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-stone-700">Senha</label>
            <input
              required
              type="password"
              className="input mt-1"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-tomato-50 px-3 py-2 text-sm text-tomato-700 ring-1 ring-tomato-100">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary mt-2 w-full">
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
}
