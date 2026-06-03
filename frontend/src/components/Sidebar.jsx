import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SettingsModal from './SettingsModal';

import { PanelLeftClose, Menu, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

const Sidebar = ({ isCollapsed, toggleCollapse }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const menuRef = useRef(null);

  // Close mobile sidebar on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isMobileOpen]);

  const navItems = [
    { name: 'Home', icon: 'home', path: '/dashboard' },
    { name: 'Onboarding', icon: 'person_add', path: '/onboarding' },
    { name: 'Study', icon: 'school', path: '/study' },
    { name: 'Calendar', icon: 'calendar_month', path: '/calendar' },
  ];

  const isActive = (path) => location.pathname === path;

  // Shared nav link renderer
  const renderNavLinks = (isMobile = false) => (
    <nav className={`flex-1 space-y-1.5 w-full ${isMobile ? 'px-2' : ''}`}>
      {navItems.map((item) => (
        <Link
          key={item.name}
          to={item.path}
          title={isCollapsed && !isMobile ? item.name : undefined}
          className={`flex items-center transition-all duration-300 rounded-xl ${
            isCollapsed && !isMobile ? 'justify-center p-3' : 'gap-3.5 px-4 py-3.5'
          } ${isActive(item.path)
            ? 'text-white border-l-2 border-primary bg-gradient-to-r from-primary/10 to-transparent'
            : 'text-white/60 hover:bg-white/5 hover:text-white active:bg-white/10'
          }`}
        >
          <span className="material-symbols-outlined text-xl">{item.icon}</span>
          {(isMobile || !isCollapsed) && (
            <span className="font-['Space_Grotesk'] uppercase tracking-widest text-sm">{item.name}</span>
          )}
        </Link>
      ))}
    </nav>
  );

  // Shared profile / auth section
  const renderProfileSection = (isMobile = false) => (
    <div className={`mt-auto space-y-6 w-full ${isCollapsed && !isMobile ? 'px-0' : 'px-4'}`} ref={isMobile ? undefined : menuRef}>
      {user ? (
        <div className="relative">
          <button 
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className={`flex w-full items-center p-2 rounded-xl hover:bg-[#1c1b1d] active:bg-[#252527] transition-colors ${isCollapsed && !isMobile ? 'justify-center' : 'gap-3'}`}
          >
            <div className="w-10 h-10 shrink-0 rounded-full border border-outline-variant/30 bg-surface-container flex items-center justify-center overflow-hidden">
              {user.profile_image_url ? (
                <img src={user.profile_image_url.startsWith('http') ? user.profile_image_url : `${API_BASE}${user.profile_image_url}`} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs font-bold text-white">{user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}</span>
              )}
            </div>
            {(isMobile || !isCollapsed) && (
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
                    setIsMobileOpen(false);
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
                    setIsMobileOpen(false);
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
          title={isCollapsed && !isMobile ? "Login" : undefined}
          className={`w-full py-3 bg-primary-container/20 text-primary border border-primary/20 rounded-lg font-label text-[10px] font-bold tracking-[0.2em] hover:bg-primary-container hover:text-on-primary-container transition-all uppercase block text-center flex items-center justify-center ${isCollapsed && !isMobile ? 'px-0' : ''}`}
        >
          {isCollapsed && !isMobile ? <span className="material-symbols-outlined">login</span> : 'LOGIN / REGISTER'}
        </Link>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Hamburger Button (top-left) */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-[60] w-11 h-11 rounded-xl bg-[#131315]/90 backdrop-blur-lg border border-white/10 flex items-center justify-center text-white/80 hover:text-white active:scale-95 transition-all shadow-lg"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Mobile Slide-out Sidebar Drawer */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[70]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setIsMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-[280px] bg-[#0e0e10] border-r border-white/5 flex flex-col py-6 px-3 shadow-2xl animate-in slide-in-from-left duration-300 pt-safe">
            {/* Close button */}
            <div className="flex items-center justify-between px-2 mb-6">
              <Link to="/" className="group flex items-center" onClick={() => setIsMobileOpen(false)}>
                <img
                  src="/logo.png"
                  alt="Axiom Logo"
                  className="w-16 h-auto object-contain drop-shadow-[0_0_25px_rgba(253,184,19,0.5)]"
                />
              </Link>
              <button
                onClick={() => setIsMobileOpen(false)}
                className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:bg-white/10 transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
            </div>

            {renderNavLinks(true)}
            {renderProfileSection(true)}
          </aside>
        </div>
      )}

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

        {renderNavLinks(false)}
        {renderProfileSection(false)}
      </aside>

      {/* Settings Modal */}
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};

export default Sidebar;
