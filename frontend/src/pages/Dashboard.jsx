import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { toggleGoalStatus, deleteGoal, activateGoal } from '../services/api';
import NeuralLoader from '../components/NeuralLoader';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  BookText,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock3,
  GraduationCap,
  Pause,
  Play,
  Plus,
  Send,
  ShieldCheck,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';

const statusStyles = {
  passed: 'bg-secondary/10 text-secondary border-secondary/20',
  active: 'bg-primary/10 text-primary border-primary/20',
  locked: 'bg-white/[0.03] text-on-surface-variant/50 border-white/5',
  paused: 'bg-white/[0.03] text-on-surface-variant/60 border-white/5',
  completed: 'bg-secondary/10 text-secondary border-secondary/20',
};

const Dashboard = () => {
  const { user } = useAuth();
  const { goals, roadmap, loading: dataLoading, refreshData, selectedGoalId, setSelectedGoalId } = useData();
  const navigate = useNavigate();
  const [activationLoading, setActivationLoading] = useState(false);
  const [nextSchedule, setNextSchedule] = useState('');
  const [expandedTasks, setExpandedTasks] = useState(new Set());

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    const getNextTime = () => {
      const schedule = user?.study_schedule || ['12:00', '18:00'];
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const sorted = [...schedule].sort();
      setNextSchedule(sorted.find((time) => time > current) || sorted[0] || '--:--');
    };

    getNextTime();
    const interval = setInterval(getNextTime, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const activeTask = roadmap?.tasks?.find((task) => task.status === 'active');
    if (activeTask) setExpandedTasks(new Set([activeTask.id]));
  }, [roadmap]);

  useEffect(() => {
    if (!user) navigate('/');
  }, [user, navigate]);

  const goalStats = useMemo(() => {
    const tasks = roadmap?.tasks || [];
    const parts = tasks.flatMap((task) => task.parts || []);
    const completedParts = parts.filter((part) => part.status === 'passed').length;
    const activePart = parts.find((part) => part.status === 'active') || null;
    const activeTask = tasks.find((task) => task.status === 'active') || null;
    const progress = parts.length ? Math.round((completedParts / parts.length) * 100) : 0;

    return { tasks, parts, completedParts, activePart, activeTask, progress };
  }, [roadmap]);

  if (!user) return null;

  const displayName = user.full_name || user.email.split('@')[0];
  const firstName = displayName.split(' ')[0];
  const activeGoals = goals.filter((goal) => goal.status === 'active');
  const completedGoals = goals.filter((goal) => goal.status === 'completed');
  const currentGoal = roadmap?.goal || goals.find((goal) => goal.id === selectedGoalId) || activeGoals[0] || goals[0];
  const hasGoals = goals.length > 0;

  const handleToggleStatus = async (goalId) => {
    setActivationLoading(true);
    try {
      await toggleGoalStatus(goalId);
      await refreshData();
    } catch (error) {
      console.error(error.message);
    } finally {
      setActivationLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm('Delete this learning path? This cannot be undone.')) return;
    setActivationLoading(true);
    try {
      await deleteGoal(goalId);
      await refreshData();
    } catch (error) {
      console.error(error.message);
    } finally {
      setActivationLoading(false);
    }
  };

  const handleSwitchGoal = async (goalId) => {
    setActivationLoading(true);
    try {
      setSelectedGoalId(goalId);
      await activateGoal(goalId);
      await refreshData();
    } catch (error) {
      console.error('Failed to switch learning path.', error);
    } finally {
      setActivationLoading(false);
    }
  };

  const toggleTask = (taskId) => {
    setExpandedTasks((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else {
        next.clear();
        next.add(taskId);
      }
      return next;
    });
  };

  const metrics = [
    { label: 'Active paths', value: activeGoals.length, detail: `${goals.length} total`, icon: Target, tone: 'text-primary' },
    { label: 'Mastery', value: `${goalStats.progress}%`, detail: `${goalStats.completedParts}/${goalStats.parts.length || 0} parts`, icon: ShieldCheck, tone: 'text-secondary' },
    { label: 'Streak', value: user.current_streak, detail: 'days verified', icon: TrendingUp, tone: 'text-primary' },
    { label: 'Next session', value: nextSchedule || '--:--', detail: user.timezone || 'Local time', icon: CalendarClock, tone: 'text-on-surface' },
  ];

  return (
    <div className="min-h-screen w-full pb-12 text-on-surface">
      {activationLoading && <NeuralLoader message="Updating workspace" />}

      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[12%] top-[-10rem] h-96 w-96 rounded-full bg-primary/8 blur-[140px]" />
        <div className="absolute bottom-[-12rem] right-[-6rem] h-[30rem] w-[30rem] rounded-full bg-secondary/5 blur-[160px]" />
      </div>

      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-1 sm:px-3 lg:px-6">
        <header className="rounded-lg border border-white/10 bg-surface-container-low/50 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-label font-black uppercase tracking-[0.22em] text-primary">
                  <Activity size={13} />
                  Learning command center
                </span>
                <span className="text-[10px] font-label uppercase tracking-[0.2em] text-on-surface-variant/50">
                  {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                </span>
              </div>
              <h1 className="max-w-4xl text-3xl font-black uppercase leading-none tracking-tight text-on-surface sm:text-4xl lg:text-5xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-on-surface-variant/65">
                Track goals, continue your current module, and keep your study system moving from one focused workspace.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={() => navigate('/study')}
                disabled={!hasGoals}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-5 py-3 text-xs font-label font-black uppercase tracking-[0.18em] text-on-surface transition hover:border-secondary/30 hover:text-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <BookOpen size={16} />
                Study
              </button>
              <button
                onClick={() => navigate('/onboarding')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-xs font-label font-black uppercase tracking-[0.18em] text-black shadow-xl shadow-primary/15 transition hover:brightness-110"
              >
                <Plus size={16} />
                New path
              </button>
            </div>
          </div>
        </header>

        {dataLoading ? (
          <div className="rounded-lg border border-white/10 bg-surface-container-low/40 p-12 text-center text-on-surface-variant">
            Loading workspace...
          </div>
        ) : !hasGoals ? (
          <section className="grid min-h-[560px] overflow-hidden rounded-lg border border-white/10 bg-surface-container-low/40 shadow-2xl shadow-black/20 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
              <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                <GraduationCap className="text-primary" size={30} />
              </div>
              <p className="mb-3 text-[10px] font-label font-black uppercase tracking-[0.25em] text-primary">Workspace setup</p>
              <h2 className="max-w-xl text-3xl font-black uppercase leading-tight tracking-tight sm:text-4xl">
                Start with one clear learning objective.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-on-surface-variant/70 sm:text-base">
                Edxiom will turn your target into a structured roadmap, schedule your sessions, and verify progress with quizzes before unlocking the next part.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => navigate('/onboarding')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-xs font-label font-black uppercase tracking-[0.2em] text-black shadow-xl shadow-primary/20 transition hover:brightness-110"
                >
                  Create learning goal
                  <ArrowRight size={16} />
                </button>
                <button
                  onClick={() => navigate('/calendar')}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-6 py-3 text-xs font-label font-black uppercase tracking-[0.2em] text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
                >
                  View calendar
                </button>
              </div>
            </div>

            <div className="border-t border-white/10 bg-background/40 p-6 lg:border-l lg:border-t-0 lg:p-8">
              <div className="grid h-full content-center gap-4">
                {[
                  ['Define target', 'Tell Edxiom what you want to learn and your current level.'],
                  ['Approve roadmap', 'Review the AI-generated path, refine it, then activate.'],
                  ['Verify mastery', 'Study each part, pass quizzes, and unlock the next step.'],
                ].map(([title, detail], index) => (
                  <div key={title} className="rounded-lg border border-white/10 bg-surface-container-low/60 p-5">
                    <div className="mb-4 flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-xs font-black text-primary">
                        {index + 1}
                      </span>
                      <h3 className="font-black uppercase tracking-tight">{title}</h3>
                    </div>
                    <p className="text-sm leading-relaxed text-on-surface-variant/65">{detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className="rounded-lg border border-white/10 bg-surface-container-low/45 p-5 shadow-lg shadow-black/10">
                  <div className="mb-5 flex items-center justify-between">
                    <span className="text-[10px] font-label font-black uppercase tracking-[0.2em] text-on-surface-variant/55">{metric.label}</span>
                    <metric.icon className={metric.tone} size={18} />
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <span className="text-3xl font-black tracking-tight text-on-surface">{metric.value}</span>
                    <span className="text-right text-[10px] font-label uppercase tracking-[0.16em] text-on-surface-variant/45">{metric.detail}</span>
                  </div>
                </div>
              ))}
            </section>

            <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
              <div className="space-y-6">
                <div className="overflow-hidden rounded-lg border border-white/10 bg-surface-container-low/45 shadow-2xl shadow-black/20">
                  <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
                    <div className="p-6 sm:p-8">
                      <div className="mb-6 flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-3 py-1.5 text-[10px] font-label font-black uppercase tracking-[0.2em] text-primary">
                          <Target size={13} />
                          Current focus
                        </span>
                        <span className="text-[10px] font-label uppercase tracking-[0.18em] text-on-surface-variant/50">
                          {currentGoal?.status || 'active'}
                        </span>
                      </div>

                      <h2 className="max-w-4xl text-2xl font-black uppercase leading-tight tracking-tight text-on-surface sm:text-4xl">
                        {currentGoal?.title || 'Select a learning path'}
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-on-surface-variant/65">
                        {goalStats.activePart
                          ? `Next part: ${goalStats.activePart.title.split(' || ')[0]}`
                          : goalStats.activeTask
                            ? `Continue task: ${goalStats.activeTask.title}`
                            : 'Your active roadmap is ready for review.'}
                      </p>

                      <div className="mt-8">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-[10px] font-label font-black uppercase tracking-[0.2em] text-on-surface-variant/55">Roadmap completion</span>
                          <span className="text-sm font-black text-primary">{goalStats.progress}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-background">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary shadow-[0_0_18px_rgba(253,184,19,0.45)] transition-all duration-700"
                            style={{ width: `${goalStats.progress}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <button
                          onClick={() => navigate('/study', { state: { goalId: currentGoal?.id } })}
                          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-xs font-label font-black uppercase tracking-[0.18em] text-black transition hover:brightness-110"
                        >
                          Continue study
                          <ChevronRight size={16} />
                        </button>
                        <button
                          onClick={() => navigate('/notebooks', { state: { goalId: currentGoal?.id } })}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-5 py-3 text-xs font-label font-black uppercase tracking-[0.18em] text-on-surface-variant transition hover:border-white/20 hover:text-on-surface"
                        >
                          <BookText size={16} />
                          Notebook
                        </button>
                      </div>
                    </div>

                    <div className="border-t border-white/10 bg-background/35 p-6 lg:border-l lg:border-t-0">
                      <div className="grid h-full gap-4">
                        <div className="rounded-lg border border-white/10 bg-surface-container-low/70 p-4">
                          <div className="mb-3 flex items-center gap-2 text-primary">
                            <Clock3 size={16} />
                            <span className="text-[10px] font-label font-black uppercase tracking-[0.2em]">Next session</span>
                          </div>
                          <p className="text-3xl font-black">{nextSchedule || '--:--'}</p>
                          <p className="mt-1 text-xs text-on-surface-variant/55">{user.timezone || 'Local timezone'}</p>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-surface-container-low/70 p-4">
                          <div className="mb-3 flex items-center gap-2 text-secondary">
                            <CheckCircle2 size={16} />
                            <span className="text-[10px] font-label font-black uppercase tracking-[0.2em]">Verified</span>
                          </div>
                          <p className="text-3xl font-black">{goalStats.completedParts}</p>
                          <p className="mt-1 text-xs text-on-surface-variant/55">completed roadmap parts</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-white/10 bg-surface-container-low/45 shadow-xl shadow-black/10">
                  <div className="flex flex-col gap-3 border-b border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-lg font-black uppercase tracking-tight">Roadmap progress</h3>
                      <p className="mt-1 text-xs text-on-surface-variant/55">Expand a module to inspect its parts and mastery state.</p>
                    </div>
                    <span className="inline-flex w-fit items-center gap-2 rounded-md border border-white/10 px-3 py-1.5 text-[10px] font-label uppercase tracking-[0.16em] text-on-surface-variant">
                      <BarChart3 size={13} />
                      {goalStats.tasks.length} modules
                    </span>
                  </div>

                  <div className="divide-y divide-white/5">
                    {goalStats.tasks.map((task, index) => {
                      const parts = task.parts || [];
                      const passed = parts.filter((part) => part.status === 'passed').length;
                      const progress = parts.length ? Math.round((passed / parts.length) * 100) : 0;
                      const isExpanded = expandedTasks.has(task.id);

                      return (
                        <div key={task.id}>
                          <button
                            onClick={() => toggleTask(task.id)}
                            className="grid w-full gap-4 p-5 text-left transition hover:bg-white/[0.025] sm:grid-cols-[48px_1fr_150px_96px_24px] sm:items-center"
                          >
                            <span className="flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-background/50 text-xs font-black text-on-surface-variant">
                              {String(index + 1).padStart(2, '0')}
                            </span>
                            <div className="min-w-0">
                              <h4 className="truncate text-sm font-bold text-on-surface">{task.title}</h4>
                              <p className="mt-1 text-xs text-on-surface-variant/50">{passed}/{parts.length} parts complete</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-background">
                                <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
                              </div>
                              <span className="w-8 text-right text-xs font-bold text-on-surface-variant">{progress}%</span>
                            </div>
                            <span className={`w-fit rounded-md border px-2.5 py-1 text-[9px] font-label font-black uppercase tracking-[0.16em] ${statusStyles[task.status] || statusStyles.locked}`}>
                              {task.status === 'passed' ? 'verified' : task.status}
                            </span>
                            <ChevronRight className={`text-on-surface-variant/40 transition ${isExpanded ? 'rotate-90' : ''}`} size={18} />
                          </button>

                          {isExpanded && (
                            <div className="border-t border-white/5 bg-background/35 px-5 py-4">
                              <div className="grid gap-2 sm:pl-14">
                                {parts.map((part) => (
                                  <div key={part.id} className="flex items-center justify-between gap-4 rounded-md border border-white/5 bg-surface-container-low/45 px-3 py-2.5">
                                    <div className="flex min-w-0 items-center gap-3">
                                      {part.status === 'passed' ? (
                                        <CheckCircle2 className="shrink-0 text-secondary" size={15} />
                                      ) : part.status === 'active' ? (
                                        <Circle className="shrink-0 fill-primary/20 text-primary" size={15} />
                                      ) : (
                                        <Circle className="shrink-0 text-on-surface-variant/25" size={15} />
                                      )}
                                      <span className="truncate text-xs font-medium text-on-surface-variant">
                                        {part.title.split(' || ')[0]}
                                      </span>
                                    </div>
                                    <span className={`shrink-0 rounded border px-2 py-1 text-[8px] font-label uppercase tracking-[0.14em] ${statusStyles[part.status] || statusStyles.locked}`}>
                                      {part.status}
                                    </span>
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
              </div>

              <aside className="space-y-6">
                <div className="rounded-lg border border-white/10 bg-surface-container-low/45 p-5 shadow-xl shadow-black/10">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-black uppercase tracking-tight">Learning paths</h3>
                      <p className="mt-1 text-xs text-on-surface-variant/55">{completedGoals.length} completed</p>
                    </div>
                    <button
                      onClick={() => navigate('/onboarding')}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-black transition hover:brightness-110"
                      title="Add learning path"
                    >
                      <Plus size={17} />
                    </button>
                  </div>

                  <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                    {goals.map((goal) => {
                      const isSelected = goal.id === (roadmap?.goal?.id || selectedGoalId);
                      const isActive = goal.status === 'active';

                      return (
                        <div
                          key={goal.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => !isSelected && handleSwitchGoal(goal.id)}
                          onKeyDown={(event) => {
                            if ((event.key === 'Enter' || event.key === ' ') && !isSelected) handleSwitchGoal(goal.id);
                          }}
                          className={`group rounded-lg border p-3 transition ${
                            isSelected
                              ? 'border-primary/30 bg-primary/8'
                              : 'border-white/5 bg-background/25 hover:border-white/10 hover:bg-white/[0.025]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className={`truncate text-sm font-bold ${isSelected ? 'text-primary' : 'text-on-surface'}`}>{goal.title}</h4>
                              <div className="mt-2 flex items-center gap-2">
                                <span className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-primary' : goal.status === 'completed' ? 'bg-secondary' : 'bg-on-surface-variant/30'}`} />
                                <span className="text-[9px] font-label uppercase tracking-[0.16em] text-on-surface-variant/55">{goal.status}</span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
                              <button
                                onClick={() => handleToggleStatus(goal.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-on-surface-variant transition hover:border-primary/30 hover:text-primary"
                                title={isActive ? 'Pause path' : 'Activate path'}
                              >
                                {isActive ? <Pause size={12} fill="currentColor" /> : <Play size={12} fill="currentColor" />}
                              </button>
                              <button
                                onClick={() => handleDeleteGoal(goal.id)}
                                className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-on-surface-variant transition hover:border-error/30 hover:text-error"
                                title="Delete path"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-white/10 bg-surface-container-low/45 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-background/40">
                      <BookText className="text-primary" size={18} />
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-tight">Notebook</h3>
                      <p className="text-xs text-on-surface-variant/55">Capture study notes</p>
                    </div>
                  </div>
                  <p className="mb-5 line-clamp-3 text-sm leading-relaxed text-on-surface-variant/65">
                    {(Array.isArray(roadmap?.goal?.notes)
                      ? roadmap.goal.notes.find((block) => block.type === 'text')?.content?.replace(/<[^>]*>?/gm, '')
                      : null) || 'Keep formulas, summaries, references, and insights beside your active path.'}
                  </p>
                  <button
                    onClick={() => navigate('/notebooks')}
                    className="w-full rounded-lg border border-white/10 px-4 py-3 text-xs font-label font-black uppercase tracking-[0.18em] text-on-surface transition hover:border-primary/30 hover:text-primary"
                  >
                    Open notebook
                  </button>
                </div>

                <div className="rounded-lg border border-white/10 bg-surface-container-low/45 p-5">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10">
                      <Send className="text-primary" size={18} />
                    </div>
                    <div>
                      <h3 className="font-black uppercase tracking-tight">Coach link</h3>
                      <p className="text-xs text-on-surface-variant/55">
                        {user.telegram_chat_id ? 'Telegram connected' : 'Telegram not connected'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-white/10 bg-background/35 px-3 py-2">
                    <span className={`h-2 w-2 rounded-full ${user.telegram_chat_id ? 'bg-secondary' : 'bg-error'}`} />
                    <span className="text-xs text-on-surface-variant/65">
                      {user.telegram_chat_id ? 'Daily nudges are active.' : 'Open settings from the profile menu to connect.'}
                    </span>
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
