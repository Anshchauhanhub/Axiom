import React, { useState, useEffect, useMemo } from 'react';
import { getAllTasks } from '../services/api';
import { CheckCircle, Circle, Lock, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';

const Calendar = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await getAllTasks();
        setTasks(data);
      } catch (err) {
        console.error("Failed to fetch tasks for calendar", err);
      } finally {
        setLoading(false);
      }
    };
    fetchTasks();
  }, []);

  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const numDays = daysInMonth(year, month);
  const firstDay = firstDayOfMonth(year, month);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Organize tasks
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      if (task.completed_at) {
        const d = new Date(task.completed_at);
        if (d.getFullYear() === year && d.getMonth() === month) {
          const dateStr = d.getDate();
          if (!map[dateStr]) map[dateStr] = [];
          map[dateStr].push(task);
        }
      }
    });
    return map;
  }, [tasks, year, month]);

  const activeAndLockedTasks = tasks.filter(t => !t.completed_at);

  const getStatusIcon = (status) => {
    if (status === 'passed') return <CheckCircle size={14} className="text-secondary" />;
    if (status === 'active') return <Circle size={14} className="text-primary" />;
    return <Lock size={14} className="text-on-surface-variant/40" />;
  };

  return (
    <div className="w-full flex flex-col lg:flex-row gap-8 animate-in slide-in-from-bottom-5 duration-700">
      
      {/* Sidebar: Task List */}
      <div className="w-full lg:w-80 flex flex-col shrink-0">
        <div className="bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/10 rounded-[2.5rem] p-6 h-[calc(100vh-8rem)] sticky top-24 flex flex-col shadow-2xl overflow-hidden">
            
            <div className="flex items-center justify-between mb-6">
                <div className="bg-surface-container p-1 rounded-xl flex items-center gap-1 border border-outline-variant/10">
                    <button className="px-4 py-1.5 bg-primary text-on-primary-container shadow-md rounded-lg text-[10px] font-label uppercase tracking-widest font-black transition-all">All</button>
                    <button className="px-4 py-1.5 text-on-surface-variant/60 hover:text-on-surface text-[10px] font-label uppercase tracking-widest font-black transition-all">Mine</button>
                </div>
                <div className="flex items-center gap-3 text-on-surface-variant/60">
                    <button className="hover:text-primary transition-colors"><Search size={18} /></button>
                    <button className="hover:text-primary transition-colors"><Filter size={18} /></button>
                </div>
            </div>

            <div className="mb-4">
                <h3 className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-primary">Pending Tasks</h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                {loading ? (
                    <div className="animate-pulse space-y-4">
                        {[1,2,3,4].map(i => <div key={i} className="h-16 bg-surface-container-highest/20 rounded-2xl"></div>)}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activeAndLockedTasks.map(task => (
                            <div key={task.id} className="flex items-start gap-4 p-4 bg-surface-container-low/50 hover:bg-surface-container rounded-2xl transition-all border border-outline-variant/5 hover:border-primary/20 cursor-pointer group">
                                <div className="mt-0.5">{getStatusIcon(task.status)}</div>
                                <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-bold truncate transition-colors ${task.status === 'locked' ? 'text-on-surface-variant/60' : 'text-on-surface group-hover:text-primary'}`}>{task.title}</p>
                                    <p className="text-[10px] text-on-surface-variant/40 uppercase tracking-wider truncate mt-1 font-label">{task.goal_title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
      </div>

      {/* Main Calendar View */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/10 rounded-[2.5rem] p-6 h-[calc(100vh-8rem)] sticky top-24 flex flex-col shadow-2xl overflow-hidden">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-8 px-4">
                <button className="px-5 py-2.5 bg-surface-container hover:bg-surface-container-highest border border-outline-variant/10 text-[10px] font-label uppercase tracking-[0.2em] font-black text-on-surface rounded-xl transition-all">Today</button>
                
                <div className="flex items-center gap-6">
                    <button onClick={prevMonth} className="p-2 bg-surface-container-low hover:bg-primary/20 hover:text-primary text-on-surface-variant border border-outline-variant/10 rounded-full transition-all"><ChevronLeft size={20}/></button>
                    <h2 className="text-2xl font-black font-headline text-on-surface uppercase tracking-tight min-w-[200px] text-center">
                        {monthNames[month]} <span className="text-primary">{year}</span>
                    </h2>
                    <button onClick={nextMonth} className="p-2 bg-surface-container-low hover:bg-primary/20 hover:text-primary text-on-surface-variant border border-outline-variant/10 rounded-full transition-all"><ChevronRight size={20}/></button>
                </div>
                
                <div className="w-24"></div> {/* Spacer for balance */}
            </div>

            <div className="flex-1 flex flex-col min-h-0 bg-surface-container-lowest/50 rounded-[1.5rem] border border-outline-variant/5 overflow-hidden">
                {/* Days of week */}
                <div className="grid grid-cols-7 border-b border-outline-variant/10 bg-surface-container-low/50 shrink-0">
                    {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(day => (
                        <div key={day} className="py-4 text-center text-[10px] font-label font-black uppercase tracking-[0.2em] text-on-surface-variant/60 border-r border-outline-variant/10 last:border-0">
                            {day}
                        </div>
                    ))}
                </div>
                
                {/* Grid */}
                <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-y-auto custom-scrollbar">
                    {Array.from({ length: 42 }).map((_, index) => {
                        const dayNum = index - firstDay + 1;
                        const isCurrentMonth = dayNum > 0 && dayNum <= numDays;
                        const isToday = isCurrentMonth && dayNum === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
                        
                        const dayTasks = isCurrentMonth ? (tasksByDate[dayNum] || []) : [];
                        
                        return (
                            <div key={index} className={`border-r border-b border-outline-variant/5 min-h-[120px] p-3 transition-colors ${!isCurrentMonth ? 'bg-surface-container-highest/5' : 'bg-transparent hover:bg-surface-container/30'}`}>
                                {isCurrentMonth && (
                                    <div className="flex flex-col h-full">
                                        <div className="flex justify-end mb-3">
                                            <span className={`w-8 h-8 flex items-center justify-center rounded-xl text-sm font-black transition-all ${isToday ? 'bg-primary text-on-primary-container shadow-[0_0_20px_rgba(253,184,19,0.3)]' : 'text-on-surface-variant/60'}`}>
                                                {dayNum}
                                            </span>
                                        </div>
                                        
                                        <div className="flex-1 space-y-2 overflow-y-auto custom-scrollbar pr-1">
                                            {dayTasks.map(task => (
                                                <div key={task.id} className="text-[10px] bg-secondary/10 border border-secondary/20 text-secondary rounded-lg px-2 py-1.5 flex items-start gap-2 shadow-sm" title={task.title}>
                                                    <CheckCircle size={12} className="shrink-0 mt-0.5" />
                                                    <span className="font-bold leading-tight line-clamp-2">{task.title}</span>
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
      </div>
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(253,184,19,0.5); }
      `}</style>
    </div>
  );
};

export default Calendar;
