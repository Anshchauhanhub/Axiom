import React from 'react';
import { Link } from 'react-router-dom';

const TopNav = () => {
  return (
    <nav className="fixed top-0 w-full z-50 bg-[#131315]/80 backdrop-blur-xl flex justify-between items-center px-6 h-16 w-full">
      <div className="text-xl font-black tracking-tighter text-[#e5e1e4] uppercase font-headline lg:hidden">
        AXIOM AI
      </div>
      <div className="flex items-center gap-6">
        <div className="hidden md:flex gap-8 items-center">
          <Link className="text-[#adc6ff] font-bold font-headline hover:text-[#4cd7f6] transition-colors duration-300" to="/onboarding">Onboarding</Link>
          <a className="text-[#353437] font-headline hover:text-[#4cd7f6] transition-colors duration-300" href="#">Docs</a>
        </div>
        <div className="flex items-center gap-4 text-[#adc6ff]">
          <span className="material-symbols-outlined cursor-pointer active:scale-95 transition-transform">notifications</span>
          <span className="material-symbols-outlined cursor-pointer active:scale-95 transition-transform">bolt</span>
        </div>
      </div>
    </nav>
  );
};

export default TopNav;
