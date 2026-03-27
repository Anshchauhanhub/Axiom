import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { listGoals, getRoadmap } from '../services/api';

const Analytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [roadmap, setRoadmap] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadAnalytics();
  }, [user]);

  const loadAnalytics = async () => {
    try {
      const g = await listGoals();
      setGoals(g);
      if (g.length > 0) {
        const rm = await getRoadmap(g[0].id);
        setRoadmap(rm);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
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
    <div className="animate-in fade-in duration-1000 max-w-6xl mx-auto">
      <header className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter text-on-surface mb-2 font-headline uppercase">Mastery Analytics</h2>
          <p className="text-on-surface-variant font-label tracking-wide uppercase text-[10px] opacity-60">System Log // Verified Integrity Protocol</p>
        </div>
        <div className="flex items-center gap-4 bg-surface-container-low px-6 py-3 rounded-2xl border border-outline-variant/10">
          <div className="text-right">
            <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">Schedule</div>
            <div className="text-sm font-bold text-primary font-headline">{user.study_schedule?.join(' / ') || '12:00 / 18:00'}</div>
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
                  let status = task.status === 'passed' ? 'MASTERED' : task.status === 'active' ? 'IN PROGRESS' : 'LOCKED';
                  let color = task.status === 'passed' ? 'bg-primary' : task.status === 'active' ? 'bg-secondary animate-pulse' : 'bg-surface-container-highest';
                  return (
                    <div key={task.id} className="group/item cursor-pointer">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          {progress === 100 ? (
                            <span className="material-symbols-outlined text-primary text-sm">verified</span>
                          ) : (
                            <div className={`h-2 w-2 rounded-full ${color}`}></div>
                          )}
                          <span className="text-sm font-bold text-on-surface">{task.title}</span>
                        </div>
                        <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest">{status}</span>
                      </div>
                      <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${progress}%` }}></div>
                      </div>
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
              <div className="text-lg font-black font-headline text-on-surface uppercase">{goals[0]?.title?.slice(0, 15) || '-'}...</div>
              <div className="text-[10px] text-on-surface-variant/40 uppercase mt-1">{goals[0]?.status || 'N/A'}</div>
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
              {(user.study_schedule || ['12:00', '18:00']).map((time, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className={`mt-1.5 w-2 h-2 rounded-full ${i === 0 ? 'bg-secondary animate-pulse shadow-[0_0_10px_rgba(76,215,246,0.6)]' : 'bg-on-surface-variant'}`}></div>
                  <div>
                    <div className="text-sm font-bold text-on-surface">{time}</div>
                    <div className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest">
                      {i === 0 ? 'Session 1' : 'Session 2'}
                    </div>
                  </div>
                </div>
              ))}
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
    </div>
  );
};

export default Analytics;
