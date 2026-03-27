import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { linkTelegram, updateSchedule } from '../services/api';

const Settings = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [chatId, setChatId] = useState('');
  const [schedule, setSchedule] = useState(user?.study_schedule || ['12:00', '18:00']);
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <button onClick={() => navigate('/onboarding')} className="px-10 py-4 rounded-full bg-primary text-on-primary-container font-label text-xs font-bold tracking-widest uppercase">
          Login first
        </button>
      </div>
    );
  }

  const handleLinkTelegram = async () => {
    if (!chatId) return;
    setSaving(true);
    try {
      await linkTelegram(parseInt(chatId));
      setMessage('✅ Telegram linked successfully!');
      refreshUser();
      setChatId('');
    } catch (e) {
      setMessage(`❌ ${e.message}`);
    }
    setSaving(false);
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      await updateSchedule(timezone, schedule);
      setMessage('✅ Schedule updated!');
      refreshUser();
    } catch (e) {
      setMessage(`❌ ${e.message}`);
    }
    setSaving(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/onboarding');
  };

  return (
    <div className="animate-in fade-in duration-1000 max-w-4xl mx-auto">
      <header className="mb-12">
        <h2 className="text-4xl font-black tracking-tighter text-on-surface mb-2 font-headline uppercase">Control Center</h2>
        <p className="text-on-surface-variant font-label tracking-wide uppercase text-[10px] opacity-60">System Configuration</p>
      </header>

      {message && (
        <div className="mb-8 p-4 bg-surface-container-low border border-outline-variant/20 rounded-xl">
          <p className="text-sm font-label font-bold">{message}</p>
        </div>
      )}

      <div className="space-y-12">
        {/* Profile Section */}
        <section>
          <h3 className="font-label text-xs font-bold text-secondary tracking-[0.2em] uppercase mb-6 flex items-center gap-3">
            <span className="h-[1px] w-8 bg-secondary/30"></span> Profile Identity
          </h3>
          <div className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 flex flex-col md:flex-row items-center gap-8">
            <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-primary/20 p-1 bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-4xl">person</span>
            </div>
            <div className="flex-1 text-center md:text-left">
              <h4 className="text-2xl font-black font-headline text-on-surface uppercase">{user.email.split('@')[0]}</h4>
              <p className="text-on-surface-variant text-sm font-label mt-1">{user.email} • Streak: {user.current_streak}D</p>
            </div>
          </div>
        </section>

        {/* Telegram Section */}
        <section>
          <h3 className="font-label text-xs font-bold text-primary tracking-[0.2em] uppercase mb-6 flex items-center gap-3">
            <span className="h-[1px] w-8 bg-primary/30"></span> Neural Bridge
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-container-lowest border border-outline-variant/15 p-8 rounded-3xl">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc]">
                  <span className="material-symbols-outlined">send</span>
                </div>
                <div>
                  <div className="text-sm font-bold">Telegram Coach</div>
                  <div className="text-[10px] text-on-surface-variant font-label uppercase">
                    {user.telegram_chat_id ? `Connected (ID: ${user.telegram_chat_id})` : 'Not connected'}
                  </div>
                </div>
              </div>
              {!user.telegram_chat_id && (
                <div className="space-y-3">
                  <input
                    className="w-full bg-surface-container-low border-none rounded-xl px-4 py-3 text-on-surface focus:ring-1 focus:ring-primary font-label text-sm placeholder:text-outline-variant"
                    placeholder="Enter Telegram Chat ID"
                    type="number"
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                  />
                  <button
                    onClick={handleLinkTelegram}
                    disabled={saving || !chatId}
                    className="w-full py-3 bg-[#0088cc] text-white rounded-xl font-label text-[10px] font-bold tracking-widest uppercase disabled:opacity-50"
                  >
                    {saving ? 'Linking...' : 'Link Telegram'}
                  </button>
                  <p className="text-[10px] text-on-surface-variant font-label">
                    Open Telegram → message @AxiomBot → send /start → copy your Chat ID
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Schedule Section */}
        <section>
          <h3 className="font-label text-xs font-bold text-on-surface-variant tracking-[0.2em] uppercase mb-6 flex items-center gap-3">
            <span className="h-[1px] w-8 bg-outline-variant/30"></span> Study Schedule
          </h3>
          <div className="bg-surface-container-low border border-outline-variant/15 rounded-[2rem] p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-2 block">Session 1</label>
                <input
                  type="time"
                  value={schedule[0] || '12:00'}
                  onChange={(e) => setSchedule([e.target.value, schedule[1]])}
                  className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-on-surface font-label text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-2 block">Session 2</label>
                <input
                  type="time"
                  value={schedule[1] || '18:00'}
                  onChange={(e) => setSchedule([schedule[0], e.target.value])}
                  className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-on-surface font-label text-sm focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="mb-6">
              <label className="text-[10px] font-label text-on-surface-variant uppercase tracking-widest mb-2 block">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-surface-container border-none rounded-xl px-4 py-3 text-on-surface font-label text-sm focus:ring-1 focus:ring-primary"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="America/New_York">America/New_York (EST)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
              </select>
            </div>
            <button
              onClick={handleSaveSchedule}
              disabled={saving}
              className="w-full py-3 bg-primary text-on-primary-container rounded-xl font-label text-[10px] font-bold tracking-widest uppercase disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Schedule'}
            </button>
          </div>
        </section>

        {/* Action Tray */}
        <div className="pt-12 flex justify-between items-center border-t border-outline-variant/10">
          <button onClick={handleLogout} className="text-[10px] font-label font-bold text-error uppercase tracking-[0.2em] hover:text-white transition-colors">
            Terminate Session
          </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;
