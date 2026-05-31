import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import AIAgentChat from './AIAgentChat';

const Layout = ({ children }) => {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const hideNavigation = ['/', '/login', '/register'].includes(path);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const hideAIAgent = hideNavigation || ['/onboarding'].includes(path);
  const [isChatOpen, setIsChatOpen] = useState(false);

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
          : `pt-4 pb-24 px-3 sm:px-4 lg:pt-8 lg:pb-12 ${isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-64'}`
      }`}>
        {children}
      </main>
      
      {/* Global AI Agent Floating Button */}
      {!hideAIAgent && !isChatOpen && (
        <button 
          title="Ask Axiom AI"
          onClick={() => setIsChatOpen(true)}
          style={{ borderRadius: '50%' }}
          className="fixed bottom-6 lg:bottom-10 right-6 lg:right-10 z-[100] w-14 h-14 lg:w-16 lg:h-16 rounded-full bg-gradient-to-br from-yellow-400 to-green-500 shadow-[0_10px_40px_rgba(234,179,8,0.4)] overflow-hidden hover:scale-110 active:scale-95 transition-all group border-2 border-white/20 flex items-center justify-center animate-bounce-slow"
        >
          <img 
            src="https://api.dicebear.com/7.x/bottts-neutral/svg?seed=AxiomMaster&backgroundColor=transparent&radius=50" 
            alt="AI Agent"
            style={{ borderRadius: '50%' }}
            className="w-10 h-10 object-cover group-hover:scale-110 transition-transform rounded-full"
          />
          {/* Notification Dot */}
          <div className="absolute top-0 right-0 w-3.5 h-3.5 bg-white rounded-full border-2 border-green-500 animate-pulse"></div>
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
