import React, { useState, useEffect } from 'react';

const NeuralLoader = ({ message = 'Processing...', subMessages = [] }) => {
  const [dotCount, setDotCount] = useState(1);
  const [activeMsg, setActiveMsg] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setDotCount(prev => (prev % 3) + 1);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (subMessages.length <= 1) return;
    const interval = setInterval(() => {
      setActiveMsg(prev => (prev + 1) % subMessages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [subMessages.length]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(19, 19, 21, 0.92)', backdropFilter: 'blur(20px)' }}
    >
      <div className="flex flex-col items-center gap-8 animate-in fade-in duration-700">

        {/* ── Squircle Frames with Orbiting Dots ── */}
        <div className="relative w-36 h-36 flex items-center justify-center">

          {/* OUTER frame — gold, straight upright */}
          <div className="absolute w-36 h-36 rounded-[2.2rem] border border-[#fdb813]/40 pointer-events-none" />
          {/* Outer dot — circular orbit wrapper (no impact on frame) */}
          <div
            className="absolute w-36 h-36 rounded-full pointer-events-none"
            style={{ animation: 'spin 6s linear infinite', transformOrigin: 'center center' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-[#fdb813] shadow-[0_0_14px_#fdb813]" />
          </div>

          {/* MIDDLE frame — emerald, straight upright */}
          <div className="absolute w-28 h-28 rounded-[1.8rem] border border-emerald-400/40 pointer-events-none" />
          {/* Middle dot — circular orbit, reverse */}
          <div
            className="absolute w-28 h-28 rounded-full pointer-events-none"
            style={{ animation: 'spin 4.5s linear infinite reverse', transformOrigin: 'center center' }}
          >
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_12px_#34d399]" />
          </div>

          {/* INNER frame — sky blue, straight upright */}
          <div className="absolute w-20 h-20 rounded-[1.4rem] border border-sky-400/45 pointer-events-none" />
          {/* Inner dot — circular orbit */}
          <div
            className="absolute w-20 h-20 rounded-full pointer-events-none"
            style={{ animation: 'spin 3s linear infinite', transformOrigin: 'center center' }}
          >
            <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-sky-400 shadow-[0_0_10px_#38bdf8]" />
          </div>

          {/* CENTER icon badge — always stable */}
          <div className="relative z-10 w-14 h-14 rounded-2xl bg-[#161618] flex items-center justify-center border border-white/10 shadow-[0_10px_25px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.12)]">
            <span className="material-symbols-outlined text-[#fdb813] text-3xl animate-pulse">
              psychology
            </span>
          </div>

          {/* Ambient glow */}
          <div className="absolute inset-0 rounded-full blur-2xl animate-pulse pointer-events-none" style={{ background: 'rgba(253,184,19,0.08)' }} />
        </div>

        {/* Main message */}
        <div className="text-center space-y-3">
          <h3 className="text-xl font-black font-headline tracking-tight text-on-surface uppercase">
            {message}{'.'.repeat(dotCount)}
          </h3>
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
            style={{ width: '40%', animation: 'edxiomProgress 2s ease-in-out infinite' }}
          />
        </div>

        <p className="text-[10px] font-label tracking-widest uppercase text-on-surface-variant/30 mt-4">
          Edxiom Engine Active
        </p>
      </div>

      <style>{`
        @keyframes edxiomProgress {
          0%   { transform: translateX(-100%); width: 40%; }
          50%  { transform: translateX(80%);   width: 60%; }
          100% { transform: translateX(-100%); width: 40%; }
        }
      `}</style>
    </div>
  );
};

export default NeuralLoader;
