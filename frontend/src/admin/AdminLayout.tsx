import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdminAuth } from './auth';

const TABS: { to: string; label: string }[] = [
  { to: '/admin/summary', label: 'Resumo' },
  { to: '/admin/orders', label: 'Pedidos' },
  { to: '/admin/customers', label: 'Clientes' },
  { to: '/admin/loyalty', label: 'Fidelidade' },
  { to: '/admin/products', label: 'Produtos' },
  { to: '/admin/categories', label: 'Categorias' },
  { to: '/admin/store', label: 'Loja' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const email = useAdminAuth((s) => s.email);
  const logout = useAdminAuth((s) => s.logout);

  function handleLogout() {
    logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-full bg-stone-100">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-tomato-600 text-white">
              🍝
            </span>
            <span className="text-sm font-bold uppercase tracking-wider text-stone-500">Admin</span>
          </div>
          <nav className="-mx-2 ml-2 flex flex-1 items-center gap-1 overflow-x-auto px-2">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-tomato-600 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <span className="hidden text-stone-500 sm:inline">{email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-200"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
