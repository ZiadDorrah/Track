import React from 'react';
import GanttChart from './GanttChart.jsx';
import './Dashboard.css';

function formatDateTimeShort(dateStr) {
  if (!dateStr) return '';
  const hasTime = dateStr.includes('T');
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr;

  const pad = (num) => String(num).padStart(2, '0');
  const mm = pad(dateObj.getMonth() + 1);
  const dd = pad(dateObj.getDate());

  if (hasTime) {
    const hours = pad(dateObj.getHours());
    const minutes = pad(dateObj.getMinutes());
    return `${mm}/${dd} ${hours}:${minutes}`;
  }
  return `${mm}/${dd}`;
}

export default function Dashboard({ projects, onProjectSelect, onTaskEdit, selectedGanttProjects, onSelectedGanttProjectsChange, escapeHTML }) {
  // Calculations
  const totalProjects = projects.length;
  let pendingTasksCount = 0;
  let completedTasksCount = 0;
  let overdueTasksCount = 0;

  const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const dateOnlyToday = new Date().toISOString().split('T')[0];
  const immediateTasks = [];

  projects.forEach(p => {
    (p.tasks || []).forEach(t => {
      if (t.status === 'done') {
        completedTasksCount++;
      } else {
        pendingTasksCount++;
        const isOverdue = t.deadline && t.deadline < todayStr;
        if (isOverdue) {
          overdueTasksCount++;
        }

        const isDueToday = t.deadline && t.deadline.startsWith(dateOnlyToday);
        if (isOverdue || isDueToday || t.priority === 'high') {
          immediateTasks.push({
            ...t,
            projectName: p.name,
            projectId: p.id,
            isOverdue,
            isDueToday
          });
        }
      }
    });
  });

  // Sort priorities: overdue first, then high priority, then by deadline date
  immediateTasks.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    if (a.priority === 'high' && b.priority !== 'high') return -1;
    if (a.priority !== 'high' && b.priority === 'high') return 1;
    return (a.deadline || '9999') > (b.deadline || '9999') ? 1 : -1;
  });

  // Limit to top 7
  const displayPriorities = immediateTasks.slice(0, 7);

  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight">Command Center</h1>
        <p className="text-sm text-text-secondary mt-1">Global breakdown of your tasks, deadlines, and project statuses.</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="metrics-card glass border border-white/6 p-6 flex items-center gap-5 hover:-translate-y-1 hover:border-white/12 transition-all duration-300">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-[#3b82f6]/15 text-[#3b82f6] border border-[#3b82f6]/25">
            <i className="fa-solid fa-diagram-project"></i>
          </div>
          <div>
            <h3 className="text-2xl font-bold font-heading text-white leading-none mb-1">{totalProjects}</h3>
            <p className="text-xs text-text-secondary font-medium">Total Projects</p>
          </div>
        </div>

        <div className="metrics-card glass border border-white/6 p-6 flex items-center gap-5 hover:-translate-y-1 hover:border-white/12 transition-all duration-300">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-[#a855f7]/15 text-[#a855f7] border border-[#a855f7]/25">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div>
            <h3 className="text-2xl font-bold font-heading text-white leading-none mb-1">{pendingTasksCount}</h3>
            <p className="text-xs text-text-secondary font-medium">Pending Tasks</p>
          </div>
        </div>

        <div className="metrics-card glass border border-white/6 p-6 flex items-center gap-5 hover:-translate-y-1 hover:border-white/12 transition-all duration-300">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-[#f43f5e]/15 text-[#f43f5e] border border-[#f43f5e]/25">
            <i className="fa-solid fa-circle-exclamation"></i>
          </div>
          <div>
            <h3 className="text-2xl font-bold font-heading text-white leading-none mb-1">{overdueTasksCount}</h3>
            <p className="text-xs text-text-secondary font-medium">Overdue Tasks</p>
          </div>
        </div>

        <div className="metrics-card glass border border-white/6 p-6 flex items-center gap-5 hover:-translate-y-1 hover:border-white/12 transition-all duration-300">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl bg-[#10b981]/15 text-[#10b981] border border-[#10b981]/25">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <h3 className="text-2xl font-bold font-heading text-white leading-none mb-1">{completedTasksCount}</h3>
            <p className="text-xs text-text-secondary font-medium">Completed Tasks</p>
          </div>
        </div>
      </div>

      {/* Main split dashboard block layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Immediate Priorities */}
        <div className="glass border border-white/6 p-6 flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-fire text-accent glow-text"></i> Immediate Priorities
            </h2>
            <span className="text-xs font-bold bg-[#f43f5e]/15 text-[#fda4af] border border-[#f43f5e]/20 px-2.5 py-1 rounded-full">
              {immediateTasks.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3">
            {displayPriorities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-text-muted gap-3">
                <i className="fa-solid fa-circle-check text-4xl text-[#10b981] opacity-35"></i>
                <p className="text-sm">All clean! No immediate priorities pending.</p>
              </div>
            ) : (
              displayPriorities.map(t => {
                let deadlineBadge = null;
                if (t.isOverdue) {
                  deadlineBadge = (
                    <span className="text-xs font-semibold text-red-400 flex items-center gap-1">
                      <i className="fa-solid fa-triangle-exclamation"></i> Overdue ({formatDateTimeShort(t.deadline)})
                    </span>
                  );
                } else if (t.isDueToday) {
                  const hasTime = t.deadline && t.deadline.includes('T');
                  let timeStr = 'Today';
                  if (hasTime) {
                    const timeOnly = t.deadline.split('T')[1];
                    timeStr = `Today ${timeOnly}`;
                  }
                  deadlineBadge = (
                    <span className="text-xs font-semibold text-[#a855f7] flex items-center gap-1">
                      <i className="fa-solid fa-hourglass-half"></i> {timeStr}
                    </span>
                  );
                } else if (t.deadline) {
                  deadlineBadge = (
                    <span className="text-xs font-semibold text-text-secondary flex items-center gap-1">
                      <i className="fa-solid fa-calendar"></i> {formatDateTimeShort(t.deadline)}
                    </span>
                  );
                }

                return (
                  <div
                    key={t.id}
                    onClick={() => onProjectSelect(t.projectId)}
                    title="Click to open project detail"
                    className="flex justify-between items-center p-3.5 bg-white/[0.02] border border-white/6 rounded-xl hover:bg-white/[0.04] hover:border-white/12 transition-all cursor-pointer"
                  >
                    <div className="flex flex-col gap-1 overflow-hidden pr-3">
                      <span className="text-sm font-semibold text-white truncate max-w-full">{t.title}</span>
                      <span className="text-[10px] text-text-muted flex items-center gap-1 truncate">
                        <i className="fa-solid fa-diagram-project"></i> {t.projectName}
                      </span>
                    </div>
                    <div className="flex items-center gap-3.5 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.priority === 'high' ? 'bg-[#f43f5e]/12 text-[#fda4af] border border-[#f43f5e]/20' :
                        (t.priority === 'medium' ? 'bg-[#eab308]/12 text-[#fef08a] border border-[#eab308]/20' :
                        'bg-[#3b82f6]/12 text-[#bfdbfe] border border-[#3b82f6]/20')
                      }`}>
                        {t.priority}
                      </span>
                      {deadlineBadge}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Project Pulse */}
        <div className="glass border border-white/6 p-6 flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-list-check text-accent glow-text"></i> Project Pulse
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-text-muted gap-3">
                <i className="fa-solid fa-diagram-project text-4xl opacity-15"></i>
                <p className="text-sm">Create a project workspace to track metrics.</p>
              </div>
            ) : (
              projects.map(p => {
                const totalTasks = p.tasks.length;
                const doneTasks = p.tasks.filter(t => t.status === 'done').length;
                const pct = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

                return (
                  <div
                    key={p.id}
                    className="p-3.5 bg-white/[0.02] border border-white/6 rounded-xl flex flex-col gap-2.5"
                  >
                    <div className="flex justify-between items-center">
                      <span
                        onClick={() => onProjectSelect(p.id)}
                        className="text-sm font-semibold text-white hover:text-accent cursor-pointer truncate max-w-[70%]"
                        title="Click to open project"
                      >
                        {p.name}
                      </span>
                      <span className="text-xs font-bold text-accent">{pct}%</span>
                    </div>

                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full shadow-[0_0_10px_var(--accent-glow)] transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-text-muted select-none font-medium">
                      <span>{totalTasks - doneTasks} pending / {doneTasks} completed</span>
                      <span>{totalTasks} total tasks</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Gantt Chart widget */}
      <GanttChart
        projects={projects}
        selectedGanttProjects={selectedGanttProjects}
        onSelectedGanttProjectsChange={onSelectedGanttProjectsChange}
        onTaskEdit={onTaskEdit}
      />
    </div>
  );
}
