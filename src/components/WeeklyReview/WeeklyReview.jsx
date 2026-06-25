import React, { useState } from 'react';
import './WeeklyReview.css';

export default function WeeklyReview({ projects, onTaskUpdate }) {
  // Dates calculation
  const today = new Date();
  const startOfDayToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Helper to format date relative to today
  const getRelativeDateString = (daysOffset) => {
    const d = new Date(startOfDayToday);
    d.setDate(d.getDate() + daysOffset);
    const pad = (num) => String(num).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T09:00`;
  };

  // Helper to format deadline offset relative to schedule
  const getRelativeDeadlineString = (daysOffset) => {
    const d = new Date(startOfDayToday);
    d.setDate(d.getDate() + daysOffset);
    const pad = (num) => String(num).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T18:00`;
  };

  // Gather all tasks across all projects
  const allTasks = [];
  projects.forEach(p => {
    (p.tasks || []).forEach(t => {
      allTasks.push({
        ...t,
        projectId: p.id,
        projectName: p.name
      });
    });
  });

  // Wins: Completed in the last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const winsTasks = allTasks.filter(t => {
    if (t.status !== 'done') return false;
    const completedDate = t.completedAt ? new Date(t.completedAt) : new Date(t.createdAt);
    return completedDate >= sevenDaysAgo;
  });

  // Carry-overs: Overdue & uncompleted tasks
  const overdueTasks = allTasks.filter(t => {
    if (t.status === 'done') return false;
    if (!t.deadline) return false;
    return new Date(t.deadline) < today;
  });

  // Unscheduled tasks: Pending and no schedule date/deadline
  const unscheduledTasks = allTasks.filter(t => {
    return t.status !== 'done' && !t.scheduleDate;
  });

  const handleQuickSchedule = (taskId, projectId, option) => {
    let scheduleDate = '';
    let deadline = '';
    
    switch (option) {
      case 'tomorrow':
        scheduleDate = getRelativeDateString(1);
        deadline = getRelativeDeadlineString(1);
        break;
      case 'monday': {
        const currentDay = today.getDay(); // 0 is Sun, 1 is Mon
        const daysToNextMonday = currentDay === 0 ? 1 : 8 - currentDay;
        scheduleDate = getRelativeDateString(daysToNextMonday);
        deadline = getRelativeDeadlineString(daysToNextMonday);
        break;
      }
      case 'tuesday': {
        const currentDay = today.getDay();
        const daysToNextTuesday = currentDay <= 2 ? 2 - currentDay : 9 - currentDay;
        scheduleDate = getRelativeDateString(daysToNextTuesday);
        deadline = getRelativeDeadlineString(daysToNextTuesday);
        break;
      }
      case 'wednesday': {
        const currentDay = today.getDay();
        const daysToNextWednesday = currentDay <= 3 ? 3 - currentDay : 10 - currentDay;
        scheduleDate = getRelativeDateString(daysToNextWednesday);
        deadline = getRelativeDeadlineString(daysToNextWednesday);
        break;
      }
      case 'thursday': {
        const currentDay = today.getDay();
        const daysToNextThursday = currentDay <= 4 ? 4 - currentDay : 11 - currentDay;
        scheduleDate = getRelativeDateString(daysToNextThursday);
        deadline = getRelativeDeadlineString(daysToNextThursday);
        break;
      }
      case 'friday': {
        const currentDay = today.getDay();
        const daysToNextFriday = currentDay <= 5 ? 5 - currentDay : 12 - currentDay;
        scheduleDate = getRelativeDateString(daysToNextFriday);
        deadline = getRelativeDeadlineString(daysToNextFriday);
        break;
      }
      case 'weekend': {
        const currentDay = today.getDay();
        const daysToSaturday = currentDay === 6 ? 7 : 6 - currentDay;
        scheduleDate = getRelativeDateString(daysToSaturday);
        deadline = getRelativeDeadlineString(daysToSaturday + 1); // Sunday deadline
        break;
      }
      default:
        return;
    }
    
    onTaskUpdate(taskId, { scheduleDate, deadline }, false, projectId);
  };

  const handleCustomScheduleChange = (taskId, projectId, field, value) => {
    onTaskUpdate(taskId, { [field]: value }, false, projectId);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight">Weekly Review</h1>
        <p className="text-sm text-text-secondary mt-1">
          A Sunday planning workspace: celebrate last week's accomplishments, reschedule overdue carry-overs, and schedule upcoming tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
        {/* Column 1: Last Week's Wins */}
        <div className="glass border border-white/6 p-5 flex flex-col gap-4 min-h-[450px]">
          <div className="flex justify-between items-center select-none pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-trophy text-emerald-400"></i>
              <span>Last Week's Wins</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
              {winsTasks.length} Done
            </span>
          </div>

          <div className="flex flex-col gap-3 overflow-y-auto max-h-[500px] pr-1">
            {winsTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-text-muted gap-2 border border-dashed border-white/4 rounded-xl flex-1">
                <i className="fa-solid fa-crown text-text-muted/15 text-2xl"></i>
                <p className="text-xs">No tasks completed in the last 7 days.</p>
                <p className="text-[10px]">Complete some tasks to celebrate your wins!</p>
              </div>
            ) : (
              winsTasks.map(t => (
                <div key={t.id} className="p-3 bg-emerald-500/[0.02] border border-emerald-500/10 rounded-lg flex flex-col gap-1.5">
                  <div className="flex items-start gap-2">
                    <i className="fa-solid fa-circle-check text-emerald-400 text-xs mt-0.5"></i>
                    <span className="text-xs font-semibold text-white leading-snug line-through opacity-75">{t.title}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-text-muted select-none pl-5">
                    <span>{t.projectName}</span>
                    <span>Completed {t.completedAt ? new Date(t.completedAt).toLocaleDateString() : 'recently'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Overdue Carry-overs */}
        <div className="glass border border-white/6 p-5 flex flex-col gap-4 min-h-[450px]">
          <div className="flex justify-between items-center select-none pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-triangle-exclamation text-red-400"></i>
              <span>Overdue Carry-overs</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-red-500/15 text-red-400 border border-red-500/20 px-2.5 py-0.5 rounded-full">
              {overdueTasks.length} Pending
            </span>
          </div>

          <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[500px] pr-1">
            {overdueTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-text-muted gap-2 border border-dashed border-white/4 rounded-xl flex-1">
                <i className="fa-solid fa-clipboard-check text-emerald-400/30 text-2xl"></i>
                <p className="text-xs">No overdue carry-overs!</p>
                <p className="text-[10px] text-emerald-400/60 font-semibold">Everything is up-to-date.</p>
              </div>
            ) : (
              overdueTasks.map(t => (
                <div key={t.id} className="p-3 bg-red-500/[0.01] border border-red-500/10 rounded-lg flex flex-col gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white leading-snug">{t.title}</h4>
                    <p className="text-[9px] text-text-muted mt-0.5">Project: {t.projectName}</p>
                  </div>
                  
                  {/* Reschedule controls */}
                  <div className="flex flex-col gap-1.5 pt-1 border-t border-white/5">
                    <label className="text-[9px] font-bold text-text-secondary uppercase select-none">Quick Reschedule:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        onClick={() => handleQuickSchedule(t.id, t.projectId, 'tomorrow')}
                        className="py-1 bg-white/5 hover:bg-accent hover:text-white rounded text-[10px] transition-all cursor-pointer font-medium"
                      >
                        Tomorrow
                      </button>
                      <button
                        onClick={() => handleQuickSchedule(t.id, t.projectId, 'monday')}
                        className="py-1 bg-white/5 hover:bg-accent hover:text-white rounded text-[10px] transition-all cursor-pointer font-medium"
                      >
                        Next Monday
                      </button>
                    </div>
                    {/* Custom deadline picker */}
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="text-[9px] font-bold text-text-muted select-none">Custom Deadline:</span>
                      <input
                        type="datetime-local"
                        value={t.deadline ? t.deadline.slice(0, 16) : ''}
                        onChange={(e) => handleCustomScheduleChange(t.id, t.projectId, 'deadline', e.target.value)}
                        className="bg-black/25 border border-white/6 text-white px-2 py-1 rounded text-[10px] focus:outline-none focus:border-accent"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Plan Next Week */}
        <div className="glass border border-white/6 p-5 flex flex-col gap-4 min-h-[450px]">
          <div className="flex justify-between items-center select-none pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-calendar-days text-purple-400"></i>
              <span>Unscheduled Tasks</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-purple-500/15 text-purple-400 border border-purple-500/20 px-2.5 py-0.5 rounded-full">
              {unscheduledTasks.length} Left
            </span>
          </div>

          <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[500px] pr-1">
            {unscheduledTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center text-text-muted gap-2 border border-dashed border-white/4 rounded-xl flex-1">
                <i className="fa-solid fa-list text-purple-400/20 text-2xl animate-pulse"></i>
                <p className="text-xs">No unscheduled tasks.</p>
                <p className="text-[10px]">All pending tasks have been planned.</p>
              </div>
            ) : (
              unscheduledTasks.map(t => (
                <div key={t.id} className="p-3 bg-white/[0.015] border border-white/6 rounded-lg flex flex-col gap-2">
                  <div>
                    <h4 className="text-xs font-semibold text-white leading-snug">{t.title}</h4>
                    <p className="text-[9px] text-text-muted mt-0.5">Project: {t.projectName}</p>
                  </div>
                  
                  {/* Planning picker */}
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-white/5">
                    <span className="text-[9px] font-bold text-text-secondary select-none mb-1">Plan For:</span>
                    <select
                      onChange={(e) => handleQuickSchedule(t.id, t.projectId, e.target.value)}
                      defaultValue=""
                      className="bg-black/25 border border-white/6 text-white px-2 py-1.5 rounded text-[11px] focus:outline-none focus:border-accent cursor-pointer"
                    >
                      <option value="" disabled>Select a day...</option>
                      <option value="tomorrow">Tomorrow</option>
                      <option value="monday">Next Monday</option>
                      <option value="tuesday">Next Tuesday</option>
                      <option value="wednesday">Next Wednesday</option>
                      <option value="thursday">Next Thursday</option>
                      <option value="friday">Next Friday</option>
                      <option value="weekend">Next Weekend</option>
                    </select>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
