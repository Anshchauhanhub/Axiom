import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { linkTelegram, updateSchedule, updateProfile, uploadProfileImage } from '../services/api';

const API_BASE = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

const SettingsModal = ({ isOpen, onClose }) => {
  const { user, logout, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState('general');
  const [chatId, setChatId] = useState('');
  const [schedule, setSchedule] = useState(user?.study_schedule || ['12:00', '18:00']);
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');
  const [saving, setSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.full_name || user?.email?.split('@')[0] || '');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Reset state when user changes
  useEffect(() => {
    if (user) {
      setSchedule(user.study_schedule || ['12:00', '18:00']);
      setTimezone(user.timezone || 'Asia/Kolkata');
      setNewName(user.full_name || user.email?.split('@')[0] || '');
    }
  }, [user]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKey);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const handleLinkTelegram = async () => {
    if (!chatId) return;
    setSaving(true);
    try {
      await linkTelegram(parseInt(chatId));
      showToast('Telegram linked successfully!');
      refreshUser();
      setChatId('');
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSaving(false);
  };

  const handleSaveName = async () => {
    if (!newName.trim() || newName === user.full_name) {
      setIsEditingName(false);
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ full_name: newName });
      showToast('Profile name updated!');
      await refreshUser();
      setIsEditingName(false);
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSaving(false);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      await uploadProfileImage(file);
      showToast('Profile image updated!');
      await refreshUser();
    } catch (err) {
      showToast(err.message, 'error');
    }
    setUploadingImage(false);
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    try {
      const sortedSchedule = [...schedule].sort();
      await updateSchedule(timezone, sortedSchedule);
      setSchedule(sortedSchedule);
      showToast('Schedule updated!');
      refreshUser();
    } catch (e) {
      showToast(e.message, 'error');
    }
    setSaving(false);
  };

  const handleLogout = () => {
    onClose();
    logout();
  };

  const tabs = [
    { id: 'general', label: 'General', icon: 'person' },
    { id: 'notifications', label: 'Notifications', icon: 'notifications' },
    { id: 'security', label: 'Security & Data', icon: 'shield' },
  ];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"></div>

      {/* Modal Container */}
      <div 
        ref={modalRef}
        className="relative w-full max-w-[720px] max-h-[85vh] bg-[#131315] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 mx-4"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 shrink-0">
          <h2 className="text-base font-bold text-white tracking-wide">Settings</h2>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
          {/* Top/Left Tab Navigation */}
          <div className="w-full md:w-[200px] shrink-0 border-b md:border-b-0 md:border-r border-white/5 py-3 px-2 flex flex-row md:flex-col gap-1 bg-[#0e0e10]/50 overflow-x-auto md:overflow-y-auto no-scrollbar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 md:w-full flex items-center justify-center md:justify-start gap-2 md:gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all text-center md:text-left whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white/8 text-white'
                    : 'text-white/50 hover:text-white/80 hover:bg-white/3'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${activeTab === tab.id ? 'text-primary' : ''}`}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}

            {/* Logout at bottom of sidebar (desktop only) */}
            <div className="hidden md:block mt-auto pt-4 border-t border-white/5 mx-1">
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-red-400/80 hover:text-red-400 hover:bg-red-400/5 transition-all text-left"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Log out
              </button>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 overflow-y-auto py-6 px-6 custom-scrollbar">

            {/* ==================== GENERAL TAB ==================== */}
            {activeTab === 'general' && (
              <div className="animate-in fade-in duration-300 space-y-8">
                
                {/* Profile Section */}
                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] mb-4">Profile</h3>
                  <div className="flex items-center gap-5 p-4 bg-white/3 rounded-xl border border-white/5">
                    {/* Avatar */}
                    <div 
                      className="relative group cursor-pointer w-16 h-16 rounded-full overflow-hidden border-2 border-white/10 shrink-0 bg-surface-container flex items-center justify-center"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {user.profile_image_url ? (
                        <img 
                          src={user.profile_image_url.startsWith('http') ? user.profile_image_url : `${API_BASE}${user.profile_image_url}`} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-bold text-white/60">{user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}</span>
                      )}
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-white text-[18px]">
                          {uploadingImage ? 'hourglass_empty' : 'photo_camera'}
                        </span>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </div>

                    {/* Name & Email */}
                    <div className="flex-1 min-w-0">
                      {isEditingName ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                          />
                          <button onClick={handleSaveName} disabled={saving} className="text-primary hover:text-primary/80 text-sm">
                            <span className="material-symbols-outlined text-[18px]">check</span>
                          </button>
                          <button onClick={() => { setIsEditingName(false); setNewName(user.full_name || user.email.split('@')[0]); }} className="text-white/40 hover:text-white/60 text-sm">
                            <span className="material-symbols-outlined text-[18px]">close</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate">{user.full_name || user.email.split('@')[0]}</span>
                          <button 
                            onClick={() => setIsEditingName(true)}
                            className="text-white/30 hover:text-white/60 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Study Schedule */}
                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] mb-4">Study Schedule</h3>
                  <div className="space-y-3">
                    {schedule.map((time, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <div className="flex-1 relative">
                          <input
                            type="time"
                            value={time}
                            onChange={(e) => {
                              const newSched = [...schedule];
                              newSched[idx] = e.target.value;
                              setSchedule(newSched);
                            }}
                            className="w-full bg-white/3 border border-white/8 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all appearance-none"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/20 uppercase tracking-wider pointer-events-none">Session {idx + 1}</span>
                        </div>
                        {schedule.length > 1 && (
                          <button 
                            onClick={() => setSchedule(schedule.filter((_, i) => i !== idx))}
                            className="w-10 h-10 flex items-center justify-center text-white/20 hover:text-red-400 hover:bg-red-400/5 rounded-lg transition-colors"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        )}
                      </div>
                    ))}
                    <button 
                      onClick={() => setSchedule([...schedule, '09:00'])}
                      className="w-full py-2.5 border border-dashed border-white/10 rounded-lg flex items-center justify-center gap-2 text-[12px] text-white/30 hover:text-white/60 hover:border-white/20 transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px]">add</span>
                      Add session
                    </button>
                  </div>

                  {/* Timezone */}
                  <div className="mt-4">
                    <label className="text-[11px] text-white/30 uppercase tracking-wider block mb-2">Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-white/3 border border-white/8 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 appearance-none cursor-pointer"
                    >
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="America/New_York">America/New_York (EST)</option>
                      <option value="Europe/London">Europe/London (GMT)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                      <option value="Europe/Berlin">Europe/Berlin (CET)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEST)</option>
                    </select>
                  </div>

                  <button
                    onClick={handleSaveSchedule}
                    disabled={saving}
                    className="mt-4 w-full py-2.5 bg-primary text-black rounded-lg text-[12px] font-bold tracking-wider uppercase disabled:opacity-50 hover:brightness-110 transition-all"
                  >
                    {saving ? 'Saving...' : 'Save Schedule'}
                  </button>
                </div>

              </div>
            )}

            {/* ==================== NOTIFICATIONS TAB ==================== */}
            {activeTab === 'notifications' && (
              <div className="animate-in fade-in duration-300 space-y-8">

                {/* Telegram Integration */}
                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] mb-4">Telegram Coach</h3>
                  <div className="p-4 bg-white/3 rounded-xl border border-white/5 space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[#0088cc]/10 flex items-center justify-center text-[#0088cc] shrink-0">
                        <span className="material-symbols-outlined text-[20px]">send</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white">Telegram Notifications</p>
                        <p className="text-[12px] text-white/40 mt-0.5">
                          {user.telegram_chat_id ? `Connected — ID: ${user.telegram_chat_id}` : 'Not connected'}
                        </p>
                      </div>
                      {user.telegram_chat_id && (
                        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0 shadow-[0_0_8px_rgba(74,222,128,0.5)]"></span>
                      )}
                    </div>

                    {!user.telegram_chat_id && (
                      <div className="space-y-3 pt-2 border-t border-white/5">
                        <input
                          className="w-full bg-white/5 border border-white/8 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:ring-1 focus:ring-[#0088cc]/50 placeholder:text-white/20"
                          placeholder="Enter Telegram Chat ID"
                          type="number"
                          value={chatId}
                          onChange={(e) => setChatId(e.target.value)}
                        />
                        <button
                          onClick={handleLinkTelegram}
                          disabled={saving || !chatId}
                          className="w-full py-2.5 bg-[#0088cc] text-white rounded-lg text-[12px] font-bold tracking-wider uppercase disabled:opacity-50 hover:brightness-110 transition-all"
                        >
                          {saving ? 'Linking...' : 'Link Telegram'}
                        </button>
                        <p className="text-[11px] text-white/30 leading-relaxed">
                          Open Telegram → message <a href="https://t.me/Edxiomneurobot" target="_blank" rel="noopener noreferrer" className="text-[#0088cc] hover:underline font-semibold">@Edxiomneurobot</a> → send <code className="bg-white/5 px-1.5 py-0.5 rounded text-white/60">/start</code> → copy your Chat ID
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Push Notifications - Placeholder */}
                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] mb-4">Reminders</h3>
                  <div className="space-y-1">
                    <SettingsToggleRow label="Study reminders" description="Get notified when it's time to study" defaultChecked={true} />
                    <SettingsToggleRow label="Streak alerts" description="Warns you before losing your streak" defaultChecked={true} />
                    <SettingsToggleRow label="Weekly report" description="Summary of your progress every Sunday" defaultChecked={false} />
                  </div>
                </div>

              </div>
            )}

            {/* ==================== SECURITY & DATA TAB ==================== */}
            {activeTab === 'security' && (
              <div className="animate-in fade-in duration-300 space-y-8">

                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] mb-4">Account Security</h3>
                  <div className="space-y-1">
                    <SettingsInfoRow icon="mail" label="Email" value={user.email} />
                    <SettingsInfoRow icon="login" label="Auth Provider" value="Google OAuth 2.0" />
                    <SettingsInfoRow icon="verified_user" label="Account Status" value="Active" valueColor="text-green-400" />
                    <SettingsInfoRow icon="local_fire_department" label="Current Streak" value={`${user.current_streak || 0} days`} valueColor="text-primary" />
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] mb-4">Data & Privacy</h3>
                  <div className="space-y-1">
                    <SettingsToggleRow label="Analytics" description="Help improve Edxiom with anonymous usage data" defaultChecked={false} />
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold text-white/40 uppercase tracking-[0.15em] mb-4">Danger Zone</h3>
                  <div className="p-4 bg-red-500/3 rounded-xl border border-red-500/10">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-white">Delete Account</p>
                        <p className="text-[12px] text-white/30 mt-0.5">Permanently remove your account and all data.</p>
                      </div>
                      <button className="px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};


/* ──────────── Reusable Setting Row Components ──────────── */

const SettingsToggleRow = ({ label, description, defaultChecked }) => {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between p-4 rounded-xl hover:bg-white/2 transition-colors">
      <div>
        <p className="text-sm text-white">{label}</p>
        {description && <p className="text-[12px] text-white/30 mt-0.5">{description}</p>}
      </div>
      <button 
        onClick={() => setChecked(!checked)}
        className={`w-10 h-[22px] rounded-full transition-all duration-300 relative ${checked ? 'bg-primary' : 'bg-white/10'}`}
      >
        <div className={`absolute top-[3px] w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-300 ${checked ? 'left-[22px]' : 'left-[3px]'}`}></div>
      </button>
    </div>
  );
};

const SettingsInfoRow = ({ icon, label, value, valueColor = 'text-white/60' }) => {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl">
      <div className="flex items-center gap-3">
        <span className="material-symbols-outlined text-[18px] text-white/30">{icon}</span>
        <span className="text-sm text-white/70">{label}</span>
      </div>
      <span className={`text-sm font-medium ${valueColor}`}>{value}</span>
    </div>
  );
};


export default SettingsModal;
