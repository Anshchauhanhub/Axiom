import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SettingsModal from './SettingsModal';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

const Sidebar = ({ isCollapsed, toggleCollapse }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navItems = [
    { name: 'Home', icon: 'home', path: '/dashboard' },
    { name: 'Onboarding', icon: 'person_add', path: '/onboarding' },
    { name: 'Study', icon: 'school', path: '/study' },
    { name: 'Calendar', icon: 'calendar_month', path: '/calendar' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <>
      {/* Desktop SideNavBar */}
      <aside className={`hidden lg:flex flex-col fixed left-0 top-0 h-full transition-all duration-300 bg-[#0e0e10] py-8 px-4 shadow-[40px_0_60px_-10px_rgba(77,142,255,0.05)] z-40 ${isCollapsed ? 'w-20 items-center px-2' : 'w-56'}`}>
        
        {/* Header / Logo */}
        <div className={`mb-8 px-2 flex ${isCollapsed ? 'flex-col items-center pt-2' : 'items-center justify-between'}`}>
          {isCollapsed ? (
            <button onClick={toggleCollapse} className="group flex justify-center cursor-pointer">
              <img
                src="/logo.png"
                alt="Axiom Logo"
                className="w-10 h-auto object-contain drop-shadow-[0_0_25px_rgba(253,184,19,0.5)] transition-all duration-500 group-hover:scale-110"
              />
            </button>
          ) : (
            <>
              <Link to="/" className="group flex justify-center">
                <img
                  src="/logo.png"
                  alt="Axiom Logo"
                  className="w-20 h-auto object-contain drop-shadow-[0_0_25px_rgba(253,184,19,0.5)] transition-all duration-500 group-hover:scale-110"
                />
              </Link>
              <button 
                onClick={toggleCollapse} 
                className="text-white/60 hover:text-white hover:bg-[#1c1b1d] p-1.5 rounded-lg transition-colors -mr-2"
              >
                <PanelLeftClose size={20} />
              </button>
            </>
          )}
        </div>

        <nav className="flex-1 space-y-2 w-full">
          {navItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center transition-all duration-300 rounded-lg ${isCollapsed ? 'justify-center p-3' : 'gap-3 px-4 py-3'} ${isActive(item.path)
                ? 'text-white border-r-2 border-white bg-gradient-to-r from-white/10 to-transparent'
                : 'text-white/60 hover:bg-[#1c1b1d] hover:text-white'
                }`}
            >
              <span className="material-symbols-outlined text-xl">{item.icon}</span>
              {!isCollapsed && <span className="font-['Space_Grotesk'] uppercase tracking-widest text-sm">{item.name}</span>}
            </Link>
          ))}
        </nav>
        <div className={`mt-auto space-y-6 w-full ${isCollapsed ? 'px-0' : 'px-4'}`} ref={menuRef}>
          {user ? (
            <div className="relative">
              <button 
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className={`flex w-full items-center p-2 rounded-xl hover:bg-[#1c1b1d] transition-colors ${isCollapsed ? 'justify-center' : 'gap-3'}`}
              >
                <div className="w-10 h-10 shrink-0 rounded-full border border-outline-variant/30 bg-surface-container flex items-center justify-center overflow-hidden">
                  {user.profile_image_url ? (
                    <img src={user.profile_image_url.startsWith('http') ? user.profile_image_url : `${API_BASE}${user.profile_image_url}`} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-white">{user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}</span>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col min-w-0 text-left">
                    <span className="text-xs font-bold text-on-surface truncate pr-2">{user.full_name || user.email.split('@')[0]}</span>
                    <span className="text-[10px] text-on-surface-variant font-label uppercase truncate">Personal Workspace</span>
                  </div>
                )}
              </button>

              {/* Profile Menu Popup */}
              {isProfileMenuOpen && (
                <div className="absolute bottom-[calc(100%+10px)] left-2 w-64 bg-[#1c1b1d] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 py-2">
                  <div className="px-4 py-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full border border-white/10 bg-surface-container flex items-center justify-center shrink-0 overflow-hidden">
                      {user.profile_image_url ? (
                        <img src={user.profile_image_url.startsWith('http') ? user.profile_image_url : `${API_BASE}${user.profile_image_url}`} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-white">{user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-white truncate">{user.full_name || user.email.split('@')[0]}</span>
                      <span className="text-[10px] text-white/60 truncate uppercase tracking-wider">{user.email}</span>
                    </div>
                  </div>
                  
                  <div className="px-2 pt-2">
                    <div className="h-px bg-white/10 w-full mb-2"></div>
                    <button 
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsSettingsOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">settings</span>
                      Settings
                    </button>
                  </div>

                  <div className="px-2">
                    <div className="h-px bg-white/10 w-full my-2"></div>
                    <button 
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-sm text-error/80 hover:text-error hover:bg-error/10 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">logout</span>
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              to="/login"
              title={isCollapsed ? "Login" : undefined}
              className={`w-full py-3 bg-primary-container/20 text-primary border border-primary/20 rounded-lg font-label text-[10px] font-bold tracking-[0.2em] hover:bg-primary-container hover:text-on-primary-container transition-all uppercase block text-center flex items-center justify-center ${isCollapsed ? 'px-0' : ''}`}
            >
              {isCollapsed ? <span className="material-symbols-outlined">login</span> : 'LOGIN / REGISTER'}
            </Link>
          )}
        </div>
      </aside>

      {/* BottomNavBar (Mobile Only) */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-1 pb-safe pt-1.5 bg-[#131315]/95 backdrop-blur-xl border-t border-[#353437]/20 shadow-[0_-10px_40px_rgba(0,0,0,0.4)]">
        {navItems.filter(item => ['Home', 'Onboarding', 'Study', 'Calendar'].includes(item.name)).map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`flex flex-col items-center justify-center py-1.5 px-2 min-w-[60px] transition-all duration-300 relative group ${isActive(item.path) ? 'text-white' : 'text-white/60'
              }`}
          >
            <div className={`mb-0.5 p-1 rounded-lg transition-all duration-300 ${isActive(item.path) ? 'bg-primary/10 scale-110' : 'group-hover:bg-[#1c1b1d]'}`}>
              <span className={`material-symbols-outlined text-[20px] ${isActive(item.path) ? 'fill-1' : ''}`}>{item.icon}</span>
            </div>
            <span className="font-['Space_Grotesk'] text-[10px] uppercase font-bold tracking-[0.05em]">{item.name}</span>
            {isActive(item.path) && (
              <div className="absolute -top-1 w-1 h-1 bg-white rounded-full shadow-[0_0_10px_#ffffff]"></div>
            )}
          </Link>
        ))}
      </nav>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};

export default Sidebar;
