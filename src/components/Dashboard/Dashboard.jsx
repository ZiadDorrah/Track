import React from 'react';
import GanttChart from '../GanttChart/GanttChart.jsx';
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

export default function Dashboard({ projects, onProjectSelect, onTaskEdit, onTaskUpdate, onStartTimer, onStopTimer, selectedGanttProjects, onSelectedGanttProjectsChange, escapeHTML }) {
  // Calculations
  const totalProjects = projects.length;
  let pendingTasksCount = 0;
  let completedTasksCount = 0;
  let overdueTasksCount = 0;

  const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const dateOnlyToday = new Date().toISOString().split('T')[0];
  const immediateTasks = [];
  let totalPomodoros = 0;

  // Calculate Weekly Time Log
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push({
      dateStr: d.toISOString().split('T')[0],
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      hours: 0
    });
  }

  const focusableTasks = [];

  projects.forEach(p => {
    (p.tasks || []).forEach(t => {
      // Sum Pomodoro sessions
      totalPomodoros += (t.pomodoroSessions || []).length;

      // Group time tracking sessions
      (t.timeSessions || []).forEach(s => {
        if (!s.endTime) return;
        const datePart = s.endTime.split('T')[0];
        const dayObj = last7Days.find(d => d.dateStr === datePart);
        if (dayObj) {
          dayObj.hours += (s.duration || 0) / 3600;
        }
      });

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

        focusableTasks.push({
          ...t,
          projectId: p.id,
          projectName: p.name
        });
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

  // Sort focusable: high priority first
  focusableTasks.sort((a, b) => (a.priority === 'high' ? -1 : (b.priority === 'high' ? 1 : 0)));
  const displayFocusable = focusableTasks.slice(0, 5);

  // Limit to top 7
  const displayPriorities = immediateTasks.slice(0, 7);

  const totalWeeklyHours = last7Days.reduce((sum, d) => sum + d.hours, 0).toFixed(1);
  const maxHours = Math.max(...last7Days.map(d => d.hours), 1);

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

        {/* Weekly Productivity & Time Log */}
        <div className="glass border border-white/6 p-6 flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-5 select-none">
            <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-chart-column text-accent glow-text"></i> Weekly Focus Summary
            </h2>
            <span className="text-xs font-bold text-accent bg-accent/15 px-2.5 py-1 rounded-full">
              {totalWeeklyHours} hrs logged
            </span>
          </div>

          <div className="flex-1 flex items-end gap-3 px-2 py-4 h-full relative">
            {last7Days.map(day => {
              const heightPercent = Math.min(100, Math.round((day.hours / maxHours) * 100));
              return (
                <div key={day.dateStr} className="flex flex-col items-center gap-2 h-full flex-1 justify-end">
                  <div className="flex-1 w-full bg-white/[0.015] border border-white/5 rounded-xl flex flex-col justify-end relative group cursor-pointer overflow-visible min-h-[120px]">
                    
                    {/* The Bar */}
                    <div 
                      className="w-full bg-gradient-to-t from-accent to-[#a855f7] rounded-xl shadow-[0_0_10px_var(--accent-glow)] transition-all duration-500 ease-out" 
                      style={{ height: `${heightPercent}%` }}
                    />
                    
                    {/* Custom Premium Tooltip */}
                    <div className="absolute opacity-0 group-hover:opacity-100 transition-all duration-200 bg-[#0f1016]/95 border border-white/12 text-white px-2 py-1 rounded-lg text-[9px] font-extrabold bottom-[calc(100%+5px)] left-1/2 -translate-x-1/2 pointer-events-none whitespace-nowrap shadow-xl transform translate-y-1 group-hover:translate-y-0 z-10">
                      {day.hours.toFixed(2)} hrs
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-text-muted select-none">{day.dayName}</span>
                </div>
              );
            })}
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

        {/* Pomodoro Focus Zone */}
        <div className="glass border border-white/6 p-6 flex flex-col h-[450px]">
          <div className="flex justify-between items-center mb-5 select-none">
            <h2 className="text-base font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-hourglass-half text-accent glow-text"></i> Focus Zone
            </h2>
            <span className="text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-full">
              {totalPomodoros} Focus Cycles
            </span>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-hidden">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-400 text-lg animate-pulse">
                <i className="fa-solid fa-brain"></i>
              </div>
              <div className="flex-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wide">Flow State Booster</h4>
                <p className="text-[11px] text-text-secondary mt-0.5">Focus intensely on a task for 25 minutes. No distractions. Let your productivity surge.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto flex-1 pr-1">
              <span className="text-[9px] font-extrabold text-text-muted uppercase select-none tracking-wider mb-0.5">QUICK SELECT A TASK TO FOCUS ON</span>
              {displayFocusable.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center text-text-muted gap-2 border border-dashed border-white/4 rounded-xl flex-1">
                  <i className="fa-solid fa-check text-xl opacity-20"></i>
                  <p className="text-[11px]">All tasks completed! Excellent work.</p>
                </div>
              ) : (
                displayFocusable.map(t => (
                  <div
                    key={t.id}
                    className="flex justify-between items-center p-3 bg-white/[0.015] border border-white/6 rounded-xl hover:bg-white/[0.03] transition-all"
                  >
                    <div className="flex flex-col gap-0.5 overflow-hidden pr-3">
                      <span className="text-xs font-semibold text-white truncate max-w-full">{t.title}</span>
                      <span className="text-[9px] text-text-muted truncate max-w-full">
                        <i className="fa-solid fa-folder text-[8px] mr-1"></i> {t.projectName}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => {
                        const event = new CustomEvent('start-pomodoro-focus', { detail: { projectId: t.projectId, task: t } });
                        window.dispatchEvent(event);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 hover:text-white text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1.5 flex-shrink-0"
                      title="Launch Pomodoro Focus"
                    >
                      <i className="fa-solid fa-hourglass-start text-[8px]"></i> Start
                    </button>
                  </div>
                ))
              )}
            </div>
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
