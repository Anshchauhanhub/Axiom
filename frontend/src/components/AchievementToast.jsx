import React, { useEffect } from 'react';
import { Award, Flame, CheckCircle, Zap, X } from 'lucide-react';

export default function AchievementToast({ achievement, onClose }) {
  useEffect(() => {
    if (!achievement) return;
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [achievement, onClose]);

  if (!achievement) return null;

  const { title, description, icon: Icon = Award, type = 'streak' } = achievement;

  const getAccent = () => {
    switch (type) {
      case 'streak': return { bg: 'from-amber-500/20 to-orange-500/20', border: 'border-amber-500/40', text: 'text-amber-400', glow: 'shadow-[0_0_30px_rgba(251,191,36,0.3)]' };
      case 'perfect': return { bg: 'from-purple-500/20 to-pink-500/20', border: 'border-purple-500/40', text: 'text-purple-400', glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]' };
      case 'goal': return { bg: 'from-green-500/20 to-emerald-500/20', border: 'border-green-500/40', text: 'text-green-400', glow: 'shadow-[0_0_30px_rgba(34,197,94,0.3)]' };
      default: return { bg: 'from-primary/20 to-amber-500/20', border: 'border-primary/40', text: 'text-primary', glow: 'shadow-[0_0_30px_rgba(253,184,19,0.3)]' };
    }
  };

  const accent = getAccent();

  return (
    <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-top-6 fade-in duration-300">
      <div className={`flex items-center gap-4 px-6 py-4 rounded-2xl bg-surface-container-high/95 backdrop-blur-xl border ${accent.border} ${accent.glow} max-w-md w-full`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-gradient-to-br ${accent.bg} ${accent.text}`}>
          <Icon size={24} className="animate-bounce" />
        </div>
        <div className="flex-1 min-w-0">
          <span className={`text-[10px] font-bold uppercase tracking-widest ${accent.text}`}>
            Achievement Unlocked
          </span>
          <h4 className="text-sm font-bold text-on-surface truncate">{title}</h4>
          <p className="text-xs text-on-surface-variant truncate">{description}</p>
        </div>
        <button
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface transition-colors p-1"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
