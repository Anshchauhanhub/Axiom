import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Home } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="flex-1 flex items-center justify-center min-h-[80vh] px-4 animate-in fade-in duration-700">
      <div className="max-w-xl w-full text-center relative">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>
        
        <div className="mb-8 flex justify-center">
          <div className="w-24 h-24 rounded-[2rem] bg-surface-container border border-outline-variant/10 flex items-center justify-center shadow-2xl relative">
            <AlertTriangle className="w-12 h-12 text-primary absolute" />
            <div className="w-12 h-12 text-primary animate-ping absolute opacity-20">
               <AlertTriangle className="w-full h-full" />
            </div>
          </div>
        </div>

        <h1 className="text-8xl sm:text-9xl font-black font-headline text-on-surface mb-2 tracking-tighter">404</h1>
        
        <div className="flex items-center justify-center gap-4 mb-6">
          <div className="h-[1px] w-12 bg-primary/30"></div>
          <h2 className="text-[10px] sm:text-xs font-label uppercase tracking-[0.4em] text-primary font-bold">
            Neural Pathway Disconnected
          </h2>
          <div className="h-[1px] w-12 bg-primary/30"></div>
        </div>
        
        <p className="text-sm sm:text-base text-on-surface-variant leading-relaxed mb-10 max-w-md mx-auto">
          The node you are attempting to access does not exist or has been archived. Please recalibrate your navigation coordinates.
        </p>
        
        <Link 
          to="/" 
          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-primary text-on-primary-container font-label font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all group"
        >
          <Home className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
          Return to Hub
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
