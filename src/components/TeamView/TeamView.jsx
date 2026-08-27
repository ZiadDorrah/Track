import React, { useState } from 'react';

const ROLE_META = {
  admin:    { label: 'Admin',    color: 'text-red-300',     bg: 'bg-red-500/10 border-red-500/30' },
  manager:  { label: 'Manager',  color: 'text-blue-300',    bg: 'bg-blue-500/10 border-blue-500/30' },
  employee: { label: 'Employee', color: 'text-emerald-300', bg: 'bg-emerald-500/10 border-emerald-500/30' }
};

function formatTime(seconds) {
  if (!seconds) return '0h';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MemberCard({ member, tasks, currentUser, allMembers, onAssignTask, onViewMember }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ROLE_META[member.role] || ROLE_META.employee;
  const now = new Date();

  const done = tasks.filter(t => t.status === 'done').length;
  const inProg = tasks.filter(t => t.status === 'in-progress').length;
  const todo = tasks.filter(t => t.status === 'todo').length;
  const overdue = tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length;
  const totalTime = tasks.reduce((s, t) => s + (t.timeLogged || 0), 0);
  const completionPct = tasks.length > 0 ? Math.round((done / tasks.length) * 100) : 0;

  const directReports = allMembers.filter(m => (m.managerIds || []).includes(member.id));
  const managerNames = (member.managerIds || []).map(mid => allMembers.find(m => m.id === mid)?.username).filter(Boolean);

  return (
    <div className={`glass border border-white/6 rounded-2xl flex flex-col transition-all ${expanded ? 'border-accent/30' : ''}`}>
      {/* Card Header */}
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/25 flex items-center justify-center text-accent font-bold text-lg flex-shrink-0">
              {member.username.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-white text-sm">{member.username}</div>
              {member.jobTitle && <div className="text-xs text-text-muted">{member.jobTitle}</div>}
              <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold border mt-1 ${meta.bg} ${meta.color}`}>
                {meta.label}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {(currentUser.role === 'manager' || currentUser.role === 'admin') && (
              <button
                onClick={() => onAssignTask(member)}
                className="px-2.5 py-1.5 bg-accent/15 hover:bg-accent/30 border border-accent/30 text-accent text-xs font-semibold rounded-lg transition-all cursor-pointer"
                title="Assign task to this member"
              >
                <i className="fa-solid fa-plus mr-1"></i>Task
              </button>
            )}
            <button
              onClick={() => setExpanded(e => !e)}
              className="p-1.5 text-text-muted hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer text-xs"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'}`}></i>
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            { label: 'Total', value: tasks.length, color: 'text-white' },
            { label: 'Done', value: done, color: 'text-emerald-400' },
            { label: 'Active', value: inProg, color: 'text-blue-400' },
            { label: 'Overdue', value: overdue, color: overdue > 0 ? 'text-red-400' : 'text-text-muted' }
          ].map(s => (
            <div key={s.label} className="bg-white/[0.02] border border-white/5 rounded-lg p-2">
              <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[9px] text-text-muted uppercase tracking-wider">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Completion bar */}
        {tasks.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between text-[10px] text-text-muted">
              <span>Completion</span>
              <span className="text-white font-semibold">{completionPct}%</span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                style={{ width: `${completionPct}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Meta info */}
        <div className="flex flex-wrap gap-3 text-[11px] text-text-muted">
          {totalTime > 0 && <span><i className="fa-solid fa-clock text-[9px] mr-1"></i>{formatTime(totalTime)} logged</span>}
          {directReports.length > 0 && <span><i className="fa-solid fa-users text-[9px] mr-1"></i>{directReports.length} report{directReports.length > 1 ? 's' : ''}</span>}
          {managerNames.length > 0 && <span><i className="fa-solid fa-sitemap text-[9px] mr-1"></i>Under: {managerNames.join(', ')}</span>}
        </div>
      </div>

      {/* Expanded: task list */}
      {expanded && (
        <div className="border-t border-white/5 p-4 flex flex-col gap-2 max-h-64 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="text-center py-6 text-text-muted text-xs">No tasks assigned.</div>
          ) : (
            tasks.map(t => (
              <div key={t.id} className="flex items-start gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs">
                <span className={`w-2 h-2 rounded-full mt-0.5 flex-shrink-0 ${
                  t.status === 'done' ? 'bg-emerald-500' :
                  t.status === 'in-progress' ? 'bg-blue-500' : 'bg-text-muted'
                }`}></span>
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${t.status === 'done' ? 'line-through text-text-muted' : 'text-white'} truncate`}>{t.title}</div>
                  {t.deadline && (
                    <div className={`text-[10px] mt-0.5 ${new Date(t.deadline) < new Date() && t.status !== 'done' ? 'text-red-400' : 'text-text-muted'}`}>
                      <i className="fa-regular fa-calendar mr-1"></i>{new Date(t.deadline).toLocaleDateString()}
                    </div>
                  )}
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  t.priority === 'high' ? 'bg-red-500/20 text-red-300' :
                  t.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' : 'bg-blue-500/20 text-blue-300'
                }`}>{t.priority}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function TeamView({ currentUser, org, projects, onAssignTask, showToast }) {
  const [viewMode, setViewMode] = useState('direct'); // direct, all

  if (!org || !currentUser.orgId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center gap-3">
        <i className="fa-solid fa-users-slash text-4xl text-text-muted opacity-30"></i>
        <p className="text-text-muted text-sm">You are not in an organization.</p>
      </div>
    );
  }

  const allMembers = org.members || [];
  const allTasks = (projects || []).flatMap(p => p.tasks || []);

  const getTeamMembers = () => {
    if (currentUser.role === 'admin') {
      return viewMode === 'all' ? allMembers.filter(m => m.id !== currentUser.id) : allMembers.filter(m => m.id !== currentUser.id);
    }
    const directs = allMembers.filter(m => (m.managerIds || []).includes(currentUser.id));
    if (viewMode === 'direct') return directs;
    // All: BFS through the reporting chain
    const visited = new Set([currentUser.id]);
    const queue = [...directs];
    const all = [];
    while (queue.length) {
      const m = queue.shift();
      if (visited.has(m.id)) continue;
      visited.add(m.id);
      all.push(m);
      allMembers.filter(x => (x.managerIds || []).includes(m.id)).forEach(x => queue.push(x));
    }
    return all;
  };

  const teamMembers = getTeamMembers();
  const directCount = allMembers.filter(m => (m.managerIds || []).includes(currentUser.id)).length;

  const memberTaskMap = {};
  teamMembers.forEach(m => {
    memberTaskMap[m.id] = allTasks.filter(t => t.assignedTo === m.id);
  });

  const totalTasks = Object.values(memberTaskMap).reduce((s, tasks) => s + tasks.length, 0);
  const totalDone = Object.values(memberTaskMap).reduce((s, tasks) => s + tasks.filter(t => t.status === 'done').length, 0);
  const totalOverdue = Object.values(memberTaskMap).reduce((s, tasks) => s + tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < new Date()).length, 0);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight">My Team</h1>
        <p className="text-sm text-text-secondary mt-1">
          {currentUser.role === 'admin' ? `Organization-wide view — ${org.name}` : `Your reporting team in ${org.name}`}
        </p>
      </div>

      {/* Team overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Team Members', value: teamMembers.length, icon: 'fa-users', color: 'text-accent' },
          { label: 'Total Tasks', value: totalTasks, icon: 'fa-list-check', color: 'text-white' },
          { label: 'Completed', value: totalDone, icon: 'fa-circle-check', color: 'text-emerald-400' },
          { label: 'Overdue', value: totalOverdue, icon: 'fa-triangle-exclamation', color: totalOverdue > 0 ? 'text-red-400' : 'text-text-muted' }
        ].map(stat => (
          <div key={stat.label} className="glass border border-white/6 p-4 rounded-2xl flex items-center gap-4">
            <i className={`fa-solid ${stat.icon} text-xl ${stat.color}`}></i>
            <div>
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-text-muted">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* View toggle (only for managers with indirect reports) */}
      {currentUser.role === 'manager' && directCount > 0 && (
        <div className="flex bg-white/4 border border-white/6 rounded-xl p-0.5 w-fit">
          <button onClick={() => setViewMode('direct')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'direct' ? 'bg-accent text-white' : 'text-text-muted hover:text-white'}`}>
            Direct Reports ({directCount})
          </button>
          <button onClick={() => setViewMode('all')} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${viewMode === 'all' ? 'bg-accent text-white' : 'text-text-muted hover:text-white'}`}>
            All Reports
          </button>
        </div>
      )}

      {/* Member cards grid */}
      {teamMembers.length === 0 ? (
        <div className="glass border border-white/6 rounded-2xl p-16 text-center flex flex-col items-center gap-3">
          <i className="fa-solid fa-user-group text-4xl text-text-muted opacity-30"></i>
          <p className="text-text-muted text-sm">No team members found.</p>
          <p className="text-text-muted text-xs">Ask your admin to assign team members to you.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {teamMembers.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              tasks={memberTaskMap[member.id] || []}
              currentUser={currentUser}
              allMembers={allMembers}
              onAssignTask={onAssignTask}
              onViewMember={() => {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}
