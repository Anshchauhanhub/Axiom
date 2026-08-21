import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toggleGoalStatus, deleteGoal } from '../services/api';
import NeuralLoader from '../components/NeuralLoader';
import {
  Activity, ArrowRight, BookOpen, BookText, CalendarClock, CheckCircle2, ChevronDown,
  ChevronRight, Clock3, Flame, GraduationCap, Layers, Pause, Play,
  Send, ShieldCheck, Sparkles, Target, Trash2, Zap,
} from 'lucide-react';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 5) return { text: 'Late night session', icon: '🌙', sub: 'Burning the midnight oil? Remember to rest.' };
  if (h < 12) return { text: 'Good morning', icon: '☀️', sub: 'Fresh mind, maximum retention. Start strong.' };
  if (h < 17) return { text: 'Good afternoon', icon: '🔥', sub: 'Stay locked in. Consistency beats intensity.' };
  if (h < 21) return { text: 'Good evening', icon: '🌅', sub: 'Great time for focused deep work.' };
  return { text: 'Night owl mode', icon: '🦉', sub: 'Wrap up your session and plan for tomorrow.' };
};

const statusDot = { passed: 'bg-emerald-400', active: 'bg-primary', locked: 'bg-white/20', paused: 'bg-orange-400', completed: 'bg-emerald-400' };
const statusText = { passed: 'text-emerald-400', active: 'text-primary', locked: 'text-white/30', paused: 'text-orange-400', completed: 'text-emerald-400' };

const glowColorMap = {
  gold: 'rgba(253, 184, 19, 0.16)',
  green: 'rgba(16, 185, 129, 0.16)',
  orange: 'rgba(249, 115, 22, 0.16)',
  blue: 'rgba(56, 189, 248, 0.16)',
  white: 'rgba(255, 255, 255, 0.08)',
};

const borderColors = {
  gold: 'border-t-primary/40 border-x-white/[0.06] border-b-black/45',
  green: 'border-t-emerald-400/40 border-x-white/[0.06] border-b-black/45',
  orange: 'border-t-orange-400/40 border-x-white/[0.06] border-b-black/45',
  blue: 'border-t-sky-400/40 border-x-white/[0.06] border-b-black/45',
  white: 'border-t-white/20 border-x-white/[0.06] border-b-black/45',
};

const TiltCard = ({ children, className = "", style = {}, glowColor = "gold" }) => {
  const currentGlow = glowColorMap[glowColor] || glowColor;
  const currentBorder = borderColors[glowColor] || borderColors.white;

  return (
    <div
      style={{
        '--glow-color': currentGlow,
        boxShadow: `0 10px 30px -10px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)`,
        ...style
      }}
      className={`relative rounded-2xl border ${currentBorder} bg-gradient-to-b from-white/[0.05] to-white/[0.01] overflow-hidden hover:border-white/20 hover:shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8),_0_0_25px_var(--glow-color)] transition-all duration-300 ${className}`}
    >
      {children}
    </div>
  );
};

/** Single Goal Card — shows 3D horizontal progress bar + expandable roadmap */
const GoalCard = ({ goal, roadmapData, onStudy, onNotes, onToggle, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedModule, setExpandedModule] = useState(null);

  const tasks = roadmapData?.tasks || [];
  const parts = tasks.flatMap(t => t.parts || []);
  const done = parts.filter(p => p.status === 'passed').length;
  const pct = parts.length ? Math.round((done / parts.length) * 100) : 0;
  const activePart = parts.find(p => p.status === 'active');
  const activeTask = tasks.find(t => t.status === 'active');
  const isActive = goal.status === 'active';

  // Determine color matching status for psychological association
  const cardGlow = goal.status === 'active' ? 'gold' : goal.status === 'completed' ? 'green' : 'orange';

  // Auto-expand active module
  useEffect(() => {
    if (expanded && activeTask) setExpandedModule(activeTask.id);
  }, [expanded, activeTask]);

  return (
    <TiltCard className="group/card" glowColor={cardGlow}>
      {/* Goal Header — always visible */}
      <div className="p-5 sm:p-6" style={{ transform: 'translateZ(15px)' }}>
        <div className="flex items-center gap-4 sm:gap-5">
          {/* Circular Progress (Left Corner) */}
          <div className="relative w-12 h-12 sm:w-[52px] sm:h-[52px] shrink-0 flex items-center justify-center rounded-full bg-black/20 border border-white/[0.04] shadow-[inset_0_2px_4px_rgba(0,0,0,0.5)]">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-white/5" strokeWidth="2.5" />
              <circle cx="18" cy="18" r="15.5" fill="none"
                stroke={goal.status === 'active' ? '#fdb813' : goal.status === 'completed' ? '#34d399' : '#fb923c'}
                style={{ filter: `drop-shadow(0 0 4px ${goal.status === 'active' ? 'rgba(253,184,19,0.5)' : goal.status === 'completed' ? 'rgba(52,211,153,0.5)' : 'rgba(251,146,60,0.5)'})` }}
                strokeWidth="2.5" strokeDasharray="97.38" strokeDashoffset={97.38 - (pct / 100) * 97.38} strokeLinecap="round" />
            </svg>
            <span className="absolute text-[10px] sm:text-xs font-black text-white">{pct}%</span>
          </div>

          {/* Goal Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot[goal.status] || statusDot.locked}`} />
              <span className="text-[9px] font-label uppercase tracking-[0.2em] text-on-surface-variant/50">{goal.status}</span>
              <span className="text-[9px] font-label uppercase tracking-wider text-on-surface-variant/40 ml-auto">{done}/{parts.length} parts</span>
            </div>
            <h3 className="text-base sm:text-lg font-black uppercase tracking-tight leading-tight truncate mb-1 text-white">{goal.title}</h3>
            <p className="text-xs text-on-surface-variant/60 truncate">
              {activePart ? `Next: ${activePart.title.split(' || ')[0]}` : activeTask ? `Module: ${activeTask.title}` : pct === 100 ? 'Completed! 🎉' : 'Ready for review'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0 ml-2">
            <button onClick={() => setExpanded(!expanded)} className={`h-9 w-9 rounded-lg border border-white/10 flex items-center justify-center text-on-surface-variant/60 hover:text-white hover:border-white/20 active:translate-y-[2px] transition-all shadow-[0_3px_0_rgba(255,255,255,0.05)] active:shadow-none ${expanded ? 'bg-white/10 text-white' : ''}`}>
              <ChevronDown size={15} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Roadmap */}
      {expanded && (
        <div className="border-t border-white/[0.04] bg-black/20 animate-in slide-in-from-top-2 fade-in duration-300" style={{ transform: 'translateZ(10px)' }}>
          {/* Quick action bar */}
          <div className="flex items-center gap-2 px-5 py-3 bg-white/[0.01] border-b border-white/[0.03]">
            <button onClick={() => onNotes(goal.id)} className="h-8 px-3 rounded-lg border border-[#fdb813]/20 bg-[#fdb813]/10 text-[9px] font-label font-black uppercase tracking-wider text-[#fdb813] hover:bg-[#fdb813]/20 hover:border-[#fdb813]/30 active:translate-y-[1.5px] transition-all flex items-center gap-1.5 shadow-[0_2.5px_0_rgba(253,184,19,0.05)] active:shadow-none">
              <BookText size={12} /> Notebook
            </button>
            <div className="flex-1" />
            <button onClick={() => onToggle(goal.id)} className={`h-8 px-3 rounded-lg border text-[9px] font-label font-black uppercase tracking-wider active:translate-y-[1.5px] transition-all flex items-center gap-1.5 active:shadow-none ${
              isActive 
                ? 'bg-orange-500/10 border-orange-500/20 text-orange-400 hover:bg-orange-500/20 hover:border-orange-500/30 shadow-[0_2.5px_0_rgba(249,115,22,0.05)]' 
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30 shadow-[0_2.5px_0_rgba(16,185,129,0.05)]'
            }`}>
              {isActive ? <><Pause size={10} fill="currentColor" /> Pause</> : <><Play size={10} fill="currentColor" /> Resume</>}
            </button>
            <button onClick={() => { if(confirm('Delete this learning path? This cannot be undone.')) onDelete(goal.id); }}
              className="h-8 w-8 rounded-lg border border-red-500/20 bg-red-500/10 flex items-center justify-center text-red-400 hover:text-red-300 hover:bg-red-500/20 hover:border-red-500/30 active:translate-y-[1.5px] transition-all shadow-[0_2.5px_0_rgba(239,68,68,0.05)] active:shadow-none">
              <Trash2 size={12} />
            </button>
          </div>

          {/* Module list */}
          <div className="divide-y divide-white/[0.04]">
            {tasks.map((task, i) => {
              const tp = task.parts || [];
              const tDone = tp.filter(p => p.status === 'passed').length;
              const tPct = tp.length ? Math.round((tDone / tp.length) * 100) : 0;
              const isModOpen = expandedModule === task.id;
              return (
                <div key={task.id}>
                  <button onClick={() => setExpandedModule(isModOpen ? null : task.id)}
                    className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.03] transition-colors">
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0 border shadow-sm ${
                      task.status === 'passed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      task.status === 'active' ? 'bg-primary/10 text-primary border-primary/20' :
                      'bg-white/[0.03] text-white/40 border-white/10'
                    }`}>
                      {task.status === 'passed' ? <CheckCircle2 size={15} /> : String(i+1).padStart(2,'0')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[13px] font-bold truncate text-white/95">{task.title}</h4>
                      <div className="flex items-center gap-2 mt-1.5">
                        <div className="h-1 flex-1 max-w-[120px] rounded-full bg-white/10"><div className="h-full rounded-full bg-primary" style={{ width: `${tPct}%` }} /></div>
                        <span className="text-[10px] text-on-surface-variant/50 font-medium">{tDone}/{tp.length}</span>
                      </div>
                    </div>
                    <ChevronRight className={`text-on-surface-variant/40 transition-transform shrink-0 ${isModOpen ? 'rotate-90 text-white' : ''}`} size={16} />
                  </button>
                  {isModOpen && (
                    <div className="px-5 pb-4 pt-1">
                      <div className="grid gap-1.5 pl-[44px]">
                        {tp.map(p => (
                          <div key={p.id} className="flex items-center gap-3 rounded-lg bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] transition-colors px-3.5 py-2.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot[p.status] || statusDot.locked} shadow-[0_0_5px_currentColor]`} />
                            <span className={`flex-1 truncate text-xs ${p.status === 'locked' ? 'text-white/40' : 'text-white/90 font-medium'}`}>{p.title.split(' || ')[0]}</span>
                            <span className={`text-[9px] font-label font-bold uppercase tracking-wider ${statusText[p.status] || statusText.locked}`}>{p.status}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </TiltCard>
  );
};


const FEATURED_SLIDES = [
  {
    id: 'dsa',
    subtitle: "Don't Watch My A2Z DSA Course",
    title: "Strivers A2Z-DSA Course | DSA Playlist | Placements",
    progress: 0,
    accent: "bg-primary",
    glow: "from-[#3a2a00]/40",
    light: "bg-primary/[0.06]"
  },
  {
    id: 'sysdesign',
    subtitle: "New Pathway Available",
    title: "System Design Playlist",
    progress: 0,
    accent: "bg-[#fdb813]",
    glow: "from-[#3a2000]/40",
    light: "bg-[#fdb813]/[0.06]"
  },
  {
    id: 'ai-eng',
    subtitle: "Recommended Pathway",
    title: "Generative AI Engineering & LLM Architecture",
    progress: 0,
    accent: "bg-sky-400",
    glow: "from-[#002b3d]/40",
    light: "bg-sky-400/[0.06]"
  }
];

const Dashboard = () => {
  const { user } = useAuth();
  const { goals, allRoadmaps, loading: dataLoading, refreshData, loadAllRoadmaps, setSelectedGoalId } = useData();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [nextSchedule, setNextSchedule] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  const featuredSlides = useMemo(() => {
    if (!goals || goals.length === 0) return FEATURED_SLIDES;
    
    return goals.map(g => {
      const rm = allRoadmaps[g.id];
      const parts = (rm?.tasks || []).flatMap(t => t.parts || []);
      const done = parts.filter(p => p.status === 'passed').length;
      const pct = parts.length ? Math.round((done / parts.length) * 100) : 0;
      
      return {
        id: g.id,
        goalId: g.id,
        subtitle: g.status === 'active' ? "Active Pathway" : "Learning Pathway",
        title: g.title,
        progress: pct,
        accent: "bg-[#fdb813]",
        glow: "from-[#3a2000]/40",
        light: "bg-[#fdb813]/[0.06]"
      };
    });
  }, [goals, allRoadmaps]);

  const slide = featuredSlides[currentSlide % featuredSlides.length] || featuredSlides[0];

  // Auto-rotate featured pathways every 6 seconds
  useEffect(() => {
    if (!featuredSlides.length) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % featuredSlides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [featuredSlides]);

  useEffect(() => { if (!user) navigate('/'); }, [user, navigate]);

  // Load ALL roadmaps when goals are available
  useEffect(() => {
    if (goals.length > 0) loadAllRoadmaps(goals);
  }, [goals]);

  useEffect(() => {
    const calc = () => {
      const sched = user?.study_schedule || ['12:00','18:00'];
      const now = new Date();
      const cur = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      setNextSchedule([...sched].sort().find(t => t > cur) || sched[0] || '--:--');
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [user]);

  if (!user) return null;

  const greeting = getGreeting();
  const name = (user.full_name || user.email.split('@')[0]).split(' ')[0];
  const hasGoals = goals.length > 0;

  // Aggregate stats across ALL goals
  const globalStats = useMemo(() => {
    let totalParts = 0, totalDone = 0;
    goals.forEach(g => {
      const rm = allRoadmaps[g.id];
      if (!rm) return;
      const parts = (rm.tasks || []).flatMap(t => t.parts || []);
      totalParts += parts.length;
      totalDone += parts.filter(p => p.status === 'passed').length;
    });
    const pct = totalParts ? Math.round((totalDone / totalParts) * 100) : 0;
    return { totalParts, totalDone, pct };
  }, [goals, allRoadmaps]);

  const activeGoals = goals.filter(g => g.status === 'active');

  const wrap = async (fn) => { setBusy(true); try { await fn(); await refreshData(); } catch(e) { console.error(e); } finally { setBusy(false); } };

  // ── Empty State ──
  if (!dataLoading && !hasGoals) return (
    <div className="min-h-[80vh] w-full flex items-center justify-center px-4">
      {busy && <NeuralLoader message="Setting up..." />}
      <div className="w-full max-w-2xl text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="w-20 h-20 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/20">
          <GraduationCap className="text-primary" size={36} />
        </div>
        <p className="text-[10px] font-label font-black uppercase tracking-[0.3em] text-primary mb-4">Workspace Empty</p>
        <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight mb-4">Start with one clear <span className="text-primary">objective</span>.</h1>
        <p className="text-on-surface-variant/60 text-sm leading-relaxed max-w-md mx-auto mb-10">
          Edxiom will turn your target into a structured roadmap, schedule sessions, and verify progress with quizzes before unlocking the next step.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3">
          <button onClick={() => navigate('/onboarding')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-4 text-xs font-label font-black uppercase tracking-[0.2em] text-black shadow-lg shadow-primary/20 hover:brightness-110 transition-all active:scale-95">
            Create learning goal <ArrowRight size={16} />
          </button>
          <button onClick={() => navigate('/calendar')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-8 py-4 text-xs font-label font-black uppercase tracking-[0.2em] text-on-surface-variant hover:border-white/20 hover:text-on-surface transition-all">
            View calendar
          </button>
        </div>
      </div>
    </div>
  );

  // ── Main Dashboard ──
  return (
    <div className="w-full pb-16 text-on-surface animate-in fade-in duration-500">
      {busy && <NeuralLoader message="Updating workspace" />}

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[5%] top-[-6rem] h-[500px] w-[500px] rounded-full bg-primary/8 blur-[160px]" />
        <div className="absolute bottom-[-8rem] right-[-4rem] h-[420px] w-[420px] rounded-full bg-emerald-500/8 blur-[160px]" />
        <div className="absolute top-[40%] left-[50%] h-72 w-72 rounded-full bg-sky-500/6 blur-[140px]" />
        <div className="absolute top-[15%] right-[10%] h-56 w-56 rounded-full bg-violet-500/6 blur-[120px]" />
      </div>

      <div className="mx-auto w-full max-w-[1280px] flex flex-col gap-5 px-1 sm:px-3 lg:px-6">

        {/* ── Hero Greeting ── */}
        <header className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 pb-3 px-2 sm:px-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
            <h1 className="text-3xl sm:text-4xl lg:text-[3rem] font-black uppercase tracking-tight leading-none text-white drop-shadow-lg">
              {greeting.text}, <span className="text-primary">{name}</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-label uppercase tracking-widest text-white/20">{greeting.sub}</span>
          </div>
        </header>

        {dataLoading ? (
          <div className="rounded-2xl border border-white/[0.06] bg-surface-container-low/40 p-16 text-center text-on-surface-variant/50 text-sm">Loading workspace...</div>
        ) : (
          <>
            <div className="flex flex-col xl:flex-row gap-8 lg:gap-10">
              {/* ── Left Column: Main Content ── */}
              <div className="flex-1 min-w-0 flex flex-col gap-10">
                {/* ── Featured / Up Next Pathway Carousel ── */}
                <section className="px-1">
                  <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.05] bg-[#111111]/80 p-8 sm:p-12 shadow-2xl group flex flex-col justify-center min-h-[280px]">
                    {/* Ambient Glow on Right */}
                    <div className={`absolute top-0 right-0 w-full md:w-[70%] h-full bg-gradient-to-l ${slide.glow} to-transparent pointer-events-none transition-all duration-1000`} />
                    <div className={`absolute top-1/2 right-0 w-[500px] h-[500px] ${slide.light} rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none transition-all duration-1000`} />

                    <div key={currentSlide} className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-10 animate-in fade-in duration-500">
                      {/* Left Content */}
                      <div className="flex-1 max-w-2xl">
                        <span className="text-[10px] font-label font-black uppercase tracking-[0.25em] text-[#fdb813] mb-4 block drop-shadow-md flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#fdb813]" /> {slide.subtitle}
                        </span>
                        <h2 className="text-4xl sm:text-[2.75rem] font-black uppercase tracking-tighter text-white mb-12 leading-[1.1] drop-shadow-lg">
                          {slide.title}
                        </h2>

                        {/* Progress Area */}
                        <div className="max-w-[280px] sm:max-w-md">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 text-on-surface-variant/60">
                              <Activity size={14} className="text-white/40" />
                              <span className="text-[10px] font-label font-bold uppercase tracking-[0.2em]">Progress</span>
                            </div>
                            <span className="text-xs font-black text-white">{slide.progress}%</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                            <div className="h-full rounded-full bg-white/20" style={{ width: `${slide.progress}%` }} />
                          </div>
                        </div>
                      </div>

                      {/* Right Content / CTA */}
                      <div className="shrink-0 flex items-center gap-4 mt-8 md:mt-0">
                        <button onClick={() => {
                          if (slide?.goalId) setSelectedGoalId(slide.goalId);
                          navigate('/study', { state: { goalId: slide?.goalId } });
                        }} className="h-14 px-8 rounded-xl bg-[#fdb813] text-black text-[11px] font-label font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-95 transition-all flex items-center gap-3 shadow-[0_4px_15px_rgba(253,184,19,0.2)]">
                          Study <ChevronRight size={16} strokeWidth={3} />
                        </button>
                        <button 
                          onClick={() => setCurrentSlide(prev => (prev + 1) % featuredSlides.length)}
                          className="h-14 w-14 rounded-xl border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/30 transition-all bg-white/[0.02]"
                        >
                          <ChevronRight size={20} strokeWidth={2} />
                        </button>
                      </div>
                    </div>

                    {/* Carousel Pagination Dots */}
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
                      {featuredSlides.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentSlide(i)}
                          className={`h-1.5 rounded-full transition-all duration-300 ${
                            i === (currentSlide % featuredSlides.length)
                              ? 'w-5 bg-[#fdb813] shadow-[0_0_8px_rgba(253,184,19,0.5)]' 
                              : 'w-1.5 bg-white/20 hover:bg-white/40'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </section>

                {/* ── All Learning Paths ── */}
                <section>
                  <div className="flex items-center justify-between mb-4 px-1">
                    <h2 className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                      <Target size={15} className="text-primary" /> Your learning paths
                    </h2>
                    <div className="flex items-center gap-2">
                      <span className="h-5 px-2 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-label font-black text-primary uppercase tracking-wider flex items-center">{goals.filter(g=>g.status==='active').length} active</span>
                      <span className="h-5 px-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-label font-black text-emerald-400 uppercase tracking-wider flex items-center">{goals.filter(g=>g.status==='completed').length} done</span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {goals.map(goal => (
                      <GoalCard
                        key={goal.id}
                        goal={goal}
                        roadmapData={allRoadmaps[goal.id]}
                        onStudy={(id) => navigate('/study', { state: { goalId: id } })}
                        onNotes={(id) => navigate('/notebooks', { state: { goalId: id } })}
                        onToggle={(id) => wrap(() => toggleGoalStatus(id))}
                        onDelete={(id) => wrap(() => deleteGoal(id))}
                      />
                    ))}
                  </div>
                </section>
              </div>

              {/* ── Right Column: Side Panel ── */}
              <aside className="w-full xl:w-[280px] shrink-0 flex flex-col gap-5">
                {/* Notebook Card */}
                <div className="p-5 sm:p-6 rounded-[2rem] border border-emerald-500/10 bg-gradient-to-br from-[#0a1a12]/90 to-[#111111]/80 shadow-2xl flex flex-col gap-5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <BookText className="text-emerald-400" size={18} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/90">Notebook</h4>
                      <p className="text-[9px] text-emerald-400/50 font-label uppercase tracking-wider">Your study notes</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/notebooks')} className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 text-black text-[10px] font-label font-black uppercase tracking-[0.2em] hover:brightness-110 active:scale-[0.98] transition-all shadow-[0_4px_15px_rgba(52,211,153,0.2)] flex items-center justify-center gap-2">
                    <BookText size={13} /> Open Editor
                  </button>
                </div>

                {/* Coach Link Card */}
                <div className="p-5 rounded-[2rem] border border-sky-500/10 bg-gradient-to-br from-[#081420]/90 to-[#111111]/80 shadow-2xl flex items-center gap-4 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-full blur-2xl pointer-events-none" />
                  <div className="w-12 h-12 rounded-xl border border-sky-400/20 bg-sky-400/10 flex items-center justify-center shrink-0">
                    <Send className="text-sky-400" size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-black tracking-tight text-white flex items-center gap-1.5 mb-1">
                      Coach Link
                      <span className={`w-1.5 h-1.5 rounded-full shadow-[0_0_5px_currentColor] ${user.telegram_chat_id ? 'bg-emerald-400 text-emerald-400' : 'bg-red-400 text-red-400'}`} />
                    </h4>
                    <p className="text-[10px] text-on-surface-variant/50 font-medium tracking-wide leading-tight">
                      {user.telegram_chat_id ? 'Nudges active.' : 'Offline. Connect Telegram in settings.'}
                    </p>
                  </div>
                </div>

                {/* Today & Streak Card */}
                {(() => {
                  // Compute today's stats from roadmap data
                  const todayStr = new Date().toDateString();
                  let partsPassedToday = 0;
                  let questionsToday = 0;
                  goals.forEach(g => {
                    const rm = allRoadmaps[g.id];
                    if (!rm) return;
                    (rm.tasks || []).flatMap(t => t.parts || []).forEach(p => {
                      if (p.status === 'passed') {
                        // Count if updated today (use updated_at if available)
                        if (p.updated_at && new Date(p.updated_at).toDateString() === todayStr) {
                          partsPassedToday++;
                        }
                        // Count quiz attempts
                        (p.quiz_results || []).forEach(qr => {
                          if (qr.created_at && new Date(qr.created_at).toDateString() === todayStr) {
                            questionsToday += (qr.total_questions || 0);
                          }
                        });
                      }
                    });
                  });

                  // Compute streak: count consecutive days with at least 1 passed part
                  const daySet = new Set();
                  goals.forEach(g => {
                    const rm = allRoadmaps[g.id];
                    if (!rm) return;
                    (rm.tasks || []).flatMap(t => t.parts || []).forEach(p => {
                      if (p.status === 'passed' && p.updated_at) {
                        daySet.add(new Date(p.updated_at).toDateString());
                      }
                    });
                  });
                  let streak = 0;
                  const check = new Date();
                  while (daySet.has(check.toDateString())) {
                    streak++;
                    check.setDate(check.getDate() - 1);
                  }

                  return (
                    <div className="rounded-[2rem] border border-[#fdb813]/15 bg-[#111111]/80 shadow-2xl overflow-hidden">
                      {/* Header */}
                      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-[#fdb813]/10 border border-[#fdb813]/20 flex items-center justify-center">
                            <Zap size={14} className="text-[#fdb813]" />
                          </div>
                          <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white/90">Today</span>
                        </div>
                        <span className="text-[9px] font-label uppercase tracking-widest text-white/20">{new Date().toLocaleDateString('en-US',{weekday:'short', month:'short', day:'numeric'})}</span>
                      </div>

                      {/* Stats row */}
                      <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                        <div className="bg-white/[0.03] rounded-2xl p-3.5 border border-white/[0.04]">
                          <p className="text-[22px] font-black text-[#fdb813] leading-none mb-1">
                            {partsPassedToday} <span className="text-white/20 text-xs font-normal">/ —</span>
                          </p>
                          <p className="text-[9px] font-label font-black uppercase tracking-widest text-white/35">Parts Done</p>
                        </div>
                        <div className="bg-white/[0.03] rounded-2xl p-3.5 border border-white/[0.04]">
                          <p className="text-[22px] font-black text-[#fdb813] leading-none mb-1">
                            {questionsToday} <span className="text-white/20 text-xs font-normal">/ —</span>
                          </p>
                          <p className="text-[9px] font-label font-black uppercase tracking-widest text-white/35">Questions</p>
                        </div>
                      </div>

                      {/* Divider */}
                      <div className="mx-5 h-px bg-white/[0.05]" />

                      {/* Streak row */}
                      <div className="px-5 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-[9px] font-label font-black uppercase tracking-widest text-white/35 mb-2">Streak</p>
                          <div className="flex items-center gap-5">
                            <div>
                              <p className="text-[9px] font-label uppercase tracking-wider text-white/30 mb-0.5">Current</p>
                              <p className="text-base font-black text-[#fdb813]">{streak} day{streak !== 1 ? 's' : ''}</p>
                            </div>
                            <div className="w-px h-8 bg-white/[0.06]" />
                            <div>
                              <p className="text-[9px] font-label uppercase tracking-wider text-white/30 mb-0.5">All-time</p>
                              <p className="text-base font-black text-white/70">{globalStats.totalDone} parts</p>
                            </div>
                          </div>
                        </div>
                        {/* Flame icon badge */}
                        <div className="relative w-11 h-11 shrink-0">
                          <div className="absolute inset-0 rounded-xl bg-[#fdb813]/10 border border-[#fdb813]/20 flex items-center justify-center">
                            <Flame size={20} className={`${streak > 0 ? 'text-[#fdb813]' : 'text-white/20'}`} />
                          </div>
                          {streak > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#fdb813] text-black text-[9px] font-black flex items-center justify-center shadow-[0_0_8px_rgba(253,184,19,0.5)]">
                              {streak}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* See all activity */}
                      <button
                        onClick={() => navigate('/calendar')}
                        className="w-full flex items-center justify-center gap-1.5 py-3.5 border-t border-white/[0.05] text-[9px] font-label font-black uppercase tracking-[0.25em] text-white/30 hover:text-[#fdb813] hover:bg-[#fdb813]/5 transition-all"
                      >
                        See All Activity <ChevronRight size={11} strokeWidth={3} />
                      </button>
                    </div>
                  );
                })()}
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
