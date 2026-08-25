import React, { useState, useEffect, useMemo } from 'react';
import { getAllTasks, getPersonalTasks, createPersonalTask, deletePersonalTask } from '../services/api';
import { CheckCircle, Circle, Lock, ChevronLeft, ChevronRight, Search, Filter, Calendar as CalendarIcon, Clock, X } from 'lucide-react';

let globalCalendarCache = null;

const Calendar = () => {
    const [tasks, setTasks] = useState([]);
    const [personalTasks, setPersonalTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDateInfo, setSelectedDateInfo] = useState(null); // { date: Date, tasks: [] }
    const [activeGoalId, setActiveGoalId] = useState(null);
    const [showPersonalTaskModal, setShowPersonalTaskModal] = useState(false);
    const [newPersonalTask, setNewPersonalTask] = useState({ title: '', description: '', date: '', time: '' });
    const [showLegend, setShowLegend] = useState(false);

    useEffect(() => {
        const fetchAllData = async () => {
            if (globalCalendarCache) {
                setTasks(globalCalendarCache.tasks);
                setPersonalTasks(globalCalendarCache.personalTasks);
                setLoading(false);
            }
            try {
                const [tasksData, personalTasksData] = await Promise.all([
                    getAllTasks(),
                    getPersonalTasks()
                ]);
                globalCalendarCache = { tasks: tasksData, personalTasks: personalTasksData };
                setTasks(tasksData);
                setPersonalTasks(personalTasksData);
            } catch (err) {
                console.error("Failed to fetch calendar data", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAllData();
    }, []);

    const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const numDays = daysInMonth(year, month);
    const firstDay = firstDayOfMonth(year, month);
    const totalRows = Math.ceil((firstDay + numDays) / 7);
    const totalCells = totalRows * 7;

    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

    // Organize tasks
    const tasksByDate = useMemo(() => {
        const map = {};

        // Learning Tasks
        tasks.forEach(task => {
            const dateToUse = task.scheduled_at || task.completed_at;
            if (dateToUse) {
                const d = new Date(dateToUse);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    const dateStr = d.getDate();
                    if (!map[dateStr]) map[dateStr] = [];
                    map[dateStr].push({ ...task, is_personal: false });
                }
            }
        });

        // Personal Tasks
        personalTasks.forEach(task => {
            if (task.scheduled_at) {
                const d = new Date(task.scheduled_at);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    const dateStr = d.getDate();
                    if (!map[dateStr]) map[dateStr] = [];
                    map[dateStr].push({ ...task, is_personal: true });
                }
            }
        });

        // Sort tasks in each day by time
        Object.keys(map).forEach(day => {
            map[day].sort((a, b) => new Date(a.scheduled_at || a.completed_at || 0) - new Date(b.scheduled_at || b.completed_at || 0));
        });
        return map;
    }, [tasks, personalTasks, year, month]);

    const activeAndLockedTasks = tasks.filter(t => !t.completed_at);

    const uniqueGoals = useMemo(() => {
        const goalsMap = {};
        tasks.forEach(t => {
            if (!goalsMap[t.goal_id]) {
                goalsMap[t.goal_id] = {
                    id: t.goal_id,
                    title: t.goal_title,
                    taskCount: 0,
                    completedCount: 0
                };
            }
            goalsMap[t.goal_id].taskCount += 1;
            if (t.completed_at) {
                goalsMap[t.goal_id].completedCount += 1;
            }
        });
        return Object.values(goalsMap);
    }, [tasks]);

    const selectedGoalTasks = useMemo(() => {
        if (!activeGoalId) return [];
        return tasks
            .filter(t => t.goal_id === activeGoalId)
            .sort((a, b) => {
                // Sort chronologically by scheduled_at if available
                const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
                const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
                return dateA - dateB;
            });
    }, [tasks, activeGoalId]);

    const selectedGoalInfo = useMemo(() => {
        if (!activeGoalId || tasks.length === 0) return null;
        const firstTask = tasks.find(t => t.goal_id === activeGoalId);
        return firstTask ? { id: firstTask.goal_id, title: firstTask.goal_title } : null;
    }, [tasks, activeGoalId]);

    const getStatusIcon = (status) => {
        if (status === 'passed') return <CheckCircle size={14} className="text-secondary" />;
        if (status === 'active') return <Circle size={14} className="text-primary" />;
        return <Lock size={14} className="text-on-surface-variant/40" />;
    };

    const getTaskStatusInfo = (task) => {
        if (task.is_personal) return { text: 'Personal Task', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', dotClass: 'bg-purple-500' };

        if (!task.completed_at) return { text: 'Pending', color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', dotClass: 'bg-orange-500' };

        if (task.scheduled_at) {
            const completed = new Date(task.completed_at);
            const scheduled = new Date(task.scheduled_at);
            const completedStr = completed.toISOString().split('T')[0];
            const scheduledStr = scheduled.toISOString().split('T')[0];
            if (completedStr > scheduledStr) {
                return { text: 'Completed Late', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', dotClass: 'bg-yellow-400' };
            }
        }
        return { text: 'Completed', color: 'text-secondary bg-secondary/10 border-secondary/20', dotClass: 'bg-secondary' };
    };

    const handleOpenPersonalTaskModal = () => {
        const now = new Date();
        // YYYY-MM-DD
        const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
        // HH:MM
        const timeStr = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');

        setNewPersonalTask({ title: '', description: '', date: dateStr, time: timeStr });
        setShowPersonalTaskModal(true);
    };

    const handleCreatePersonalTask = async () => {
        if (!newPersonalTask.title || !newPersonalTask.date || !newPersonalTask.time) return;
        try {
            const datetimeStr = `${newPersonalTask.date}T${newPersonalTask.time}:00`;
            const task = await createPersonalTask({
                title: newPersonalTask.title,
                description: newPersonalTask.description,
                scheduled_at: new Date(datetimeStr).toISOString()
            });
            const newTasksList = [...personalTasks, task];
            setPersonalTasks(newTasksList);
            if (globalCalendarCache) globalCalendarCache.personalTasks = newTasksList;
            setNewPersonalTask({ title: '', description: '', date: '', time: '' });
            setShowPersonalTaskModal(false);
        } catch (e) {
            console.error("Failed to create personal task", e);
        }
    };

    const handleDeletePersonalTask = async (taskId) => {
        try {
            await deletePersonalTask(taskId);
            const updatedTasks = personalTasks.filter(t => t.id !== taskId);
            setPersonalTasks(updatedTasks);
            if (globalCalendarCache) globalCalendarCache.personalTasks = updatedTasks;
        } catch (e) {
            console.error("Failed to delete personal task", e);
        }
    };

    return (
        <div className="w-full flex flex-col-reverse lg:flex-row gap-8 animate-in slide-in-from-bottom-5 duration-700">

            {/* Sidebar: Task List */}
            <div className="w-full lg:w-80 flex flex-col shrink-0">
                <div className="bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/10 rounded-[2.5rem] p-6 max-h-[50vh] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 flex flex-col shadow-2xl overflow-hidden">

                    {!activeGoalId ? (
                        <>
                            {/* Split View: Top Half - Goals */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <h3 className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-primary">Learning Paths</h3>
                                    <div className="flex items-center gap-2 text-on-surface-variant/60">
                                        <button className="hover:text-primary transition-colors"><Search size={14} /></button>
                                        <button className="hover:text-primary transition-colors"><Filter size={14} /></button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 mb-4">
                                    {loading ? (
                                        <div className="animate-pulse space-y-4">
                                            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-surface-container-highest/20 rounded-2xl"></div>)}
                                        </div>
                                    ) : uniqueGoals.length === 0 ? (
                                        <div className="text-center py-4 text-on-surface-variant/40 font-label text-[9px] uppercase tracking-widest">
                                            No active paths.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {uniqueGoals.map(goal => {
                                                const percent = Math.round((goal.completedCount / goal.taskCount) * 100) || 0;
                                                return (
                                                    <div
                                                        key={goal.id}
                                                        onClick={() => setActiveGoalId(goal.id)}
                                                        className="bg-surface-container-low/50 hover:bg-surface-container border border-outline-variant/5 hover:border-primary/20 p-4 rounded-2xl transition-all cursor-pointer group flex flex-col gap-2"
                                                    >
                                                        <h4 className="font-bold text-sm text-on-surface group-hover:text-primary transition-colors truncate">
                                                            {goal.title}
                                                        </h4>

                                                        <div className="space-y-1">
                                                            <div className="flex items-center justify-between text-[8px] font-label uppercase tracking-widest text-on-surface-variant/60">
                                                                <span>Progress</span>
                                                                <span className="text-primary">{percent}%</span>
                                                            </div>
                                                            <div className="h-1 w-full bg-surface-container-highest/35 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary rounded-full transition-all"
                                                                    style={{ width: `${percent}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Split View: Bottom Half - Personal Workspace */}
                            <div className="flex-1 flex flex-col min-h-0 pt-4 border-t border-outline-variant/10">
                                <div className="flex items-center justify-between mb-4 shrink-0">
                                    <h3 className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-purple-400">Personal Workspace</h3>
                                    <button
                                        onClick={handleOpenPersonalTaskModal}
                                        className="px-2 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 rounded text-[9px] font-label font-bold uppercase tracking-wider transition-colors"
                                    >
                                        + Add
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2">
                                    {personalTasks.length === 0 ? (
                                        <div className="text-center py-4 text-on-surface-variant/40 font-label text-[9px] uppercase tracking-widest">
                                            No personal tasks scheduled.
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {personalTasks.map(task => {
                                                const timeStr = task.scheduled_at ? new Date(task.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                                const dateStr = task.scheduled_at ? new Date(task.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                                                return (
                                                    <div key={task.id} className="flex items-start gap-3 p-3 bg-surface-container-low/50 hover:bg-surface-container rounded-xl transition-all border border-outline-variant/5 hover:border-purple-500/20 group">
                                                        <div className="w-2 h-2 mt-1.5 rounded-full bg-purple-500/40 group-hover:bg-purple-500 shrink-0 transition-colors"></div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-xs font-bold text-on-surface truncate pr-6 relative">
                                                                {task.title}
                                                            </p>
                                                            {task.description && (
                                                                <p className="text-[10px] text-on-surface-variant/60 mt-1 line-clamp-2 leading-snug">
                                                                    {task.description}
                                                                </p>
                                                            )}
                                                            <div className="flex items-center mt-1.5">
                                                                <span className="text-[9px] text-purple-400/80 font-label tracking-widest truncate">
                                                                    {dateStr} {timeStr}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleDeletePersonalTask(task.id)}
                                                            className="opacity-0 group-hover:opacity-100 p-1 text-on-surface-variant/40 hover:text-red-400 hover:bg-red-400/10 rounded transition-all shrink-0 -ml-2"
                                                            title="Cancel task"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col h-full min-h-0">
                            {/* Detail View for Selected Goal */}
                            <div className="flex items-center gap-3 mb-6 shrink-0">
                                <button
                                    onClick={() => setActiveGoalId(null)}
                                    className="p-2 bg-surface-container hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface border border-outline-variant/10 rounded-xl transition-all"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="text-[9px] font-label font-black uppercase tracking-[0.2em] text-on-surface-variant/60">
                                    Back to Paths
                                </span>
                            </div>

                            <div className="mb-6 shrink-0">
                                <h3 className="text-base font-black font-headline uppercase tracking-tight text-on-surface line-clamp-2 leading-tight">
                                    {selectedGoalInfo?.title}
                                </h3>
                                <p className="text-[9px] font-label font-bold text-primary uppercase tracking-[0.2em] mt-1.5">
                                    {selectedGoalTasks.length} total tasks
                                </p>
                            </div>

                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 -mr-2 space-y-3">
                                {selectedGoalTasks.map(task => {
                                    const timeStr = task.scheduled_at ? new Date(task.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                                    const dateStr = task.scheduled_at ? new Date(task.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                                    const isPassed = task.status === 'passed';
                                    const isActive = task.status === 'active';

                                    const dotColor = isPassed ? 'bg-secondary' : isActive ? 'bg-orange-500' : 'bg-on-surface-variant/40';
                                    return (
                                        <div
                                            key={task.id}
                                            className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${isPassed
                                                    ? 'bg-secondary/5 border-secondary/15 hover:border-secondary/30'
                                                    : isActive
                                                        ? 'bg-primary/5 border-primary/20 hover:border-primary/40'
                                                        : 'bg-surface-container-low/50 border-outline-variant/5 hover:border-outline-variant/15 opacity-70'
                                                }`}
                                        >
                                            <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${dotColor}`}></div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-bold truncate ${isPassed
                                                        ? 'text-secondary line-through opacity-80'
                                                        : isActive
                                                            ? 'text-on-surface font-black'
                                                            : 'text-on-surface-variant/60'
                                                    }`}>
                                                    {task.title}
                                                </p>
                                                <div className="flex items-center justify-between mt-1.5">
                                                    <span className={`text-[8px] font-label uppercase tracking-widest px-1.5 py-0.5 rounded-md ${isPassed
                                                            ? 'bg-secondary/15 text-secondary'
                                                            : isActive
                                                                ? 'bg-primary/10 text-primary'
                                                                : 'bg-surface-container-highest text-on-surface-variant/60'
                                                        }`}>
                                                        {isPassed ? 'Done' : isActive ? 'Active' : 'Locked'}
                                                    </span>
                                                    {(dateStr || timeStr) && (
                                                        <p className="text-[9px] text-on-surface-variant/40 font-label tracking-widest shrink-0 ml-2">
                                                            {dateStr} {timeStr}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Calendar View */}
            <div className="flex-1 min-w-0 flex flex-col">
                <div className="bg-surface-container-low/30 backdrop-blur-xl border border-outline-variant/10 rounded-[2.5rem] p-4 sm:p-6 min-h-[400px] lg:h-[calc(100vh-8rem)] lg:sticky lg:top-24 flex flex-col shadow-2xl overflow-hidden">

                    {/* Header */}
                    <div className="flex items-center justify-center mb-8 px-2 sm:px-4">
                        <div className="flex items-center justify-between md:justify-center gap-4 sm:gap-6 w-full md:w-auto">
                            <button onClick={prevMonth} className="p-2 sm:p-3 bg-surface-container-low hover:bg-primary/20 hover:text-primary text-on-surface-variant border border-outline-variant/10 rounded-full transition-all shrink-0"><ChevronLeft size={20} /></button>
                            <h2 className="text-xl sm:text-2xl font-black font-headline text-on-surface uppercase tracking-tight text-center truncate flex-1 md:flex-none">
                                {monthNames[month]} <span className="text-primary">{year}</span>
                            </h2>
                            <button onClick={nextMonth} className="p-2 sm:p-3 bg-surface-container-low hover:bg-primary/20 hover:text-primary text-on-surface-variant border border-outline-variant/10 rounded-full transition-all shrink-0"><ChevronRight size={20} /></button>
                        </div>
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
                        <div className={`flex-1 grid grid-cols-7 overflow-hidden`} style={{ gridTemplateRows: `repeat(${totalRows}, 1fr)` }}>
                            {Array.from({ length: totalCells }).map((_, index) => {
                                const dayNum = index - firstDay + 1;
                                const isCurrentMonth = dayNum > 0 && dayNum <= numDays;
                                const isToday = isCurrentMonth && dayNum === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                                const dayTasks = isCurrentMonth ? (tasksByDate[dayNum] || []) : [];

                                return (
                                    <div
                                        key={index}
                                        onClick={() => isCurrentMonth && dayTasks.length > 0 && setSelectedDateInfo({ date: new Date(year, month, dayNum), tasks: dayTasks })}
                                        className={`relative border-r border-b border-outline-variant/5 p-2.5 transition-colors ${!isCurrentMonth ? 'bg-surface-container-highest/5' : dayTasks.length > 0 ? 'bg-transparent hover:bg-surface-container/30 cursor-pointer' : 'bg-transparent'}`}
                                    >
                                        {isCurrentMonth && (
                                            <>
                                                <div className="flex justify-end">
                                                    <span className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-black transition-all ${isToday ? 'bg-primary text-on-primary-container shadow-[0_0_20px_rgba(253,184,19,0.3)]' : 'text-on-surface-variant/60'}`}>
                                                        {dayNum}
                                                    </span>
                                                </div>

                                                {dayTasks.length > 0 && (
                                                    <div className="absolute bottom-1.5 left-1 right-1 flex items-center justify-center gap-0.5 sm:gap-1 overflow-hidden">
                                                        {Array.from(new Set(dayTasks.map(task => getTaskStatusInfo(task).dotClass))).map((dotClass, idx) => (
                                                            <div
                                                                key={idx}
                                                                className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shadow-sm shadow-black/40 shrink-0 ${dotClass}`}
                                                            ></div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
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

            {/* Day View Modal */}
            {selectedDateInfo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-surface-container-low border border-outline-variant/10 rounded-[2.5rem] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container/50">
                            <div>
                                <h3 className="text-xl font-black font-headline uppercase tracking-tight text-on-surface">
                                    {selectedDateInfo.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
                                </h3>
                                <p className="text-[10px] font-label text-primary uppercase tracking-[0.2em] mt-1">
                                    {selectedDateInfo.tasks.length} {selectedDateInfo.tasks.length === 1 ? 'Task' : 'Tasks'} Scheduled
                                </p>
                            </div>
                            <button onClick={() => setSelectedDateInfo(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-highest/50 hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all">
                                ✕
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-4">
                            {selectedDateInfo.tasks.length === 0 ? (
                                <div className="text-center py-8 text-on-surface-variant/40 font-label text-xs uppercase tracking-widest">
                                    No tasks scheduled for this day.
                                </div>
                            ) : (
                                selectedDateInfo.tasks.map(task => {
                                    const statusInfo = getTaskStatusInfo(task);
                                    const timeStr = task.scheduled_at ? new Date(task.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Anytime';

                                    return (
                                        <div key={task.id} className="bg-surface-container/30 border border-outline-variant/10 rounded-2xl p-4 hover:border-primary/30 transition-all group">
                                            <div className="flex items-start justify-between gap-4 mb-3">
                                                <h4 className="font-bold text-sm text-on-surface leading-snug">{task.title}</h4>
                                                <span className={`text-[9px] font-label uppercase tracking-widest px-2 py-1 rounded-lg shrink-0 border ${statusInfo.color}`}>
                                                    {statusInfo.text}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs">
                                                <div className="flex items-center gap-1.5 text-on-surface-variant/60">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                                                    <span className="font-label uppercase tracking-wider text-[9px] truncate max-w-[200px]">{task.goal_title}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-primary/80 ml-auto">
                                                    <span className="font-label uppercase tracking-wider text-[9px] font-bold">{timeStr}</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="p-4 border-t border-outline-variant/10 bg-surface-container/50 flex justify-end">
                            <button onClick={() => setSelectedDateInfo(null)} className="px-6 py-2 bg-surface-container-highest hover:bg-surface-container-highest/80 rounded-xl text-xs font-bold font-label uppercase tracking-wider transition-all">
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Personal Task Modal Popup */}
            {showPersonalTaskModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-surface-container-low border border-purple-500/30 rounded-[2.5rem] w-full max-w-md shadow-[0_0_50px_rgba(168,85,247,0.15)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-outline-variant/10 flex items-center justify-between bg-surface-container/50">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                                    <CalendarIcon size={18} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black font-headline uppercase tracking-tight text-on-surface">
                                        Add Personal Task
                                    </h3>
                                    <p className="text-[10px] font-label text-purple-400 uppercase tracking-[0.2em] mt-0.5">
                                        Personal Workspace
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowPersonalTaskModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-highest/50 hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5">
                                    Task Title *
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. Project Review Meeting"
                                    className="w-full bg-surface-container/60 border border-outline-variant/15 rounded-xl px-4 py-3 text-sm text-on-surface outline-none focus:border-purple-500/50 transition-all placeholder:text-on-surface-variant/40"
                                    value={newPersonalTask.title}
                                    onChange={(e) => setNewPersonalTask({ ...newPersonalTask, title: e.target.value })}
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="block text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5">
                                    Details & Notes
                                </label>
                                <textarea
                                    placeholder="Add optional notes or descriptions..."
                                    className="w-full bg-surface-container/60 border border-outline-variant/15 rounded-xl px-4 py-3 text-xs text-on-surface-variant outline-none focus:border-purple-500/50 transition-all placeholder:text-on-surface-variant/30 resize-none h-20"
                                    value={newPersonalTask.description}
                                    onChange={(e) => setNewPersonalTask({ ...newPersonalTask, description: e.target.value })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5">
                                        Date *
                                    </label>
                                    <div className="flex items-center bg-surface-container/60 border border-outline-variant/15 rounded-xl px-3 py-2.5">
                                        <CalendarIcon size={14} className="text-purple-400 mr-2 shrink-0" />
                                        <input
                                            type="date"
                                            className="w-full bg-transparent text-xs text-on-surface outline-none"
                                            value={newPersonalTask.date}
                                            onChange={(e) => setNewPersonalTask({ ...newPersonalTask, date: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-label font-bold uppercase tracking-wider text-on-surface-variant/70 mb-1.5">
                                        Time *
                                    </label>
                                    <div className="flex items-center bg-surface-container/60 border border-outline-variant/15 rounded-xl px-3 py-2.5">
                                        <Clock size={14} className="text-purple-400 mr-2 shrink-0" />
                                        <input
                                            type="time"
                                            className="w-full bg-transparent text-xs text-on-surface outline-none"
                                            value={newPersonalTask.time}
                                            onChange={(e) => setNewPersonalTask({ ...newPersonalTask, time: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 px-6 border-t border-outline-variant/10 bg-surface-container/50 flex items-center justify-end gap-3">
                            <button
                                onClick={() => setShowPersonalTaskModal(false)}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold font-label uppercase tracking-wider text-on-surface-variant/70 hover:text-on-surface hover:bg-surface-container-highest transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePersonalTask}
                                disabled={!newPersonalTask.title || !newPersonalTask.date || !newPersonalTask.time}
                                className="px-6 py-2.5 bg-purple-500 hover:bg-purple-600 disabled:opacity-40 disabled:hover:bg-purple-500 text-white rounded-xl text-xs font-bold font-label uppercase tracking-wider shadow-lg shadow-purple-500/20 transition-all"
                            >
                                Save Task
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Calendar;
