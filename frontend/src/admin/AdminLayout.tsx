import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
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
  const { pathname } = useLocation();
  const email = useAdminAuth((s) => s.email);
  const logout = useAdminAuth((s) => s.logout);

  const [menuOpen, setMenuOpen] = useState(false);

  // Fecha o menu sempre que a rota muda (qualquer navegação).
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Rótulo da aba ativa pra mostrar no topbar mobile.
  const activeTab =
    TABS.find((t) => pathname === t.to || pathname.startsWith(t.to + '/'))?.label ?? 'Painel';

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate('/admin/login', { replace: true });
  }

  return (
    <div className="min-h-full bg-stone-100">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6">
          {/* Logo */}
          <div className="flex shrink-0 items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-tomato-600 text-white">
              🍝
            </span>
            <span className="hidden text-sm font-bold uppercase tracking-wider text-stone-500 sm:inline">
              Admin
            </span>
          </div>

          {/* Mobile: rótulo da aba ativa (ocupa o espaço entre logo e hambúrguer) */}
          <div className="min-w-0 flex-1 sm:hidden">
            <span className="block truncate text-base font-semibold text-stone-800">
              {activeTab}
            </span>
          </div>

          {/* Desktop/tablet: barra horizontal de abas */}
          <nav className="-mx-2 ml-2 hidden flex-1 items-center gap-1 overflow-x-auto px-2 sm:flex">
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

          {/* Desktop/tablet: email + Sair à direita */}
          <div className="hidden items-center gap-2 text-sm sm:flex">
            <span className="text-stone-500">{email}</span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-semibold text-stone-700 hover:bg-stone-200"
            >
              Sair
            </button>
          </div>

          {/* Mobile: hambúrguer (vira X quando aberto) */}
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            aria-controls="admin-mobile-menu"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-2xl leading-none text-stone-700 hover:bg-stone-100 sm:hidden"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile: painel do menu (vertical, itens grandes) */}
        {menuOpen && (
          <nav
            id="admin-mobile-menu"
            className="border-t border-stone-200 bg-white sm:hidden"
          >
            <ul className="px-3 py-2">
              {TABS.map((t) => (
                <li key={t.to}>
                  <NavLink
                    to={t.to}
                    className={({ isActive }) =>
                      `flex h-12 items-center rounded-lg px-3 text-base font-semibold transition ${
                        isActive
                          ? 'bg-tomato-600 text-white'
                          : 'text-stone-700 hover:bg-stone-100'
                      }`
                    }
                  >
                    {t.label}
                  </NavLink>
                </li>
              ))}
            </ul>
            <div className="border-t border-stone-100 px-4 py-3">
              <div className="text-xs text-stone-500">Conectada como</div>
              <div className="mt-0.5 text-sm font-medium text-stone-700">{email}</div>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 w-full rounded-lg bg-stone-100 px-3 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-200"
              >
                Sair
              </button>
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
