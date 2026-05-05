import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50 flex items-center justify-between px-6 py-3 mx-4 mt-4 rounded-xl">
        <div className="flex items-center gap-6">
          <h1 className="text-lg font-semibold tracking-tight">
            <span className="text-accent">FPV</span> Trackside DVR
          </h1>
          <nav className="flex gap-1">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-surface-active text-text-primary' : 'text-text-secondary hover:text-text-primary'}`
              }
            >
              Events
            </NavLink>
            <NavLink
              to="/audit"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-surface-active text-text-primary' : 'text-text-secondary hover:text-text-primary'}`
              }
            >
              Audit Log
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-surface-active text-text-primary' : 'text-text-secondary hover:text-text-primary'}`
              }
            >
              Settings
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {user && (
            <>
              <span className="text-sm text-text-secondary">{user.name}</span>
              <button
                onClick={handleLogout}
                className="text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
