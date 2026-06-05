import React, { useState, useEffect } from 'react';

const OfflineBanner = () => {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-background/80 backdrop-blur-sm flex items-center justify-center p-6 text-center animate-in fade-in duration-300">
      <div className="max-w-md w-full bg-surface-container-high p-8 rounded-3xl border border-error/20 shadow-2xl">
        <span className="material-symbols-outlined text-5xl text-error mb-4">wifi_off</span>
        <h2 className="text-2xl font-black text-on-surface uppercase tracking-tight mb-2">Connection Lost</h2>
        <p className="text-on-surface-variant text-sm mb-6">Axiom Neural Net is currently disconnected. Please check your network connection.</p>
        <button 
          onClick={() => window.location.reload()}
          className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider text-xs rounded-xl hover:bg-primary/90 transition-colors"
        >
          Retry Connection
        </button>
      </div>
    </div>
  );
};

export default OfflineBanner;
