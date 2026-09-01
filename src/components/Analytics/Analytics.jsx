import React, { useState, useEffect } from 'react';
import './Analytics.css';

function formatHoursMinutes(seconds) {
  if (!seconds || seconds <= 0) return '0h 0m';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs === 0) return `${mins}m`;
  return `${hrs}h ${mins}m`;
}

export default function Analytics({ projects = [] }) {
  const [kpiData, setKpiData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/kpi/dashboard')
      .then(res => res.json())
      .then(data => setKpiData(data))
      .catch(err => console.error('Fetch KPI data error:', err))
      .finally(() => setLoading(false));
  }, [projects]);

  return (
    <div className="animate-fade-in max-w-6xl">
      {/* Page Header */}
      <div className="mb-6 flex justify-between items-start flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight flex items-center gap-3">
            <i className="fa-solid fa-chart-line text-accent"></i> Executive KPI & Analytics Dashboard
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Real-time org-wide KPIs, project health status matrix, completion velocity, and team workload distribution.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="glass border border-white/6 p-12 text-center text-text-muted">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl text-accent mb-3 block"></i>
          Loading executive metrics...
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Executive KPI Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Completion Rate */}
            <div className="glass border border-white/6 p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center text-xl">
                <i className="fa-solid fa-bullseye"></i>
              </div>
              <div>
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Completion Velocity</p>
                <h3 className="text-2xl font-black font-heading text-white">{kpiData?.completionRate || 0}%</h3>
                <p className="text-[10px] text-text-secondary">{kpiData?.completedTasks || 0} of {kpiData?.totalTasks || 0} tasks done</p>
              </div>
            </div>

            {/* Active Projects */}
            <div className="glass border border-white/6 p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl">
                <i className="fa-solid fa-diagram-project"></i>
              </div>
              <div>
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Active Workspaces</p>
                <h3 className="text-2xl font-black font-heading text-white">{kpiData?.totalProjects || 0}</h3>
                <p className="text-[10px] text-text-secondary">Projects currently tracked</p>
              </div>
            </div>

            {/* Total Focus Time */}
            <div className="glass border border-white/6 p-5 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl">
                <i className="fa-solid fa-stopwatch"></i>
              </div>
              <div>
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Org Focus Time</p>
                <h3 className="text-2xl font-black font-heading text-white">{formatHoursMinutes(kpiData?.totalTimeLoggedSeconds || 0)}</h3>
                <p className="text-[10px] text-text-secondary">Total focus hours logged</p>
              </div>
            </div>

            {/* Overdue Risk */}
            <div className="glass border border-white/6 p-5 rounded-2xl flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl border flex items-center justify-center text-xl ${
                (kpiData?.overdueTasks || 0) > 0 ? 'bg-red-500/15 border-red-500/30 text-red-400' : 'bg-white/5 border-white/10 text-text-muted'
              }`}>
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <div>
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">Overdue Risks</p>
                <h3 className={`text-2xl font-black font-heading ${
                  (kpiData?.overdueTasks || 0) > 0 ? 'text-red-400' : 'text-white'
                }`}>{kpiData?.overdueTasks || 0}</h3>
                <p className="text-[10px] text-text-secondary">Tasks past deadline</p>
              </div>
            </div>
          </div>

          {/* Project Health Status Matrix */}
          <div className="glass border border-white/6 p-6 rounded-2xl">
            <h3 className="text-base font-bold font-heading text-white mb-4 flex items-center gap-2">
              <i className="fa-solid fa-heart-pulse text-accent"></i> Project Health Matrix
            </h3>

            {kpiData?.projectHealthList && kpiData.projectHealthList.length > 0 ? (
              <div className="border border-white/6 rounded-xl overflow-hidden bg-black/15">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 border-b border-white/6 text-text-muted text-[10px] uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-3">Project Workspace</th>
                      <th className="px-4 py-3 text-center">Progress</th>
                      <th className="px-4 py-3 text-center">Completed</th>
                      <th className="px-4 py-3 text-center">Overdue</th>
                      <th className="px-4 py-3 text-right">Health Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {kpiData.projectHealthList.map((p) => (
                      <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-semibold text-white">{p.name}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-20 bg-white/10 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-accent h-full rounded-full transition-all"
                                style={{ width: `${p.completionPct}%` }}
                              />
                            </div>
                            <span className="font-bold text-[11px] text-white">{p.completionPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-text-secondary">{p.completedTasks} / {p.totalTasks}</td>
                        <td className={`px-4 py-3 text-center font-bold ${p.overdueTasks > 0 ? 'text-red-400' : 'text-text-muted'}`}>
                          {p.overdueTasks}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`px-2.5 py-1 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                            p.health === 'on-track' ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400' :
                            p.health === 'at-risk' ? 'bg-amber-500/15 border-amber-500/30 text-amber-400' :
                            'bg-red-500/15 border-red-500/30 text-red-400'
                          }`}>
                            {p.health === 'on-track' ? 'On Track' : p.health === 'at-risk' ? 'At Risk' : 'Delayed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">No active projects available to compute health status.</p>
            )}
          </div>

          {/* Team Workload Distribution */}
          <div className="glass border border-white/6 p-6 rounded-2xl">
            <h3 className="text-base font-bold font-heading text-white mb-4 flex items-center gap-2">
              <i className="fa-solid fa-users-line text-accent"></i> Team Workload & Focus Distribution
            </h3>

            {kpiData?.memberWorkloadList && kpiData.memberWorkloadList.length > 0 ? (
              <div className="flex flex-col gap-4">
                {kpiData.memberWorkloadList.map((m) => {
                  const donePct = m.totalTasks > 0 ? Math.round((m.completedTasks / m.totalTasks) * 100) : 0;

                  return (
                    <div key={m.userId} className="p-4 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-2">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 text-accent font-bold text-xs flex items-center justify-center">
                            {m.displayName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-bold text-white">{m.displayName}</span>
                        </div>

                        <div className="flex items-center gap-4 text-text-secondary text-[11px]">
                          <span><strong>{m.pendingTasks}</strong> pending</span>
                          <span><strong className="text-emerald-400">{m.completedTasks}</strong> completed</span>
                          {m.overdueTasks > 0 && <span className="text-red-400 font-bold">{m.overdueTasks} overdue</span>}
                          <span className="font-mono font-bold text-white bg-white/5 px-2 py-0.5 rounded">
                            {formatHoursMinutes(m.timeLoggedSeconds)}
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden flex">
                        <div
                          className="bg-emerald-400 h-full transition-all duration-500"
                          style={{ width: `${donePct}%` }}
                          title={`Completed: ${donePct}%`}
                        />
                        <div
                          className="bg-accent/60 h-full transition-all duration-500"
                          style={{ width: `${100 - donePct}%` }}
                          title={`Pending: ${100 - donePct}%`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-muted italic">No team workload data available.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
