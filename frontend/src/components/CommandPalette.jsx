import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, BookOpen, Calendar, PlusCircle, 
  Home, FileText, Sparkles, X, ChevronRight 
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { goals, setSelectedGoalId } = useData();

  // Toggle with Ctrl+K or Cmd+K
  useKeyboardShortcut('ctrl+k', () => {
    setIsOpen(prev => !prev);
  }, { ignoreInputs: false });

  // Escape to close
  useKeyboardShortcut('escape', () => {
    if (isOpen) setIsOpen(false);
  }, { enabled: isOpen, ignoreInputs: false });

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Static navigation commands
  const defaultCommands = [
    { id: 'dash', title: 'Go to Dashboard', category: 'Navigation', icon: Home, action: () => navigate('/dashboard') },
    { id: 'study', title: 'Open Study Workbench', category: 'Navigation', icon: BookOpen, action: () => navigate('/study') },
    { id: 'calendar', title: 'Open Calendar & Timetable', category: 'Navigation', icon: Calendar, action: () => navigate('/calendar') },
    { id: 'notebooks', title: 'Browse Study Notebooks', category: 'Navigation', icon: FileText, action: () => navigate('/notebooks') },
    { id: 'onboard', title: 'Create New Goal (AI Architect)', category: 'Actions', icon: PlusCircle, action: () => navigate('/onboarding') },
  ];

  // Dynamic goal commands
  const goalCommands = (goals || []).map(g => ({
    id: `goal-${g.id}`,
    title: `Study Goal: ${g.title}`,
    category: 'Goals',
    icon: Sparkles,
    action: () => {
      setSelectedGoalId(g.id);
      navigate('/study');
    },
  }));

  const allItems = [...defaultCommands, ...goalCommands];

  const filteredItems = query.trim() === '' 
    ? allItems 
    : allItems.filter(item => item.title.toLowerCase().includes(query.toLowerCase()) || item.category.toLowerCase().includes(query.toLowerCase()));

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        setIsOpen(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-xl bg-surface-container-high border border-outline-variant/20 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/10">
          <Search size={20} className="text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search goals... (↑↓ to navigate, Enter to select)"
            className="flex-1 bg-transparent text-sm text-on-surface placeholder:text-on-surface-variant/50 outline-none"
          />
          <button 
            onClick={() => setIsOpen(false)}
            className="text-on-surface-variant hover:text-on-surface p-1 rounded-lg"
          >
            <X size={18} />
          </button>
        </div>

        {/* Results list */}
        <div className="max-h-80 overflow-y-auto custom-scrollbar p-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-xs text-on-surface-variant">
              No matching commands or goals found.
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    item.action();
                    setIsOpen(false);
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-4 py-3 rounded-2xl cursor-pointer transition-all ${
                    isSelected ? 'bg-primary/15 text-primary border border-primary/20' : 'text-on-surface hover:bg-surface-container'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
                    }`}>
                      <Icon size={16} />
                    </div>
                    <div className="truncate">
                      <p className="text-xs font-semibold truncate">{item.title}</p>
                      <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">{item.category}</span>
                    </div>
                  </div>
                  <ChevronRight size={14} className={isSelected ? 'text-primary' : 'text-on-surface-variant/40'} />
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-surface-container-low border-t border-outline-variant/5 flex items-center justify-between text-[11px] text-on-surface-variant">
          <span>Navigate with <kbd className="px-1.5 py-0.5 rounded bg-surface-container-highest font-mono text-[10px]">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-surface-container-highest font-mono text-[10px]">↓</kbd></span>
          <span>Select with <kbd className="px-1.5 py-0.5 rounded bg-surface-container-highest font-mono text-[10px]">Enter</kbd></span>
        </div>
      </div>
    </div>
  );
}
