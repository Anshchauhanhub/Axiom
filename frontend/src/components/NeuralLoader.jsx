import React, { useState, useEffect } from 'react';

const NeuralLoader = ({ message = 'Processing...', subMessages = [] }) => {
  const [dotCount, setDotCount] = useState(1);
  const [activeMsg, setActiveMsg] = useState(0);

  // Animate trailing dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Cycle through sub-messages
  useEffect(() => {
    if (subMessages.length <= 1) return;
    const interval = setInterval(() => {
      setActiveMsg(prev => (prev + 1) % subMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [subMessages.length]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ backgroundColor: 'rgba(19, 19, 21, 0.92)', backdropFilter: 'blur(20px)' }}>
      <div className="flex flex-col items-center gap-8 animate-in fade-in duration-700">

        {/* Orbital Animation */}
        <div className="relative w-32 h-32">
          {/* Outer ring - slow spin */}
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" style={{ animation: 'spin 8s linear infinite' }}></div>
          {/* Middle ring - medium spin reverse */}
          <div className="absolute inset-3 rounded-full border border-secondary/30" style={{ animation: 'spin 5s linear infinite reverse' }}></div>
          {/* Inner ring - fast spin */}
          <div className="absolute inset-6 rounded-full border border-primary/40" style={{ animation: 'spin 3s linear infinite' }}></div>

          {/* Orbiting dots */}
          <div className="absolute inset-0" style={{ animation: 'spin 4s linear infinite' }}>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/50" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}></div>
          </div>
          <div className="absolute inset-0" style={{ animation: 'spin 6s linear infinite reverse' }}>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2.5 h-2.5 rounded-full bg-secondary shadow-lg shadow-secondary/50" style={{ animation: 'pulse 2s ease-in-out infinite 0.5s' }}></div>
          </div>
          <div className="absolute inset-0" style={{ animation: 'spin 3.5s linear infinite' }}>
            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-tertiary shadow-lg shadow-tertiary/50" style={{ animation: 'pulse 1.8s ease-in-out infinite 1s' }}></div>
          </div>

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-high flex items-center justify-center border border-outline-variant/20 shadow-2xl">
              <span className="material-symbols-outlined text-primary text-3xl" style={{ animation: 'pulse 2s ease-in-out infinite' }}>
                psychology
              </span>
            </div>
          </div>

          {/* Ambient glow */}
          <div className="absolute inset-0 rounded-full bg-primary/5 blur-xl" style={{ animation: 'pulse 3s ease-in-out infinite' }}></div>
        </div>

        {/* Main message */}
        <div className="text-center space-y-3">
          <h3 className="text-xl font-black font-headline tracking-tight text-on-surface uppercase">
            {message}{'.'.repeat(dotCount)}
          </h3>

          {/* Sub message cycling */}
          {subMessages.length > 0 && (
            <div className="relative h-6 overflow-hidden">
              <p
                key={activeMsg}
                className="text-xs font-label uppercase tracking-[0.2em] text-on-surface-variant/60 animate-in fade-in slide-in-from-bottom-2 duration-500"
              >
                {subMessages[activeMsg]}
              </p>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="w-64 h-1 bg-surface-container-highest rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary via-secondary to-primary rounded-full"
            style={{
              width: '40%',
              animation: 'edxiomProgress 2s ease-in-out infinite',
            }}
          ></div>
        </div>

        {/* Subtle hint */}
        <p className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/30 mt-4">
          Edxiom Engine Active
        </p>
      </div>

      <style>{`
        @keyframes edxiomProgress {
          0% { transform: translateX(-100%); width: 40%; }
          50% { transform: translateX(80%); width: 60%; }
          100% { transform: translateX(-100%); width: 40%; }
        }
      `}</style>
    </div>
  );
};

export default NeuralLoader;
