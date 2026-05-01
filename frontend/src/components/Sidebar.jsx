import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { name: 'Home', icon: 'home', path: '/' },
    { name: 'Social Feed', icon: 'public', path: '/social' },
    { name: 'Onboarding', icon: 'person_add', path: '/onboarding' },
    { name: 'Study', icon: 'menu_book', path: '/study' },
    { name: 'Settings', icon: 'settings', path: '/settings' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Desktop SideNavBar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-[#0e0e10] py-8 px-4 shadow-[40px_0_60px_-10px_rgba(77,142,255,0.05)] z-40">
        <div className="mb-10 px-2 flex items-center justify-center">
          <img src="/logo.png" alt="Axiom Logo" className="w-56 h-auto object-contain drop-shadow-[0_0_25px_rgba(253,184,19,0.5)]" />
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-300 ${isActive(item.path)
                  ? 'text-primary border-r-2 border-secondary bg-gradient-to-r from-primary/10 to-transparent'
                  : 'text-[#353437] hover:bg-[#1c1b1d] hover:text-[#e5e1e4]'
                }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              <span className="font-['Space_Grotesk'] uppercase tracking-widest text-xs">{item.name}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-auto px-4 space-y-6">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full border border-outline-variant/30 bg-surface-container flex items-center justify-center overflow-hidden">
                {user.profile_image_url ? (
                  <img src={user.profile_image_url.startsWith('http') ? user.profile_image_url : `${API_BASE}${user.profile_image_url}`} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-primary text-lg">person</span>
                )}
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-on-surface truncate pr-2">{user.full_name || user.email.split('@')[0]}</span>
                <button onClick={logout} className="text-[10px] text-error font-label uppercase text-left hover:underline w-fit mt-0.5">Logout</button>
              </div>
            </div>
          ) : (
            <Link
              to="/onboarding"
              className="w-full py-3 bg-primary-container/20 text-primary border border-primary/20 rounded-lg font-label text-[10px] font-bold tracking-[0.2em] hover:bg-primary-container hover:text-on-primary-container transition-all uppercase block text-center"
            >
              LOGIN / REGISTER
            </Link>
          )}
        </div>
      </aside>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-2 pb-safe pt-2 bg-[#131315]/95 backdrop-blur-xl border-t border-[#353437]/20 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        {navItems.filter(item => ['Home', 'Social Feed', 'Study', 'Settings'].includes(item.name)).map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`flex flex-col items-center justify-center py-2 px-1 transition-all duration-300 relative group ${isActive(item.path) ? 'text-primary' : 'text-[#8c909f]'
              }`}
          >
            <div className={`mb-1 p-1.5 rounded-xl transition-all duration-300 ${isActive(item.path) ? 'bg-primary/10 scale-110' : 'group-hover:bg-[#1c1b1d]'}`}>
              <span className={`material-symbols-outlined text-[24px] ${isActive(item.path) ? 'fill-1' : ''}`}>{item.icon}</span>
            </div>
            <span className="font-['Space_Grotesk'] text-[9px] uppercase font-bold tracking-[0.1em]">{item.name === 'Social Feed' ? 'Social' : item.name}</span>
            {isActive(item.path) && (
              <div className="absolute -top-2 w-1 h-1 bg-primary rounded-full shadow-[0_0_10px_#fdb813]"></div>
            )}
          </Link>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
