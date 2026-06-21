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
function TaskCard({ task, onEdit, onDelete, onStatusChange, todayStr, escapeHTML }) {
  const [menuActive, setMenuActive] = useState(false);
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

  const isOverdue = task.deadline && task.deadline < todayStr && task.status !== 'done';

  const formattedDeadline = formatDateTimeUS(task.deadline);
  const formattedSchedule = formatDateTimeUS(task.scheduleDate);

  return (
    <div className={`task-card p-4 relative bg-white/[0.015] border border-white/6 hover:border-white/12 hover:bg-white/[0.03] hover:-translate-y-[2px] rounded-xl flex flex-col gap-3 transition-all duration-300 ${
      task.priority === 'high' ? 'border-l-4 border-l-red-500' :
      (task.priority === 'medium' ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-blue-500')
    }`}>
      {/* Accent Strip */}
      <div className={`absolute top-0 left-0 w-full h-[3px] rounded-t-xl ${
        task.priority === 'high' ? 'bg-[#f43f5e]' : (task.priority === 'medium' ? 'bg-[#eab308]' : 'bg-[#3b82f6]')
      }`} />

      {/* Header */}
      <div className="flex justify-between items-start gap-2.5">
        <h4 className="text-sm font-semibold text-white font-heading leading-tight break-words flex-1 pr-1">{task.title}</h4>
        
        {/* Dropdown Actions */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuActive(!menuActive)}
            className="px-2 py-1 text-text-muted hover:text-white rounded hover:bg-white/5 transition-all text-xs cursor-pointer"
          >
            <i className="fa-solid fa-ellipsis-vertical"></i>
          </button>

          {menuActive && (
            <div className="absolute right-0 top-full mt-1 w-28 bg-[#0f1016]/95 border border-white/12 rounded-lg shadow-xl py-1 z-20 animate-fade-in">
              <button
                onClick={() => { onEdit(task); setMenuActive(false); }}
                className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-text-secondary hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-pen text-[9px]"></i> Edit
              </button>
              {task.status !== 'todo' && (
                <button
                  onClick={() => { onStatusChange(task.id, 'todo'); setMenuActive(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-text-secondary hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-circle-question text-[9px]"></i> To Do
                </button>
              )}
              {task.status !== 'in-progress' && (
                <button
                  onClick={() => { onStatusChange(task.id, 'in-progress'); setMenuActive(false); }}
                  className="w-full text-left px-3 py-1.5 hover:bg-white/5 text-text-secondary hover:text-white text-[11px] font-medium flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-spinner text-[9px]"></i> In Progress
                </button>
              )}
              {task.status !== 'done' && (
                <button
                  onClick={() => { onStatusChange(task.id, 'done'); setMenuActive(false); }}
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

      {/* Footer */}
      <div className="flex justify-between items-center mt-1 text-[10px] text-text-secondary">
        <div className="flex flex-col gap-1">
          {formattedSchedule && (
            <span className="flex items-center gap-1.5 text-text-muted">
              <i className="fa-solid fa-calendar" title="Scheduled Date"></i> {formattedSchedule}
            </span>
          )}
          {formattedDeadline && (
            <span className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-400 font-bold' : ''}`}>
              <i className="fa-solid fa-calendar-check" title="Deadline"></i> {formattedDeadline} {isOverdue && <b>(OVERDUE)</b>}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {task.reminder && <i className="fa-solid fa-bell text-accent animate-pulse" title="Alarm Enabled"></i>}
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
  onTaskStatusChange,
  escapeHTML,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [viewMode, setViewMode] = useState('kanban'); // kanban, list

  if (!project) return null;

  const todayStr = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

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
    <div className="flex flex-col gap-6 animate-fade-in">
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

          <div className="flex items-center gap-3.5 flex-wrap flex-shrink-0 mt-1">
            {project.url && (
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-white/5 border border-white/6 hover:bg-white/10 hover:border-white/12 text-white font-heading font-medium text-xs rounded-lg flex items-center gap-2 transition-all shadow-md"
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
                className="px-4 py-2 bg-white/5 border border-white/6 hover:bg-white/10 hover:border-white/12 text-white font-heading font-medium text-xs rounded-lg flex items-center gap-2 transition-all shadow-md"
                title="View Source"
              >
                <i className="fa-brands fa-github text-text-secondary"></i> <span>GitHub</span>
              </a>
            )}
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
        <div>
          <button
            onClick={onAddTask}
            className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-heading font-medium text-sm rounded-lg flex items-center gap-2 transition-all shadow-md cursor-pointer"
          >
            <i className="fa-solid fa-plus"></i> <span>New Task</span>
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

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* TO DO Column */}
          <div className="glass border border-white/6 p-5 flex flex-col gap-4 min-h-[400px]">
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
                  <p className="text-[11px]">Column is empty</p>
                </div>
              ) : (
                todoTasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onStatusChange={onTaskStatusChange}
                    todayStr={todayStr}
                    escapeHTML={escapeHTML}
                  />
                ))
              )}
            </div>
          </div>

          {/* IN PROGRESS Column */}
          <div className="glass border border-white/6 p-5 flex flex-col gap-4 min-h-[400px]">
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
                  <p className="text-[11px]">Column is empty</p>
                </div>
              ) : (
                progressTasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onStatusChange={onTaskStatusChange}
                    todayStr={todayStr}
                    escapeHTML={escapeHTML}
                  />
                ))
              )}
            </div>
          </div>

          {/* DONE Column */}
          <div className="glass border border-white/6 p-5 flex flex-col gap-4 min-h-[400px]">
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
                  <p className="text-[11px]">Column is empty</p>
                </div>
              ) : (
                doneTasks.map(t => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    onEdit={onEditTask}
                    onDelete={onDeleteTask}
                    onStatusChange={onTaskStatusChange}
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
              <div className="w-44 px-4 truncate">Task</div>
              <div className="flex-1 px-4 truncate">Description</div>
              <div className="w-36 px-4 text-center">Schedule Date</div>
              <div className="w-36 px-4 text-center">Deadline</div>
              <div className="w-24 px-4 text-center">Priority</div>
              <div className="w-32 px-4 text-center">Status</div>
              <div className="w-20 px-4 text-center">Actions</div>
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
                  return (
                    <div
                      key={t.id}
                      className="flex border-b border-white/[0.04] h-12 items-center hover:bg-white/[0.01] transition-colors"
                    >
                      <div className="w-44 px-4 truncate font-semibold text-white" title={t.title}>
                        {t.title}
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
                          onChange={(e) => onTaskStatusChange(t.id, e.target.value)}
                          className="bg-black/25 border border-white/6 text-white px-2 py-1 rounded text-[11px] focus:outline-none focus:border-accent focus:bg-[#0d0e15] cursor-pointer"
                        >
                          <option value="todo">To Do</option>
                          <option value="in-progress">In Progress</option>
                          <option value="done">Done</option>
                        </select>
                      </div>
                      <div className="w-20 px-4 flex items-center justify-center gap-2 text-text-muted">
                        <button
                          onClick={() => onEditTask(t)}
                          className="hover:text-white cursor-pointer"
                          title="Edit Task"
                        >
                          <i className="fa-solid fa-pen"></i>
                        </button>
                        <button
                          onClick={() => onDeleteTask(t.id)}
                          className="hover:text-red-400 cursor-pointer"
                          title="Delete Task"
                        >
                          <i className="fa-solid fa-trash-can"></i>
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
    </div>
  );
}
