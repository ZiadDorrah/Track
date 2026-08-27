import React, { useState, useEffect, useRef } from 'react';
import './ProjectDetail.css';

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

// Single Task Card inside Kanban Column
function TaskCard({
  task,
  projectId,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onTaskUpdate,
  onStartTimer,
  onStopTimer,
  onOpenNotes,
  todayStr,
  escapeHTML
}) {
  const [menuActive, setMenuActive] = useState(false);
  const [subtasksVisible, setSubtasksVisible] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(task.timeLogged || 0);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuActive(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    let interval = null;
    if (task.timerStarted) {
      const calculateElapsed = () => {
        const start = new Date(task.timerStarted).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((now - start) / 1000));
        setElapsedTime((task.timeLogged || 0) + diff);
      };
      calculateElapsed();
      interval = setInterval(calculateElapsed, 1000);
    } else {
      setElapsedTime(task.timeLogged || 0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [task.timerStarted, task.timeLogged]);

  const isOverdue = task.deadline && task.deadline < todayStr && task.status !== 'done';

  const formattedDeadline = formatDateTimeUS(task.deadline);
  const formattedSchedule = formatDateTimeUS(task.scheduleDate);

  const subtasks = task.subtasks || [];
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const totalSubtasks = subtasks.length;
  const percentDone = totalSubtasks === 0 ? 0 : Math.round((completedSubtasks / totalSubtasks) * 100);

  const notes = task.notes || [];

  const formatTime = (secs) => {
    const hrs = Math.floor(secs / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    const pad = (num) => String(num).padStart(2, '0');
    if (hrs > 0) {
      return `${hrs}h ${pad(mins)}m ${pad(seconds)}s`;
    }
    return `${mins}m ${pad(seconds)}s`;
  };

  const handleCardClick = (e) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      onToggleSelect(task.id);
    }
  };

  return (
    <div
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', task.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onClick={handleCardClick}
      className={`task-card p-4 relative bg-white/[0.015] border hover:bg-white/[0.03] hover:-translate-y-[2px] rounded-xl flex flex-col gap-3 transition-all duration-300 cursor-grab active:cursor-grabbing select-none ${
        isSelected ? 'border-accent bg-accent/10 ring-2 ring-accent/30' : 'border-white/6 hover:border-white/12'
      } ${
        task.priority === 'high' ? 'border-l-4 border-l-red-500' :
        (task.priority === 'medium' ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-blue-500')
      }`}
    >
      {/* Accent Strip */}
      <div className={`absolute top-0 left-0 w-full h-[3px] rounded-t-xl ${
        task.priority === 'high' ? 'bg-[#f43f5e]' : (task.priority === 'medium' ? 'bg-[#eab308]' : 'bg-[#3b82f6]')
      }`} />

      {/* Header */}
      <div className="flex justify-between items-start gap-2.5">
        <div className="flex items-center gap-2 flex-1 pr-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(task.id)}
            onClick={(e) => e.stopPropagation()}
            className="w-3.5 h-3.5 rounded border-white/20 accent-accent cursor-pointer flex-shrink-0"
            title="Multi-select card"
          />
          <h4 className="text-sm font-semibold text-white font-heading leading-tight break-words flex-1">{task.title}</h4>
        </div>
        
        {/* Dropdown Actions */}
        <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuActive(!menuActive)}
            className="px-2 py-1 text-text-muted hover:text-white rounded hover:bg-white/5 transition-all text-xs cursor-pointer"
          >
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>

          {menuActive && (
            <div className="absolute right-0 top-full mt-1 w-32 bg-[#0f1016]/95 border border-white/12 rounded-lg shadow-xl py-1 z-20 animate-fade-in">
              <button
                onClick={() => { onEdit(task); setMenuActive(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-text-secondary hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-pen text-[9px]"></i> Edit
              </button>
              <button
                onClick={() => { onOpenNotes(task); setMenuActive(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-text-secondary hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-note-sticky text-[9px] text-amber-400"></i> Notes ({notes.length})
              </button>
              {task.status !== 'todo' && (
                <button
                  onClick={() => { onTaskUpdate(task.id, { status: 'todo' }); setMenuActive(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-text-secondary hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-circle-question text-[9px]"></i> To Do
                </button>
              )}
              {task.status !== 'in-progress' && (
                <button
                  onClick={() => { onTaskUpdate(task.id, { status: 'in-progress' }); setMenuActive(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-text-secondary hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-spinner text-[9px]"></i> In Progress
                </button>
              )}
              {task.status !== 'done' && (
                <button
                  onClick={() => { onTaskUpdate(task.id, { status: 'done' }); setMenuActive(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-text-secondary hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-circle-check text-[9px]"></i> Done
                </button>
              )}
              <button
                onClick={() => { onDelete(task.id); setMenuActive(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-red-500/15 text-[#fda4af] hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-trash-can text-[9px]"></i> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-text-secondary leading-relaxed break-words">
        {task.description ? task.description : <span className="text-text-muted italic">No description provided.</span>}
      </p>

      {/* Sub-tasks Checklist Progress Bar */}
      {totalSubtasks > 0 && (
        <div className="flex flex-col gap-1 mt-0.5 select-none" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-between items-center text-[10px] font-semibold text-text-secondary">
            <button 
              type="button"
              onClick={() => setSubtasksVisible(!subtasksVisible)}
              className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer"
            >
              <i className="fa-solid fa-list-check text-accent text-[9px]"></i> Checklist ({completedSubtasks}/{totalSubtasks})
              <i className={`fa-solid fa-chevron-${subtasksVisible ? 'up' : 'down'} text-[8px] opacity-70`}></i>
            </button>
            <span>{percentDone}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-accent rounded-full shadow-[0_0_5px_var(--accent-glow)] transition-all duration-300"
              style={{ width: `${percentDone}%` }}
            />
          </div>
          {subtasksVisible && (
            <div className="flex flex-col gap-1 border-t border-white/5 pt-1.5 mt-1 select-none max-h-28 overflow-y-auto">
              {subtasks.map(sub => (
                <label key={sub.id} className="flex items-center gap-2 text-[10px] text-text-secondary cursor-pointer hover:text-white transition-colors py-0.5">
                  <input
                    type="checkbox"
                    checked={sub.completed}
                    onChange={() => {
                      const updatedSubtasks = subtasks.map(s => s.id === sub.id ? { ...s, completed: !s.completed } : s);
                      onTaskUpdate(task.id, { subtasks: updatedSubtasks }, true);
                    }}
                    className="w-3 h-3 rounded border-white/10 accent-accent cursor-pointer"
                  />
                  <span className={sub.completed ? 'line-through text-text-muted' : ''}>{sub.text}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom Fields & Eisenhower Tags */}
      {(task.urgent || task.important || (task.customFields && Object.keys(task.customFields).length > 0)) && (
        <div className="flex flex-wrap gap-1 mt-0.5 select-none">
          {task.urgent && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-red-500/12 text-[#fda4af] border border-red-500/20 flex items-center gap-0.5" title="Urgent">
              <i className="fa-solid fa-fire text-[7px] text-red-400"></i> Urgent
            </span>
          )}
          {task.important && (
            <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-amber-500/12 text-[#fef08a] border border-amber-500/20 flex items-center gap-0.5" title="Important">
              <i className="fa-solid fa-star text-[7px] text-amber-400"></i> Important
            </span>
          )}
          {task.customFields && Object.entries(task.customFields).map(([k, val]) => (
            <span key={k} className="px-1.5 py-0.5 rounded text-[8px] font-semibold bg-white/5 text-text-secondary border border-white/8 truncate max-w-[130px]" title={`${k}: ${val}`}>
              {k}: {val}
            </span>
          ))}
        </div>
      )}

      {/* Play/Pause Timer & Logged Summary */}
      <div className="flex justify-between items-center bg-white/[0.01] border border-white/4 p-1.5 rounded-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2">
          {task.timerStarted ? (
            <button
              onClick={() => onStopTimer(projectId, task.id)}
              className="w-6 h-6 rounded-md bg-red-500/20 hover:bg-red-500/35 border border-red-500/30 flex items-center justify-center text-red-400 hover:text-white cursor-pointer transition-all"
              title="Pause Timer"
            >
              <i className="fa-solid fa-pause text-[10px]"></i>
            </button>
          ) : (
            <button
              onClick={() => onStartTimer(projectId, task.id)}
              className="w-6 h-6 rounded-md bg-accent/20 hover:bg-accent/35 border border-accent/30 flex items-center justify-center text-accent hover:text-white cursor-pointer transition-all"
              title="Start Timer"
            >
              <i className="fa-solid fa-play text-[8px] translate-x-[0.5px]"></i>
            </button>
          )}
          <span className={`text-[10px] font-bold ${task.timerStarted ? 'text-red-400 animate-pulse' : 'text-text-secondary'}`}>
            {elapsedTime > 0 ? formatTime(elapsedTime) : '0s logged'}
          </span>
        </div>
        
        {/* Quick Launch Pomodoro Focus */}
        <button
          onClick={() => {
            const event = new CustomEvent('start-pomodoro-focus', { detail: { projectId, task } });
            window.dispatchEvent(event);
          }}
          className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/20 text-amber-400 hover:text-white text-[9px] font-bold cursor-pointer transition-all flex items-center gap-1"
          title="Start Pomodoro Focus"
        >
          <i className="fa-solid fa-hourglass-start text-[8px]"></i> Focus
        </button>
      </div>

      {/* Footer */}
      <div className="flex justify-between items-center mt-0.5 text-[10px] text-text-secondary">
        <div className="flex flex-col gap-0.5">
          {formattedSchedule && (
            <span className="flex items-center gap-1 text-text-muted">
              <i className="fa-solid fa-calendar" title="Scheduled Date"></i> {formattedSchedule}
            </span>
          )}
          {formattedDeadline && (
            <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400 font-bold' : ''}`}>
              <i className="fa-solid fa-calendar-check" title="Deadline"></i> {formattedDeadline} {isOverdue && <b>(OVERDUE)</b>}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenNotes(task); }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[9px] font-medium border border-amber-500/20 cursor-pointer"
            title="Activity Notes"
          >
            <i className="fa-solid fa-comment-dots"></i> {notes.length}
          </button>

          {task.reminder && <i className="fa-solid fa-bell text-accent animate-pulse" title="Alarm Enabled"></i>}
          {task.recurring && task.recurring !== 'none' && (
            <span className="px-1 py-0.2 rounded text-[7px] font-extrabold uppercase bg-purple-500/12 text-[#d8b4fe] border border-purple-500/20 flex items-center gap-0.5" title={`Recurring: ${task.recurring}`}>
              <i className="fa-solid fa-rotate text-[6px]"></i> {task.recurring}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
            task.priority === 'high' ? 'bg-[#f43f5e]/12 text-[#fda4af] border border-[#f43f5e]/20' :
            (task.priority === 'medium' ? 'bg-[#eab308]/12 text-[#fef08a] border border-[#eab308]/20' :
            'bg-[#3b82f6]/12 text-[#bfdbfe] border border-[#3b82f6]/20')
          }`}>{task.priority}</span>
        </div>
      </div>
    </div>
  );
}

export default function ProjectDetail({
  project,
  onNavigate,
  onEditProject,
  onDeleteProject,
  onAddTask,
  onEditTask,
  onDeleteTask,
  onTaskUpdate,
  onBulkTaskUpdate,
  onSaveAsTemplate,
  onStartTimer,
  onStopTimer,
  escapeHTML,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // kanban, list
  
  // Drag and Drop state
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Multi-select state
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  // Notes Modal state
  const [notesModalTask, setNotesModalTask] = useState(null);
  const [newNoteText, setNewNoteText] = useState('');

  if (!project) return null;

  const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  // Multi-select handlers
  const handleToggleSelect = (taskId) => {
    setSelectedTaskIds(prev => 
      prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
    );
  };

  const handleSelectAll = () => {
    const allIds = (project.tasks || []).map(t => t.id);
    setSelectedTaskIds(allIds);
  };

  const handleClearSelection = () => {
    setSelectedTaskIds([]);
  };

  // Drag and Drop handlers
  const handleDragOver = (e, columnStatus) => {
    e.preventDefault();
    if (dragOverColumn !== columnStatus) {
      setDragOverColumn(columnStatus);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverColumn(null);
  };

  const handleDrop = (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId) {
      onTaskUpdate(taskId, { status: targetStatus });
    }
  };

  // Task Notes Add handler
  const handleAddNote = () => {
    if (!newNoteText.trim() || !notesModalTask) return;
    const nowStr = new Date().toISOString();
    const newNote = {
      id: String(Date.now()),
      text: newNoteText.trim(),
      createdAt: nowStr
    };
    const updatedNotes = [...(notesModalTask.notes || []), newNote];
    onTaskUpdate(notesModalTask.id, { notes: updatedNotes });
    setNotesModalTask({ ...notesModalTask, notes: updatedNotes });
    setNewNoteText('');
  };

  // Filtering logic
  let filteredTasks = project.tasks || [];
  if (searchQuery.trim() !== '') {
    const q = searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(t =>
      t.title.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }
  if (priorityFilter !== 'all') {
    filteredTasks = filteredTasks.filter(t => t.priority === priorityFilter);
  }

  // Kanban splits
  const todoTasks = filteredTasks.filter(t => t.status === 'todo');
  const progressTasks = filteredTasks.filter(t => t.status === 'in-progress');
  const doneTasks = filteredTasks.filter(t => t.status === 'done');

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative">
      {/* Header Breadcrumbs */}
      <div>
        <div className="flex items-center gap-2 text-xs text-text-muted mb-2 select-none">
          <span onClick={() => onNavigate('dashboard')} className="hover:text-accent cursor-pointer transition-colors">Dashboard</span>
          <i className="fa-solid fa-chevron-right text-[10px]"></i>
          <span className="text-text-secondary font-medium">Project Details</span>
        </div>

        <div className="flex justify-between items-start gap-6 flex-wrap md:flex-nowrap">
          <div className="flex-1 min-w-[250px] overflow-hidden">
            <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight truncate max-w-full" title={project.name}>{project.name}</h1>
            <p className="text-sm text-text-secondary mt-1 leading-relaxed break-words">{project.description || 'No description provided for this project.'}</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap flex-shrink-0 mt-1">
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-white/5 border border-white/6 hover:bg-white/10 hover:border-white/12 text-white font-heading font-medium text-xs rounded-lg flex items-center gap-2 transition-all shadow-md"
                title="Visit Site"
              >
                <i className="fa-solid fa-globe text-text-secondary"></i> <span>Live URL</span>
              </a>
            )}
            {project.github && (
              <a
                href={project.github}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-white/5 border border-white/6 hover:bg-white/10 hover:border-white/12 text-white font-heading font-medium text-xs rounded-lg flex items-center gap-2 transition-all shadow-md"
                title="View Source"
              >
                <i className="fa-brands fa-github text-text-secondary"></i> <span>GitHub</span>
              </a>
            )}
            
            {/* Save as Template Button */}
            <button
              onClick={() => {
                const name = window.prompt('Enter Template Name:', `${project.name} Template`);
                if (name) {
                  onSaveAsTemplate(project, name, project.description);
                }
              }}
              className="px-3 py-1.5 bg-purple-500/15 border border-purple-500/30 hover:bg-purple-500/30 text-[#d8b4fe] text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
              title="Save Project as Reusable Template"
            >
              <i className="fa-solid fa-box-archive"></i> <span>Save Template</span>
            </button>

            <button
              onClick={() => onEditProject(project)}
              className="p-2 bg-white/5 border border-white/6 hover:bg-white/10 hover:border-white/12 text-white rounded-lg transition-all cursor-pointer"
              title="Edit Project Scope"
            >
              <i className="fa-solid fa-pen-to-square"></i>
            </button>
            <button
              onClick={() => onDeleteProject(project.id)}
              className="p-2 bg-red-500/15 border border-red-500/30 hover:bg-red-500/30 hover:border-red-500/50 text-[#fda4af] hover:text-white rounded-lg transition-all cursor-pointer"
              title="Delete Project Workspace"
            >
              <i className="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Control Ribbon */}
      <div className="glass border border-white/6 p-4 flex justify-between items-center gap-5 flex-wrap">
        <div className="flex items-center gap-3">
          <button
            onClick={onAddTask}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-heading font-medium text-sm rounded-lg flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <i className="fa-solid fa-plus"></i> <span>New Task</span>
          </button>

          {/* Select All Toggle */}
          <button
            onClick={selectedTaskIds.length === project.tasks.length ? handleClearSelection : handleSelectAll}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-text-secondary hover:text-white rounded-lg transition-all cursor-pointer"
          >
            <i className="fa-solid fa-list-check mr-1.5"></i>
            {selectedTaskIds.length === project.tasks.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        <div className="flex items-center gap-4 flex-wrap md:flex-nowrap">
          {/* Search */}
          <div className="relative">
            <i className="fa-solid fa-magnifying-glass absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-xs"></i>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/20 border border-white/6 text-white pl-9 pr-3.5 py-1.5 rounded-lg text-xs transition-all focus:outline-none focus:border-accent focus:bg-black/35 w-48 md:w-56"
            />
          </div>

          {/* Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-black/20 border border-white/6 text-white px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none focus:border-accent focus:bg-[#0d0e15] cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-white/4 p-0.5 border border-white/6 rounded-lg select-none">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-md text-xs cursor-pointer transition-all ${
                viewMode === 'kanban' ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-white'
              }`}
              title="Kanban Board View"
            >
              <i className="fa-solid fa-table-columns"></i>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md text-xs cursor-pointer transition-all ${
                viewMode === 'list' ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-white'
              }`}
              title="Detailed List View"
            >
              <i className="fa-solid fa-list-ul"></i>
            </button>
          </div>
        </div>
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedTaskIds.length > 0 && (
        <div className="sticky top-2 z-30 bg-[#0f1017]/95 border border-accent/40 backdrop-blur-xl p-3.5 rounded-xl shadow-2xl flex items-center justify-between gap-4 flex-wrap animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <span className="w-5 h-5 rounded-full bg-accent flex items-center justify-center text-[10px]">
              {selectedTaskIds.length}
            </span>
            <span>tasks selected</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Move Status */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-text-muted font-medium">Status:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkTaskUpdate(project.id, selectedTaskIds, 'status', e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-white/5 border border-white/10 text-white text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">Move status...</option>
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            {/* Set Priority */}
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-text-muted font-medium">Priority:</span>
              <select
                onChange={(e) => {
                  if (e.target.value) {
                    onBulkTaskUpdate(project.id, selectedTaskIds, 'priority', e.target.value);
                    e.target.value = '';
                  }
                }}
                className="bg-white/5 border border-white/10 text-white text-xs px-2.5 py-1 rounded-lg focus:outline-none focus:border-accent cursor-pointer"
              >
                <option value="">Set priority...</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Bulk Delete */}
            <button
              onClick={() => {
                if (window.confirm(`Delete ${selectedTaskIds.length} selected tasks permanently?`)) {
                  onBulkTaskUpdate(project.id, selectedTaskIds, 'delete', null);
                  setSelectedTaskIds([]);
                }
              }}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/35 border border-red-500/35 text-red-300 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1"
            >
              <i className="fa-solid fa-trash-can text-[10px]"></i> Delete
            </button>

            {/* Clear selection */}
            <button
              onClick={handleClearSelection}
              className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-text-muted hover:text-white text-xs rounded-lg transition-all cursor-pointer ml-2"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* TO DO Column */}
          <div
            onDragOver={(e) => handleDragOver(e, 'todo')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'todo')}
            className={`glass border p-5 flex flex-col gap-4 min-h-[400px] transition-all rounded-2xl ${
              dragOverColumn === 'todo' ? 'border-accent bg-accent/10 border-dashed ring-2 ring-accent/40' : 'border-white/6'
            }`}
          >
            <div className="flex justify-between items-center mb-1 select-none">
              <div className="flex items-center gap-2">
                <span className="dot dot-todo"></span>
                <h2 className="text-sm font-bold font-heading text-white">To Do</h2>
              </div>
              <span className="text-xs font-bold text-text-secondary bg-white/5 px-2 py-0.5 rounded-full">{todoTasks.length}</span>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[500px] pr-1.5">
              {todoTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted gap-2 border border-dashed border-white/4 rounded-xl min-h-[120px]">
                  <i className="fa-solid fa-inbox text-xl opacity-20"></i>
                  <p className="text-[11px]">Drop tasks here</p>
                </div>
              ) : (
                todoTasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    projectId={project.id}
                    isSelected={selectedTaskIds.includes(t.id)}
                    onToggleSelect={handleToggleSelect}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onTaskUpdate={onTaskUpdate}
                    onStartTimer={onStartTimer}
                    onStopTimer={onStopTimer}
                    onOpenNotes={setNotesModalTask}
                    todayStr={todayStr}
                    escapeHTML={escapeHTML}
                  />
                ))
              )}
            </div>
          </div>

          {/* IN PROGRESS Column */}
          <div
            onDragOver={(e) => handleDragOver(e, 'in-progress')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'in-progress')}
            className={`glass border p-5 flex flex-col gap-4 min-h-[400px] transition-all rounded-2xl ${
              dragOverColumn === 'in-progress' ? 'border-accent bg-accent/10 border-dashed ring-2 ring-accent/40' : 'border-white/6'
            }`}
          >
            <div className="flex justify-between items-center mb-1 select-none">
              <div className="flex items-center gap-2">
                <span className="dot dot-progress"></span>
                <h2 className="text-sm font-bold font-heading text-white">In Progress</h2>
              </div>
              <span className="text-xs font-bold text-text-secondary bg-white/5 px-2 py-0.5 rounded-full">{progressTasks.length}</span>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[500px] pr-1.5">
              {progressTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted gap-2 border border-dashed border-white/4 rounded-xl min-h-[120px]">
                  <i className="fa-solid fa-inbox text-xl opacity-20"></i>
                  <p className="text-[11px]">Drop tasks here</p>
                </div>
              ) : (
                progressTasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    projectId={project.id}
                    isSelected={selectedTaskIds.includes(t.id)}
                    onToggleSelect={handleToggleSelect}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onTaskUpdate={onTaskUpdate}
                    onStartTimer={onStartTimer}
                    onStopTimer={onStopTimer}
                    onOpenNotes={setNotesModalTask}
                    todayStr={todayStr}
                    escapeHTML={escapeHTML}
                  />
                ))
              )}
            </div>
          </div>

          {/* DONE Column */}
          <div
            onDragOver={(e) => handleDragOver(e, 'done')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'done')}
            className={`glass border p-5 flex flex-col gap-4 min-h-[400px] transition-all rounded-2xl ${
              dragOverColumn === 'done' ? 'border-accent bg-accent/10 border-dashed ring-2 ring-accent/40' : 'border-white/6'
            }`}
          >
            <div className="flex justify-between items-center mb-1 select-none">
              <div className="flex items-center gap-2">
                <span className="dot dot-done"></span>
                <h2 className="text-sm font-bold font-heading text-white">Done</h2>
              </div>
              <span className="text-xs font-bold text-text-secondary bg-white/5 px-2 py-0.5 rounded-full">{doneTasks.length}</span>
            </div>
            <div className="flex flex-col gap-3.5 overflow-y-auto max-h-[500px] pr-1.5">
              {doneTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted gap-2 border border-dashed border-white/4 rounded-xl min-h-[120px]">
                  <i className="fa-solid fa-inbox text-xl opacity-20"></i>
                  <p className="text-[11px]">Drop tasks here</p>
                </div>
              ) : (
                doneTasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    projectId={project.id}
                    isSelected={selectedTaskIds.includes(t.id)}
                    onToggleSelect={handleToggleSelect}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onTaskUpdate={onTaskUpdate}
                    onStartTimer={onStartTimer}
                    onStopTimer={onStopTimer}
                    onOpenNotes={setNotesModalTask}
                    todayStr={todayStr}
                    escapeHTML={escapeHTML}
                  />
                ))
              )}
            </div>
          </div>

        </div>
      )}

      {/* List View Table */}
      {viewMode === 'list' && (
        <div className="w-full overflow-x-auto bg-black/15 border border-white/6 rounded-xl relative select-none">
          <div className="min-w-[750px] flex flex-col text-xs">
            {/* Headers */}
            <div className="flex bg-white/3 border-b border-white/6 font-bold text-text-secondary h-10 items-center">
              <div className="w-10 px-3 flex justify-center">
                <input
                  type="checkbox"
                  checked={selectedTaskIds.length > 0 && selectedTaskIds.length === project.tasks.length}
                  onChange={selectedTaskIds.length === project.tasks.length ? handleClearSelection : handleSelectAll}
                  className="w-3.5 h-3.5 rounded border-white/10 accent-accent cursor-pointer"
                />
              </div>
              <div className="w-44 px-4 truncate">Task</div>
              <div className="flex-1 px-4 truncate">Description</div>
              <div className="w-36 px-4 text-center">Schedule Date</div>
              <div className="w-36 px-4 text-center">Deadline</div>
              <div className="w-24 px-4 text-center">Priority</div>
              <div className="w-32 px-4 text-center">Status</div>
              <div className="w-24 px-4 text-center">Actions</div>
            </div>

            {/* List Body */}
            <div className="flex flex-col">
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-10 text-center text-text-muted gap-2 border border-dashed border-white/4 m-4 rounded-xl">
                  <i className="fa-solid fa-clipboard-list text-2xl opacity-15"></i>
                  <p>No tasks found matching current filters.</p>
                </div>
              ) : (
                filteredTasks.map(t => {
                  const isOverdue = t.deadline && t.deadline < todayStr && t.status !== 'done';
                  const isSelected = selectedTaskIds.includes(t.id);
                  return (
                    <div
                      key={t.id}
                      className={`flex border-b border-white/[0.04] h-12 items-center hover:bg-white/[0.02] transition-colors ${
                        isSelected ? 'bg-accent/10 border-accent/20' : ''
                      }`}
                    >
                      <div className="w-10 px-3 flex justify-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(t.id)}
                          className="w-3.5 h-3.5 rounded border-white/10 accent-accent cursor-pointer"
                        />
                      </div>
                      <div className="w-44 px-4 truncate font-semibold text-white flex items-center gap-1.5" title={t.title}>
                        <span className="truncate">{t.title}</span>
                        {t.urgent && <i className="fa-solid fa-fire text-red-400 text-[10px]" title="Urgent"></i>}
                        {t.important && <i className="fa-solid fa-star text-amber-400 text-[10px]" title="Important"></i>}
                      </div>
                      <div className="flex-1 px-4 truncate text-text-secondary" title={t.description}>
                        {t.description ? t.description : <span className="text-text-muted italic">None</span>}
                      </div>
                      <div className="w-36 px-4 text-center text-text-secondary">{formatDateTimeUS(t.scheduleDate) || '-'}</div>
                      <div className={`w-36 px-4 text-center ${isOverdue ? 'text-red-400 font-bold' : 'text-text-secondary'}`}>
                        {formatDateTimeUS(t.deadline) || '-'} {isOverdue && <i className="fa-solid fa-triangle-exclamation ml-1.5" title="Overdue"></i>}
                      </div>
                      <div className="w-24 px-4 flex items-center justify-center">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${
                          t.priority === 'high' ? 'bg-[#f43f5e]/12 text-[#fda4af] border border-[#f43f5e]/20' :
                          (t.priority === 'medium' ? 'bg-[#eab308]/12 text-[#fef08a] border border-[#eab308]/20' :
                          'bg-[#3b82f6]/12 text-[#bfdbfe] border border-[#3b82f6]/20')
                        }`}>{t.priority}</span>
                      </div>
                      <div className="w-32 px-4 flex items-center justify-center">
                        <select
                          value={t.status}
                          onChange={(e) => onTaskUpdate(t.id, { status: e.target.value })}
                          className="bg-black/25 border border-white/6 text-white px-2 py-1 rounded text-[11px] focus:outline-none focus:border-accent focus:bg-[#0d0e15] cursor-pointer"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                      <div className="w-24 px-4 flex items-center justify-center gap-2 text-text-muted">
                        <button
                          onClick={() => setNotesModalTask(t)}
                          className="hover:text-amber-400 cursor-pointer"
                          title="Task Notes"
                        >
                          <i className="fa-solid fa-comment-dots text-xs"></i>
                        </button>
                        <button
                          onClick={() => onEditTask(t)}
                          className="hover:text-white cursor-pointer"
                          title="Edit Task"
                        >
                          <i className="fa-solid fa-pen text-xs"></i>
                        </button>
                        <button
                          onClick={() => onDeleteTask(t.id)}
                          className="hover:text-red-400 cursor-pointer"
                          title="Delete Task"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Task Notes / Activity Log Modal */}
      {notesModalTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[#0f1016] border border-white/12 rounded-2xl w-full max-w-lg shadow-2xl p-6 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white font-heading flex items-center gap-2">
                  <i className="fa-solid fa-note-sticky text-amber-400"></i> Task Notes & Activity Log
                </h3>
                <p className="text-xs text-text-muted truncate max-w-xs">{notesModalTask.title}</p>
              </div>
              <button
                onClick={() => setNotesModalTask(null)}
                className="text-text-muted hover:text-white p-1 rounded hover:bg-white/10 cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-lg"></i>
              </button>
            </div>

            {/* Note Input */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Add note e.g. Blocked by design review — 2026-08-12..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                className="flex-1 bg-white/5 border border-white/10 text-white text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-accent"
              />
              <button
                onClick={handleAddNote}
                className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-xl cursor-pointer transition-all flex items-center gap-1"
              >
                <i className="fa-solid fa-plus text-[10px]"></i> Add Note
              </button>
            </div>

            {/* Notes List Audit Trail */}
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1 mt-2">
              {(!notesModalTask.notes || notesModalTask.notes.length === 0) ? (
                <div className="p-6 text-center text-xs text-text-muted border border-dashed border-white/6 rounded-xl">
                  No notes recorded yet. Add notes to build an audit trail!
                </div>
              ) : (
                notesModalTask.notes.map(note => (
                  <div key={note.id} className="bg-white/[0.03] border border-white/6 p-3 rounded-xl flex flex-col gap-1">
                    <p className="text-xs text-white leading-relaxed break-words">{note.text}</p>
                    <span className="text-[10px] text-text-muted flex items-center gap-1">
                      <i className="fa-solid fa-clock text-[9px]"></i> {formatDateTimeUS(note.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
