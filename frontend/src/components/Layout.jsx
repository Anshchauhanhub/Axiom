import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import AIAgentChat from './AIAgentChat';
import MoodFace from './MoodFace';
import { useMood } from '../context/MoodContext';

const Layout = ({ children }) => {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const hideNavigation = ['/', '/login', '/register'].includes(path);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const hideAIAgent = hideNavigation || ['/onboarding'].includes(path);
  const [isChatOpen, setIsChatOpen] = useState(false);

  // Global mood — single source of truth from MoodContext
  const { mood } = useMood();

  const getMoodGradient = (m) => {
    switch (m) {
      case 5: return 'from-emerald-400 to-teal-500';
      case 4: return 'from-primary to-amber-500';
      case 3: return 'from-amber-400 to-primary';
      case 2: return 'from-orange-400 to-amber-500';
      case 1: return 'from-primary to-amber-600';
      default: return 'from-primary to-amber-500';
    }
  };

  const getMoodIndicator = (m) => {
    switch (m) {
      case 5: return 'border-emerald-400';
      case 4: return 'border-primary';
      case 3: return 'border-amber-400';
      case 2: return 'border-orange-400';
      case 1: return 'border-primary';
      default: return 'border-primary';
    }
  };

  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary/30 flex flex-col overflow-x-hidden w-full relative">
      {!hideNavigation && (
        <>
          {/* Mobile Header Background to prevent overlap */}
          <div className="lg:hidden fixed top-0 left-0 w-full h-20 bg-black/95 backdrop-blur-xl border-b border-white/5 z-[50] pt-safe"></div>
          
          <Sidebar isCollapsed={isSidebarCollapsed} toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)} />
          {path !== '/notebooks' && <TopNav />}
        </>
      )}
      <main className={`flex-1 flex flex-col items-center justify-start w-full transition-all duration-300 relative ${
        hideNavigation 
          ? 'p-0 max-w-none' 
          : `pt-24 pb-8 px-3 sm:px-4 lg:pt-20 lg:pb-12 ${isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'}`
      }`}>
        {children}
      </main>
      
      {/* Global AI Agent Floating Button */}
      {!hideAIAgent && !isChatOpen && (
        <button 
          title="Ask Edxiom AI"
          onClick={() => setIsChatOpen(true)}
          style={{ borderRadius: '50%' }}
          className={`fixed bottom-6 right-6 lg:bottom-10 lg:right-10 z-[55] w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br ${getMoodGradient(mood)} shadow-[0_10px_40px_rgba(234,179,8,0.4)] overflow-hidden hover:scale-110 active:scale-95 transition-all group border-2 border-white/20 flex items-center justify-center mb-safe`}
        >
          <MoodFace mood={mood} size={44} />
          {/* Notification Dot */}
          <div className={`absolute top-0 right-0 w-3.5 h-3.5 bg-white rounded-full border-2 ${getMoodIndicator(mood)} animate-pulse`}></div>
        </button>
      )}

      <AIAgentChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Ambient Glow Effects — hidden on mobile for performance */}
      {!hideNavigation && (
        <>
          <div className="hidden lg:block fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
          <div className="hidden lg:block fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
        </>
      )}
    </div>
  );
};

export default Layout;
