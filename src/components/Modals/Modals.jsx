import React, { useState, useEffect } from 'react';
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
  }, [task, isOpen]);

  if (!isOpen) return null;

  const handleAddSubtask = () => {
    const text = newSubtaskText.trim();
    if (!text) return;
    const newSub = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      text,
      completed: false
    };
    setSubtasks([...subtasks, newSub]);
    setNewSubtaskText('');
  };

  const handleToggleSubtask = (id) => {
    setSubtasks(subtasks.map(s => s.id === id ? { ...s, completed: !s.completed } : s));
  };

  const handleRemoveSubtask = (id) => {
    setSubtasks(subtasks.filter(s => s.id !== id));
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

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl glass border border-white/8 p-6 flex flex-col gap-5 relative animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold font-heading text-white">
            {task ? 'Modify Task' : 'Create Task'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-white cursor-pointer text-lg">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-secondary">Description</label>
            <textarea
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              rows="2"
              placeholder="Details or checklist for this task..."
              className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35 resize-none"
            />
          </div>

          {/* Sub-tasks checklist section */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
              <i className="fa-solid fa-list-check text-accent"></i> Sub-tasks / Checklist
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newSubtaskText}
                onChange={(e) => setNewSubtaskText(e.target.value)}
                placeholder="Add a step-by-step item..."
                className="flex-1 bg-black/20 border border-white/6 text-white px-3 py-2 rounded-lg text-xs transition-all focus:outline-none focus:border-accent focus:bg-black/35"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleAddSubtask}
                className="px-3.5 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-semibold transition-all cursor-pointer"
              >
                Add
              </button>
            </div>
            {subtasks.length > 0 && (
              <div className="max-h-32 overflow-y-auto border border-white/6 rounded-lg bg-black/15 p-2 flex flex-col gap-1.5 mt-1 select-none">
                {subtasks.map((sub) => (
                  <div key={sub.id} className="flex justify-between items-center gap-2 px-2.5 py-1 rounded bg-white/[0.015] border border-white/4">
                    <label className="flex items-center gap-2 text-[11px] text-text-primary cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sub.completed}
                        onChange={() => handleToggleSubtask(sub.id)}
                        className="w-3.5 h-3.5 rounded border-white/10 accent-accent cursor-pointer"
                      />
                      <span className={sub.completed ? 'line-through text-text-muted' : ''}>{sub.text}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtask(sub.id)}
                      className="text-text-muted hover:text-red-400 p-0.5 transition-colors cursor-pointer text-xs"
                    >
                      <i className="fa-solid fa-xmark text-[10px]"></i>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-rotate mr-1.5"></i> Recurrence
              </label>
              <select
                value={recurring}
                onChange={(e) => setRecurring(e.target.value)}
                className="bg-black/20 border border-white/6 text-white px-3 py-2.5 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:bg-[#0d0e15]"
              >
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

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

          <div className="flex justify-end gap-3 mt-2">
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
              {task ? 'Save Task' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
