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

  // Square sizes (px) — must match the SVG rect dimensions below
  const outerSize = 144; // w-36
  const midSize   = 112; // w-28
  const innerSize =  80; // w-20
  const r = 12; // corner radius for the motion path rects

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(19, 19, 21, 0.92)', backdropFilter: 'blur(20px)' }}
    >
      <div className="flex flex-col items-center gap-8 animate-in fade-in duration-700">

        {/* ── Squircle frames + orbiting dots ── */}
        <div
          className="relative flex items-center justify-center"
          style={{ width: outerSize, height: outerSize }}
        >

          {/* ── OUTER FRAME (gold, 144 × 144, perfectly upright) ── */}
          <div
            className="absolute border border-[#fdb813]/40 bg-gradient-to-br from-[#fdb813]/[0.04] to-transparent pointer-events-none"
            style={{
              width: outerSize,
              height: outerSize,
              borderRadius: '2.2rem',
              boxShadow: 'inset 0 0 20px rgba(253,184,19,0.05)',
            }}
          />
          {/* Outer orbiting dot — travels the square perimeter */}
          <div
            className="absolute pointer-events-none"
            style={{ width: outerSize, height: outerSize, top: 0, left: 0 }}
          >
            <div
              className="w-3.5 h-3.5 rounded-full bg-[#fdb813]"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                boxShadow: '0 0 14px #fdb813, 0 0 4px #fdb813',
                offsetPath: `path('M ${r},0 L ${outerSize - r},0 Q ${outerSize},0 ${outerSize},${r} L ${outerSize},${outerSize - r} Q ${outerSize},${outerSize} ${outerSize - r},${outerSize} L ${r},${outerSize} Q 0,${outerSize} 0,${outerSize - r} L 0,${r} Q 0,0 ${r},0 Z')`,
                offsetAnchor: 'center center',
                animation: 'orbitSquare 5s linear infinite',
              }}
            />
          </div>

          {/* ── MIDDLE FRAME (emerald, 112 × 112) ── */}
          <div
            className="absolute border border-emerald-400/40 bg-gradient-to-br from-emerald-400/[0.04] to-transparent pointer-events-none"
            style={{
              width: midSize,
              height: midSize,
              borderRadius: '1.8rem',
              boxShadow: 'inset 0 0 15px rgba(52,211,153,0.05)',
            }}
          />
          {/* Middle orbiting dot */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: midSize,
              height: midSize,
              top: (outerSize - midSize) / 2,
              left: (outerSize - midSize) / 2,
            }}
          >
            <div
              className="w-3 h-3 rounded-full bg-emerald-400"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                boxShadow: '0 0 12px #34d399, 0 0 4px #34d399',
                offsetPath: `path('M ${r},0 L ${midSize - r},0 Q ${midSize},0 ${midSize},${r} L ${midSize},${midSize - r} Q ${midSize},${midSize} ${midSize - r},${midSize} L ${r},${midSize} Q 0,${midSize} 0,${midSize - r} L 0,${r} Q 0,0 ${r},0 Z')`,
                offsetAnchor: 'center center',
                animation: 'orbitSquare 3.8s linear infinite reverse',
              }}
            />
          </div>

          {/* ── INNER FRAME (sky-blue, 80 × 80) ── */}
          <div
            className="absolute border border-sky-400/45 bg-gradient-to-br from-sky-400/[0.04] to-transparent pointer-events-none"
            style={{
              width: innerSize,
              height: innerSize,
              borderRadius: '1.4rem',
              boxShadow: 'inset 0 0 10px rgba(56,189,248,0.05)',
            }}
          />
          {/* Inner orbiting dot */}
          <div
            className="absolute pointer-events-none"
            style={{
              width: innerSize,
              height: innerSize,
              top: (outerSize - innerSize) / 2,
              left: (outerSize - innerSize) / 2,
            }}
          >
            <div
              className="w-2.5 h-2.5 rounded-full bg-sky-400"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                boxShadow: '0 0 10px #38bdf8, 0 0 3px #38bdf8',
                offsetPath: `path('M ${r},0 L ${innerSize - r},0 Q ${innerSize},0 ${innerSize},${r} L ${innerSize},${innerSize - r} Q ${innerSize},${innerSize} ${innerSize - r},${innerSize} L ${r},${innerSize} Q 0,${innerSize} 0,${innerSize - r} L 0,${r} Q 0,0 ${r},0 Z')`,
                offsetAnchor: 'center center',
                animation: 'orbitSquare 2.6s linear infinite',
              }}
            />
          </div>

          {/* ── CENTER ICON BADGE ── */}
          <div className="relative z-10 w-14 h-14 rounded-2xl bg-[#161618] flex items-center justify-center border border-white/10 shadow-[0_10px_25px_rgba(0,0,0,0.8),_inset_0_1px_0_rgba(255,255,255,0.12)]">
            <span className="material-symbols-outlined text-[#fdb813] text-3xl animate-pulse">
              psychology
            </span>
          </div>

          {/* Ambient glow */}
          <div className="absolute inset-0 rounded-full bg-[#fdb813]/10 blur-2xl animate-pulse pointer-events-none" />
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
        @keyframes orbitSquare {
          from { offset-distance: 0%; }
          to   { offset-distance: 100%; }
        }
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
