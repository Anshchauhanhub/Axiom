import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { quickActivateGoal, toggleGoalStatus, deleteGoal, activateGoal } from '../services/api';
import NeuralLoader from '../components/NeuralLoader';
import { Trash2, Play, Pause, History, BookOpen, ShieldCheck, Zap, Cpu, Send, CheckCircle2, Circle, ChevronRight, Activity, BookText } from 'lucide-react';


const Dashboard = () => {
  const { user } = useAuth();
  const { goals, roadmap, loading: dataLoading, refreshData, selectedGoalId, setSelectedGoalId } = useData();
  const navigate = useNavigate();
  const [activePartId, setActivePartId] = useState(null);
  const [activePartTitle, setActivePartTitle] = useState('');
  const [activationLoading, setActivationLoading] = useState(false);
  const [nextSchedule, setNextSchedule] = useState('');
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    const getNextTime = () => {
      const schedule = user?.study_schedule || ['12:00', '18:00'];
      const now = new Date();
      const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const sorted = [...schedule].sort();
      const next = sorted.find(t => t > current) || sorted[0];
      setNextSchedule(next);
    };
    getNextTime();
    const interval = setInterval(getNextTime, 60000);
    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    const activeGoals = goals.filter(g => g.status === 'active');
    if (activeGoals.length <= 1) return;
    const interval = setInterval(() => {
      setHeroIndex((prev) => (prev + 1) % activeGoals.length);
    }, 6000); // Rotate every 6 seconds
    return () => clearInterval(interval);
  }, [goals]);



  useEffect(() => {
    if (roadmap && roadmap.tasks) {
      // Find first active part
      let found = false;
      for (const task of roadmap.tasks) {
        if (!task.parts) continue;
        for (const part of task.parts) {
          if (part.status === 'active') {
            setActivePartId(part.id);
            setActivePartTitle(part.title.split(' || ')[0]);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      // Initialize expanded tasks with the first active one
      if (roadmap.tasks) {
        const activeTask = roadmap.tasks.find(t => t.status === 'active');
        if (activeTask) {
          setExpandedTasks(new Set([activeTask.id]));
        } else {
          setExpandedTasks(new Set());
        }
      }
    }
  }, [roadmap]);

  const toggleTask = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
      newExpanded.clear();
      newExpanded.add(taskId);
    }
    setExpandedTasks(newExpanded);
  };

  const handleSelectGoal = async (title) => {
    if (title === 'CUSTOM') {
      navigate('/onboarding');
      return;
    }
    setActivationLoading(true);
    try {
      await quickActivateGoal(title);
      await refreshData();
    } catch (e) {
      console.error(e);
    } finally {
      setActivationLoading(false);
    }
  };

  const handleToggleStatus = async (goalId) => {
    setActivationLoading(true);
    try {
      await toggleGoalStatus(goalId);
      await refreshData();
    } catch (e) {
      console.error(e.message);
    } finally {
      setActivationLoading(false);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!window.confirm("Permanently purge this neural path? This cannot be undone.")) return;
    setActivationLoading(true);
    try {
      await deleteGoal(goalId);
      await refreshData();
    } catch (e) {
      console.error(e.message);
    } finally {
      setActivationLoading(false);
    }
  };

  const handleSwitchGoal = async (id) => {
    setActivationLoading(true);
    try {
      await activateGoal(id);
      await refreshData();
    } catch (e) {
      console.error("Failed to switch learning path.");
    } finally {
      setActivationLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user) return null;

  const completedTasks = roadmap?.tasks?.filter(t => t.status === 'passed').length || 0;
  const totalTasks = roadmap?.tasks?.length || 0;
  const activeGoals = goals.filter(g => g.status === 'active');
  const archivedGoals = goals.filter(g => g.status !== 'active');

  return (
    <div className="animate-in fade-in duration-700 min-h-screen pb-24 relative">
      {activationLoading && <NeuralLoader message="Calibrating Neural Pathways" />}

      {/* Background glow effect */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/5 blur-[120px] rounded-[100%] pointer-events-none"></div>

      <div className="w-full mx-auto relative z-10">

        {/* Minimal Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tighter text-on-surface mb-1 font-headline uppercase">
              Welcome back, {user.full_name || user.email.split('@')[0]}
            </h2>

          </div>
        </div>

        {/* KPI Header Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-10">
          <div className="bg-surface-container-low/50 border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors">
            <span className="text-[9px] font-label font-black tracking-[0.2em] uppercase text-on-surface-variant/60 mb-3">Active Paths</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-headline font-black text-on-surface leading-none">{activeGoals.length}</span>
              <span className="text-[10px] font-label text-primary mb-1 uppercase tracking-widest">Focusing</span>
            </div>
          </div>

          <div className="bg-surface-container-low/50 border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors group">
            <span className="text-[9px] font-label font-black tracking-[0.2em] uppercase text-on-surface-variant/60 mb-3 flex items-center justify-between">
              Consistency
              <Activity className="w-3.5 h-3.5 text-primary group-hover:animate-pulse" />
            </span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-headline font-black text-on-surface leading-none">{user.current_streak}</span>
              <span className="text-[10px] font-label text-on-surface-variant mb-1 uppercase tracking-widest">Days</span>
            </div>
          </div>

          <div className="bg-surface-container-low/50 border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors">
            <span className="text-[9px] font-label font-black tracking-[0.2em] uppercase text-on-surface-variant/60 mb-3 flex items-center justify-between">
              Global Mastery
              <ShieldCheck className="w-3.5 h-3.5 text-on-surface-variant/40" />
            </span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-headline font-black text-on-surface leading-none">{totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%</span>
              <span className="text-[10px] font-label text-on-surface-variant mb-1 uppercase tracking-widest">Verified</span>
            </div>
          </div>

          <div className="bg-surface-container-low/50 border border-white/5 rounded-2xl p-6 flex flex-col justify-between hover:border-white/10 transition-colors">
            <span className="text-[9px] font-label font-black tracking-[0.2em] uppercase text-on-surface-variant/60 mb-3">Next Sync</span>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-headline font-black text-on-surface leading-none tracking-tighter">{nextSchedule || '--:--'}</span>
              <span className="text-[10px] font-label text-on-surface-variant mb-1 uppercase tracking-widest">Today</span>
            </div>
          </div>
        </div>

        {/* Main Split View */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">

          {/* LEFT COLUMN: FOCUS ZONE */}
          <div className="lg:col-span-8 flex flex-col gap-8">



            {/* Path Hero (Auto-rotating Netflix style) */}
            {activeGoals.length > 0 ? (() => {
              const currentGoal = activeGoals[heroIndex] || activeGoals[0];
              const isSelected = currentGoal.id === roadmap?.goal?.id;
              const displayTitle = currentGoal.title;
              const displayPartTitle = isSelected ? activePartTitle : 'NEW PATHWAY AVAILABLE';
              const displayProgress = isSelected ? (totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0) : 0;

              return (
              <div className="bg-surface-container-low/40 backdrop-blur-xl border border-white/10 rounded-[2.5rem] p-8 sm:p-10 relative overflow-hidden group shadow-2xl transition-all duration-500">
                {/* Subtle Background Glow inside card */}
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none transition-opacity duration-700 opacity-100"></div>
                <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent"></div>

                <div key={currentGoal.id} className="relative z-10 animate-in fade-in duration-1000">
                  <div className="flex items-center gap-3 mb-8">
                    <span className="text-[10px] font-label text-primary font-bold tracking-[0.2em] uppercase flex items-center gap-2 max-w-full overflow-hidden">
                      {isSelected && <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-primary animate-pulse"></span>}
                      <span className="truncate">{displayPartTitle}</span>
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black font-headline text-on-surface uppercase tracking-tighter leading-[1.1] mb-12 max-w-4xl break-words">
                    {displayTitle}
                  </h2>

                  <div className="flex flex-col sm:flex-row sm:items-end gap-8 justify-between">
                    <div className="flex-1 w-full max-w-lg h-[46px]">
                        <div className="animate-in fade-in duration-500">
                          <div className="flex justify-between items-end mb-3">
                            <span className="text-[10px] font-label font-black uppercase tracking-[0.2em] text-on-surface-variant/80 flex items-center gap-2">
                              <Activity className="w-3 h-3" /> Progress
                            </span>
                            <span className="text-sm font-headline font-black text-on-surface">{displayProgress}%</span>
                          </div>
                          <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden border border-white/5">
                            <div
                              className="h-full bg-gradient-to-r from-primary to-primary transition-all duration-1000 relative shadow-[0_0_15px_rgba(253,184,19,0.8)]"
                              style={{ width: `${displayProgress}%` }}
                            >
                              <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/40"></div>
                            </div>
                          </div>
                        </div>
                    </div>

                    <button
                      onClick={() => {
                        if (!isSelected) {
                          handleSwitchGoal(currentGoal.id);
                        } else {
                          navigate('/study', { state: { goalId: currentGoal.id } });
                        }
                      }}
                      className="shrink-0 w-full sm:w-auto px-12 py-5 bg-primary text-on-primary-container rounded-2xl font-label font-black text-[11px] tracking-[0.25em] uppercase hover:brightness-110 transition-all shadow-2xl shadow-primary/30 active:scale-95 flex justify-center items-center gap-3 border border-white/10"
                    >
                      {isSelected ? 'Initialize' : 'Switch Focus'}
                      <ChevronRight size={16} strokeWidth={3} />
                    </button>
                  </div>
                </div>
                
                {/* Carousel Next Arrow */}
                {activeGoals.length > 1 && (
                  <button
                    onClick={() => setHeroIndex((prev) => (prev + 1) % activeGoals.length)}
                    className="absolute right-4 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full border border-primary/50 text-primary flex items-center justify-center bg-black/20 hover:bg-primary/10 hover:border-primary transition-all z-20 group cursor-pointer"
                  >
                    <ChevronRight size={20} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                )}
                
                {/* Carousel Indicators */}
                {activeGoals.length > 1 && (
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
                    {activeGoals.map((_, idx) => (
                      <button 
                        key={idx} 
                        onClick={() => setHeroIndex(idx)}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === heroIndex ? 'bg-primary w-4' : 'bg-white/30 hover:bg-white/50'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
              );
            })() : (
              <div className="bg-surface-container-lowest border border-dashed border-white/10 rounded-[2.5rem] p-16 text-center flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-20 h-20 rounded-full bg-surface-container flex items-center justify-center border border-white/5 mb-6">
                  <Zap className="text-on-surface-variant/30" size={32} />
                </div>
                <h3 className="text-xl font-headline font-black uppercase tracking-widest text-on-surface mb-2">No Active Synapses</h3>
                <p className="text-[11px] font-label uppercase tracking-widest text-on-surface-variant mb-8 max-w-sm leading-relaxed">Establish a new neural pathway to begin your learning protocol.</p>
                <button onClick={() => navigate('/onboarding')} className="px-10 py-4 bg-primary text-on-primary-container font-label font-bold text-[10px] tracking-[0.2em] rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 uppercase">
                  Set New Goal
                </button>
              </div>
            )}

            {/* High-Density Curriculum List */}
            {roadmap && activeGoals.length > 0 && (
              <div className="mt-4">


                <div className="bg-surface-container-lowest border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                  <div className="divide-y divide-white/5 max-h-[550px] overflow-y-auto custom-scrollbar">
                    {[...(roadmap?.tasks || [])].map((task, idx) => {
                      const taskPassed = task.parts?.filter(p => p.status === 'passed').length || 0;
                      const taskTotal = task.parts?.length || 0;
                      const progress = taskTotal > 0 ? Math.round((taskPassed / taskTotal) * 100) : 0;
                      const isExpanded = expandedTasks.has(task.id);

                      return (
                        <div key={task.id} className="group">
                          {/* Task Row */}
                          <div
                            className="px-6 py-5 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 cursor-pointer hover:bg-surface-container-low/50 transition-colors"
                            onClick={() => toggleTask(task.id)}
                          >
                            <div className="flex items-center gap-4 sm:gap-6 flex-1 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center shrink-0 border border-white/5 text-[10px] font-label font-black text-on-surface-variant/80 group-hover:text-on-surface transition-colors">
                                {String(idx + 1).padStart(2, '0')}
                              </div>

                              <div className="flex-1 min-w-0">
                                <h4 className="text-[13px] sm:text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors leading-relaxed">{task.title}</h4>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 pl-12 sm:pl-0">
                              <div className="flex items-center gap-3 w-32">
                                <span className="text-[9px] font-label text-on-surface-variant tracking-[0.1em] font-bold min-w-[28px]">{progress}%</span>
                                <div className="h-1 flex-1 bg-surface-container rounded-full overflow-hidden border border-white/5">
                                  <div className={`h-full ${progress === 100 ? 'bg-primary shadow-[0_0_10px_rgba(253,184,19,0.5)]' : 'bg-secondary'} transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className={`text-[8px] sm:text-[9px] font-label font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-md border ${task.status === 'passed' ? 'bg-primary/10 text-primary border-primary/20' :
                                    task.status === 'active' ? 'bg-secondary/10 text-secondary border-secondary/20' :
                                      'bg-surface-container-highest/50 text-on-surface-variant/60 border-transparent'
                                  }`}>
                                  {task.status === 'passed' ? 'Verified' : task.status}
                                </span>
                                <span className={`material-symbols-outlined text-sm text-on-surface-variant/40 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                  expand_more
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Expandable Parts List */}
                          {isExpanded && (
                            <div className="bg-[#0f1115] px-6 sm:px-8 py-5 border-t border-white/5 shadow-inner">
                              <div className="space-y-4 sm:pl-[3.25rem] relative before:absolute before:left-6 sm:before:left-[1.625rem] before:top-2 before:bottom-2 before:w-px before:bg-white/5">
                                {(task.parts || []).map(part => (
                                  <div key={part.id} className="flex items-center justify-between group/part relative pl-8 sm:pl-0">
                                    <div className="absolute left-0 sm:-left-6 top-1/2 w-4 h-px bg-white/10"></div>
                                    <div className="flex items-center gap-4 min-w-0 flex-1">
                                      {part.status === 'passed' ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                      ) : part.status === 'active' ? (
                                        <Circle className="w-3.5 h-3.5 text-secondary fill-secondary/20 animate-pulse shrink-0" />
                                      ) : (
                                        <Circle className="w-3.5 h-3.5 text-on-surface-variant/20 shrink-0" />
                                      )}
                                      <span className={`text-[11px] sm:text-xs truncate ${part.status === 'passed' ? 'text-on-surface font-bold' : part.status === 'active' ? 'text-secondary font-bold' : 'text-on-surface-variant/70 font-medium'}`}>
                                        {(part.title || '').split(' || ')[0]}
                                      </span>
                                    </div>
                                    <span className={`shrink-0 ml-4 text-[8px] font-label font-bold uppercase tracking-[0.2em] ${part.status === 'passed' ? 'text-primary/70' : part.status === 'active' ? 'text-secondary/70' : 'text-on-surface-variant/30'}`}>
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
            )}
          </div>

          {/* RIGHT COLUMN: AUXILIARY SYSTEMS */}
          <div className="lg:col-span-4 flex flex-col gap-6 lg:gap-8">



            {/* Learning Paths */}
            <div className="bg-surface-container-low/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col flex-1 shadow-lg min-h-[300px] max-h-[400px]">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <Cpu className="w-4 h-4 text-on-surface-variant animate-pulse" />
                  <span className="text-[10px] font-label font-black tracking-[0.2em] uppercase text-on-surface">Learning Paths</span>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => navigate('/onboarding')} 
                    className="w-7 h-7 rounded-full bg-surface-container hover:bg-primary/20 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors border border-white/5"
                    title="Add Learning Path"
                  >
                    <span className="material-symbols-outlined text-sm font-bold">add</span>
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2">
                {goals.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center opacity-30 mt-8">
                    <History className="w-8 h-8 mb-3 stroke-[1.5]" />
                    <span className="text-[9px] font-label font-bold uppercase tracking-[0.2em]">No Pathways Established</span>
                  </div>
                ) : (
                  [...goals].sort((a, b) => {
                    const aSelected = a.id === (roadmap?.goal?.id || selectedGoalId);
                    const bSelected = b.id === (roadmap?.goal?.id || selectedGoalId);
                    if (aSelected && !bSelected) return -1;
                    if (!aSelected && bSelected) return 1;

                    const aActive = a.status === 'active';
                    const bActive = b.status === 'active';
                    if (aActive && !bActive) return -1;
                    if (!aActive && bActive) return 1;

                    return 0;
                  }).map(goal => {
                    const isSelected = goal.id === (roadmap?.goal?.id || selectedGoalId);
                    const isActive = goal.status === 'active';
                    
                    return (
                      <div 
                        key={goal.id} 
                        onClick={() => {
                          if (!isSelected) {
                            setActivationLoading(true);
                            setSelectedGoalId(goal.id);
                            refreshData().then(() => setActivationLoading(false));
                          }
                        }}
                        className={`group/archive flex items-center justify-between gap-4 p-3.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/5 border-primary/25 shadow-[0_0_15px_rgba(253,184,19,0.05)]'
                            : 'border-transparent hover:border-white/5 hover:bg-surface-container-lowest'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className={`text-[11px] font-bold truncate mb-1 transition-colors ${isSelected ? 'text-primary' : 'text-on-surface group-hover/archive:text-primary'}`}>{goal.title}</h4>
                          <span className="text-[8px] font-label font-bold uppercase tracking-[0.2em] flex items-center gap-1.5">
                             <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-primary animate-pulse' : 'bg-on-surface-variant/30'}`}></span>
                             <span className={isActive ? 'text-primary/80' : 'text-on-surface-variant/50'}>{goal.status}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-0 group-hover/archive:opacity-100 transition-opacity shrink-0" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleToggleStatus(goal.id)} 
                            className="w-7 h-7 flex items-center justify-center bg-surface-container hover:bg-primary/20 rounded-md hover:text-primary text-on-surface-variant transition-colors border border-white/5" 
                            title={isActive ? 'Deactivate (Pause)' : 'Activate (Play)'}
                          >
                            {isActive ? <Pause size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                          </button>
                          <button 
                            onClick={() => handleDeleteGoal(goal.id)} 
                            className="w-7 h-7 flex items-center justify-center bg-surface-container hover:bg-error/20 rounded-md hover:text-error text-on-surface-variant transition-colors border border-white/5" 
                            title="Purge"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Neural Notebook Preview */}
            <div className="bg-surface-container-low/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 sm:p-8 flex flex-col hover:border-white/10 hover:bg-surface-container-low transition-all shadow-lg group">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-surface-container border border-white/5 flex items-center justify-center">
                    <BookText className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-[10px] font-label font-black tracking-[0.2em] uppercase text-on-surface">Notebook</span>
                </div>

              </div>
              <p className="text-[11px] font-medium text-on-surface-variant/70 leading-relaxed mb-8 line-clamp-3 italic">
                "{(Array.isArray(roadmap?.goal?.notes) ? roadmap.goal.notes.find(b => b.type === 'text')?.content?.replace(/<[^>]*>?/gm, '')?.substring(0, 100) : null) || 'Capture insights, research, and technical notes during your focused session.'}"
              </p>
              <button
                onClick={() => navigate('/notebooks')}
                className="w-full py-3.5 bg-primary text-on-primary-container rounded-xl font-label text-[10px] font-black tracking-[0.2em] uppercase transition-all shadow-md shadow-primary/20 hover:brightness-110"
              >
                Open Editor
              </button>
            </div>

            {/* Coach / Telegram Widget */}
            <div className="bg-surface-container-low/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 sm:p-8 flex items-start gap-5 hover:border-white/10 hover:bg-surface-container-low transition-all group cursor-pointer shadow-lg" onClick={() => navigate('/settings')}>
              <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-all">
                <Send className="w-5 h-5 text-primary transition-colors" />
              </div>
              <div>
                <h4 className="text-sm font-headline font-black text-on-surface mb-1.5 flex items-center gap-2">
                  Coach Link
                  {user.telegram_chat_id ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(253,184,19,0.8)] animate-pulse"></span>
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full bg-error"></span>
                  )}
                </h4>
                <p className="text-[11px] font-medium text-on-surface-variant/70 leading-relaxed">
                  {user.telegram_chat_id ? 'Active. Receiving scheduled neural nudges.' : 'Offline. Connect Telegram in settings.'}
                </p>
              </div>
            </div>

          </div>
        </div>

        {/* System Footer Info */}
        <div className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 opacity-30">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-lg">code_blocks</span>
            <span className="text-[9px] font-label font-bold uppercase tracking-[0.25em]">Axiom System v3.0-Pro</span>
          </div>
          <div className="flex gap-6">
            <span className="text-[9px] font-label font-bold uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">Neural Integrity</span>
            <span className="text-[9px] font-label font-bold uppercase tracking-[0.2em] cursor-pointer hover:text-primary transition-colors">Documentation</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
