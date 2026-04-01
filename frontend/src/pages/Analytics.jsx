import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { quickActivateGoal } from '../services/api';
import GoalSelectionGrid from '../components/GoalSelectionGrid';
import NeuralLoader from '../components/NeuralLoader';


const Analytics = () => {
  const { user } = useAuth();
  const { goals, roadmap, loading: dataLoading, refreshData } = useData();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('Overview');
  const [expandedTasks, setExpandedTasks] = useState(new Set());
  const [activationLoading, setActivationLoading] = useState(false);
  const [nextSchedule, setNextSchedule] = useState('');

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
    if (!dataLoading && !roadmap) {
      setActiveTab('Onboarding');
    } else if (roadmap) {
      setActiveTab('Overview');
    }
  }, [roadmap, dataLoading]);

  useEffect(() => {
    if (roadmap) {
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
      setActiveTab('Overview');
    } catch (e) {
      console.error(e);
    } finally {
      setActivationLoading(false);
    }
  };

  if (!user) {

    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <button onClick={() => navigate('/onboarding')} className="px-10 py-4 rounded-full bg-primary text-on-primary-container font-label text-xs font-bold tracking-widest uppercase">
          Login to view Analytics
        </button>
      </div>
    );
  }

  const tasks = roadmap?.tasks || [];
  const totalParts = tasks.reduce((sum, t) => sum + t.parts.length, 0);
  const passedParts = tasks.reduce((sum, t) => sum + t.parts.filter(p => p.status === 'passed').length, 0);
  const masteredTasks = tasks.filter(t => t.status === 'passed').length;
  const saturation = totalParts > 0 ? Math.round((passedParts / totalParts) * 100) : 0;

  return (
    <div className="animate-in fade-in duration-1000 max-w-6xl mx-auto relative">
      {activationLoading && <NeuralLoader message="Synthesizing Roadmap" />}

      {/* Tab Navigation */}
      <div className="flex gap-8 mb-12 border-b border-outline-variant/10">
        {['Overview', 'Onboarding'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-4 px-2 font-label text-[10px] font-bold uppercase tracking-[0.3em] transition-all relative ${activeTab === tab ? 'text-primary' : 'text-on-surface-variant opacity-40 hover:opacity-100'
              }`}
          >
            {tab}
            {activeTab === tab && (
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary animate-in fade-in zoom-in duration-500"></div>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'Onboarding' ? (
        <GoalSelectionGrid onSelect={handleSelectGoal} loading={activationLoading} />
      ) : (
        <>
          <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black tracking-tighter text-on-surface mb-2 font-headline uppercase">Mastery Analytics</h2>
              <p className="text-on-surface-variant font-label tracking-wide uppercase text-[10px] opacity-60">System Log // Verified Integrity Protocol</p>
            </div>
            <div className="flex items-center gap-4 bg-surface-container-low px-6 py-3 rounded-2xl border border-outline-variant/10">
              <div className="text-right">
                <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Next Schedule</div>
                <div className="text-sm font-bold text-primary font-headline">
                  {nextSchedule || '...'}
                </div>
              </div>
              <span className="material-symbols-outlined text-primary animate-pulse">notifications_active</span>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Curriculum Saturation */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-surface-container-low rounded-[2rem] border border-outline-variant/15 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <span className="material-symbols-outlined text-9xl">verified</span>
                </div>
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-12">
                    <div>
                      <h3 className="font-headline font-bold text-2xl text-on-surface">Curriculum Saturation</h3>
                      <p className="text-on-surface-variant text-xs font-label uppercase tracking-widest mt-1">
                        Mastery Rate: {saturation}%
                      </p>
                    </div>
                    <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20 text-center">
                      <div className="text-2xl font-black text-primary font-headline">{passedParts}/{totalParts}</div>
                      <div className="text-[10px] font-label text-primary uppercase">Parts Passed</div>
                    </div>
                  </div>

                  {/* Roadmap Progress */}
                  <div className="space-y-6">
                    {tasks.map((task) => {
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

                          {/* Parts List */}
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
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-surface-container-lowest border border-outline-variant/10 p-6 rounded-3xl">
                  <div className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-4">Streak</div>
                  <div className="text-3xl font-black font-headline text-on-surface">{user.current_streak}D</div>
                  <div className="text-[10px] text-primary uppercase mt-1">Active</div>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/10 p-6 rounded-3xl">
                  <div className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-4">Tasks Mastered</div>
                  <div className="text-3xl font-black font-headline text-on-surface">{masteredTasks}<span className="text-sm text-secondary">/{tasks.length}</span></div>
                  <div className="text-[10px] text-on-surface-variant/40 uppercase mt-1">Via Sudden Death</div>
                </div>
                <div className="bg-surface-container-lowest border border-outline-variant/10 p-6 rounded-3xl">
                  <div className="font-label text-[10px] text-on-surface-variant uppercase tracking-[0.2em] mb-4">Goal</div>
                  <div className="text-lg font-black font-headline text-on-surface uppercase whitespace-nowrap overflow-hidden text-ellipsis">
                    {roadmap?.goal?.title || goals.find(g => g.status === 'active')?.title || '-'}
                  </div>
                  <div className="text-[10px] text-on-surface-variant/40 uppercase mt-1">
                    {roadmap?.goal?.status || goals.find(g => g.status === 'active')?.status || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-8">
              {/* Badge */}
              <div className="bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/20 p-8 rounded-[2rem] text-center relative overflow-hidden shadow-2xl shadow-primary/5">
                <div className="relative z-10 flex flex-col items-center">
                  <div className="w-20 h-20 bg-primary rounded-full flex items-center justify-center mb-6 shadow-xl shadow-primary/40">
                    <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>military_tech</span>
                  </div>
                  <h4 className="text-xl font-black font-headline uppercase mb-2">
                    {saturation >= 80 ? 'Verified Master' : saturation >= 50 ? 'Rising Challenger' : 'New Recruit'}
                  </h4>
                  <p className="text-xs text-on-surface-variant font-label leading-relaxed px-4">
                    {passedParts} parts mastered via Sudden Death verification.
                  </p>
                </div>
              </div>

              {/* Schedule */}
              <div className="bg-surface-container-low border border-outline-variant/15 p-8 rounded-[2rem]">
                <h4 className="font-headline font-bold text-on-surface mb-6 uppercase tracking-tighter">Nudge Schedule</h4>
                <div className="space-y-8">
                  {(user.study_schedule || ['12:00', '18:00']).sort().map((time, i) => {
                    const isNext = time === nextSchedule;
                    return (
                      <div key={i} className="flex items-start gap-4">
                        <div className={`mt-1.5 w-2 h-2 rounded-full ${isNext ? 'bg-secondary animate-pulse shadow-[0_0_12px_rgba(0,179,89,0.4)]' : 'bg-on-surface-variant/30'}`}></div>
                        <div>
                          <div className={`text-sm font-bold ${isNext ? 'text-on-surface' : 'text-on-surface-variant/60'}`}>{time}</div>
                          <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">
                            {isNext ? 'Next Session' : `Session ${i + 1}`}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => navigate('/settings')}
                  className="w-full mt-8 py-3 border border-outline-variant/30 rounded-xl font-label text-[10px] font-bold tracking-widest text-on-surface hover:bg-surface-container-highest transition-colors uppercase"
                >
                  Configure Routine
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Analytics;
