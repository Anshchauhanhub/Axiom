import React from 'react';

const StudySidebar = ({ showNotes, roadmap, activeTask, handleSelectTask }) => {
  if (!roadmap || !roadmap.tasks) return null;

  return (
    <div className={`w-full lg:w-80 flex-col gap-6 shrink-0 transition-all duration-500 ${showNotes ? 'hidden' : 'flex'}`}>
      <div className="bg-[#0c0c0e]/90 backdrop-blur-xl border border-white/10 rounded-[2rem] p-4 shadow-2xl sm:p-6">
        <div className="flex items-center gap-3 mb-6 px-2">
          <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
            hub
          </span>
          <span className="text-[10px] font-label font-black uppercase tracking-[0.3em] text-primary/80">
            NEURAL PATH
          </span>
        </div>
        
        <div className="relative flex gap-3 overflow-x-auto pb-2 lg:max-h-[calc(100vh-14rem)] lg:flex-col lg:overflow-x-hidden lg:overflow-y-auto lg:pb-0">
          {roadmap.tasks.map((task, idx) => {
            const isActive = activeTask?.id === task.id;
            const isLocked = task.status === 'locked';
            const isPassed = task.status === 'passed';
            
            return (
              <button
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className={`w-[min(82vw,18rem)] shrink-0 flex items-center gap-4 p-4 rounded-2xl transition-all relative z-10 text-left lg:w-full ${
                  isActive 
                    ? 'bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary/60 shadow-[0_0_20px_rgba(253,184,19,0.15)] scale-[1.02]' 
                    : isPassed
                    ? 'bg-white/5 border border-white/10 hover:border-secondary/40 text-on-surface'
                    : 'bg-white/5 border border-white/5 opacity-50 hover:opacity-100 hover:border-white/20'
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0 transition-all ${
                  isActive 
                    ? 'bg-primary text-black shadow-lg shadow-primary/30 font-black' 
                    : isPassed 
                    ? 'bg-secondary/20 text-secondary border border-secondary/30' 
                    : 'bg-white/10 text-white/50'
                }`}>
                  {isPassed ? (
                    <span className="material-symbols-outlined text-sm">check</span>
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className={`text-xs font-headline font-bold uppercase tracking-tight flex-1 line-clamp-2 ${
                  isActive ? 'text-primary' : isPassed ? 'text-on-surface' : 'text-on-surface-variant'
                }`}>
                  {task.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StudySidebar;
