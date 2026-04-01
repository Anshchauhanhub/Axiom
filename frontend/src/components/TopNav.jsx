import React from 'react';
import { Link } from 'react-router-dom';

const TopNav = () => {
  return (
    <nav className="fixed top-0 w-full z-50 bg-[#131315]/80 backdrop-blur-xl flex justify-between items-center px-6 h-16 w-full">
      <div className="flex items-center lg:hidden">
        <img src="/logo.png" alt="Axiom Logo" className="w-48 h-auto object-contain drop-shadow-[0_0_20px_rgba(253,184,19,0.5)]" />
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden md:flex gap-8 items-center">
          <Link className="text-primary font-bold font-headline hover:text-secondary transition-colors duration-300" to="/onboarding">Onboarding</Link>
          <a className="text-[#353437] font-headline hover:text-secondary transition-colors duration-300" href="#">Docs</a>
        </div>
        <div className="flex items-center gap-4 text-primary">
          <span className="material-symbols-outlined cursor-pointer active:scale-95 transition-transform">notifications</span>
          <span className="material-symbols-outlined cursor-pointer active:scale-95 transition-transform">bolt</span>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
