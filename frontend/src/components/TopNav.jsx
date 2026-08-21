import React, { useState, useEffect, useRef } from 'react';
import { Bell, AlertCircle, Clock, CheckCircle2, Coins, Play, X, Loader2 } from 'lucide-react';
import { getAllTasks, isLoggedIn, earnCredit } from '../services/api';
import { useAuth } from '../context/AuthContext';

const TopNav = () => {
  const { user, refreshUser } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [adCountdown, setAdCountdown] = useState(5);
  const dropdownRef = useRef(null);

  useEffect(() => {
    let interval;
    if (isWatchingAd) {
      interval = setInterval(() => {
        setAdCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            handleAdComplete();
            return 5;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isWatchingAd]);

  const handleAdComplete = async () => {
    try {
      await earnCredit();
      await refreshUser();
      setIsWatchingAd(false);
      setAdModalOpen(false);
      alert("🎉 1 Credit Earned! Thank you for supporting Edxiom AI.");
    } catch (error) {
      console.error("Failed to earn credit:", error);
      setIsWatchingAd(false);
      alert("Error: " + error.message);
    }
  };

  const startAd = () => {
    setIsWatchingAd(true);
    setAdCountdown(5);
    
    // Open Adsterra Direct Link in a new tab to bypass popup blockers
    const directLink = import.meta.env.VITE_ADSTERRA_DIRECT_LINK;
    if (directLink) {
      window.open(directLink, '_blank');
    } else {
      // Fallback: open a placeholder or let the popunder try to trigger
      console.warn("VITE_ADSTERRA_DIRECT_LINK not set in .env. Falling back to background popunder.");
    }
  };

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!isLoggedIn()) return;
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
            title: 'Edxiom AI (Teacher)',
            message: `You have ${overdueCount} overdue task(s)! No more excuses, get back to studying right now!`,
            time: 'Just now',
            icon: <AlertCircle className="text-red-500" size={18} />
          });
        }

        upcomingTasks.slice(0, 2).forEach(t => {
          notifs.push({
            id: `upcoming-${t.id}`,
            type: 'warning',
            title: 'Edxiom AI (Teacher)',
            message: `Don't forget! Your task "${t.title}" is scheduled for today. Make sure you complete it on time.`,
            time: 'Upcoming',
            icon: <Clock className="text-orange-400" size={18} />
          });
        });

        if (notifs.length === 0) {
          notifs.push({
            id: 'all-good',
            type: 'success',
            title: 'Edxiom AI (Teacher)',
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
    <div id="top-nav" className="fixed top-4 right-4 lg:top-6 lg:right-6 z-[99] pointer-events-auto flex items-center gap-3">
      {/* Notifications Button */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-300 ${isOpen ? 'bg-surface-bright text-primary' : 'bg-surface hover:bg-surface-bright text-on-surface/80 hover:text-on-surface'} border border-outline/20 shadow-md backdrop-blur-lg active:scale-95`}
        >
          <Bell size={19} className={hasUrgent && !isOpen ? 'animate-pulse text-red-400' : ''} />
          
          {/* Notification Badge */}
          {notifications.length > 0 && notifications[0].type !== 'success' && (
            <span className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full ${hasUrgent ? 'bg-red-500' : 'bg-orange-500'} ring-2 ring-surface`}></span>
          )}
        </button>

        {/* Notification Dropdown */}
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

      {/* Adsterra Rewards / Earn Credits Modal */}
      {adModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md bg-[#131315] border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => !isWatchingAd && setAdModalOpen(false)}
              disabled={isWatchingAd}
              className="absolute top-4 right-4 text-white/60 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <X size={20} />
            </button>

            <div className="p-6 text-center">
              {!isWatchingAd ? (
                <>
                  <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-[32px] text-primary">monetization_on</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Need More Credits?</h3>
                  <p className="text-sm text-white/60 mb-6">
                    Axiom is 100% free to use. Watch a short sponsor ad to support us and earn 1 Credit!
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={startAd}
                      className="w-full py-3 bg-yellow-500 text-black font-extrabold rounded-xl hover:bg-yellow-400 active:scale-98 transition-all flex items-center justify-center gap-2"
                    >
                      <Play size={16} fill="black" />
                      Watch Sponsor Ad
                    </button>
                    <button
                      onClick={() => setAdModalOpen(false)}
                      className="w-full py-3 bg-white/5 text-white/80 font-bold rounded-xl hover:bg-white/10 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-8">
                  <div className="relative w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                    <Loader2 size={48} className="text-yellow-400 animate-spin absolute" />
                    <span className="text-xl font-extrabold text-yellow-400">{adCountdown}s</span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2">Streaming Sponsor Content...</h3>
                  <p className="text-xs text-white/40 max-w-xs mx-auto">
                    Please do not close this window. Your popunder ad should have opened. Click anywhere on the screen if it didn't trigger.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopNav;
