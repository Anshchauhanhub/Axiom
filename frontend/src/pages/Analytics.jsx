import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Flame, Clock, Award, CheckCircle2, 
  TrendingUp, Calendar, Zap, ArrowUpRight, Sparkles 
} from 'lucide-react';
import { 
  getAnalyticsSummary, getStudyHours, getQuizScores, 
  getStreakHistory, getCompletionVelocity 
} from '../services/api';
import NeuralLoader from '../components/NeuralLoader';

export default function Analytics() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    total_study_hours: 0,
    total_quizzes_passed: 0,
    total_parts_completed: 0,
    current_streak: 0,
    longest_streak: 0,
    avg_quiz_score: 0,
  });
  const [studyHours, setStudyHours] = useState([]);
  const [quizScores, setQuizScores] = useState([]);
  const [streakDays, setStreakDays] = useState([]);
  const [velocity, setVelocity] = useState([]);

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      try {
        const [sumRes, hoursRes, scoresRes, streakRes, velRes] = await Promise.allSettled([
          getAnalyticsSummary(),
          getStudyHours(),
          getQuizScores(),
          getStreakHistory(),
          getCompletionVelocity(),
        ]);

        if (mounted) {
          if (sumRes.status === 'fulfilled' && sumRes.value) setSummary(sumRes.value);
          if (hoursRes.status === 'fulfilled' && hoursRes.value?.weeks) setStudyHours(hoursRes.value.weeks);
          if (scoresRes.status === 'fulfilled' && scoresRes.value?.scores) setQuizScores(scoresRes.value.scores);
          if (streakRes.status === 'fulfilled' && streakRes.value?.days) setStreakDays(streakRes.value.days);
          if (velRes.status === 'fulfilled' && velRes.value?.weeks) setVelocity(velRes.value.weeks);
        }
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => { mounted = false; };
  }, []);

  if (loading) {
    return <NeuralLoader message="Compiling neural analytics and learning metrics..." />;
  }

  // Generate fallback streak days if backend returned empty (52 weeks x 7 days)
  const daysToRender = streakDays.length > 0 ? streakDays : Array.from({ length: 364 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (363 - i));
    return {
      date: d.toISOString().split('T')[0],
      count: 0,
      level: 0,
    };
  });

  // Calculate max hours for chart scale
  const maxHours = Math.max(...studyHours.map(w => w.hours || 0), 5);

  const getHeatmapColor = (level) => {
    switch (level) {
      case 1: return 'bg-amber-500/30 hover:bg-amber-500/50 border border-amber-500/30';
      case 2: return 'bg-amber-500/60 hover:bg-amber-500/80 border border-amber-500/50';
      case 3: return 'bg-amber-400 hover:bg-amber-300 border border-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.5)]';
      case 4: return 'bg-yellow-300 hover:bg-yellow-200 border border-yellow-200 shadow-[0_0_12px_rgba(253,224,71,0.8)]';
      default: return 'bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.03]';
    }
  };

  return (
    <div className="max-w-[1280px] mx-auto w-full px-4 sm:px-6 py-6 space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 border-b border-outline-variant/10 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-primary/10 text-primary border border-primary/20">
              Cognitive Telemetry
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-on-surface font-headline uppercase tracking-tight flex items-center gap-3">
            Learning Analytics
            <Sparkles className="text-primary w-6 h-6 animate-pulse" />
          </h1>
          <p className="text-on-surface-variant text-xs font-label uppercase tracking-widest mt-1">
            Quantified proof-of-mastery & continuous neural progress
          </p>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Hours */}
        <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/10 relative overflow-hidden group hover:border-outline-variant/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Clock size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
              Logged
            </span>
          </div>
          <p className="text-3xl font-black text-on-surface tracking-tight font-headline">
            {summary.total_study_hours || 0}
            <span className="text-sm font-normal text-on-surface-variant ml-1">hrs</span>
          </p>
          <p className="text-[11px] font-label text-on-surface-variant uppercase tracking-widest mt-1">
            Total Focus Time
          </p>
        </div>

        {/* Quizzes Passed */}
        <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/10 relative overflow-hidden group hover:border-outline-variant/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-green-500/10 text-green-400 flex items-center justify-center">
              <Award size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
              Verified
            </span>
          </div>
          <p className="text-3xl font-black text-on-surface tracking-tight font-headline">
            {summary.total_quizzes_passed || 0}
          </p>
          <p className="text-[11px] font-label text-on-surface-variant uppercase tracking-widest mt-1">
            Neural Seals Passed
          </p>
        </div>

        {/* Current Streak */}
        <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/10 relative overflow-hidden group hover:border-outline-variant/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <Flame size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
              Best: {summary.longest_streak || 0}d
            </span>
          </div>
          <p className="text-3xl font-black text-on-surface tracking-tight font-headline">
            {summary.current_streak || 0}
            <span className="text-sm font-normal text-on-surface-variant ml-1">days</span>
          </p>
          <p className="text-[11px] font-label text-on-surface-variant uppercase tracking-widest mt-1">
            Active Study Streak
          </p>
        </div>

        {/* Average Score */}
        <div className="p-5 rounded-3xl bg-surface-container-low border border-outline-variant/10 relative overflow-hidden group hover:border-outline-variant/30 transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Zap size={20} />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
              Mastery
            </span>
          </div>
          <p className="text-3xl font-black text-on-surface tracking-tight font-headline">
            {summary.avg_quiz_score ? Math.round(summary.avg_quiz_score) : 0}%
          </p>
          <p className="text-[11px] font-label text-on-surface-variant uppercase tracking-widest mt-1">
            Avg Quiz Accuracy
          </p>
        </div>
      </div>

      {/* GitHub-Style 365-Day Activity Heatmap */}
      <div className="p-6 sm:p-8 rounded-[2rem] bg-surface-container-low border border-outline-variant/10 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
              <Calendar size={18} className="text-primary" />
              Annual Study Cadence Heatmap
            </h2>
            <p className="text-xs text-on-surface-variant mt-1">
              Visual log of daily active learning, lesson reads, and quiz certifications over 52 weeks
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-2 text-[10px] font-mono text-on-surface-variant">
            <span>Less</span>
            <div className="w-3 h-3 rounded-sm bg-white/[0.04] border border-white/[0.05]"></div>
            <div className="w-3 h-3 rounded-sm bg-amber-500/30 border border-amber-500/30"></div>
            <div className="w-3 h-3 rounded-sm bg-amber-500/60 border border-amber-500/50"></div>
            <div className="w-3 h-3 rounded-sm bg-amber-400 border border-amber-300"></div>
            <div className="w-3 h-3 rounded-sm bg-yellow-300 border border-yellow-200"></div>
            <span>More</span>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto custom-scrollbar pb-2">
          <div className="inline-grid grid-rows-7 grid-flow-col gap-1.5 min-w-[700px]">
            {daysToRender.map((day, idx) => (
              <div
                key={idx}
                title={`${day.date}: ${day.count} active study events`}
                className={`w-3.5 h-3.5 rounded-sm transition-all cursor-pointer ${getHeatmapColor(day.level)}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Charts Split Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Focus Hours Bar Chart */}
        <div className="p-6 sm:p-8 rounded-[2rem] bg-surface-container-low border border-outline-variant/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-400" />
              Weekly Focus Hours (Last 12 Weeks)
            </h2>
            <span className="text-xs text-on-surface-variant font-mono">
              Max: {maxHours.toFixed(1)}h
            </span>
          </div>

          <div className="h-48 flex items-end gap-3 pt-6 border-b border-outline-variant/10 pb-2">
            {(studyHours.length > 0 ? studyHours : Array.from({ length: 12 }, (_, i) => ({ week_start: `W${i+1}`, hours: (i % 4) * 2 + 1.5 }))).map((w, idx) => {
              const heightPct = Math.min(100, Math.max(8, ((w.hours || 0) / maxHours) * 100));
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
                  <div className="text-[10px] font-mono text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {w.hours}h
                  </div>
                  <div 
                    className="w-full bg-gradient-to-t from-primary/20 via-primary/60 to-primary rounded-t-lg transition-all duration-500 group-hover:brightness-125"
                    style={{ height: `${heightPct}%` }}
                  />
                  <span className="text-[9px] font-mono text-on-surface-variant truncate w-full text-center">
                    {w.week_start?.slice(5) || `W${idx+1}`}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Quiz Performance Trend */}
        <div className="p-6 sm:p-8 rounded-[2rem] bg-surface-container-low border border-outline-variant/10 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-bold text-on-surface uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={18} className="text-green-400" />
              Recent Quiz Mastery Scores
            </h2>
            <span className="text-xs text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded-full">
              Threshold: ≥80%
            </span>
          </div>

          <div className="space-y-3 flex-1 flex flex-col justify-center">
            {quizScores.slice(0, 5).map((q, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-2xl bg-surface-container border border-outline-variant/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                    q.score >= 80 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}>
                    {Math.round(q.score)}%
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-semibold text-on-surface truncate">{q.part_title || 'Module Quiz'}</p>
                    <p className="text-[10px] text-on-surface-variant">{q.date ? new Date(q.date).toLocaleDateString() : 'Recent'}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                  q.score >= 80 ? 'text-green-400 bg-green-500/10' : 'text-red-400 bg-red-500/10'
                }`}>
                  {q.score >= 80 ? 'Passed' : 'Needs Review'}
                </span>
              </div>
            ))}

            {quizScores.length === 0 && (
              <div className="text-center py-8 text-on-surface-variant text-xs">
                Complete your first module quiz in the Study workbench to see mastery metrics!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
