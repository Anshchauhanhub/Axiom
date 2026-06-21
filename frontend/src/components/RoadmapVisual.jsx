import React, { useState, useEffect, useCallback } from 'react';
import { Video, BrainCircuit, CheckCircle2, ArrowRight, Sparkles, MessageSquare, Bell, Send } from 'lucide-react';

const mockRoadmap = [
  { title: 'React Fundamentals', nodes: 8, done: true },
  { title: 'State Management', nodes: 5, done: true },
  { title: 'Advanced Patterns', nodes: 6, done: false, active: true },
  { title: 'System Design', nodes: 4, done: false },
];

const chatMessages = [
  { role: 'user', text: 'I want to master full-stack development' },
  { role: 'ai', text: 'Great goal. What\'s your current experience level — beginner, intermediate, or advanced?' },
  { role: 'user', text: 'Intermediate, I know React basics' },
  { role: 'ai', text: 'Perfect. I\'m generating a 4-module mastery path optimized for your level...' },
];

const notifications = [
  { title: 'Advanced Patterns', desc: 'Continue where you left off — 3 concepts remaining', time: '2m ago', type: 'progress' },
  { title: 'Daily Streak: 7 Days 🔥', desc: 'Complete today\'s session to maintain your streak', time: '10m ago', type: 'streak' },
  { title: 'System Design Unlocked', desc: 'You\'ve met the prerequisites. New module available!', time: '1h ago', type: 'unlock' },
];

const RoadmapVisual = () => {
  const [step, setStep] = useState(0); 
  // 0: youtube url, 1: analyzing, 2: roadmap, 3: chat with LLM, 4: notifications
  const [progress, setProgress] = useState(0);
  const [visibleChats, setVisibleChats] = useState(0);
  const [visibleNotifs, setVisibleNotifs] = useState(0);
  const [iteration, setIteration] = useState(0);

  const resetAll = useCallback(() => {
    setStep(0);
    setProgress(0);
    setVisibleChats(0);
    setVisibleNotifs(0);
    setIteration(i => i + 1);
  }, []);

  // Auto-play the full demo
  useEffect(() => {
    const timers = [];

    // Step 0 → 1 (URL → analyzing)
    timers.push(setTimeout(() => setStep(1), 2000));

    // Animate progress bar
    for (let i = 1; i <= 100; i++) {
      timers.push(setTimeout(() => setProgress(i), 2000 + i * 18));
    }

    // Step 1 → 2 (analyzing → roadmap)
    timers.push(setTimeout(() => setStep(2), 4000));

    // Step 2 → 3 (roadmap → LLM chat)
    timers.push(setTimeout(() => setStep(3), 7500));

    // Animate chat messages appearing
    timers.push(setTimeout(() => setVisibleChats(1), 8000));
    timers.push(setTimeout(() => setVisibleChats(2), 9000));
    timers.push(setTimeout(() => setVisibleChats(3), 10200));
    timers.push(setTimeout(() => setVisibleChats(4), 11500));

    // Step 3 → 4 (chat → notifications)
    timers.push(setTimeout(() => setStep(4), 13500));

    // Animate notifications sliding in
    timers.push(setTimeout(() => setVisibleNotifs(1), 14000));
    timers.push(setTimeout(() => setVisibleNotifs(2), 14600));
    timers.push(setTimeout(() => setVisibleNotifs(3), 15200));

    // Loop back to start
    timers.push(setTimeout(() => resetAll(), 18500));

    return () => timers.forEach(clearTimeout);
  }, [iteration]);

  return (
    <div className="relative w-full max-w-[440px] mx-auto mt-8 lg:mt-0 select-none">

      {/* Ambient glow */}
      <div className="absolute -inset-10 bg-gradient-to-br from-primary/8 to-secondary/8 blur-[80px] rounded-full pointer-events-none animate-pulse-slow"></div>

      {/* Phone / App Frame */}
      <div className="relative bg-[#09090b] border border-white/10 rounded-[2rem] sm:rounded-[2.5rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,0.8)]">

        {/* Status Bar */}
        <div className="flex items-center justify-between px-6 pt-4 pb-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="Edxiom" className="w-5 h-5 opacity-60" />
            <span className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em]">Edxiom</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-secondary shadow-[0_0_6px_var(--secondary)]"></div>
            <span className="text-[9px] text-secondary/70 font-bold uppercase tracking-widest">Live</span>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-5 sm:px-6 pb-6 min-h-[340px] sm:min-h-[380px] flex flex-col relative">

          {/* ─── Step 0: YouTube URL Input ─── */}
          <div 
            className="transition-all duration-700"
            style={{ 
              opacity: step === 0 ? 1 : 0,
              transform: step === 0 ? 'translateY(0)' : 'translateY(-20px)',
              position: step === 0 ? 'relative' : 'absolute',
              pointerEvents: step === 0 ? 'auto' : 'none',
              inset: step !== 0 ? '0 20px' : undefined
            }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Video size={16} className="text-red-400" />
              <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Playlist Import</span>
            </div>
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 mb-4">
              <div className="text-[10px] text-white/30 mb-2 font-mono">URL</div>
              <div className="text-xs sm:text-sm text-white/70 font-mono truncate animate-typing overflow-hidden whitespace-nowrap border-r-2 border-primary">
                youtube.com/playlist?list=PLu0W_9lII9a...
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 py-3 bg-primary/10 border border-primary/20 rounded-xl">
              <Sparkles size={14} className="text-primary" />
              <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Generate Roadmap</span>
            </div>
          </div>

          {/* ─── Step 1: Analyzing ─── */}
          <div 
            className="transition-all duration-700 flex flex-col items-center justify-center flex-1"
            style={{ 
              opacity: step === 1 ? 1 : 0,
              transform: step === 1 ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
              position: step === 1 ? 'relative' : 'absolute',
              pointerEvents: step === 1 ? 'auto' : 'none',
              inset: step !== 1 ? '0 20px' : undefined
            }}
          >
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(253,184,19,0.2)]">
              <BrainCircuit size={28} className="text-primary animate-pulse sm:w-9 sm:h-9" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-white mb-2">Analyzing 23 Videos...</div>
            <div className="text-[10px] text-white/40 mb-6 uppercase tracking-widest">Extracting Knowledge Graph</div>
            <div className="w-full max-w-[250px] h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-100 shadow-[0_0_10px_var(--primary)]"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <div className="text-[10px] text-primary/60 mt-3 font-mono font-bold">{progress}%</div>
          </div>

          {/* ─── Step 2: Generated Roadmap ─── */}
          <div 
            className="transition-all duration-700"
            style={{ 
              opacity: step === 2 ? 1 : 0,
              transform: step === 2 ? 'translateY(0)' : 'translateY(30px)',
              position: step === 2 ? 'relative' : 'absolute',
              pointerEvents: step === 2 ? 'auto' : 'none',
              inset: step !== 2 ? '0 20px' : undefined
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-secondary" />
                <span className="text-[10px] text-secondary font-bold uppercase tracking-widest">Path Generated</span>
              </div>
              <span className="text-[10px] text-white/30 font-mono">4 modules · 23 nodes</span>
            </div>
            <div className="space-y-2.5">
              {mockRoadmap.map((item, i) => (
                <div 
                  key={i}
                  className={`flex items-center gap-3 p-3 sm:p-3.5 rounded-xl border transition-all duration-500 ${
                    item.active 
                      ? 'bg-primary/10 border-primary/30 shadow-[0_0_20px_rgba(253,184,19,0.1)]' 
                      : item.done 
                      ? 'bg-white/[0.02] border-white/5' 
                      : 'bg-white/[0.01] border-white/5 opacity-50'
                  }`}
                  style={{ animation: step === 2 ? `slideUp 0.5s ease-out ${i * 120}ms both` : 'none' }}
                >
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 ${
                    item.done ? 'bg-secondary/20 border border-secondary/30' 
                    : item.active ? 'bg-primary/20 border-2 border-primary animate-pulse' 
                    : 'bg-white/5 border border-white/10'
                  }`}>
                    {item.done ? <CheckCircle2 size={12} className="text-secondary" /> 
                    : item.active ? <div className="w-2 h-2 rounded-full bg-primary"></div> 
                    : <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`text-[11px] sm:text-xs font-bold truncate ${item.active ? 'text-primary' : item.done ? 'text-white/80' : 'text-white/40'}`}>
                      {item.title}
                    </div>
                    <div className="text-[9px] text-white/25 mt-0.5">{item.nodes} concepts</div>
                  </div>
                  {item.done && <span className="text-[8px] text-secondary/60 font-bold uppercase tracking-widest shrink-0">Done</span>}
                  {item.active && <ArrowRight size={12} className="text-primary shrink-0 animate-bounce-x" />}
                </div>
              ))}
            </div>
          </div>

          {/* ─── Step 3: Chat with LLM Coach ─── */}
          <div 
            className="transition-all duration-700 flex flex-col"
            style={{ 
              opacity: step === 3 ? 1 : 0,
              transform: step === 3 ? 'translateY(0)' : 'translateY(30px)',
              position: step === 3 ? 'relative' : 'absolute',
              pointerEvents: step === 3 ? 'auto' : 'none',
              inset: step !== 3 ? '0 20px' : undefined
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare size={16} className="text-primary" />
              <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">AI Coach</span>
              <div className="ml-auto flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                <span className="text-[9px] text-primary/60 font-bold uppercase tracking-widest">Active</span>
              </div>
            </div>

            <div className="space-y-3 flex-1">
              {chatMessages.slice(0, visibleChats).map((msg, i) => (
                <div 
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  style={{ animation: `slideUp 0.4s ease-out both` }}
                >
                  <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[11px] sm:text-xs leading-relaxed ${
                    msg.role === 'user' 
                      ? 'bg-primary/15 border border-primary/20 text-white/80 rounded-br-sm' 
                      : 'bg-white/[0.04] border border-white/10 text-white/60 rounded-bl-sm'
                  }`}>
                    {msg.role === 'ai' && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <BrainCircuit size={10} className="text-primary" />
                        <span className="text-[8px] text-primary/60 font-bold uppercase tracking-widest">Edxiom</span>
                      </div>
                    )}
                    {msg.text}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {visibleChats > 0 && visibleChats < chatMessages.length && visibleChats % 2 === 0 && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.04] border border-white/10 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              )}
            </div>

            {/* Chat input mockup */}
            <div className="mt-4 flex items-center gap-2 bg-white/[0.03] border border-white/10 rounded-xl px-3 py-2.5">
              <span className="text-[11px] text-white/20 flex-1">Respond to Edxiom...</span>
              <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                <Send size={12} className="text-primary" />
              </div>
            </div>
          </div>

          {/* ─── Step 4: Notifications & Reminders ─── */}
          <div 
            className="transition-all duration-700 flex flex-col"
            style={{ 
              opacity: step === 4 ? 1 : 0,
              transform: step === 4 ? 'translateY(0)' : 'translateY(30px)',
              position: step === 4 ? 'relative' : 'absolute',
              pointerEvents: step === 4 ? 'auto' : 'none',
              inset: step !== 4 ? '0 20px' : undefined
            }}
          >
            <div className="flex items-center gap-2 mb-5">
              <Bell size={16} className="text-primary" />
              <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Smart Reminders</span>
              <div className="ml-auto px-2 py-0.5 bg-primary/20 rounded-full">
                <span className="text-[9px] text-primary font-bold">{visibleNotifs}</span>
              </div>
            </div>

            <div className="space-y-3">
              {notifications.slice(0, visibleNotifs).map((notif, i) => (
                <div 
                  key={i}
                  className={`p-3.5 sm:p-4 rounded-xl border transition-all duration-500 ${
                    notif.type === 'progress' 
                      ? 'bg-primary/5 border-primary/20' 
                      : notif.type === 'streak' 
                      ? 'bg-amber-500/5 border-amber-500/20' 
                      : 'bg-secondary/5 border-secondary/20'
                  }`}
                  style={{ animation: `slideUp 0.5s ease-out both` }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 ${
                      notif.type === 'progress' 
                        ? 'bg-primary/15 border border-primary/20' 
                        : notif.type === 'streak' 
                        ? 'bg-amber-500/15 border border-amber-500/20' 
                        : 'bg-secondary/15 border border-secondary/20'
                    }`}>
                      {notif.type === 'progress' && <ArrowRight size={14} className="text-primary" />}
                      {notif.type === 'streak' && <Sparkles size={14} className="text-amber-400" />}
                      {notif.type === 'unlock' && <CheckCircle2 size={14} className="text-secondary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] sm:text-xs font-bold text-white/80 truncate">{notif.title}</span>
                        <span className="text-[8px] text-white/20 font-mono shrink-0 ml-2">{notif.time}</span>
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-white/40 leading-relaxed">{notif.desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Dismiss mockup */}
            {visibleNotifs >= 3 && (
              <div className="mt-5 flex items-center justify-center gap-2 py-3 bg-white/[0.02] border border-white/5 rounded-xl" style={{ animation: 'slideUp 0.5s ease-out both' }}>
                <span className="text-[10px] text-white/30 font-bold uppercase tracking-widest">Mark All as Read</span>
              </div>
            )}
          </div>

        </div>

      </div>

      <style>{`
        .animate-pulse-slow { animation: pulseGlow 6s ease-in-out infinite; }
        .animate-bounce-x { animation: bounceX 1.5s ease-in-out infinite; }
        .animate-typing { 
          width: 0;
          animation: typing 1.5s steps(40) forwards;
        }
        
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        @keyframes bounceX {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(4px); }
        }
        @keyframes typing {
          from { width: 0; }
          to { width: 100%; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default RoadmapVisual;
