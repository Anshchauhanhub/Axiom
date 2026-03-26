import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Sidebar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const navItems = [
    { name: 'Home', icon: 'home', path: '/' },
    { name: 'Onboarding', icon: 'person_add', path: '/onboarding' },
    { name: 'Quiz', icon: 'quiz', path: '/quiz' },
    { name: 'Analytics', icon: 'insights', path: '/analytics' },
    { name: 'Settings', icon: 'settings', path: '/settings' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Desktop SideNavBar */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-full w-64 bg-[#0e0e10] py-8 px-4 shadow-[40px_0_60px_-10px_rgba(77,142,255,0.05)] z-40">
        <div className="mb-12 px-4">
          <h2 className="text-[#e5e1e4] font-bold font-headline text-xl tracking-tighter uppercase">AXIOM AI</h2>
        </div>
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 transition-all duration-300 ${
                isActive(item.path)
                  ? 'text-[#adc6ff] border-r-2 border-[#4cd7f6] bg-gradient-to-r from-[#4d8eff]/10 to-transparent'
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
              <div className="w-10 h-10 rounded-full border border-outline-variant/30 bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-lg">person</span>
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-on-surface">{user.email.split('@')[0]}</span>
                <button onClick={logout} className="text-[10px] text-error font-label uppercase text-left hover:underline">Logout</button>
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
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-6 pb-6 pt-3 bg-[#131315]/90 backdrop-blur-lg border-t border-[#353437]/15">
        {navItems.slice(0, 3).map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`flex flex-col items-center justify-center transition-all duration-200 ${
              isActive(item.path) ? 'text-[#4cd7f6] bg-[#201f22] rounded-xl px-4 py-1' : 'text-[#353437]'
            }`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold tracking-widest">{item.name}</span>
          </Link>
        ))}
      </nav>
    </>
  );
};

export default Sidebar;
