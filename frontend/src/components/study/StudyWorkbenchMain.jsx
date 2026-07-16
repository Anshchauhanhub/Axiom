import React, { useState, useEffect } from 'react';
import { unlockTask } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const StudyWorkbenchMain = ({ activeTask, handleStartLearning, refreshData }) => {
  const { user, refreshUser } = useAuth();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);

  useEffect(() => {
    let interval;
    if (isWatchingAd) {
      interval = setInterval(() => {
        setAdCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAdUnlockComplete();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWatchingAd]);

  const handleAdUnlockComplete = async () => {
    setIsUnlocking(true);
    try {
      await unlockTask(activeTask.id, false); // useCredit=False
      await refreshUser();
      await refreshData();
      setIsWatchingAd(false);
      alert("🎉 Module unlocked successfully!");
    } catch (error) {
      alert("Failed to unlock module: " + error.message);
      setIsWatchingAd(false);
    } finally {
      setIsUnlocking(false);
    }
  };

  const handleUnlockWithCredit = async () => {
    if (!user || user.credits < 1) {
      alert("You don't have enough credits! Watch an ad to unlock or earn credits.");
      return;
    }
    setIsUnlocking(true);
    try {
      await unlockTask(activeTask.id, true); // useCredit=True
      await refreshUser();
      await refreshData();
      alert("🎉 Module unlocked using 1 Credit!");
    } catch (error) {
      alert("Failed to unlock module: " + error.message);
    } finally {
      setIsUnlocking(false);
    }
  };

  if (!activeTask) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-12 text-center bg-surface-container-low/20 rounded-[3.5rem] border border-dashed border-outline-variant/30">
        <span className="material-symbols-outlined text-6xl text-on-surface-variant/20 mb-6">target</span>
        <h3 className="text-xl font-headline font-black text-on-surface-variant/40 uppercase tracking-widest">Select logic node to begin focus</h3>
      </div>
    );
  }

  if (activeTask.status === 'locked') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-surface-container-low/20 rounded-[3.5rem] border border-outline-variant/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5">
           <span className="material-symbols-outlined text-9xl">lock</span>
        </div>
        
        {isWatchingAd ? (
          <div className="space-y-6 max-w-sm relative z-10">
            <div className="w-20 h-20 rounded-full border-4 border-t-primary border-primary/20 animate-spin flex items-center justify-center mx-auto mb-4">
              <span className="text-xl font-extrabold text-primary">{adCountdown}s</span>
            </div>
            <h3 className="text-xl font-black text-on-surface uppercase tracking-widest">Streaming Sponsor Content...</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Please wait while the ad completes to unlock this module. Click anywhere on the screen if your popunder didn't open.
            </p>
          </div>
        ) : (
          <div className="space-y-8 max-w-md relative z-10">
            <div className="w-20 h-20 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(253,184,19,0.15)]">
              <span className="material-symbols-outlined text-4xl text-primary animate-pulse">lock</span>
            </div>
            <div>
              <span className="text-[10px] font-label tracking-[0.4em] text-primary uppercase font-black">Monetization Lock</span>
              <h3 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight mt-1">{activeTask.title}</h3>
              <p className="text-xs text-on-surface-variant leading-relaxed mt-3">
                This module is currently locked. You can unlock it instantly using 1 Credit or by watching a short sponsor ad.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
              <button
                onClick={handleUnlockWithCredit}
                disabled={isUnlocking || !user || user.credits < 1}
                className="w-full sm:w-auto px-6 py-4 bg-primary text-black font-extrabold rounded-2xl hover:bg-yellow-400 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
              >
                <span className="material-symbols-outlined text-lg">database</span>
                Unlock with 1 Credit ({user?.credits || 0} left)
              </button>
              <button
                onClick={() => setIsWatchingAd(true)}
                disabled={isUnlocking}
                className="w-full sm:w-auto px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-extrabold rounded-2xl active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">smart_display</span>
                Watch Ad to Unlock
              </button>
            </div>
          </div>
        )}
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
