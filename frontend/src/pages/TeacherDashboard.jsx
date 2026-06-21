import React, { useState } from 'react';
import { 
  Users, BookOpen, Activity, Target, 
  TrendingUp, Video, MessageSquare, AlertCircle,
  MoreVertical, ChevronRight, PlayCircle, BarChart3
} from 'lucide-react';

const TeacherDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data for the dashboard
  const kpis = [
    { label: 'Total Enrolled', value: '4,285', trend: '+12%', icon: Users, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: 'Active Learners', value: '1,892', trend: '+5%', icon: Activity, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: 'Avg. Completion', value: '68%', trend: '+2.4%', icon: Target, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Course Revenue', value: '$12.4K', trend: '+18%', icon: TrendingUp, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ];

  const recentActivity = [
    { student: 'Alex Johnson', action: 'Completed Quiz: Neural Networks', time: '12 mins ago', status: 'success' },
    { student: 'Sarah Chen', action: 'Stuck on: Backpropagation Module', time: '28 mins ago', status: 'warning' },
    { student: 'Marcus Doe', action: 'Started: Advanced React Patterns', time: '1 hour ago', status: 'neutral' },
    { student: 'Emily White', action: 'Achieved 7-day learning streak', time: '2 hours ago', status: 'success' },
  ];

  const activeCourses = [
    { title: 'Complete AI Architecture', students: 1250, completion: 45, rating: 4.8 },
    { title: 'Mastering Full-Stack React', students: 2100, completion: 72, rating: 4.9 },
    { title: 'System Design Interview Prep', students: 935, completion: 38, rating: 4.7 },
  ];

  return (
    <div className="animate-in fade-in duration-1000 max-w-[1280px] mx-auto w-full">
      {/* Header section */}
      <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-on-surface mb-2 font-headline uppercase flex items-center gap-3">
            Creator Studio
            <span className="bg-primary/20 text-primary text-[10px] px-3 py-1 rounded-full uppercase tracking-widest font-bold border border-primary/20">Pro</span>
          </h1>
          <p className="text-on-surface-variant font-label tracking-wide uppercase text-xs opacity-80">
            Edxiom Master Console • Educator Edition
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="h-10 px-6 rounded-full bg-surface-container-high text-on-surface text-xs font-bold uppercase tracking-widest hover:bg-surface-container-highest transition-colors border border-outline-variant/10 flex items-center gap-2">
            <Video size={16} /> Go Live
          </button>
          <button className="h-10 px-6 rounded-full bg-primary text-on-primary text-xs font-bold uppercase tracking-widest hover:brightness-110 transition-colors shadow-[0_0_20px_rgba(253,184,19,0.3)]">
            + New Course
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto custom-scrollbar gap-2 mb-8 pb-2 border-b border-outline-variant/10">
        {['overview', 'students', 'curriculum', 'analytics'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2.5 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
              activeTab === tab 
                ? 'bg-on-surface text-surface' 
                : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, idx) => (
              <div key={idx} className="bg-surface-container-low border border-outline-variant/10 p-6 rounded-3xl relative overflow-hidden group hover:border-outline-variant/30 transition-all">
                <div className="absolute top-0 right-0 p-6 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 transition-transform duration-500">
                  <kpi.icon size={80} />
                </div>
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${kpi.bg} ${kpi.color}`}>
                    <kpi.icon size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-green-400 bg-green-400/10 px-2 py-1 rounded-md">
                    {kpi.trend}
                  </span>
                </div>
                <h3 className="text-3xl font-black text-on-surface mb-1">{kpi.value}</h3>
                <p className="text-[11px] font-label text-on-surface-variant uppercase tracking-widest">{kpi.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Student Tracking */}
            <div className="lg:col-span-2 bg-surface-container-low border border-outline-variant/10 rounded-[2rem] p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-primary to-green-500"></div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  Live Student Radar
                </h2>
                <button className="text-on-surface-variant hover:text-on-surface transition-colors">
                  <MoreVertical size={20} />
                </button>
              </div>
              
              <div className="space-y-4">
                {recentActivity.map((activity, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-container border border-outline-variant/5 hover:bg-surface-container-high transition-colors">
                    <div className="w-10 h-10 rounded-full bg-surface-container-highest flex items-center justify-center text-on-surface font-bold text-sm shrink-0">
                      {activity.student.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-on-surface truncate">{activity.student}</p>
                      <p className="text-xs text-on-surface-variant truncate">{activity.action}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">{activity.time}</p>
                      {activity.status === 'warning' && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-red-400 mt-1">
                          <AlertCircle size={10} /> Needs help
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button className="w-full mt-4 py-3 text-xs font-bold uppercase tracking-widest text-primary hover:bg-primary/5 rounded-xl transition-colors">
                View All Activity
              </button>
            </div>

            {/* AI Assistant Insights */}
            <div className="bg-surface-container-low border border-outline-variant/10 rounded-[2rem] p-6 sm:p-8 flex flex-col">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest mb-6 flex items-center gap-2">
                <BarChart3 size={18} className="text-purple-400" />
                AI Coach Insights
              </h2>
              
              <div className="flex-1 space-y-4">
                <div className="p-4 rounded-2xl bg-purple-400/5 border border-purple-400/10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-purple-400/10 rounded-bl-full"></div>
                  <h4 className="text-sm font-bold text-purple-400 mb-2">Curriculum Bottleneck</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    28% of students are spending 3x longer on the <strong>"Backpropagation"</strong> module. Consider adding a supplementary simplified video.
                  </p>
                </div>
                
                <div className="p-4 rounded-2xl bg-green-400/5 border border-green-400/10">
                  <h4 className="text-sm font-bold text-green-400 mb-2">High Engagement</h4>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    The new interactive quiz format increased completion rates by 15% this week.
                  </p>
                </div>
              </div>
              
              <button className="mt-4 w-full h-10 rounded-xl bg-surface-container text-on-surface text-xs font-bold uppercase tracking-widest hover:bg-surface-container-high transition-colors">
                Generate Full Report
              </button>
            </div>
          </div>

          {/* Active Courses */}
          <div>
            <div className="flex items-center justify-between mb-6 mt-4">
              <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest">Active Curriculums</h2>
              <button className="text-[11px] font-bold text-primary uppercase tracking-widest hover:underline flex items-center">
                Manage Hub <ChevronRight size={14} />
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeCourses.map((course, idx) => (
                <div key={idx} className="bg-surface-container-low border border-outline-variant/10 p-5 rounded-3xl hover:border-outline-variant/30 transition-colors group cursor-pointer">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                      <BookOpen size={20} />
                    </div>
                    <span className="text-xs font-bold text-on-surface flex items-center gap-1">
                      ⭐ {course.rating}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-on-surface mb-1 line-clamp-1">{course.title}</h3>
                  <p className="text-xs text-on-surface-variant mb-4">{course.students} active students</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
                      <span>Avg Completion</span>
                      <span>{course.completion}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${course.completion}%` }}></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab !== 'overview' && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-full bg-surface-container-low flex items-center justify-center text-on-surface-variant mb-6">
            <MoreVertical size={32} />
          </div>
          <h2 className="text-xl font-bold text-on-surface mb-2">Module under construction</h2>
          <p className="text-on-surface-variant text-sm max-w-md">
            The {activeTab} section for educators is currently being built. Check back soon for advanced insights and tools.
          </p>
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;
