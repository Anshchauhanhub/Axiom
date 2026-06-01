import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, Clock, CheckCircle2 } from 'lucide-react';
import { getAllTasks } from '../services/api';

const TopNav = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const tasks = await getAllTasks();
        if (!tasks) return;

        const now = new Date();
        const notifs = [];
        let overdueCount = 0;
        const upcomingTasks = [];

        tasks.forEach(t => {
          if (!t.completed_at && t.scheduled_at) {
            const scheduled = new Date(t.scheduled_at);
            if (scheduled < now) {
              overdueCount++;
            } else if (scheduled.getTime() - now.getTime() < 24 * 60 * 60 * 1000) {
              upcomingTasks.push(t);
            }
          }
        });

        // AI Teacher Messages
        if (overdueCount > 0) {
          notifs.push({
            id: 'overdue',
            type: 'urgent',
            title: 'Axiom AI (Teacher)',
            message: `You have ${overdueCount} overdue task(s)! No more excuses, get back to studying right now!`,
            time: 'Just now',
            icon: <AlertCircle className="text-red-500" size={18} />
          });
        }

        upcomingTasks.slice(0, 2).forEach(t => {
          notifs.push({
            id: `upcoming-${t.id}`,
            type: 'warning',
            title: 'Axiom AI (Teacher)',
            message: `Don't forget! Your task "${t.title}" is scheduled for today. Make sure you complete it on time.`,
            time: 'Upcoming',
            icon: <Clock className="text-orange-400" size={18} />
          });
        });

        if (notifs.length === 0) {
          notifs.push({
            id: 'all-good',
            type: 'success',
            title: 'Axiom AI (Teacher)',
            message: `Great job staying on track! No pending tasks right now. Take a well-deserved break!`,
            time: 'Just now',
            icon: <CheckCircle2 className="text-green-500" size={18} />
          });
        }

        setNotifications(notifs);
      } catch (error) {
        console.error('Failed to load notifications:', error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000); // Check every minute
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const hasUrgent = notifications.some(n => n.type === 'urgent');

  return (
    <div className="fixed top-0 right-0 p-4 lg:p-6 z-50 pointer-events-auto">
      <div className="relative" ref={dropdownRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`relative p-3 rounded-full transition-all duration-300 ${isOpen ? 'bg-surface-container-highest text-primary' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'} border border-white/5 shadow-lg backdrop-blur-md`}
        >
          <Bell size={20} className={hasUrgent && !isOpen ? 'animate-pulse text-red-400' : ''} />
          
          {/* Notification Badge */}
          {notifications.length > 0 && notifications[0].type !== 'success' && (
            <span className={`absolute top-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-background ${hasUrgent ? 'bg-red-500' : 'bg-orange-500'}`}></span>
          )}
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-surface-container-lowest border border-white/10 rounded-2xl shadow-2xl overflow-hidden origin-top-right animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-white/5 bg-surface-container/50">
              <h3 className="font-bold text-on-surface flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                Teacher Messages
              </h3>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {notifications.map((notif) => (
                <div key={notif.id} className="p-4 border-b border-white/5 hover:bg-surface-container transition-colors flex gap-3 last:border-0">
                  <div className={`mt-1 p-2 rounded-full h-fit flex-shrink-0 ${notif.type === 'urgent' ? 'bg-red-500/10' : notif.type === 'warning' ? 'bg-orange-500/10' : 'bg-green-500/10'}`}>
                    {notif.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`text-sm font-bold truncate pr-2 ${notif.type === 'urgent' ? 'text-red-400' : notif.type === 'warning' ? 'text-orange-400' : 'text-green-400'}`}>
                        {notif.title}
                      </h4>
                      <span className="text-xs text-on-surface-variant whitespace-nowrap">{notif.time}</span>
                    </div>
                    <p className="text-sm text-on-surface leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopNav;
