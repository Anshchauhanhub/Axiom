import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { quickActivateGoal } from '../services/api';
import NeuralLoader from '../components/NeuralLoader';


const Dashboard = () => {
  const { user } = useAuth();
  const { goals, roadmap, loading: dataLoading, refreshData } = useData();
  const navigate = useNavigate();
  const [activePartId, setActivePartId] = useState(null);
  const [activePartTitle, setActivePartTitle] = useState('');
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
    }
  }, [roadmap]);

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
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-on-surface mb-2 font-headline uppercase">
              Welcome, {user.email.split('@')[0]}
            </h2>
            <p className="text-on-surface-variant font-label tracking-wide uppercase text-xs opacity-60">
              System Status: Operational | {goals.length} Active Goal{goals.length !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Streak Widget */}
          <div className="bg-surface-container-low p-1 rounded-2xl flex items-center gap-4 pr-6 glow-blue border border-outline-variant/10">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[#ff7e5f] to-[#feb47b] flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
            </div>
            <div>
              <div className="text-2xl font-black font-headline text-[#feb47b]">{user.current_streak}</div>
              <div className="font-label text-[10px] uppercase tracking-widest text-on-surface-variant">Day Streak</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Next Up Session */}
        <div className="lg:col-span-8 group">
          <div className="relative overflow-hidden rounded-[2rem] bg-surface-container-low border border-outline-variant/10 h-full p-8 transition-all duration-500 hover:border-primary/30">
            <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/10 rounded-full blur-[80px]"></div>
            <div className="relative z-10 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-6">
                  <span className="h-2 w-2 rounded-full bg-secondary animate-pulse"></span>
                  <span className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary font-bold">Priority Session</span>
                </div>
                <h3 className="text-3xl font-black tracking-tight mb-2 font-headline">
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
              <div className="mt-12 flex flex-wrap items-center gap-6">
                {activePartId ? (
                  <button
                    onClick={() => navigate('/study')}
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
          <div className="rounded-[2rem] bg-gradient-to-br from-[#0088cc]/20 to-transparent border border-[#0088cc]/30 p-8 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-all"
            onClick={() => navigate('/settings')}
          >
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#0088cc] flex items-center justify-center text-white">
                  <span className="material-symbols-outlined">send</span>
                </div>
                <span className="font-label text-[10px] font-bold tracking-widest uppercase text-[#0088cc]">Coach Access</span>
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
          <div className="rounded-[2rem] bg-surface-container border border-outline-variant/10 p-8 flex-1">
            <div className="flex justify-between items-start mb-6">
              <h4 className="font-label text-[10px] font-bold tracking-widest uppercase text-on-surface-variant">Mastery Progress</h4>
              <span className="text-secondary font-headline font-bold">
                {totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0}%
              </span>
            </div>
            <div className="space-y-4">
              <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-secondary rounded-full shadow-[0_0_12px_rgba(76,215,246,0.5)] transition-all duration-1000"
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
              <div key={task.id} className="bg-surface-container-lowest border border-outline-variant/10 p-6 rounded-3xl hover:bg-surface-container-low transition-colors group cursor-pointer">
                <div className="flex justify-between items-start mb-8">
                  <div className={`h-12 w-12 rounded-2xl bg-surface-container flex items-center justify-center group-hover:border-primary/40 border border-transparent transition-all ${
                    task.status === 'passed' ? 'text-primary' : task.status === 'active' ? 'text-secondary' : 'text-on-surface-variant'
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
                  <span className={`px-2 py-1 rounded-md text-[9px] font-label uppercase tracking-wider ${
                    task.status === 'passed' ? 'bg-primary/20 text-primary' : task.status === 'active' ? 'bg-secondary/20 text-secondary' : 'bg-surface-container-highest text-on-surface-variant'
                  }`}>
                    {task.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default Dashboard;
