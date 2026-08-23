import React from 'react';
import { STUDY_CATEGORIES } from '../utils/categoryUtils';

const GoalSelectionGrid = ({ onSelect, loading }) => {
  return (
    <div className="w-full max-w-6xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-10">
        <span className="text-[10px] font-label font-black tracking-[0.4em] uppercase text-primary bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
          Curated Neural Pathways
        </span>
        <h3 className="text-3xl sm:text-5xl font-black font-headline uppercase tracking-tighter text-on-surface mt-3 mb-2">
          Select Your Study Domain
        </h3>
        <p className="text-on-surface-variant font-label text-xs tracking-[0.2em] uppercase opacity-70">
          Choose from 17 specialized learning fields or create a custom path
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
        {STUDY_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onSelect(cat.name)}
            disabled={loading}
            className="group relative flex flex-col justify-between bg-surface border border-white/10 hover:border-primary/50 rounded-3xl p-4 text-left overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_10px_30px_rgba(253,184,19,0.15)] disabled:opacity-50"
          >
            {/* Top Badge Number */}
            <div className="flex items-center justify-between mb-3 z-10">
              <span className="w-7 h-7 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-black flex items-center justify-center">
                {cat.id}
              </span>
              <span className="material-symbols-outlined text-primary/40 group-hover:text-primary transition-colors text-lg">
                {cat.icon}
              </span>
            </div>

            {/* 3D Category Image */}
            <div className="w-full h-36 rounded-2xl overflow-hidden mb-4 relative bg-black/40 border border-white/5 group-hover:border-primary/30 transition-colors">
              <img 
                src={cat.image} 
                alt={cat.name} 
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-90 group-hover:opacity-100"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent opacity-80"></div>
            </div>

            {/* Content */}
            <div className="z-10 flex-1 flex flex-col justify-between">
              <div>
                <h4 className="text-base font-black font-headline text-on-surface uppercase tracking-tight group-hover:text-primary transition-colors mb-1">
                  {cat.name}
                </h4>
                <p className="text-[11px] text-on-surface-variant/70 leading-snug line-clamp-2">
                  {cat.tagline}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-label font-bold tracking-widest text-primary uppercase">
                <span>Explore Path</span>
                <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">arrow_forward</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Custom AI Chat Banner */}
      <div className="mt-12 p-8 bg-gradient-to-r from-primary/10 via-surface-container-high/40 to-primary/5 border border-primary/20 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-xl animate-pulse">auto_awesome</span>
            <h5 className="font-headline font-black text-xl text-primary uppercase tracking-tight">Need a custom mastery plan?</h5>
          </div>
          <p className="text-xs text-on-surface-variant font-label leading-relaxed">
            Our AI Coach can generate a targeted curriculum for any specific subject, exam, or career goal.
          </p>
        </div>
        <button 
          onClick={() => onSelect("CUSTOM")}
          disabled={loading}
          className="px-8 py-4 bg-primary text-black font-label font-black text-xs tracking-widest uppercase rounded-2xl shadow-xl shadow-primary/20 hover:bg-yellow-400 active:scale-95 transition-all shrink-0"
        >
          Launch AI Architect
        </button>
      </div>
    </div>
  );
};

export default GoalSelectionGrid;

