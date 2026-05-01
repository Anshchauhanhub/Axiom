import React from 'react';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary/30 flex flex-col">
      <Sidebar />
      <TopNav />
      <main className="flex-1 flex flex-col items-center justify-start pt-24 pb-32 px-4 lg:pt-8 lg:pb-12 lg:pl-72 max-w-7xl mx-auto w-full">
        {children}
      </main>
      {/* Ambient Glow Effects */}
      <div className="fixed top-[-10%] right-[-10%] w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
      <div className="fixed bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[120px] pointer-events-none -z-10"></div>
    </div>
  );
};

export default Layout;
