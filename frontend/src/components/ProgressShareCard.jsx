import React, { useRef } from 'react';
import { Share2, Sparkles, Flame, Award, Download, X, Check, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function ProgressShareCard({ goal, progress = 0, isOpen, onClose }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const cardRef = useRef(null);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin);
    showToast('App link copied to clipboard!', 'success');
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(
      `I'm currently at ${Math.round(progress)}% mastery on "${goal?.title || 'my curriculum'}" using @Edxiom, the AI-driven neural learning engine! 🔥 Streak: ${user?.current_streak || 1} days`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank');
  };

  const handleShareLinkedIn = () => {
    const url = encodeURIComponent(window.location.origin);
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${url}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface-container-high border border-outline-variant/20 rounded-3xl p-6 shadow-2xl relative space-y-6 animate-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
        >
          <X size={18} />
        </button>

        <div>
          <h3 className="text-lg font-bold text-on-surface font-headline uppercase tracking-tight flex items-center gap-2">
            <Share2 size={18} className="text-primary" />
            Share Proof of Mastery
          </h3>
          <p className="text-xs text-on-surface-variant font-label uppercase tracking-widest mt-1">
            Showcase your learning velocity & verified streak
          </p>
        </div>

        {/* The Visual Badge Card */}
        <div 
          ref={cardRef}
          className="p-6 rounded-2xl bg-gradient-to-br from-surface-container-highest to-surface-container border border-outline-variant/30 relative overflow-hidden shadow-inner"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/20 text-primary flex items-center justify-center font-black text-sm">
                E
              </div>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface font-headline">
                Edxiom Neural Verified
              </span>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold">
              <Flame size={12} /> {user?.current_streak || 1}d Streak
            </div>
          </div>

          <div className="my-4">
            <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Active Curriculum</p>
            <h4 className="text-base font-bold text-on-surface line-clamp-1 mt-0.5">{goal?.title || 'Advanced Neural Architecture'}</h4>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-outline-variant/10">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-on-surface-variant">Mastery Rate</span>
              <span className="font-bold text-primary">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 w-full bg-surface-container-low rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-amber-400 rounded-full transition-all duration-500"
                style={{ width: `${Math.max(5, progress)}%` }}
              ></div>
            </div>
          </div>

          <div className="mt-4 pt-3 flex items-center justify-between text-[10px] text-on-surface-variant border-t border-outline-variant/10">
            <span>Scholar: {user?.full_name || 'Autonomous Learner'}</span>
            <span className="font-mono text-primary/80">edxiom.ai</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleShareTwitter}
            className="py-2.5 px-4 rounded-xl bg-[#1DA1F2]/10 hover:bg-[#1DA1F2]/20 border border-[#1DA1F2]/30 text-[#1DA1F2] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            Twitter / X
          </button>
          <button
            onClick={handleShareLinkedIn}
            className="py-2.5 px-4 rounded-xl bg-[#0A66C2]/10 hover:bg-[#0A66C2]/20 border border-[#0A66C2]/30 text-[#0A66C2] text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors"
          >
            LinkedIn
          </button>
        </div>

        <button
          onClick={handleCopyLink}
          className="w-full py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-highest border border-outline-variant/20 text-xs font-bold uppercase tracking-wider text-on-surface flex items-center justify-center gap-2 transition-colors"
        >
          <Copy size={14} /> Copy Platform Link
        </button>
      </div>
    </div>
  );
}
