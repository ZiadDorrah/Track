import React, { useState, useEffect } from 'react';
import { useCurrentUser } from '../../context/CurrentUserContext.jsx';
import './ManagerDashboard.css';

function formatHoursMinutes(seconds) {
  if (!seconds || seconds <= 0) return '0h 0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

export default function ManagerDashboard({ showToast }) {
  const { user, isManager } = useCurrentUser();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);
        const res = await fetch('/api/reports/manager');
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          showToast('Failed to load manager performance reports.', 'error');
        }
      } catch (err) {
        console.error('Error fetching manager reports:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <i className="fa-solid fa-circle-notch fa-spin text-3xl text-accent"></i>
          <span className="text-sm text-text-secondary">Generating team performance rollups...</span>
        </div>
      </div>
    );
  }

  const summary = data?.summary || {
    totalReports: 0,
    teamTotalTasks: 0,
    teamCompletedTasks: 0,
    teamCompletionRate: 0,
    teamOverdueTasks: 0,
    teamTotalTimeLogged: 0
  };

  const reports = data?.reports || [];

  return (
    <div className="animate-fade-in max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight flex items-center gap-3">
          <i className="fa-solid fa-chart-line text-accent"></i> Manager Performance Dashboard
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Skip-level task completion rollups, workload metrics, and time tracking breakdown across your reporting hierarchy.
        </p>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        {/* Total Direct & Indirect Reports */}
        <div className="glass border border-white/8 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xl">
            <i className="fa-solid fa-users"></i>
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Total Reports</p>
            <h3 className="text-2xl font-black font-heading text-white mt-0.5">{summary.totalReports}</h3>
          </div>
        </div>

        {/* Team Tasks & Completion Rate */}
        <div className="glass border border-white/8 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center text-xl">
            <i className="fa-solid fa-[#a855f7]"></i>
            <i className="fa-solid fa-list-check"></i>
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Completion Rate</p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <h3 className="text-2xl font-black font-heading text-white">{summary.teamCompletionRate}%</h3>
              <span className="text-xs text-text-muted">({summary.teamCompletedTasks}/{summary.teamTotalTasks})</span>
            </div>
          </div>
        </div>

        {/* Overdue Tasks */}
        <div className="glass border border-white/8 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-xl">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Overdue Tasks</p>
            <h3 className="text-2xl font-black font-heading text-white mt-0.5">{summary.teamOverdueTasks}</h3>
          </div>
        </div>

        {/* Total Time Tracked */}
        <div className="glass border border-white/8 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xl">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div>
            <p className="text-xs text-text-muted font-medium uppercase tracking-wider">Time Tracked</p>
            <h3 className="text-2xl font-black font-heading text-white mt-0.5">{formatHoursMinutes(summary.teamTotalTimeLogged)}</h3>
          </div>
        </div>
      </div>

      {/* Per-Report Performance Cards Section */}
      <div>
        <h2 className="text-xl font-bold font-heading text-white mb-4 flex items-center gap-2">
          <i className="fa-solid fa-user-check text-accent"></i> Workload & Report Performance Rollup
        </h2>

        {reports.length > 0 ? (
          <div className="flex flex-col gap-4">
            {reports.map(({ user: rep, managers, stats }) => (
              <div key={rep.id} className="glass border border-white/6 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 hover:border-white/16 transition-all">
                {/* User Info */}
                <div className="flex items-center gap-4 min-w-[240px]">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 text-accent font-bold font-heading flex items-center justify-center text-lg">
                    {(rep.displayName || rep.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold font-heading text-white">{rep.displayName || rep.username}</h4>
                    <p className="text-xs text-text-secondary">{rep.jobTitle || 'Team Member'}</p>
                    {managers && managers.length > 0 && (
                      <p className="text-[11px] text-text-muted mt-1">
                        Reports to: {managers.map(m => m.displayName || m.username).join(', ')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Rate */}
                <div className="flex-1 w-full md:max-w-xs flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-text-secondary font-medium">Completion Rate</span>
                    <span className="text-white font-bold">{stats.completionRate}%</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full transition-all duration-500 shadow-[0_0_8px_var(--accent-glow)]"
                      style={{ width: `${stats.completionRate}%` }}
                    />
                  </div>
                </div>

                {/* Stat Badges */}
                <div className="flex items-center gap-4 text-center">
                  <div className="bg-white/5 border border-white/8 px-3.5 py-2 rounded-xl">
                    <span className="text-xs text-text-muted block">Tasks</span>
                    <span className="text-sm font-bold text-white">{stats.totalTasks}</span>
                  </div>

                  <div className="bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 rounded-xl">
                    <span className="text-xs text-emerald-400 block">Done</span>
                    <span className="text-sm font-bold text-emerald-400">{stats.completedTasks}</span>
                  </div>

                  <div className="bg-purple-500/10 border border-purple-500/20 px-3.5 py-2 rounded-xl">
                    <span className="text-xs text-purple-400 block">In Progress</span>
                    <span className="text-sm font-bold text-purple-400">{stats.inProgressTasks}</span>
                  </div>

                  {stats.overdueTasks > 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/20 px-3.5 py-2 rounded-xl">
                      <span className="text-xs text-rose-400 block">Overdue</span>
                      <span className="text-sm font-bold text-rose-400">{stats.overdueTasks}</span>
                    </div>
                  )}

                  <div className="bg-blue-500/10 border border-blue-500/20 px-3.5 py-2 rounded-xl">
                    <span className="text-xs text-blue-400 block">Time</span>
                    <span className="text-sm font-bold text-blue-400">{formatHoursMinutes(stats.totalTimeLogged)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass border border-white/6 p-8 text-center">
            <i className="fa-solid fa-chart-pie text-4xl text-text-muted mb-3"></i>
            <h3 className="text-base font-semibold text-white">No Reporting Data Available</h3>
            <p className="text-xs text-text-secondary mt-1">You currently have no direct or indirect reports to summarize.</p>
          </div>
        )}
      </div>
    </div>
  );
}
