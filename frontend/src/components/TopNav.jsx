import React from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const TopNav = () => {
  const { user } = useAuth();

  if (!user) return null;

  return createPortal(
    <div className="fixed top-6 right-6 z-[9999]">
      <Link 
        to="/notifications" 
        className="flex items-center justify-center p-3.5 bg-surface-container-low/60 backdrop-blur-3xl border border-outline-variant/20 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.5)] hover:bg-surface-container-low transition-all active:scale-90 group relative pointer-events-auto"
      >
        <span className="material-symbols-outlined text-primary text-[28px] neural-glow">notifications</span>
        <div className="absolute top-3.5 right-3.5 w-3 h-3 bg-error rounded-full border-2 border-[#0e0e10] animate-pulse shadow-[0_0_15px_rgba(255,59,48,0.5)]"></div>
      </Link>
    </div>,
    document.body
  );
};

export default TopNav;
