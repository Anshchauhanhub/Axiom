import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { quickActivateGoal, toggleGoalStatus, deleteGoal, activateGoal } from '../services/api';
import NeuralLoader from '../components/NeuralLoader';
import { Trash2, Play, Pause, History, BookOpen, ShieldCheck, Zap, Cpu } from 'lucide-react';


const Dashboard = () => {
  const { user } = useAuth();
  const { goals, roadmap, loading: dataLoading, refreshData, selectedGoalId, setSelectedGoalId } = useData();
  const navigate = useNavigate();
  const [activePartId, setActivePartId] = useState(null);
  const [activePartTitle, setActivePartTitle] = useState('');
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
      const next = sorted.find(t => t > current) || sorted[0];
      setNextSchedule(next);
    };
    getNextTime();
    const interval = setInterval(getNextTime, 60000);
    return () => clearInterval(interval);
  }, [user]);



  useEffect(() => {
    if (roadmap) {
      // Find first active part
      let found = false;
      for (const task of roadmap.tasks) {
        for (const part of task.parts) {
          if (part.status === 'active') {
            setActivePartId(part.id);
            setActivePartTitle(part.title);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      // Initialize expanded tasks with active ones
      const activeTasks = roadmap.tasks.filter(t => t.status === 'active').map(t => t.id);
      setExpandedTasks(new Set(activeTasks));
    }
  }, [roadmap]);

  const toggleTask = (taskId) => {
    const newExpanded = new Set(expandedTasks);
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId);
    } else {
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
      console.error("Failed to switch neural path.");
    } finally {
      setActivationLoading(false);
    }
  };

  if (!user) {

    return (
      <div className="animate-in fade-in duration-1000 flex flex-col items-center justify-center min-h-[60vh] gap-8">
        <div className="text-center">
          <h2 className="text-5xl font-black tracking-tighter text-on-surface mb-4 font-headline uppercase">AXIOM AI</h2>
          <p className="text-on-surface-variant font-label text-sm uppercase tracking-widest">High-Accountability Learning Coach</p>
        </div>
        <button
          onClick={() => navigate('/onboarding')}
          className="px-12 py-5 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary-container font-label text-xs font-bold tracking-widest uppercase shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
        >
          Initialize System
        </button>
      </div>
    );
  }

  const completedTasks = roadmap?.tasks?.filter(t => t.status === 'passed').length || 0;
  const totalTasks = roadmap?.tasks?.length || 0;

  return (
    <div className="animate-in fade-in duration-1000 relative">
      {activationLoading && <NeuralLoader message="Synthesizing Roadmap" />}

      {/* Header Section */}
      <section className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter text-on-surface mb-2 font-headline uppercase">
              Welcome, {user.full_name || user.email.split('@')[0]}
            </h2>
            <p className="text-on-surface-variant font-label tracking-wide uppercase text-xs opacity-60">
              System Status: Operational | {goals.length} Active Goal{goals.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Streak Widget */}
          <div className="bg-surface-container-low p-1 rounded-2xl flex items-center gap-3 sm:gap-4 pr-4 sm:pr-6 glow-blue border border-outline-variant/10">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-on-primary-container" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            </div>
            <div>
              <div className="text-2xl font-black font-headline text-primary">{user.current_streak}</div>
              <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Day Streak</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Next Up Session */}
        <div className="lg:col-span-8 group">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-[2rem] bg-surface-container-low border border-outline-variant/10 h-full p-5 sm:p-8 transition-all duration-500 hover:border-primary/30">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
                  <span className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Priority Session</span>
                </div>
                <h3 className="text-xl sm:text-3xl font-black tracking-tight mb-2 font-headline">
                  {activePartTitle || 'No active part'}
                </h3>
                <div className="flex items-center gap-4 text-on-surface-variant font-label text-sm uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">schedule</span>
                    {nextSchedule || '12:00'} Today
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base">layers</span>
                    {roadmap?.goal?.title || goals.find(g => g.status === 'active')?.title || 'Set a goal'}
                  </span>
                </div>
              </div>
              <div className="mt-8 sm:mt-12 flex flex-wrap items-center gap-4 sm:gap-6">
                {activePartId ? (
                  <button
                    onClick={() => {
                        setSelectedGoalId(roadmap?.goal?.id);
                        navigate('/study', { state: { goalId: roadmap?.goal?.id } });
                    }}
                    className="px-8 py-4 bg-primary text-on-primary-container font-label font-bold text-xs tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 uppercase"
                  >
                    Start Study Session
                  </button>
                ) : (
                  <button
                    onClick={() => navigate('/onboarding')}
                    className="px-8 py-4 bg-primary text-on-primary-container font-label font-bold text-xs tracking-widest rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-primary/20 uppercase"
                  >
                    Set Goal
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Side widgets */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="rounded-2xl sm:rounded-[2rem] bg-gradient-to-br from-secondary/20 to-transparent border border-secondary/30 p-5 sm:p-8 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all"
            onClick={() => navigate('/settings')}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">send</span>
                </div>
                <span className="font-label text-[10px] font-bold tracking-widest uppercase text-secondary">Coach Access</span>
              </div>
              <h4 className="text-xl font-bold font-headline mb-2">
                {user.telegram_chat_id ? 'Telegram Connected ✓' : 'Connect Telegram'}
              </h4>
              <p className="text-sm text-on-surface-variant leading-relaxed">
                {user.telegram_chat_id ? 'Nudges active at your scheduled times.' : 'Get precision nudges via Neural Bridge.'}
              </p>
            </div>
          </div>

          {/* Progress Widget */}
          <div className="rounded-2xl sm:rounded-[2rem] bg-surface-container border border-outline-variant/10 p-5 sm:p-8 flex-1">
            <div className="flex justify-between items-start mb-6">
              <h4 className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Mastery Progress</h4>
              <span className="text-secondary font-headline font-bold">
                {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
              </span>
            </div>
            <div className="space-y-4">
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full shadow-[0_0_12px_rgba(0,179,89,0.5)] transition-all duration-1000"
                  style={{ width: `${totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0}%` }}
                ></div>
              </div>
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                <span className="text-on-surface font-bold">{completedTasks}/{totalTasks}</span> tasks mastered via Verified Mastery.
              </p>
            </div>
          </div>
        </div>

        {/* Roadmap Tasks */}
        {roadmap && (
          <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-3 gap-6">
            {roadmap.tasks.slice(0, 3).map((task, idx) => (
              <div key={task.id} className="bg-surface-container-lowest border border-outline-variant/10 p-4 sm:p-6 rounded-2xl sm:rounded-3xl hover:bg-surface-container-low transition-colors group cursor-pointer">
                <div className="flex justify-between items-start mb-8">
                  <div className={`h-12 w-12 rounded-2xl bg-surface-container flex items-center justify-center group-hover:border-primary/40 border border-transparent transition-all ${task.status === 'passed' ? 'text-primary' : task.status === 'active' ? 'text-secondary' : 'text-on-surface-variant'
                    }`}>
                    <span className="material-symbols-outlined">
                      {task.status === 'passed' ? 'verified' : task.status === 'active' ? 'play_arrow' : 'lock'}
                    </span>
                  </div>
                  <span className="text-[10px] font-label font-bold text-on-surface-variant/40">{String(idx + 1).padStart(2, '0')}</span>
                </div>
                <h5 className="font-bold text-lg mb-2">{task.title}</h5>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-4">
                  {task.parts.length} parts • {task.parts.filter(p => p.status === 'passed').length} mastered
                </p>
                <div className="flex gap-2">
                  <span className={`px-2 py-1 rounded-md text-[9px] font-label uppercase tracking-wider ${task.status === 'passed' ? 'bg-primary/20 text-primary' : task.status === 'active' ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-highest text-on-surface-variant'
                    }`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Neural Bridge / Neural Archive Section (Moved from Onboarding) */}
      <section className="mt-10 sm:mt-16 animate-in slide-in-from-bottom-8 duration-1000">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
            <History className="text-primary" size={24} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black font-headline uppercase tracking-tighter text-on-surface">Neural Archive</h3>
            <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-[0.3em] opacity-40">Synchronized Neural Pathways</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {goals.length === 0 ? (
            <div className="md:col-span-3 text-center py-20 bg-surface-container-low/30 rounded-[2rem] border border-dashed border-outline-variant/20 opacity-30">
              <span className="material-symbols-outlined text-5xl mb-4">folder_open</span>
              <p className="font-label uppercase tracking-[0.2em] text-xs">No saved paths in neural storage</p>
            </div>
          ) : (
            goals.map((goal) => (
              <div key={goal.id} className={`group p-5 sm:p-6 rounded-2xl sm:rounded-[2rem] border transition-all duration-300 relative overflow-hidden ${goal.status === 'active'
                  ? 'bg-primary/5 border-primary/40 shadow-2xl shadow-primary/5'
                  : 'bg-surface-container-low/40 border-outline-variant/10 hover:border-outline-variant/30 opacity-80 hover:opacity-100'
                }`}>
                
                {/* Status Indicator */}
                <div className="absolute top-0 right-0 p-6">
                  <div className={`w-2 h-2 rounded-full ${goal.status === 'active' ? 'bg-primary animate-pulse shadow-[0_0_10px_#fdb813]' : 'bg-on-surface-variant/30'}`}></div>
                </div>

                <div className="mb-8">
                  <span className={`text-[8px] font-label font-black uppercase tracking-[0.3em] mb-2 block ${goal.status === 'active' ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                    {goal.status === 'active' ? 'Mastery Active' : 'Neural Path Paused'}
                  </span>
                  <h4 className="text-lg sm:text-xl font-black text-on-surface uppercase tracking-tight line-clamp-2 pr-6 font-headline">
                    {goal.title}
                  </h4>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleStatus(goal.id)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-label font-bold text-[9px] tracking-[0.2em] uppercase transition-all ${goal.status === 'active'
                          ? 'bg-primary text-on-primary shadow-lg shadow-primary/20'
                          : 'bg-surface-container-highest text-on-surface-variant hover:bg-primary/10 hover:text-primary'
                        }`}
                    >
                      {goal.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                      {goal.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                  </div>
                  
                  <button
                    onClick={() => handleDeleteGoal(goal.id)}
                    className="w-10 h-10 rounded-xl bg-surface-container-highest/50 flex items-center justify-center text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-all border border-outline-variant/10"
                    title="Purge Path"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {/* Aesthetic Neural Connector */}
                {goal.status === 'active' && (
                  <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent"></div>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-8 sm:mt-12 p-5 sm:p-8 bg-surface-container-low/30 rounded-2xl sm:rounded-[2rem] border border-outline-variant/10 text-center max-w-2xl mx-auto">
          <p className="text-[11px] text-on-surface-variant leading-relaxed font-label uppercase tracking-widest opacity-60">
            "The neural bridge maintains your cognitive load across all saved mastery paths."
          </p>
        </div>
      </section>
      {/* Neural Notebook Section */}
      <section className="mt-10 sm:mt-16 animate-in slide-in-from-bottom-8 duration-1000">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20 shadow-lg shadow-secondary/10">
            <BookOpen className="text-secondary" size={24} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black font-headline uppercase tracking-tighter text-on-surface">Neural Notebook</h3>
            <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-[0.3em] opacity-40">Your Preserved Cognitive Insights</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {goals.length === 0 ? (
            <div className="md:col-span-2 text-center py-12 bg-surface-container-low/30 rounded-2xl sm:rounded-[2rem] border border-dashed border-outline-variant/20 opacity-30">
              <span className="material-symbols-outlined text-4xl mb-3 block">menu_book</span>
              <p className="font-label uppercase tracking-[0.2em] text-xs">Create a goal to start your Neural Notebook</p>
            </div>
          ) : (
            goals.map((goal) => {
              const hasNotes = Array.isArray(goal.notes) && goal.notes.length > 0;
              const noteCount = hasNotes ? goal.notes.length : 0;
              const preview = hasNotes
                ? goal.notes.find(b => b.type === 'text')?.content?.replace(/<[^>]*>?/gm, '').substring(0, 120) || 'Multimedia entry...'
                : 'Start writing notes in your study session...';

              return (
                <div 
                  key={goal.id} 
                  onClick={() => {
                      setSelectedGoalId(goal.id);
                      navigate('/study', { state: { openNotebook: true, goalId: goal.id } });
                  }}
                  className={`p-5 sm:p-6 rounded-2xl sm:rounded-[2rem] border transition-all group cursor-pointer hover:scale-[1.01] active:scale-[0.99] ${
                    goal.status === 'active' 
                      ? 'bg-surface-container-low border-primary/20 hover:border-primary/40 shadow-lg' 
                      : 'bg-surface-container-low/60 border-outline-variant/10 hover:border-outline-variant/30'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${goal.status === 'active' ? 'bg-primary/10 text-primary' : 'bg-surface-container-highest text-on-surface-variant'}`}>
                        <span className="material-symbols-outlined text-xl">description</span>
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-lg font-black font-headline uppercase text-on-surface truncate pr-4 leading-tight">{goal.title}</h4>
                        <span className={`text-[9px] font-label font-bold uppercase tracking-widest ${goal.status === 'active' ? 'text-primary' : 'text-on-surface-variant/40'}`}>
                          {goal.status === 'active' ? '● Active' : 'Paused'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-label text-on-surface-variant font-bold uppercase tracking-widest whitespace-nowrap">
                      {noteCount > 0 ? `${noteCount} Blocks` : 'Empty'}
                    </span>
                  </div>
                  <div className="text-xs text-on-surface-variant line-clamp-2 mb-4 opacity-50 pl-[52px]">
                    {preview}
                  </div>
                  <div className="flex items-center justify-between pl-[52px]">
                    <span className="flex items-center gap-2 text-[10px] font-label font-bold text-primary uppercase tracking-widest group-hover:gap-3 transition-all">
                      Open Notebook <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>


      {/* Curriculum Saturation & Schedule Section (Moved from Analytics) */}
      {roadmap && (
        <section className="mt-10 sm:mt-16 animate-in slide-in-from-bottom-8 duration-1000">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center border border-secondary/20 shadow-lg shadow-secondary/10">
              <span className="material-symbols-outlined text-secondary">analytics</span>
            </div>
            <div>
              <h3 className="text-xl sm:text-2xl font-black font-headline uppercase tracking-tighter text-on-surface">Mastery Analytics</h3>
              <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-[0.3em] opacity-40">Verified Integrity Protocol</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Detailed Roadmap */}
            <div className="lg:col-span-8">
              <div className="bg-surface-container-low rounded-2xl sm:rounded-[2rem] border border-outline-variant/15 p-5 sm:p-8 relative overflow-hidden h-full">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <span className="material-symbols-outlined text-9xl">verified</span>
                </div>
                
                {/* Side Navigation Arrows */}
                {goals.length > 1 && (
                  <>
                    <button 
                      onClick={() => {
                          const currentIndex = goals.findIndex(g => g.id === (roadmap?.goal?.id || selectedGoalId));
                          const prevIndex = (currentIndex - 1 + goals.length) % goals.length;
                          setSelectedGoalId(goals[prevIndex].id);
                      }} 
                      className="absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-container-highest/80 backdrop-blur-sm border border-primary/30 hover:border-primary hover:bg-primary/20 flex items-center justify-center transition-all group z-30 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                    >
                        <span className="material-symbols-outlined text-primary text-xl sm:text-2xl group-active:-translate-x-1 transition-transform">chevron_left</span>
                    </button>
                    <button 
                      onClick={() => {
                          const currentIndex = goals.findIndex(g => g.id === (roadmap?.goal?.id || selectedGoalId));
                          const nextIndex = (currentIndex + 1) % goals.length;
                          setSelectedGoalId(goals[nextIndex].id);
                      }} 
                      className="absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-surface-container-highest/80 backdrop-blur-sm border border-primary/30 hover:border-primary hover:bg-primary/20 flex items-center justify-center transition-all group z-30 shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                    >
                        <span className="material-symbols-outlined text-primary text-xl sm:text-2xl group-active:translate-x-1 transition-transform">chevron_right</span>
                    </button>
                  </>
                )}
                
                <div className={`relative z-10 ${goals.length > 1 ? 'px-8 sm:px-12' : 'px-4 sm:px-6'}`}>
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <h3 className="font-headline font-bold text-xl sm:text-2xl text-on-surface uppercase tracking-tighter">
                        {roadmap?.goal?.title || 'Curriculum Saturation'}
                      </h3>
                      <div className="flex items-center gap-3 mt-1">
                          <p className="text-on-surface-variant text-xs font-label uppercase tracking-widest">
                            Overall Mastery: {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
                          </p>
                      </div>
                    </div>

                  </div>
                  
                  {(dataLoading || (roadmap?.goal?.id !== selectedGoalId)) ? (
                    <div className="flex flex-col items-center justify-center py-20 opacity-60">
                      <div className="w-16 h-16 rounded-full border-4 border-outline-variant/20 border-t-primary animate-spin mb-4"></div>
                      <p className="text-xs font-label uppercase tracking-widest text-on-surface-variant font-bold animate-pulse">Syncing Roadmap...</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                    {roadmap.tasks.map((task) => {
                      const taskPassed = task.parts.filter(p => p.status === 'passed').length;
                      const taskTotal = task.parts.length;
                      const progress = taskTotal > 0 ? Math.round((taskPassed / taskTotal) * 100) : 0;
                      const isExpanded = expandedTasks.has(task.id);
                      let status = task.status === 'passed' ? 'MASTERED' : task.status === 'active' ? 'IN PROGRESS' : 'LOCKED';
                      let color = task.status === 'passed' ? 'bg-primary' : task.status === 'active' ? 'bg-secondary animate-pulse' : 'bg-surface-container-highest';

                      return (
                        <div key={task.id} className="group/item">
                          <div
                            className="flex justify-between items-center mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => toggleTask(task.id)}
                          >
                            <div className="flex items-center gap-3">
                              {progress === 100 ? (
                                <span className="material-symbols-outlined text-primary text-sm">verified</span>
                              ) : (
                                <div className={`h-2 w-2 rounded-full ${color}`}></div>
                              )}
                              <span className="text-sm font-bold text-on-surface">{task.title}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest">{status}</span>
                              <span className={`material-symbols-outlined text-xs text-on-surface-variant transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                expand_more
                              </span>
                            </div>
                          </div>
                          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden mb-4">
                            <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
                          </div>

                          {isExpanded && (
                            <div className="ml-5 mt-4 space-y-4 pb-4 animate-in slide-in-from-top-2 duration-300">
                              {task.parts.map((part) => (
                                <div key={part.id} className="flex justify-between items-center group/part">
                                  <div className="flex items-center gap-4">
                                    <span className={`material-symbols-outlined text-[14px] ${part.status === 'passed' ? 'text-primary' :
                                        part.status === 'active' ? 'text-secondary animate-pulse' :
                                          'text-on-surface-variant opacity-40'
                                      }`}>
                                      {part.status === 'passed' ? 'check_circle' : 'radio_button_unchecked'}
                                    </span>
                                    <span className={`text-[12px] font-medium transition-colors ${part.status === 'passed' ? 'text-on-surface font-bold' :
                                        part.status === 'active' ? 'text-secondary' :
                                          'text-on-surface-variant/70'
                                      }`}>
                                      {part.title}
                                    </span>
                                  </div>
                                  <span className={`text-[8px] font-label uppercase tracking-[0.1em] px-2 py-0.5 rounded border ${part.status === 'passed' ? 'border-primary/30 text-primary bg-primary/5' :
                                      part.status === 'active' ? 'border-secondary/30 text-secondary bg-secondary/5' :
                                        'border-outline-variant/20 text-on-surface-variant/40'
                                    }`}>
                                    {part.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  )}
                </div>
              </div>
            </div>

            {/* Schedule & Routine */}
            <div className="lg:col-span-4 space-y-8">
               {/* Badge/Rank */}
               <div className="bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/20 p-8 rounded-[2rem] text-center relative overflow-hidden shadow-2xl shadow-primary/5">
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-4 shadow-xl shadow-primary/40">
                    <span className="material-symbols-outlined text-white text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
                  </div>
                  <h4 className="text-lg font-black font-headline uppercase mb-1">
                    {totalTasks > 0 && (completedTasks / totalTasks) >= 0.8 ? 'Verified Master' : 'Neural Initiate'}
                  </h4>
                  <p className="text-[10px] text-on-surface-variant font-label leading-relaxed px-4 uppercase tracking-wider opacity-60">
                    Verification Protocol Active
                  </p>
                </div>
              </div>

              {/* Nudge Schedule */}
              <div className="bg-surface-container-low border border-outline-variant/15 p-8 rounded-[2rem]">
                <h4 className="font-headline font-bold text-on-surface mb-6 uppercase tracking-tighter text-lg">Nudge Routine</h4>
                <div className="space-y-6">
                  {(user.study_schedule || ['12:00', '18:00']).sort().map((time, i) => {
                    const isNext = time === nextSchedule;
                    return (
                      <div key={i} className="flex items-start gap-4">
                        <div className={`mt-1.5 w-2 h-2 rounded-full ${isNext ? 'bg-secondary animate-pulse shadow-[0_0_12px_rgba(0,179,89,0.4)]' : 'bg-on-surface-variant/30'}`}></div>
                        <div>
                          <div className={`text-sm font-bold ${isNext ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>{time}</div>
                          <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest opacity-40">
                            {isNext ? 'Next Sync' : `Session ${i + 1}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full mt-8 py-3 border border-outline-variant/30 rounded-xl font-label text-[9px] font-bold tracking-widest text-on-surface hover:bg-surface-container-highest transition-colors uppercase"
                >
                  Edit Routine
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* System Documentation Section (Moved from Docs) */}
      <section className="mt-16 sm:mt-24 mb-8 sm:mb-12 animate-in slide-in-from-bottom-8 duration-1000">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/10">
            <BookOpen className="text-primary" size={24} />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black font-headline uppercase tracking-tighter text-on-surface">System Documentation</h3>
            <p className="text-[10px] font-label text-on-surface-variant uppercase tracking-[0.3em] opacity-40">Operating Manual // Protocol AXIOM</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Document Card 1: Verified Mastery */}
          <div className="p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] bg-surface-container-low/40 border border-outline-variant/10 hover:border-primary/20 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <Zap size={120} />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <ShieldCheck className="text-primary" size={20} />
              </div>
              <h4 className="text-lg font-bold font-headline uppercase">Verified Mastery</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed opacity-70">
              Axiom doesn't just track time; it verifies understanding. Before advancing through your roadmap, the system generates custom MCQ gates. Failure to pass triggers a mandatory review session, ensuring cognitive retention before expansion.
            </p>
          </div>

          {/* Document Card 2: Neural Bridge */}
          <div className="p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] bg-surface-container-low/40 border border-outline-variant/10 hover:border-secondary/20 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <Cpu size={120} />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
                <span className="material-symbols-outlined text-secondary">send</span>
              </div>
              <h4 className="text-lg font-bold font-headline uppercase">The Neural Bridge</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed opacity-70">
              Your growth continues outside this interface. The Neural Bridge synchronizes your progress with Telegram, sending high-precision "nudges" at your scheduled times. This keeps your goals top-of-mind and enables active recall on-the-go.
            </p>
          </div>

          {/* Document Card 3: Sudden Death */}
          <div className="p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] bg-surface-container-low/40 border border-outline-variant/10 hover:border-error/20 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <span className="material-symbols-outlined text-8xl">bolt</span>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-error/10 flex items-center justify-center border border-error/20">
                <span className="material-symbols-outlined text-error">warning</span>
              </div>
              <h4 className="text-lg font-bold font-headline uppercase">Sudden Death Protocol</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed opacity-70">
              For high-accountability paths, the Sudden Death Protocol ensures maximum focus. If activated, missing consecutive study sessions or failing verification gates multiple times will pause your neural path, requiring manual re-initialization.
            </p>
          </div>

          {/* Document Card 4: Agentic Roadmaps */}
          <div className="p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] bg-surface-container-low/40 border border-outline-variant/10 hover:border-primary/20 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <span className="material-symbols-outlined text-8xl">account_tree</span>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <span className="material-symbols-outlined text-primary">psychology</span>
              </div>
              <h4 className="text-lg font-bold font-headline uppercase">Agentic Synthesis</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed opacity-70">
              Every roadmap is synthesized in real-time using SOTA LLMs. Axiom analyzes the core concepts, prerequisites, and practical applications of your goal to build a non-linear path that adapts as you master individual nodes.
            </p>
          </div>

          {/* Document Card 5: Neural Notebook */}
          <div className="p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] bg-surface-container-low/40 border border-outline-variant/10 hover:border-secondary/20 transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
              <span className="material-symbols-outlined text-8xl">edit_note</span>
            </div>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center border border-secondary/20">
                <span className="material-symbols-outlined text-secondary">book</span>
              </div>
              <h4 className="text-lg font-bold font-headline uppercase">Neural Notebook</h4>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed opacity-70">
              Your cognitive insights are preserved in the Neural Notebook. While studying, you can capture rich-text notes, images, and links. These notes are bio-locked to each specific neural path and can be exported as high-fidelity documents or shared to the social feed.
            </p>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-outline-variant/10 flex flex-col md:flex-row justify-between items-center gap-6 opacity-40">
           <div className="flex items-center gap-2">
              <img src="/logo.png" alt="Axiom" className="h-6 w-auto grayscale" />
              <span className="text-[9px] font-label uppercase tracking-widest">System Version 2.4.0-Final</span>
           </div>
           <div className="flex gap-6">
              <span className="text-[9px] font-label uppercase tracking-widest cursor-help hover:text-primary transition-colors">Privacy Shield</span>
              <span className="text-[9px] font-label uppercase tracking-widest cursor-help hover:text-primary transition-colors">Neural Safety</span>
              <span className="text-[9px] font-label uppercase tracking-widest cursor-help hover:text-primary transition-colors">Core Ethics</span>
           </div>
        </div>
      </section>

    </div>
  );
};

export default Dashboard;
