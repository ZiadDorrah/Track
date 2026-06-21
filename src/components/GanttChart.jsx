import React, { useState, useEffect, useRef } from 'react';
import './GanttChart.css';

// Consistent HSL project color hashing
function getProjectColor(name) {
  const colors = [
    'hsl(265, 89%, 65%)', // Violet
    'hsl(175, 89%, 45%)', // Teal
    'hsl(210, 89%, 55%)', // Blue
    'hsl(340, 89%, 60%)', // Rose
    'hsl(38, 92%, 50%)',  // Amber
    'hsl(142, 72%, 45%)'   // Emerald
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function formatDateTimeUS(dateStr) {
  if (!dateStr) return '';
  const hasTime = dateStr.includes('T');
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj.getTime())) return dateStr;

  const pad = (num) => String(num).padStart(2, '0');
  const mm = pad(dateObj.getMonth() + 1);
  const dd = pad(dateObj.getDate());
  const yyyy = dateObj.getFullYear();

  if (hasTime) {
    const hours = pad(dateObj.getHours());
    const minutes = pad(dateObj.getMinutes());
    return `${mm}/${dd}/${yyyy} ${hours}:${minutes}`;
  }
  return `${mm}/${dd}/${yyyy}`;
}

export default function GanttChart({ projects, selectedGanttProjects, onSelectedGanttProjectsChange, onTaskEdit }) {
  const [timelineMode, setTimelineMode] = useState('days'); // days, hours
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDayStr, setSelectedDayStr] = useState(todayStr);
  const [dropdownActive, setDropdownActive] = useState(false);
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, content: null });
  const dropdownRef = useRef(null);

  // Close dropdown if clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownActive(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Sync / Toggle selector dropdown items
  const handleToggleProject = (id) => {
    if (selectedGanttProjects.includes(id)) {
      onSelectedGanttProjectsChange(selectedGanttProjects.filter(pId => pId !== id));
    } else {
      onSelectedGanttProjectsChange([...selectedGanttProjects, id]);
    }
  };

  const handleSelectAll = () => {
    onSelectedGanttProjectsChange(projects.map(p => p.id));
  };

  const handleClearAll = () => {
    onSelectedGanttProjectsChange([]);
  };

  // Selector Label text
  let selectorText = 'None Selected';
  if (projects.length === 0) {
    selectorText = 'No Projects';
  } else if (selectedGanttProjects.length === projects.length && projects.length > 0) {
    selectorText = 'All Projects';
  } else if (selectedGanttProjects.length > 0) {
    selectorText = `${selectedGanttProjects.length} Selected`;
  }

  // Filter projects list for rendering
  const activeProjects = projects.filter(p => selectedGanttProjects.includes(p.id));

  // Determine Gantt Date bounds
  const getTimelineBounds = () => {
    let minDate = null;
    let maxDate = null;
    const todayStr = new Date().toISOString().split('T')[0];

    activeProjects.forEach(p => {
      (p.tasks || []).forEach(t => {
        const start = t.scheduleDate;
        const end = t.deadline;

        if (start) {
          const sDate = new Date(start);
          if (!isNaN(sDate.getTime())) {
            if (minDate === null || sDate < minDate) minDate = sDate;
          }
        }
        if (end) {
          const eDate = new Date(end);
          if (!isNaN(eDate.getTime())) {
            if (maxDate === null || eDate > maxDate) maxDate = eDate;
          }
        }
      });
    });

    const min = minDate ? new Date(minDate) : new Date(todayStr);
    const max = maxDate ? new Date(maxDate) : new Date(todayStr);
    min.setHours(0, 0, 0, 0);
    max.setHours(23, 59, 59, 999);

    // Buffers
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 3);

    // Min width window
    const diffTime = Math.abs(max - min);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 14) {
      max.setDate(min.getDate() + 14);
    }

    // Clamp maximum 90 days
    const maxDiffDays = Math.ceil(Math.abs(max - min) / (1000 * 60 * 60 * 24));
    if (maxDiffDays > 90) {
      max.setTime(min.getTime() + 90 * 24 * 60 * 60 * 1000);
    }

    return { min, max };
  };

  const { min: minDate, max: maxDate } = getTimelineBounds();

  // Generate list of days
  const getDaysInRange = (start, end) => {
    const days = [];
    const current = new Date(start);
    current.setHours(0, 0, 0, 0);
    const targetEnd = new Date(end);
    targetEnd.setHours(23, 59, 59, 999);
    while (current <= targetEnd) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const days = getDaysInRange(minDate, maxDate);

  // Group days by Month + Year
  const monthGroups = [];
  days.forEach(day => {
    const label = day.toLocaleString('default', { month: 'long', year: 'numeric' });
    if (monthGroups.length === 0 || monthGroups[monthGroups.length - 1].label !== label) {
      monthGroups.push({ label, count: 1 });
    } else {
      monthGroups[monthGroups.length - 1].count++;
    }
  });

  const hoursArray = Array.from({ length: 24 }, (_, i) => i);
  let hourModeDateLabel = '';
  if (selectedDayStr) {
    const parts = selectedDayStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const dObj = new Date(year, month, day);
      hourModeDateLabel = dObj.toLocaleString('default', { month: 'long', day: 'numeric', year: 'numeric' });
    } else {
      hourModeDateLabel = selectedDayStr;
    }
  }

  // Tooltip position & trigger logic
  const handleMouseEnter = (e, task, projectName, startStr, endStr, isFallback, isOverdue) => {
    let datesHtml = '';
    if (isFallback) {
      datesHtml = `<span class="text-amber-500 font-semibold"><i class="fa-solid fa-triangle-exclamation mr-1"></i> Dates not scheduled</span>`;
    } else {
      datesHtml = `${formatDateTimeUS(startStr)} &mdash; ${formatDateTimeUS(endStr)}`;
    }

    let statusText = task.status.toUpperCase();
    if (task.status === 'in-progress') statusText = 'IN PROGRESS';

    const content = (
      <div className="flex flex-col gap-1.5 text-xs text-text-secondary select-none">
        <div className="font-bold text-sm text-white border-b border-white/6 pb-1 mb-1">{task.title}</div>
        <div><strong>Project:</strong> <span className="text-white">{projectName}</span></div>
        <div><strong>Dates:</strong> <span className="text-white" dangerouslySetInnerHTML={{ __html: datesHtml }} /></div>
        <div className="flex items-center gap-1.5 mt-1">
          <strong>Status:</strong>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
            task.status === 'done' ? 'bg-[#10b981]/12 text-[#10b981]' : (task.status === 'in-progress' ? 'bg-[#a855f7]/12 text-[#a855f7]' : 'bg-[#3b82f6]/12 text-[#3b82f6]')
          }`}>{statusText}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <strong>Priority:</strong>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
            task.priority === 'high' ? 'bg-[#f43f5e]/12 text-[#f43f5e]' : (task.priority === 'medium' ? 'bg-[#eab308]/12 text-[#eab308]' : 'bg-[#3b82f6]/12 text-[#3b82f6]')
          }`}>{task.priority}</span>
        </div>
        {task.description && (
          <div className="mt-1 text-text-muted italic border-t border-white/4 pt-1.5 max-w-[240px] break-words">
            {task.description}
          </div>
        )}
        {isOverdue && (
          <div className="text-red-400 font-bold mt-1.5 flex items-center gap-1">
            <i className="fa-solid fa-clock"></i> OVERDUE
          </div>
        )}
      </div>
    );

    setTooltip({
      show: true,
      x: e.pageX + 15,
      y: e.pageY + 15,
      content
    });
  };

  const handleMouseMove = (e) => {
    if (!tooltip.show) return;
    const x = e.pageX + 15;
    const y = e.pageY + 15;
    setTooltip(prev => ({ ...prev, x, y }));
  };

  const handleMouseLeave = () => {
    setTooltip({ show: false, x: 0, y: 0, content: null });
  };

  // Safe window dimensions tooltip clamps
  const getTooltipStyles = () => {
    if (!tooltip.show) return { display: 'none' };
    const styles = {
      position: 'absolute',
      zIndex: 1000,
      background: 'rgba(15, 17, 28, 0.95)',
      border: '1px solid var(--border-hover)',
      borderRadius: '10px',
      padding: '12px',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(10px)',
      pointerEvents: 'none',
      width: 'max-content',
      maxWidth: '280px',
      left: `${tooltip.x}px`,
      top: `${tooltip.y}px`,
    };

    // Bounds detection
    const tooltipWidth = 260; // Approximate
    const tooltipHeight = 150; // Approximate
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    if (tooltip.x + tooltipWidth > screenWidth + window.scrollX) {
      styles.left = `${tooltip.x - tooltipWidth - 30}px`;
    }
    if (tooltip.y + tooltipHeight > screenHeight + window.scrollY) {
      styles.top = `${tooltip.y - tooltipHeight - 30}px`;
    }

    return styles;
  };

  return (
    <div className="flex flex-col mt-7">
      <div className="flex justify-between items-center gap-5 mb-6 flex-wrap">
        <div>
          <h2 className="text-lg font-bold font-heading text-white flex items-center gap-2">
            <i className="fa-solid fa-timeline text-accent glow-text"></i> Project Timelines
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">Interactive Gantt chart showing schedule dates and deadlines.</p>
        </div>

        <div className="flex items-center gap-5 flex-wrap">
          {/* View Mode Selector */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-text-secondary">View:</span>
            <select
              value={timelineMode}
              onChange={(e) => setTimelineMode(e.target.value)}
              className="bg-black/25 border border-white/6 text-white px-2.5 py-1.5 rounded-lg text-xs font-medium focus:outline-none focus:border-accent focus:bg-[#0d0e15] cursor-pointer"
            >
              <option value="days">Days (Month)</option>
              <option value="hours">Hours (Day)</option>
            </select>
          </div>

          {/* Select Day for Hours View */}
          {timelineMode === 'hours' && (
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-semibold text-text-secondary">Day:</span>
              <input
                type="date"
                value={selectedDayStr}
                onChange={(e) => setSelectedDayStr(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                className="bg-black/25 border border-white/6 text-white px-2.5 py-1 rounded-lg text-xs font-medium focus:outline-none focus:border-accent focus:bg-[#0d0e15] cursor-pointer"
              />
            </div>
          )}

          {/* Multi-Select Projects Selector Dropdown */}
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-text-secondary">Projects:</span>
            <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setDropdownActive(!dropdownActive)}
              className="px-4 py-2 text-sm text-white bg-white/4 border border-white/6 hover:bg-white/8 hover:border-white/12 rounded-lg font-heading font-medium flex items-center gap-2.5 transition-all cursor-pointer shadow-lg"
            >
              <span>{selectorText}</span>
              <i className={`fa-solid fa-chevron-down transition-transform duration-200 ${dropdownActive ? 'rotate-180' : ''}`}></i>
            </button>

            {dropdownActive && (
              <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto z-40 p-2 glass border border-white/12 shadow-[0_10px_30px_rgba(0,0,0,0.5)] flex flex-col gap-1 animate-fade-in bg-[#0f1016]/95">
                <div className="flex justify-between p-1.5 border-b border-white/6 mb-1.5">
                  <button
                    onClick={handleSelectAll}
                    type="button"
                    className="bg-transparent border-none text-accent font-bold text-xs hover:text-accent-hover cursor-pointer"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleClearAll}
                    type="button"
                    className="bg-transparent border-none text-accent font-bold text-xs hover:text-accent-hover cursor-pointer"
                  >
                    Clear All
                  </button>
                </div>

                {projects.length === 0 ? (
                  <div className="p-3 text-xs text-text-muted text-center">No active projects.</div>
                ) : (
                  projects.map(p => {
                    const isSelected = selectedGanttProjects.includes(p.id);
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleToggleProject(p.id)}
                        className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer text-xs transition-all hover:bg-white/4 ${
                          isSelected ? 'font-semibold text-white' : 'text-text-secondary'
                        }`}
                      >
                        <div className={`w-4 h-4 border border-text-muted rounded flex items-center justify-center transition-all ${
                          isSelected ? 'bg-accent border-accent text-white' : ''
                        }`}>
                          {isSelected && <i className="fa-solid fa-check text-[9px]"></i>}
                        </div>
                        <div className="w-2 h-2 rounded-full" style={{ background: getProjectColor(p.name) }}></div>
                        <span className="flex-1 truncate" title={p.name}>{p.name}</span>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

      {/* Gantt Chart Scrollable Grid */}
      <div className="w-full overflow-x-auto bg-black/15 border border-white/6 rounded-xl relative gantt-chart-wrapper">
        {activeProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-text-muted gap-3 min-w-[600px]">
            <i className="fa-solid fa-chart-gantt text-4xl opacity-15"></i>
            <p className="text-sm">Select one or more projects from the filter menu to view their timelines.</p>
          </div>
        ) : (
          <div className="flex flex-col min-w-max relative text-white select-none">
            
            {/* Header: Months / Date */}
            <div className="flex border-b border-white/6 bg-white/[0.02] sticky top-0 z-20">
              <div className="w-56 min-w-56 px-4 flex items-center text-xs font-bold text-text-secondary border-r border-white/6 bg-[#0b0c10] sticky left-0 z-25 h-8">
                Timeline
              </div>
              <div className="flex relative">
                {timelineMode === 'days' ? (
                  monthGroups.map((g, idx) => (
                    <div
                      key={idx}
                      className="flex items-center pl-3 text-xs font-bold text-white border-r border-white/6 h-8 bg-white/[0.01]"
                      style={{ width: `${g.count * 50}px` }}
                    >
                      {g.label}
                    </div>
                  ))
                ) : (
                  <div
                    className="flex items-center pl-3 text-xs font-bold text-white border-r border-white/6 h-8 bg-white/[0.01]"
                    style={{ width: `${24 * 50}px` }}
                  >
                    {hourModeDateLabel}
                  </div>
                )}
              </div>
            </div>

            {/* Header: Days / Hours */}
            <div className="flex border-b border-white/6 bg-white/[0.02] sticky top-8 z-20">
              <div className="w-56 min-w-56 px-4 flex items-center text-xs font-bold text-text-secondary border-r border-white/6 bg-[#0b0c10] sticky left-0 z-25 h-10">
                Projects / Tasks
              </div>
              <div className="flex relative">
                {timelineMode === 'days' ? (
                  days.map((day, idx) => {
                    const dStr = day.toISOString().split('T')[0];
                    const isToday = dStr === todayStr;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                    return (
                      <div
                        key={idx}
                        className={`w-[50px] min-w-[50px] flex flex-col items-center justify-center h-10 border-r border-white/[0.04] text-[10px] ${
                          isWeekend ? 'bg-white/[0.01]' : ''
                        } ${isToday ? 'bg-accent/15 border-l border-accent border-r-accent' : ''}`}
                      >
                        <span className={`font-bold ${isToday ? 'text-accent' : 'text-white'}`}>{day.getDate()}</span>
                        <span className="text-[8px] text-text-muted uppercase">
                          {day.toLocaleString('default', { weekday: 'short' }).substring(0, 2)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  hoursArray.map((hour) => {
                    const localNow = new Date();
                    const isToday = selectedDayStr === todayStr;
                    const isCurrentHour = isToday && localNow.getHours() === hour;
                    const hourLabel = String(hour).padStart(2, '0') + ':00';

                    return (
                      <div
                        key={hour}
                        className={`w-[50px] min-w-[50px] flex flex-col items-center justify-center h-10 border-r border-white/[0.04] text-[10px] ${
                          isCurrentHour ? 'bg-accent/15 border-l border-accent border-r-accent' : ''
                        }`}
                      >
                        <span className={`font-bold ${isCurrentHour ? 'text-accent' : 'text-white'}`}>{hourLabel}</span>
                        <span className="text-[8px] text-text-muted uppercase">
                          Hour
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Gantt Rows Container */}
            <div className="relative flex flex-col">
              
              {/* Grid Background columns */}
              <div className="absolute top-0 bottom-0 left-56 right-0 flex pointer-events-none z-1">
                {timelineMode === 'days' ? (
                  days.map((day, idx) => {
                    const dStr = day.toISOString().split('T')[0];
                    const isToday = dStr === todayStr;
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                    return (
                      <div
                        key={idx}
                        className={`w-[50px] h-full border-r border-white/[0.03] flex-shrink-0 ${
                          isWeekend ? 'bg-white/[0.015]' : ''
                        } ${isToday ? 'bg-accent/[0.02] border-r-accent/15' : ''}`}
                      />
                    );
                  })
                ) : (
                  hoursArray.map((hour) => {
                    const localNow = new Date();
                    const isToday = selectedDayStr === todayStr;
                    const isCurrentHour = isToday && localNow.getHours() === hour;

                    return (
                      <div
                        key={hour}
                        className={`w-[50px] h-full border-r border-white/[0.03] flex-shrink-0 ${
                          isCurrentHour ? 'bg-accent/[0.02] border-r-accent/15' : ''
                        }`}
                      />
                    );
                  })
                )}
              </div>

              {/* Dynamic Project Groups */}
              {activeProjects.map(p => {
                const projColor = getProjectColor(p.name);
                const tasks = p.tasks || [];

                return (
                  <React.Fragment key={p.id}>
                    {/* Project Header Row */}
                    <div className="flex h-9 items-center bg-white/[0.02] border-b border-white/6 relative z-5">
                      <div className="w-56 min-w-56 px-4 flex items-center gap-2 text-xs font-bold text-accent border-r border-white/6 bg-[#141621]/90 sticky left-0 z-6 h-full truncate">
                        <i className="fa-solid fa-folder-open" style={{ color: projColor }}></i>
                        <span className="truncate">{p.name}</span>
                      </div>
                      <div className="flex-1 h-full"></div>
                    </div>

                    {/* Tasks Rows */}
                    {tasks.length === 0 ? (
                      <div className="flex h-12 items-center border-b border-white/6 relative z-5 text-text-muted italic text-xs">
                        <div className="w-56 min-w-56 px-8 flex items-center border-r border-white/6 bg-[#0d0e15]/95 sticky left-0 z-6 h-full select-none">
                          No tasks scheduled
                        </div>
                        <div className="flex-1 h-full"></div>
                      </div>
                    ) : (
                      tasks.map(t => {
                        // Safe timeline calculations
                        let startStr = t.scheduleDate;
                        let endStr = t.deadline;
                        let isFallback = false;

                        if (!startStr && !endStr) {
                          startStr = todayStr;
                          endStr = todayStr;
                          isFallback = true;
                        } else if (!startStr) {
                          startStr = endStr;
                          isFallback = true;
                        } else if (!endStr) {
                          startStr = startStr;
                          endStr = startStr;
                          isFallback = true;
                        }

                        const sDate = new Date(startStr);
                        const eDate = new Date(endStr);
                        const isOverdue = t.deadline && t.deadline < todayStr && t.status !== 'done';

                        let inView = false;
                        let barWidth = 0;
                        let leftOffset = 0;

                        if (timelineMode === 'days') {
                          const minTime = minDate.getTime();
                          const startOffsetDays = Math.floor((sDate.getTime() - minTime) / (1000 * 60 * 60 * 24));
                          let durationDays = Math.ceil((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
                          if (durationDays < 1) durationDays = 1;

                          const totalTimelineDays = days.length;
                          const endOffsetDays = startOffsetDays + durationDays;

                          inView = endOffsetDays >= 0 && startOffsetDays < totalTimelineDays;
                          const visibleStart = Math.max(0, startOffsetDays);
                          const visibleEnd = Math.min(totalTimelineDays, endOffsetDays);
                          const visibleDuration = visibleEnd - visibleStart;

                          barWidth = visibleDuration * 50;
                          leftOffset = visibleStart * 50;
                        } else {
                          // Hours View Mode
                          const dayStart = new Date(selectedDayStr + 'T00:00:00');
                          const dayEnd = new Date(selectedDayStr + 'T23:59:59');
                          const dayStartTime = dayStart.getTime();
                          const dayEndTime = dayEnd.getTime();

                          const taskStartTime = sDate.getTime();
                          const taskEndTime = eDate.getTime();

                          // Check if task overlaps with this 24h day
                          inView = taskStartTime <= dayEndTime && taskEndTime >= dayStartTime;

                          if (inView) {
                            const visibleStartTime = Math.max(dayStartTime, taskStartTime);
                            const visibleEndTime = Math.min(dayEndTime, taskEndTime);

                            const startOffsetHours = (visibleStartTime - dayStartTime) / (1000 * 60 * 60);
                            const endOffsetHours = (visibleEndTime - dayStartTime) / (1000 * 60 * 60);
                            const durationHours = endOffsetHours - startOffsetHours;

                            barWidth = durationHours * 50;
                            if (barWidth < 10) barWidth = 10;
                            leftOffset = startOffsetHours * 50;
                          }
                        }

                        const isOutside = barWidth < 120;

                        return (
                          <div key={t.id} className="flex h-12 items-center border-b border-white/6 relative z-5 transition-colors hover:bg-white/[0.01]">
                            {/* Task name cell sticky */}
                            <div
                              onClick={() => onTaskEdit(t, p.id)}
                              className="w-56 min-w-56 pl-8 pr-4 flex items-center gap-2 text-xs font-semibold text-white border-r border-white/6 bg-[#0d0e15]/95 sticky left-0 z-6 h-full truncate cursor-pointer hover:text-accent"
                            >
                              <span className={`dot dot-${t.status === 'in-progress' ? 'progress' : t.status} flex-shrink-0`} />
                              <span className="truncate">{t.title}</span>
                            </div>

                            {/* Task Bar timeline cell */}
                            <div className="relative flex-1 h-full flex items-center">
                              {inView && (
                                <div
                                  onClick={() => onTaskEdit(t, p.id)}
                                  onMouseEnter={(e) => handleMouseEnter(e, t, p.name, startStr, endStr, isFallback, isOverdue)}
                                  onMouseMove={handleMouseMove}
                                  onMouseLeave={handleMouseLeave}
                                  className={`gantt-task-bar absolute h-6.5 rounded-md px-2.5 flex items-center text-[10px] font-bold text-white cursor-pointer select-none transition-all hover:scale-y-105 border z-10 ${
                                    t.status === 'done' ? 'status-done border-[#10b981]/30 shadow-lg shadow-[#10b981]/5 hover:shadow-xl hover:shadow-[#10b981]/15' :
                                    (t.status === 'in-progress' ? 'status-in-progress border-[#a855f7]/40 shadow-lg shadow-[#a855f7]/10 hover:shadow-xl hover:shadow-[#a855f7]/20' :
                                    'status-todo border-[#3b82f6]/40 shadow-lg shadow-[#3b82f6]/10 hover:shadow-xl hover:shadow-[#3b82f6]/20')
                                  } ${isFallback ? 'fallback-dates text-amber-200' : ''} ${isOverdue ? 'is-overdue border-red-500' : ''} ${
                                    isOutside ? 'overflow-visible' : 'overflow-hidden'
                                  }`}
                                  style={{
                                    left: `${leftOffset}px`,
                                    width: `${barWidth}px`
                                  }}
                                >
                                  {isFallback && (
                                    <i className="fa-solid fa-triangle-exclamation text-[#eab308] mr-1.5 flex-shrink-0" title="Task timeline dates not set"></i>
                                  )}
                                  <span
                                    className={`truncate whitespace-nowrap font-medium ${
                                      isOutside
                                        ? 'absolute left-[calc(100%+8px)] text-white text-[10px] font-semibold tracking-wide drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)] max-w-max z-15 pointer-events-none'
                                        : 'w-full text-ellipsis'
                                    }`}
                                  >
                                    {t.title}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Floating Tooltip portal */}
      {tooltip.show && (
        <div style={getTooltipStyles()}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
