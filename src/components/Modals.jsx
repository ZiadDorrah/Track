import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './Modals.css';

function normalizeToDateTimeLocal(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('T')) {
    return dateStr.slice(0, 16);
  }
  return `${dateStr}T09:00`;
}

export function ProjectModal({ isOpen, onClose, project, onSubmit, showToast }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [url, setUrl] = useState('');
  const [github, setGithub] = useState('');

  useEffect(() => {
    if (project) {
      setName(project.name || '');
      setDesc(project.description || '');
      setUrl(project.url || '');
      setGithub(project.github || '');
    } else {
      setName('');
      setDesc('');
      setUrl('');
      setGithub('');
    }
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      showToast('Project name is required.', 'error');
      return;
    }
    onSubmit({
      id: project ? project.id : null,
      name: cleanName,
      description: desc.trim(),
      url: url.trim(),
      github: github.trim(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg glass border border-white/8 p-6 flex flex-col gap-5 relative animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold font-heading text-white">
            {project ? 'Edit Project Scope' : 'New Project Workspace'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-white cursor-pointer text-lg">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Portfolio Website"
              required
              className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows="3"
              placeholder="Describe the scope, goals, and key features..."
              className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-globe mr-1.5"></i> Live URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-brands fa-github mr-1.5"></i> GitHub Repository
              </label>
              <input
                type="url"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white/5 border border-white/6 hover:bg-white/10 hover:border-white/12 text-white font-heading font-medium text-sm rounded-lg transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-heading font-medium text-sm rounded-lg transition-all cursor-pointer shadow-[0_4px_15px_var(--accent-glow)] hover:shadow-[0_6px_20px_hsla(var(--accent-h),var(--accent-s),var(--accent-l),0.25)] hover:-translate-y-[1px]"
            >
              {project ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TaskModal({ isOpen, onClose, task, onSubmit, showToast }) {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [status, setStatus] = useState('todo');
  const [priority, setPriority] = useState('medium');
  const [scheduleDate, setScheduleDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [reminder, setReminder] = useState(false);
  const [recurring, setRecurring] = useState('none');
  const [subtasks, setSubtasks] = useState([]);
  const [newSubtaskText, setNewSubtaskText] = useState('');

  useEffect(() => {
    const pad = (num) => String(num).padStart(2, '0');
    const localNow = new Date();
    const todayStr = `${localNow.getFullYear()}-${pad(localNow.getMonth()+1)}-${pad(localNow.getDate())}T${pad(localNow.getHours())}:${pad(localNow.getMinutes())}`;

    if (task) {
      setTitle(task.title || '');
      setDesc(task.description || '');
      setStatus(task.status || 'todo');
      setPriority(task.priority || 'medium');
      setScheduleDate(normalizeToDateTimeLocal(task.scheduleDate));
      setDeadline(normalizeToDateTimeLocal(task.deadline));
      setReminder(task.reminder || false);
      setRecurring(task.recurring || 'none');
      setSubtasks(task.subtasks || []);
    } else {
      setTitle('');
      setDesc('');
      setStatus('todo');
      setPriority('medium');
      setScheduleDate(todayStr);
      setDeadline('');
      setReminder(false);
      setRecurring('none');
      setSubtasks([]);
    }
    setNewSubtaskText('');
  }, [task, isOpen]);

  if (!isOpen) return null;

  const addSubtask = () => {
    const text = newSubtaskText.trim();
    if (!text) return;
    setSubtasks(prev => [...prev, { id: uuidv4(), title: text, done: false }]);
    setNewSubtaskText('');
  };

  const toggleSubtask = (id) => {
    setSubtasks(prev => prev.map(s => s.id === id ? { ...s, done: !s.done } : s));
  };

  const removeSubtask = (id) => {
    setSubtasks(prev => prev.filter(s => s.id !== id));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      showToast('Task title is required.', 'error');
      return;
    }
    onSubmit({
      id: task ? task.id : null,
      title: cleanTitle,
      description: desc.trim(),
      status,
      priority,
      scheduleDate,
      deadline,
      reminder,
      recurring,
      subtasks,
    });
  };

  const doneCount = subtasks.filter(s => s.done).length;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl glass border border-white/8 flex flex-col relative animate-fade-in max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 pt-6 pb-4 border-b border-white/6 flex-shrink-0">
          <h2 className="text-xl font-bold font-heading text-white">
            {task ? 'Modify Task' : 'Create Task'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-white cursor-pointer text-lg">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="task-modal-form" onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-4 flex-1">
          {/* Title */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              Task Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design DB Schema"
              required
              className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows="2"
              placeholder="Details, context, or notes about this task..."
              className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35 resize-none"
            />
          </div>

          {/* Sub-tasks */}
          <div className="flex flex-col gap-2 p-3.5 bg-white/[0.015] border border-white/6 rounded-xl">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
                <i className="fa-solid fa-list-check text-accent/70"></i> Sub-tasks
              </label>
              {subtasks.length > 0 && (
                <span className="text-[11px] text-text-muted font-medium">
                  {doneCount}/{subtasks.length} done
                  <span className="inline-block w-16 h-1 bg-white/10 rounded-full ml-2 align-middle overflow-hidden">
                    <span
                      className="block h-full bg-accent rounded-full transition-all"
                      style={{ width: `${(doneCount / subtasks.length) * 100}%` }}
                    />
                  </span>
                </span>
              )}
            </div>

            {subtasks.length > 0 && (
              <div className="flex flex-col gap-1.5 max-h-32 overflow-y-auto pr-1">
                {subtasks.map(s => (
                  <div key={s.id} className="flex items-center gap-2 group">
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={() => toggleSubtask(s.id)}
                      className="w-3.5 h-3.5 accent-accent cursor-pointer flex-shrink-0"
                    />
                    <span className={`flex-1 text-xs leading-relaxed ${s.done ? 'line-through text-text-muted' : 'text-text-secondary'}`}>
                      {s.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeSubtask(s.id)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 text-[10px] cursor-pointer transition-all flex-shrink-0 ml-1"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                placeholder="Add a sub-task and press Enter..."
                className="flex-1 bg-black/20 border border-white/6 text-white px-3 py-1.5 rounded-lg text-xs transition-all focus:outline-none focus:border-accent focus:bg-black/35"
              />
              <button
                type="button"
                onClick={addSubtask}
                className="px-3 py-1.5 bg-white/5 border border-white/6 hover:bg-white/10 hover:border-white/12 text-white text-xs rounded-lg transition-all cursor-pointer flex-shrink-0"
              >
                <i className="fa-solid fa-plus"></i>
              </button>
            </div>
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-spinner mr-1.5"></i> Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:bg-[#0d0e15]"
              >
                <option value="todo">To Do</option>
                <option value="in-progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-circle-exclamation mr-1.5"></i> Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:bg-[#0d0e15]"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Schedule & Deadline */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-calendar mr-1.5"></i> Schedule Date & Time
              </label>
              <input
                type="datetime-local"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-[#0d0e15] cursor-pointer"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-calendar-check mr-1.5"></i> Deadline Date & Time
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-[#0d0e15] cursor-pointer"
              />
            </div>
          </div>

          {/* Recurring */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">
              <i className="fa-solid fa-rotate mr-1.5"></i> Recurring
            </label>
            <select
              value={recurring}
              onChange={(e) => setRecurring(e.target.value)}
              className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:bg-[#0d0e15]"
            >
              <option value="none">None — one-time task</option>
              <option value="daily">Daily — repeat every day</option>
              <option value="weekly">Weekly — repeat every 7 days</option>
              <option value="monthly">Monthly — repeat every 30 days</option>
            </select>
            {recurring !== 'none' && (
              <p className="text-[11px] text-text-muted ml-0.5">
                <i className="fa-solid fa-circle-info mr-1 text-accent/60"></i>
                When marked done, a new task will auto-appear with the next {recurring === 'daily' ? 'day' : recurring === 'weekly' ? 'week' : 'month'}'s dates.
              </p>
            )}
          </div>

          {/* Reminder */}
          <div className="flex flex-col gap-2 p-1.5 bg-white/[0.01] border border-white/4 rounded-lg">
            <label className="flex items-center gap-3 text-sm text-text-primary cursor-pointer select-none font-medium">
              <input
                type="checkbox"
                checked={reminder}
                onChange={(e) => setReminder(e.target.checked)}
                className="w-4 h-4 rounded border-white/10 accent-accent cursor-pointer"
              />
              Enable In-App Alarm Reminder
            </label>
            <span className="text-xs text-text-muted ml-7">
              Sends a glowing notification card 1 day before the deadline.
            </span>
          </div>
        </form>

        {/* Footer Buttons */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-white/6 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-white/5 border border-white/6 hover:bg-white/10 hover:border-white/12 text-white font-heading font-medium text-sm rounded-lg transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="task-modal-form"
            className="px-5 py-2.5 bg-accent hover:bg-accent-hover text-white font-heading font-medium text-sm rounded-lg transition-all cursor-pointer shadow-[0_4px_15px_var(--accent-glow)] hover:shadow-[0_6px_20px_hsla(var(--accent-h),var(--accent-s),var(--accent-l),0.25)] hover:-translate-y-[1px]"
          >
            {task ? 'Save Task' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}
