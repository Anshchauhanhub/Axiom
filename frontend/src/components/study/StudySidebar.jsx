import React from 'react';

const StudySidebar = ({ showNotes, roadmap, activeTask, handleSelectTask }) => {
  if (!roadmap || !roadmap.tasks) return null;

  return (
    <div className={`w-full lg:w-80 flex-col gap-6 shrink-0 transition-all duration-500 ${showNotes ? 'hidden' : 'flex'}`}>
      <div className="bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/10 rounded-[2.5rem] p-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="material-symbols-outlined text-primary text-xl">account_tree</span>
          <span className="text-[10px] font-label font-black uppercase tracking-[0.3em] text-on-surface-variant">Neural Path</span>
        </div>
        
        <div className="space-y-4 relative">
          <div className="absolute left-4 top-2 bottom-2 w-[1px] bg-outline-variant/20"></div>
          {roadmap.tasks.map((task, idx) => {
            const isActive = activeTask?.id === task.id;
            const isLocked = task.status === 'locked';
            const isPassed = task.status === 'passed';
            
            return (
              <button
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative z-10 ${
                  isActive 
                    ? 'bg-primary/10 border border-primary/20 scale-[1.02] shadow-lg' 
                    : isLocked ? 'opacity-60 hover:bg-surface-container/30 border border-transparent cursor-pointer' : 'hover:bg-surface-container/50 border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                  isActive ? 'bg-primary border-primary text-on-primary-container' : isPassed ? 'bg-secondary border-secondary text-on-secondary-container' : 'bg-surface border-outline-variant text-on-surface-variant'
                }`}>
                  {isPassed ? (
                    <span className="material-symbols-outlined text-sm">check</span>
                  ) : (
                    <span className="text-[10px] font-black">{idx + 1}</span>
                  )}
                </div>
                <span className={`text-[11px] font-label font-black text-left uppercase tracking-tight flex-1 ${isActive ? 'text-primary' : 'text-on-surface-variant'}`}>
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
