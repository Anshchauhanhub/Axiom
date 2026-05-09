import React, { useState, useEffect, useRef } from 'react';

const RoadmapVisual = () => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 40;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 40;
      setMousePos({ x, y });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const nodes = [
    { label: 'Core Foundations', color: 'primary', x: '20%', y: '20%', size: 'w-32', delay: '0s' },
    { label: 'Advanced Logic', color: 'secondary', x: '60%', y: '10%', size: 'w-36', delay: '1.2s' },
    { label: 'Smart Systems', color: 'primary', x: '80%', y: '45%', size: 'w-36', delay: '0.5s' },
    { label: 'Learning Engine', color: 'secondary', x: '20%', y: '70%', size: 'w-36', delay: '2s' },
    { label: 'Global Mastery', color: 'primary', x: '75%', y: '80%', size: 'w-32', delay: '1.5s' },
  ];

  return (
    <div ref={containerRef} className="relative w-full aspect-square max-w-[1000px] mx-auto perspective-2000 group">
      <div 
        className="relative w-full h-full transition-transform duration-700 ease-out preserve-3d"
        style={{ transform: `rotateY(${mousePos.x}deg) rotateX(${-mousePos.y}deg)` }}
      >
        {/* Background Grid with Glow */}
        <div className="absolute inset-0 axiom-grid opacity-10 rounded-[4rem] border border-outline-variant/5"></div>
        
        {/* Connection Lines with Moving Data */}
        <svg className="absolute inset-0 w-full h-full">
          <defs>
            <filter id="glow">
               <feGaussianBlur stdDeviation="2.5" result="coloredBlur"/>
               <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
               </feMerge>
            </filter>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.1" />
              <stop offset="50%" stopColor="var(--primary)" stopOpacity="0.6" />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          
          {/* Static paths */}
          <path d="M 20% 20% L 60% 10% L 80% 45% L 75% 80% L 20% 70% Z" fill="none" stroke="rgba(253,184,19,0.1)" strokeWidth="1" />
          
          {/* Animated data flow */}
          <circle r="3" fill="var(--primary)" filter="url(#glow)">
            <animateMotion 
              path="M 20% 20% L 60% 10% L 80% 45% L 75% 80% L 20% 70% Z" 
              dur="10s" 
              repeatCount="indefinite" 
            />
          </circle>
          <circle r="2" fill="var(--secondary)" filter="url(#glow)">
            <animateMotion 
              path="M 20% 20% L 60% 10% L 80% 45% L 75% 80% L 20% 70% Z" 
              dur="12s" 
              begin="-5s"
              repeatCount="indefinite" 
            />
          </circle>
        </svg>

        {/* Central Core */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center">
           <div className="w-80 h-80 bg-primary/5 rounded-full blur-[120px] animate-pulse"></div>
           <div className="relative w-48 h-48 rounded-full border border-primary/20 flex items-center justify-center animate-spin-slow">
              <div className="absolute inset-0 rounded-full border-t-2 border-primary/40 animate-spin"></div>
              <div className="relative w-36 h-36 rounded-full border border-secondary/10 flex items-center justify-center animate-spin-reverse-slow">
                 <img src="/logo.png" alt="Axiom" className="w-24 h-auto drop-shadow-glow" />
              </div>
           </div>
        </div>

        {/* Floating Nodes */}
        {nodes.map((node, i) => (
          <div 
            key={i}
            className="absolute translate-x-[-50%] translate-y-[-50%] transition-transform duration-700"
            style={{ 
              left: node.x, 
              top: node.y, 
              transform: `translateZ(${60 + i * 40}px)`
            }}
          >
            <div className={`
              relative ${node.size} p-6 rounded-[2rem] glass-morphism border border-white/5 
              flex flex-col items-center gap-4 animate-float shadow-[0_20px_50px_rgba(0,0,0,0.3)] group/node
              hover:border-primary/40 hover:bg-white/10 hover:scale-110 transition-all duration-700
            `} style={{ animationDelay: node.delay }}>
              
              <div className={`w-4 h-4 rounded-full bg-${node.color} shadow-[0_0_20px_rgba(253,184,19,0.8)] relative`}>
                 <div className={`absolute inset-0 rounded-full bg-${node.color} animate-ping opacity-40`}></div>
              </div>

              <div className="text-center">
                 <span className="text-[11px] font-black font-headline uppercase tracking-[0.2em] text-on-surface whitespace-nowrap block mb-1 drop-shadow-sm">
                   {node.label}
                 </span>
                 <div className="flex justify-center gap-1.5">
                    {[1, 2, 3].map(d => (
                      <div key={d} className={`w-1.5 h-1.5 rounded-full bg-${node.color}/30 animate-pulse`} style={{ animationDelay: `${d * 0.3}s` }}></div>
                    ))}
                 </div>
              </div>

              {/* Data tooltips on hover */}
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 opacity-0 group-hover/node:opacity-100 transition-all duration-300 pointer-events-none">
                 <div className="px-3 py-1 bg-surface-container-high rounded-full border border-outline-variant/10 whitespace-nowrap">
                    <span className="text-[9px] font-label font-bold text-primary uppercase tracking-widest">Active Protocol</span>
                 </div>
              </div>
            </div>
          </div>
        ))}

        {/* Particle Field */}
        {[...Array(15)].map((_, i) => (
          <div 
            key={i}
            className="absolute w-1 h-1 bg-white/20 rounded-full animate-float-slow"
            style={{ 
              left: `${Math.random() * 100}%`, 
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              transform: `translateZ(${Math.random() * 200}px)`
            }}
          ></div>
        ))}

      </div>

      <style>{`
        .perspective-2000 { perspective: 2000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .animate-spin-slow { animation: spin 25s linear infinite; }
        .animate-spin-reverse-slow { animation: spin 20s linear infinite reverse; }
        .animate-float-slow {
           animation: floatSlow 8s ease-in-out infinite;
        }
        @keyframes floatSlow {
           0%, 100% { transform: translate(0, 0) translateZ(50px); }
           50% { transform: translate(20px, -20px) translateZ(100px); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .drop-shadow-glow {
          filter: drop-shadow(0 0 30px rgba(253,184,19,0.4));
        }
      `}</style>
    </div>
  );
};

export default RoadmapVisual;
