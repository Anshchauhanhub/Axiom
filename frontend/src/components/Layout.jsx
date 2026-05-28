import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

const Layout = ({ children }) => {
  const location = useLocation();
  const path = location.pathname.replace(/\/$/, '') || '/';
  const hideNavigation = ['/', '/login', '/register'].includes(path);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

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
