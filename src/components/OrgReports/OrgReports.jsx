import React, { useState, useEffect } from 'react';

function formatTime(seconds) {
  if (!seconds) return '0h';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function StatCard({ icon, label, value, color = 'text-white', sub }) {
  return (
    <div className="glass border border-white/6 p-5 rounded-2xl flex items-center gap-4">
      <i className={`fa-solid ${icon} text-2xl ${color}`}></i>
      <div>
        <div className={`text-2xl font-bold ${color}`}>{value}</div>
        <div className="text-xs text-text-muted">{label}</div>
        {sub && <div className="text-[10px] text-text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function MiniBar({ value, max, color = 'bg-accent' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
      </div>
      <span className="text-[10px] text-text-muted w-8 text-right flex-shrink-0">{pct}%</span>
    </div>
  );
}

export default function OrgReports({ currentUser, org, projects, showToast }) {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberReport, setMemberReport] = useState(null);
  const [memberLoading, setMemberLoading] = useState(false);
  const [period, setPeriod] = useState('all'); // all, week, month

  useEffect(() => {
    fetchTeamReport();
  }, []);

  const fetchTeamReport = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/team');
      if (!res.ok) throw new Error('Failed to load team report.');
      const data = await res.json();
      setReportData(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberReport = async (memberId) => {
    setMemberLoading(true);
    try {
      const res = await fetch(`/api/reports/member/${memberId}`);
      if (!res.ok) throw new Error('Failed to load member report.');
      const data = await res.json();
      setMemberReport(data);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setMemberLoading(false);
    }
  };

  const handleSelectMember = (member) => {
    setSelectedMember(member);
    fetchMemberReport(member.id);
  };

  if (!org || !currentUser.orgId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-3">
        <i className="fa-solid fa-chart-pie text-4xl text-text-muted opacity-30"></i>
        <p className="text-text-muted text-sm">Organization reports require an org account.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <i className="fa-solid fa-circle-notch animate-spin text-3xl text-accent"></i>
      </div>
    );
  }

  const allMembers = org.members || [];
  const allTasks = (projects || []).flatMap(p => p.tasks || []);
  const now = new Date();

  const periodFilter = (t) => {
    if (period === 'all') return true;
    if (!t.completedAt && !t.createdAt) return true;
    const ref = t.completedAt || t.createdAt;
    const d = new Date(ref);
    if (period === 'week') {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    if (period === 'month') {
      const monthAgo = new Date(now); monthAgo.setMonth(now.getMonth() - 1);
      return d >= monthAgo;
    }
    return true;
  };

  const filteredTasks = allTasks.filter(periodFilter);
  const doneTasks = filteredTasks.filter(t => t.status === 'done');
  const overdueTasks = filteredTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now);
  const totalTime = filteredTasks.reduce((s, t) => s + (t.timeLogged || 0), 0);
  const completionRate = filteredTasks.length > 0 ? Math.round((doneTasks.length / filteredTasks.length) * 100) : 0;

  // Per-member stats
  const memberStats = allMembers.map(m => {
    const mTasks = filteredTasks.filter(t => t.assignedTo === m.id);
    const mDone = mTasks.filter(t => t.status === 'done').length;
    const mOverdue = mTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;
    const mTime = mTasks.reduce((s, t) => s + (t.timeLogged || 0), 0);
    const rate = mTasks.length > 0 ? Math.round((mDone / mTasks.length) * 100) : 0;
    return { member: m, total: mTasks.length, done: mDone, overdue: mOverdue, time: mTime, rate };
  }).filter(s => s.total > 0).sort((a, b) => b.rate - a.rate);

  const maxTasks = Math.max(...memberStats.map(s => s.total), 1);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight">Org Reports</h1>
          <p className="text-sm text-text-secondary mt-1">{org.name} · Team Performance Overview</p>
        </div>
        <div className="flex bg-white/4 border border-white/6 rounded-xl p-0.5">
          {[['all', 'All Time'], ['month', 'This Month'], ['week', 'This Week']].map(([v, l]) => (
            <button
              key={v}
              onClick={() => setPeriod(v)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${period === v ? 'bg-accent text-white' : 'text-text-muted hover:text-white'}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon="fa-users" label="Team Members" value={allMembers.length} color="text-accent" />
        <StatCard icon="fa-circle-check" label="Tasks Completed" value={doneTasks.length} color="text-emerald-400" sub={`${completionRate}% rate`} />
        <StatCard icon="fa-triangle-exclamation" label="Overdue" value={overdueTasks.length} color={overdueTasks.length > 0 ? 'text-red-400' : 'text-text-muted'} />
        <StatCard icon="fa-clock" label="Time Logged" value={formatTime(totalTime)} color="text-blue-400" />
      </div>

      {/* Completion rate bar */}
      <div className="glass border border-white/6 rounded-2xl p-5 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-sm font-semibold text-white">Overall Completion Rate</span>
          <span className="text-lg font-bold text-emerald-400">{completionRate}%</span>
        </div>
        <div className="h-3 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${completionRate}%`,
              background: `linear-gradient(90deg, hsl(var(--accent-h), var(--accent-s), var(--accent-l)), #10b981)`
            }}
          ></div>
        </div>
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>{doneTasks.length} done</span>
          <span>{filteredTasks.length - doneTasks.length} remaining</span>
          <span>{filteredTasks.length} total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Member Performance Table */}
        <div className="glass border border-white/6 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
            <i className="fa-solid fa-ranking-star text-accent text-sm"></i>
            Member Performance
          </h2>
          {memberStats.length === 0 ? (
            <p className="text-text-muted text-sm py-4 text-center">No task data for this period.</p>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto max-h-72">
              {memberStats.map(({ member, total, done, overdue, time, rate }, idx) => (
                <button
                  key={member.id}
                  onClick={() => handleSelectMember(member)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left cursor-pointer ${
                    selectedMember?.id === member.id
                      ? 'bg-accent/10 border-accent/30'
                      : 'bg-white/[0.02] border-white/5 hover:bg-white/4'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg bg-accent/15 border border-accent/25 flex items-center justify-center text-accent text-[10px] font-bold flex-shrink-0">
                    {idx + 1}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {member.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{member.username}</div>
                    <MiniBar value={done} max={total} color={rate >= 70 ? 'bg-emerald-500' : rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'} />
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-bold text-white">{done}/{total}</div>
                    {overdue > 0 && <div className="text-[9px] text-red-400">{overdue} overdue</div>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Member Drill-Down */}
        <div className="glass border border-white/6 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
            <i className="fa-solid fa-user-magnifying-glass text-accent text-sm"></i>
            Member Detail
          </h2>

          {!selectedMember ? (
            <div className="flex flex-col items-center justify-center flex-1 py-8 text-center">
              <i className="fa-solid fa-arrow-left text-2xl text-text-muted opacity-30 mb-2"></i>
              <p className="text-text-muted text-xs">Select a member to see their detail report</p>
            </div>
          ) : memberLoading ? (
            <div className="flex items-center justify-center py-8">
              <i className="fa-solid fa-circle-notch animate-spin text-2xl text-accent"></i>
            </div>
          ) : memberReport ? (
            <div className="flex flex-col gap-3 overflow-y-auto max-h-72">
              <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent font-bold">
                  {selectedMember.username.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-white text-sm">{selectedMember.username}</div>
                  {selectedMember.jobTitle && <div className="text-xs text-text-muted">{selectedMember.jobTitle}</div>}
                </div>
                <button onClick={() => setSelectedMember(null)} className="ml-auto text-text-muted hover:text-white cursor-pointer text-xs p-1">
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Total', value: memberReport.totalTasks, color: 'text-white' },
                  { label: 'Done', value: memberReport.doneTasks, color: 'text-emerald-400' },
                  { label: 'Overdue', value: memberReport.overdueTasks, color: memberReport.overdueTasks > 0 ? 'text-red-400' : 'text-text-muted' }
                ].map(s => (
                  <div key={s.label} className="bg-white/[0.02] border border-white/5 rounded-lg p-2">
                    <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] text-text-muted uppercase tracking-wider">{s.label}</div>
                  </div>
                ))}
              </div>

              {memberReport.timeLogged > 0 && (
                <div className="flex items-center gap-2 text-xs text-text-muted p-2 bg-white/[0.02] border border-white/5 rounded-lg">
                  <i className="fa-solid fa-clock text-accent text-[10px]"></i>
                  <span>Total time logged: <span className="text-white font-semibold">{formatTime(memberReport.timeLogged)}</span></span>
                </div>
              )}

              {memberReport.recentTasks && memberReport.recentTasks.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Recent Tasks</div>
                  {memberReport.recentTasks.map(t => (
                    <div key={t.id} className="flex items-center gap-2 p-2 bg-white/[0.02] border border-white/5 rounded-lg text-xs">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        t.status === 'done' ? 'bg-emerald-500' : t.status === 'in-progress' ? 'bg-blue-500' : 'bg-text-muted'
                      }`}></span>
                      <span className={`flex-1 truncate ${t.status === 'done' ? 'line-through text-text-muted' : 'text-white'}`}>{t.title}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        t.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                        t.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'
                      }`}>{t.priority}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Priority Distribution */}
      <div className="glass border border-white/6 rounded-2xl p-5 flex flex-col gap-4">
        <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
          <i className="fa-solid fa-chart-pie text-accent text-sm"></i>
          Task Priority Distribution
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {['high', 'medium', 'low'].map(p => {
            const count = filteredTasks.filter(t => t.priority === p).length;
            const pct = filteredTasks.length > 0 ? Math.round((count / filteredTasks.length) * 100) : 0;
            const colors = {
              high: { bar: 'bg-red-500', text: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
              medium: { bar: 'bg-yellow-500', text: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20' },
              low: { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' }
            };
            const c = colors[p];
            return (
              <div key={p} className={`flex flex-col gap-2 p-4 rounded-xl border ${c.bg}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-bold uppercase tracking-wider ${c.text}`}>{p}</span>
                  <span className={`text-lg font-bold ${c.text}`}>{count}</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className={`h-full ${c.bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }}></div>
                </div>
                <span className="text-[10px] text-text-muted">{pct}% of tasks</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
