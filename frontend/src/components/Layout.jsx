import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import AIAgentChat from './AIAgentChat';
import MoodFace from './MoodFace';
import { getAllTasks, isLoggedIn } from '../services/api';

const Layout = ({ children }) => {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const hideNavigation = ['/', '/login', '/register'].includes(path);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const hideAIAgent = hideNavigation || ['/onboarding'].includes(path);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [mood, setMood] = useState(3);

  // Auto-calculate mood from task progress
  useEffect(() => {
    if (hideAIAgent || !isLoggedIn()) return;
    const calculateMood = async () => {
      try {
        const tasks = await getAllTasks();
        if (!tasks || tasks.length === 0) { setMood(3); return; }
        const now = new Date();
        const total = tasks.length;
        let completed = 0, overdue = 0;
        tasks.forEach(t => {
          if (t.completed_at) {
            completed++;
          } else if (t.scheduled_at && new Date(t.scheduled_at) < now) {
            overdue++;
          }
        });
        const incomplete = total - completed;
        const completionRatio = completed / total;
        const overdueRatio = overdue / total;
        const incompleteRatio = incomplete / total;

        if (overdueRatio >= 0.3) setMood(1);
        else if (overdueRatio >= 0.15) setMood(2);
        else if (incompleteRatio >= 0.8 && total > 3) setMood(2);
        else if (completionRatio >= 0.7) setMood(5);
        else if (completionRatio >= 0.4) setMood(4);
        else if (completionRatio >= 0.1) setMood(3);
        else setMood(2);
      } catch (e) { /* ignore */ }
    };
    calculateMood();
  }, [hideAIAgent, path]);

  const getMoodGradient = (m) => {
    switch (m) {
      case 5: return 'from-green-400 to-emerald-600';
      case 4: return 'from-yellow-300 to-green-400';
      case 3: return 'from-yellow-400 to-green-500';
      case 2: return 'from-orange-400 to-red-400';
      case 1: return 'from-red-500 to-red-800';
      default: return 'from-yellow-400 to-green-500';
    }
  };

  const getMoodIndicator = (m) => {
    switch (m) {
      case 5: return 'border-green-500';
      case 4: return 'border-green-400';
      case 3: return 'border-green-500';
      case 2: return 'border-orange-500';
      case 1: return 'border-red-500';
      default: return 'border-green-500';
    }
  };

  return (
    <div className={`min-h-screen bg-background text-on-surface font-body selection:bg-primary/30 flex flex-col ${hideNavigation ? 'overflow-x-hidden' : ''}`}>
      {!hideNavigation && (
        <>
          <Sidebar isCollapsed={isSidebarCollapsed} toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
          <TopNav />
        </>
      )}
      <main className={`flex-1 flex flex-col items-center justify-start w-full transition-all duration-300 ${
        hideNavigation 
          ? 'p-0 max-w-none' 
          : `pt-6 pb-24 px-3 sm:px-4 lg:pt-16 lg:pb-12 ${isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'}`
      }`}>
        {children}
      </main>
      
      {/* Global AI Agent Floating Button */}
      {!hideAIAgent && !isChatOpen && (
        <button 
          title="Ask Axiom AI"
          onClick={() => setIsChatOpen(true)}
          style={{ borderRadius: '50%' }}
          className={`fixed bottom-6 lg:bottom-10 right-6 lg:right-10 z-[100] w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br ${getMoodGradient(mood)} shadow-[0_10px_40px_rgba(234,179,8,0.4)] overflow-hidden hover:scale-110 active:scale-95 transition-all group border-2 border-white/20 flex items-center justify-center animate-bounce-slow`}
        >
          <MoodFace mood={mood} size={44} />
          {/* Notification Dot */}
          <div className={`absolute top-0 right-0 w-3.5 h-3.5 bg-white rounded-full border-2 ${getMoodIndicator(mood)} animate-pulse`}></div>
        </button>
      )}

      <AIAgentChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Ambient Glow Effects */}
      {!hideNavigation && (
        <>
          <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
          <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        </>
      )}
    </div>
  );
};

export default Layout;

