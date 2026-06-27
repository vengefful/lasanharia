import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from './auth';

/** Guard de rotas /admin/*. Sem token → /admin/login. */
export function RequireAdminAuth() {
  const token = useAdminAuth((s) => s.token);
  const location = useLocation();
  if (!token) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
