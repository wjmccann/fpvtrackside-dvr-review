import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store';

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2.5 rounded-lg text-sm transition-colors ${isActive ? 'bg-surface-active text-text-primary' : 'text-text-secondary hover:text-text-primary'}`;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="glass sticky top-0 z-50 mx-2 sm:mx-4 mt-2 sm:mt-4 rounded-xl">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-4">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight">
              <span className="text-accent">FPV</span> Trackside DVR
            </h1>
            <nav className="hidden sm:flex gap-1">
              <NavLink to="/" end className={navLinkClass}>Events</NavLink>
              <NavLink to="/audit" className={navLinkClass}>Audit Log</NavLink>
              <NavLink to="/settings" className={navLinkClass}>Settings</NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <span className="hidden sm:inline text-sm text-text-secondary">{user.name}</span>
            )}
            {user && (
              <button
                onClick={handleLogout}
                className="hidden sm:inline text-sm text-text-muted hover:text-text-primary transition-colors"
              >
                Logout
              </button>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden p-2 -mr-2 text-text-secondary hover:text-text-primary"
              aria-label="Menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="sm:hidden px-4 pb-3 space-y-1" onClick={() => setMenuOpen(false)}>
            <NavLink to="/" end className={navLinkClass}>Events</NavLink>
            <NavLink to="/audit" className={navLinkClass}>Audit Log</NavLink>
            <NavLink to="/settings" className={navLinkClass}>Settings</NavLink>
            {user && (
              <div className="flex items-center justify-between px-4 py-2.5 text-sm text-text-secondary">
                <span>{user.name}</span>
                <button onClick={handleLogout} className="text-text-muted hover:text-text-primary">Logout</button>
              </div>
            )}
          </nav>
        )}
      </header>
      <main className="flex-1 p-2 sm:p-4">
        <Outlet />
      </main>
    </div>
  );
}
