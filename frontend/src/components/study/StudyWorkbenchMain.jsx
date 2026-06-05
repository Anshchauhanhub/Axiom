import React from 'react';

const StudyWorkbenchMain = ({ activeTask, handleStartLearning }) => {
  if (!activeTask) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-surface-container-low/20 rounded-[3.5rem] border border-dashed border-outline-variant/30">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-6">target</span>
        <h3 className="text-xl font-headline font-black text-on-surface-variant/40 uppercase tracking-widest">Select logic node to begin focus</h3>
      </div>
    );
  }

  return (
    <div className="space-y-8 h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-4">
        <div>
           <span className="text-[10px] font-label tracking-[0.4em] text-primary uppercase font-black">Active Context</span>
           <h2 className="text-3xl font-black font-headline text-on-surface uppercase tracking-tight mt-1">{activeTask.title}</h2>
        </div>
      </div>

      <div className="bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/10 p-4 sm:p-10 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <span className="material-symbols-outlined text-9xl">molecular_autonomy</span>
        </div>
        
        <div className="grid grid-cols-1 gap-6 relative z-10">
          {activeTask.parts.map((part, pidx) => {
            const isActive = part.status === 'active';
            const isPassed = part.status === 'passed';
            const isLocked = part.status === 'locked';
            
            return (
              <div 
                key={part.id} 
                onClick={() => !isLocked && handleStartLearning(part.id, part.title)}
                className={`group flex items-center justify-between p-6 sm:p-8 rounded-[2.5rem] border-2 transition-all duration-500 ${
                  !isLocked 
                    ? 'bg-surface-container-low/80 border-outline-variant/10 cursor-pointer hover:border-primary/40 hover:bg-surface-container-low hover:translate-x-2' 
                    : 'opacity-40 border-transparent grayscale'
                }`}
              >
                <div className="flex items-center gap-6">
                   <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${
                     isActive ? 'bg-primary text-on-primary-container shadow-2xl' : isPassed ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-highest/50 text-on-surface-variant'
                   }`}>
                     <span className="material-symbols-outlined text-3xl">
                       {isPassed ? 'check_circle' : isActive ? 'bolt' : 'lock_open'}
                     </span>
                   </div>
                   <div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-label tracking-[0.2em] uppercase text-on-surface-variant/40 font-black">Segment {pidx + 1}</span>
                        {isActive && <span className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></span>}
                      </div>
                      <h4 className="text-xl font-black text-on-surface group-hover:text-primary transition-colors">{part.title.split(' || ')[0]}</h4>
                   </div>
                </div>
                <span className="material-symbols-outlined text-on-surface-variant/20 group-hover:text-primary transition-all group-hover:translate-x-1">arrow_forward</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StudyWorkbenchMain;
