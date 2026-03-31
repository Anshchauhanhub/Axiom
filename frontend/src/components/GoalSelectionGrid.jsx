import React from 'react';

const GOAL_CATEGORIES = [
  {
    title: "Academic Excellence",
    icon: "school",
    goals: [
      { id: "college", title: "College Student", icon: "history_edu" },
      { id: "degree", title: "Degree Mastery", icon: "auto_stories" },
      { id: "research", title: "Research Foundation", icon: "biotech" }
    ]
  },
  {
    title: "Competitive Exams",
    icon: "military_tech",
    goals: [
      { id: "gate", title: "GATE / ESE Prep", icon: "engineering" },
      { id: "jee", title: "JEE / NEET Prep", icon: "calculate" },
      { id: "upsc", title: "UPSC / Civil Services", icon: "gavel" },
      { id: "gre", title: "GRE / GMAT", icon: "language" }
    ]
  }
];

const GoalSelectionGrid = ({ onSelect, loading }) => {
  return (
    <div className="w-full max-w-4xl mx-auto py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-center mb-12">
        <h3 className="text-3xl font-black font-headline uppercase tracking-tighter text-on-surface mb-2">Select Your Neural Path</h3>
        <p className="text-on-surface-variant font-label text-[10px] tracking-[0.3em] uppercase opacity-60">System Ready for Goal Initialization</p>
      </div>

      <div className="space-y-12">
        {GOAL_CATEGORIES.map((cat, idx) => (
          <div key={idx} className="space-y-6">
            <div className="flex items-center gap-3 px-2">
              <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>{cat.icon}</span>
              <h4 className="font-label font-bold text-[10px] uppercase tracking-[0.4em] text-primary-container bg-primary/10 px-4 py-1.5 rounded-full border border-primary/20">
                {cat.title}
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {cat.goals.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => onSelect(goal.title)}
                  disabled={loading}
                  className="group relative flex items-center justify-between p-6 bg-surface-container-low border border-outline-variant/10 rounded-2xl hover:border-primary/50 transition-all duration-300 text-left overflow-hidden disabled:opacity-50"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  
                  <div className="relative z-10 flex flex-col gap-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center border border-outline-variant/5 group-hover:bg-primary/10 group-hover:border-primary/20 transition-colors">
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary transition-colors">{goal.icon}</span>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{goal.title}</div>
                      <div className="text-[9px] font-label uppercase tracking-widest text-on-surface-variant opacity-40">System Protocol // Active</div>
                    </div>
                  </div>

                  <span className="material-symbols-outlined text-outline-variant/20 group-hover:text-primary/40 transition-colors">arrow_forward_ios</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-16 p-8 bg-primary/5 border border-primary/10 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h5 className="font-headline font-bold text-lg text-primary mb-1 uppercase tracking-tight">Need a custom roadmap?</h5>
          <p className="text-xs text-on-surface-variant font-label leading-relaxed">Our AI Coach can build a unique path tailored to your specific mastery needs.</p>
        </div>
        <button 
          onClick={() => onSelect("CUSTOM")}
          disabled={loading}
          className="px-8 py-3 bg-primary text-on-primary-container font-label font-bold text-[10px] tracking-widest uppercase rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.03] active:scale-95 transition-all"
        >
          Initialize AI Chat
        </button>
      </div>
    </div>
  );
};

export default GoalSelectionGrid;
