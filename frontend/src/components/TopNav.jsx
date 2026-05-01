import React from 'react';
import { Link } from 'react-router-dom';

const TopNav = () => {
  return (
    <nav className="fixed top-0 right-0 z-50 flex justify-end items-center px-8 h-20 w-auto pointer-events-none">
      <div className="flex items-center gap-4 pointer-events-auto">
        <Link to="/notifications" className="relative group p-3 bg-surface-container-low/40 backdrop-blur-xl border border-outline-variant/10 rounded-full shadow-2xl hover:bg-surface-container-low transition-all active:scale-90">
          <span className="material-symbols-outlined text-primary text-[24px]">notifications</span>
          <div className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full border-2 border-background animate-pulse"></div>
        </Link>
      </div>
    </nav>
  );
};

export default TopNav;
