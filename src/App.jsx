import React, { useState, useEffect } from 'react';
import Auth from './components/Auth/Auth.jsx';
import Dashboard from './components/Dashboard/Dashboard.jsx';
import ProjectDetail from './components/ProjectDetail/ProjectDetail.jsx';
import Settings from './components/Settings/Settings.jsx';
import { ProjectModal, TaskModal } from './components/Modals/Modals.jsx';
import Pomodoro from './components/Pomodoro/Pomodoro.jsx';
import GlobalSearch from './components/GlobalSearch/GlobalSearch.jsx';
import PriorityMatrix from './components/PriorityMatrix/PriorityMatrix.jsx';
import WeeklyReview from './components/WeeklyReview/WeeklyReview.jsx';
import Analytics from './components/Analytics/Analytics.jsx';

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g,
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
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

export default function App() {
  // Authentication & Profile state
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Projects data
  const [projects, setProjects] = useState([]);
  
  // Navigation states
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [activeView, setActiveView] = useState('dashboard'); // dashboard, project-detail, settings
  const [selectedGanttProjects, setSelectedGanttProjects] = useState([]);

  // System Configurations
  const [startupEnabled, setStartupEnabled] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('track-theme') || 'violet');

  // Toasts notifications queue
  const [toasts, setToasts] = useState([]);

  // Modals visibility & data payload
  const [projectModal, setProjectModal] = useState({ isOpen: false, data: null });
  const [taskModal, setTaskModal] = useState({ isOpen: false, data: null });
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // notifiedTasks to prevent repeating notifications
  const [notifiedTasks, setNotifiedTasks] = useState(() => 
    JSON.parse(localStorage.getItem('track-notified-tasks') || '[]')
  );

  // Apply visual accent theme immediately when changed
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('track-theme', theme);
  }, [theme]);

  // Global Ctrl+K search hotkey listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auth session check on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Session check failed', err);
      } finally {
        setAuthLoading(false);
      }
    }
    checkSession();
  }, []);

  // Fetch Projects when user gets logged in
  useEffect(() => {
    if (user) {
      fetchProjects();
      loadStartupSetting();
    }
  }, [user]);

  // Alarms check loop
  useEffect(() => {
    if (!user || projects.length === 0) return;

    // Run check immediately
    checkTaskReminders();

    // Check every 60s
    const interval = setInterval(checkTaskReminders, 60000);
    return () => clearInterval(interval);
  }, [user, projects, notifiedTasks]);

  // Toast Notification handler
  const showToast = (message, type = 'info', duration = 4000) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      dismissToast(id);
    }, duration);
  };

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // REST API helpers
  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      if (!response.ok) {
        if (response.status === 401) {
          handleLogoutCleanup();
          throw new Error('Session expired. Please log in again.');
        }
        throw new Error('Failed to fetch projects.');
      }
      const data = await response.json();
      setProjects(data);

      // Sync selected Gantt projects
      setSelectedGanttProjects(prev => {
        if (prev.length === 0 && data.length > 0) {
          return data.map(p => p.id);
        } else {
          return prev.filter(id => data.some(p => p.id === id));
        }
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const loadStartupSetting = async () => {
    try {
      const response = await fetch('/api/settings/startup');
      if (response.ok) {
        const data = await response.json();
        setStartupEnabled(data.enabled);
      }
    } catch (err) {
      console.error('Failed to load startup boot configuration', err);
    }
  };

  const handleStartupToggle = async (enabled) => {
    try {
      const response = await fetch('/api/settings/startup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update boot setting.');
      setStartupEnabled(data.enabled);
      showToast(
        data.enabled
          ? 'Automatic Windows Startup enabled successfully! The app will boot with Windows.'
          : 'Automatic Windows Startup disabled.',
        'success'
      );
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      showToast('Logged out successfully.', 'success');
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      handleLogoutCleanup();
    }
  };

  const handleLogoutCleanup = () => {
    setUser(null);
    setProjects([]);
    setActiveProjectId(null);
    setActiveView('dashboard');
  };

  // Alarm checkers
  const checkTaskReminders = () => {
    const oneDayMs = 24 * 60 * 60 * 1000;
    const newNotified = [...notifiedTasks];
    let changed = false;

    projects.forEach(p => {
      (p.tasks || []).forEach(t => {
        if (t.reminder && t.status !== 'done' && t.deadline) {
          const deadlineMs = new Date(t.deadline).getTime();
          const diffTime = deadlineMs - Date.now();

          if (diffTime <= oneDayMs) {
            if (!newNotified.includes(t.id)) {
              let msg = `Task "${t.title}" is due soon! (Deadline: ${formatDateTimeUS(t.deadline)})`;
              let type = 'warning';

              if (diffTime < 0) {
                msg = `Task "${t.title}" in project "${p.name}" is OVERDUE!`;
                type = 'error';
              }

              showToast(msg, type, 12000);
              newNotified.push(t.id);
              changed = true;
            }
          }
        }
      });
    });

    if (changed) {
      setNotifiedTasks(newNotified);
      localStorage.setItem('track-notified-tasks', JSON.stringify(newNotified));
    }
  };

  // Projects CRUD Actions
  const handleProjectSubmit = async (payload) => {
    try {
      const isEdit = !!payload.id;
      const endpoint = isEdit ? `/api/projects/${payload.id}` : '/api/projects';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to save project.');

      showToast(isEdit ? 'Project updated successfully.' : 'New project workspace created!', 'success');
      setProjectModal({ isOpen: false, data: null });
      await fetchProjects();

      if (!isEdit) {
        setActiveProjectId(data.id);
        setActiveView('project-detail');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleProjectDelete = async (id) => {
    const currentProj = projects.find(p => p.id === id);
    if (!currentProj) return;

    if (window.confirm(`Are you absolutely sure you want to delete "${currentProj.name}"? This deletes all associated tasks and cannot be undone.`)) {
      try {
        const response = await fetch(`/api/projects/${id}`, { method: 'DELETE' });
        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Failed to delete project.');

        showToast('Project deleted.', 'success');
        setActiveProjectId(null);
        setActiveView('dashboard');
        await fetchProjects();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // Tasks CRUD Actions
  const handleTaskSubmit = async (payload) => {
    try {
      const isEdit = !!payload.id;
      const endpoint = isEdit 
        ? `/api/projects/${activeProjectId}/tasks/${payload.id}` 
        : `/api/projects/${activeProjectId}/tasks`;
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) throw new Error(data.error || 'Failed to save task.');

      showToast(isEdit ? 'Task updated successfully.' : 'Task created successfully.', 'success');
      setTaskModal({ isOpen: false, data: null });
      await fetchProjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleTaskDelete = async (taskId) => {
    if (window.confirm('Delete this task permanently?')) {
      try {
        const response = await fetch(`/api/projects/${activeProjectId}/tasks/${taskId}`, { method: 'DELETE' });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to delete task.');
        }
        showToast('Task deleted successfully.', 'success');
        await fetchProjects();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  const handleRecurringTaskGeneration = async (task, explicitProjectId = null) => {
    let projectId = explicitProjectId;
    if (!projectId) {
      const foundProj = projects.find(p => p.tasks.some(t => t.id === task.id));
      projectId = foundProj ? foundProj.id : activeProjectId;
    }

    const shiftDate = (dateStr, pattern) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;

      if (pattern === 'daily') {
        date.setDate(date.getDate() + 1);
      } else if (pattern === 'weekly') {
        date.setDate(date.getDate() + 7);
      } else if (pattern === 'monthly') {
        date.setMonth(date.getMonth() + 1);
      }
      
      const pad = (num) => String(num).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    const nextScheduleDate = shiftDate(task.scheduleDate, task.recurring);
    const nextDeadline = shiftDate(task.deadline, task.recurring);

    const clonedTask = {
      title: task.title,
      description: task.description || '',
      status: 'todo',
      priority: task.priority || 'medium',
      scheduleDate: nextScheduleDate,
      deadline: nextDeadline,
      reminder: task.reminder || false,
      recurring: task.recurring,
      subtasks: (task.subtasks || []).map(s => ({ ...s, completed: false })),
      timeLogged: 0,
      timeSessions: [],
      timerStarted: null,
      pomodoroSessions: []
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clonedTask),
      });
      if (response.ok) {
        showToast(`Recurring occurrence for "${task.title}" created!`, 'success');
      } else {
        console.error('Failed to auto-generate recurring task occurrence');
      }
    } catch (err) {
      console.error('Failed to auto-generate recurring task', err);
    }
  };

  const handleTaskUpdate = async (taskId, updatedFields, silent = false, explicitProjectId = null) => {
    let projectId = explicitProjectId || activeProjectId;
    let project = projects.find(p => p.id === projectId);
    
    if (!project || !project.tasks.some(t => t.id === taskId)) {
      project = projects.find(p => p.tasks.some(t => t.id === taskId));
      if (project) {
        projectId = project.id;
      }
    }
    
    if (!project) return;
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;

    const statusTransitionedToDone = updatedFields.status === 'done' && task.status !== 'done';
    const updatedTask = { ...task, ...updatedFields };

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update task.');
      }
      
      if (!silent) {
        showToast('Task updated successfully.', 'success');
      }

      if (statusTransitionedToDone && task.recurring && task.recurring !== 'none') {
        await handleRecurringTaskGeneration(task, projectId);
      }

      await fetchProjects();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleStartTimer = async (projectId, taskId) => {
    let activeTimerTask = null;
    let activeTimerProjectId = null;
    
    projects.forEach(p => {
      (p.tasks || []).forEach(t => {
        if (t.timerStarted && t.id !== taskId) {
          activeTimerTask = t;
          activeTimerProjectId = p.id;
        }
      });
    });

    if (activeTimerTask) {
      const now = Date.now();
      const startedTime = new Date(activeTimerTask.timerStarted).getTime();
      const elapsed = Math.max(0, Math.floor((now - startedTime) / 1000));
      
      const newSession = {
        id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
        startTime: activeTimerTask.timerStarted,
        endTime: new Date().toISOString(),
        duration: elapsed
      };

      const updatedOtherTask = {
        ...activeTimerTask,
        timerStarted: null,
        timeLogged: (activeTimerTask.timeLogged || 0) + elapsed,
        timeSessions: [...(activeTimerTask.timeSessions || []), newSession]
      };

      try {
        await fetch(`/api/projects/${activeTimerProjectId}/tasks/${activeTimerTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedOtherTask)
        });
        showToast(`Timer paused on "${activeTimerTask.title}"`, 'info');
      } catch (err) {
        console.error('Failed to auto-pause running timer on other task', err);
      }
    }

    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const tsk = proj.tasks.find(t => t.id === taskId);
    if (!tsk) return;

    const updatedTask = {
      ...tsk,
      timerStarted: new Date().toISOString()
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });
      if (response.ok) {
        showToast(`Timer started on "${tsk.title}"`, 'success');
        await fetchProjects();
      }
    } catch (err) {
      showToast('Failed to start timer.', 'error');
    }
  };

  const handleStopTimer = async (projectId, taskId) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    const tsk = proj.tasks.find(t => t.id === taskId);
    if (!tsk || !tsk.timerStarted) return;

    const now = Date.now();
    const startedTime = new Date(tsk.timerStarted).getTime();
    const elapsed = Math.max(0, Math.floor((now - startedTime) / 1000));
    
    const newSession = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
      startTime: tsk.timerStarted,
      endTime: new Date().toISOString(),
      duration: elapsed
    };

    const updatedTask = {
      ...tsk,
      timerStarted: null,
      timeLogged: (tsk.timeLogged || 0) + elapsed,
      timeSessions: [...(tsk.timeSessions || []), newSession]
    };

    try {
      const response = await fetch(`/api/projects/${projectId}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedTask),
      });
      if (response.ok) {
        showToast(`Logged ${Math.floor(elapsed / 60)}m ${elapsed % 60}s to "${tsk.title}"`, 'success');
        await fetchProjects();
      }
    } catch (err) {
      showToast('Failed to stop timer.', 'error');
    }
  };

  const handleSearchResultClick = (projectId, task = null) => {
    setActiveProjectId(projectId);
    setActiveView('project-detail');
    if (task) {
      setTaskModal({ isOpen: true, data: task });
    }
  };

  // Render Loader
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#07080d] text-white">
        <div className="flex flex-col items-center gap-3">
          <i className="fa-solid fa-cube text-4xl text-accent animate-spin glow-text"></i>
          <span className="text-sm font-semibold tracking-wide text-text-secondary select-none">Loading Workspace...</span>
        </div>
      </div>
    );
  }

  // Render Login state
  if (!user) {
    return (
      <>
        {/* Glow Spheres */}
        <div className="glow-bg">
          <div className="glow-sphere glow-sphere-1"></div>
          <div className="glow-sphere glow-sphere-2"></div>
          <div className="glow-sphere glow-sphere-3"></div>
        </div>
        
        {/* Toasts */}
        <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
          {toasts.map(t => (
            <div
              key={t.id}
              onClick={() => dismissToast(t.id)}
              className={`pointer-events-auto bg-[#0f111c]/85 backdrop-blur-md border border-white/6 p-4 rounded-xl shadow-[0_12px_40px_0_rgba(0,0,0,0.4)] flex items-center gap-3 text-white min-w-[300px] max-w-[400px] cursor-pointer transition-all duration-300 animate-slide-in-right ${
                t.type === 'success' ? 'border-l-4 border-l-[#10b981]' : 
                (t.type === 'error' ? 'border-l-4 border-l-[#f43f5e]' : 
                (t.type === 'warning' ? 'border-l-4 border-l-[#ea580c]' : 'border-l-4 border-l-[#3b82f6]'))
              }`}
            >
              <i className={`fa-solid text-sm ${
                t.type === 'success' ? 'fa-circle-check text-[#10b981]' : 
                (t.type === 'error' ? 'fa-circle-exclamation text-[#f43f5e]' : 
                (t.type === 'warning' ? 'fa-bell text-[#ea580c]' : 'fa-circle-info text-[#3b82f6]'))
              }`} />
              <div className="flex-1 text-xs font-medium leading-relaxed">{t.message}</div>
              <button className="text-text-muted hover:text-white transition-colors text-xs">
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          ))}
        </div>

        <Auth onLoginSuccess={(u) => setUser(u)} showToast={showToast} />
      </>
    );
  }

  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="min-h-screen grid grid-cols-1 md:grid-cols-[260px_1fr] relative">
      {/* Background Glows */}
      <div className="glow-bg">
        <div className="glow-sphere glow-sphere-1"></div>
        <div className="glow-sphere glow-sphere-2"></div>
        <div className="glow-sphere glow-sphere-3"></div>
      </div>

      {/* Toast notifications */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-3 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={`pointer-events-auto bg-[#0f111c]/85 backdrop-blur-md border border-white/6 p-4 rounded-xl shadow-[0_12px_40px_0_rgba(0,0,0,0.4)] flex items-center gap-3 text-white min-w-[300px] max-w-[400px] cursor-pointer transition-all duration-300 animate-slide-in-right ${
              t.type === 'success' ? 'border-l-4 border-l-[#10b981]' : 
              (t.type === 'error' ? 'border-l-4 border-l-[#f43f5e]' : 
              (t.type === 'warning' ? 'border-l-4 border-l-[#ea580c]' : 'border-l-4 border-l-[#3b82f6]'))
            }`}
          >
            <i className={`fa-solid text-sm ${
              t.type === 'success' ? 'fa-circle-check text-[#10b981]' : 
              (t.type === 'error' ? 'fa-circle-exclamation text-[#f43f5e]' : 
              (t.type === 'warning' ? 'fa-bell text-[#ea580c]' : 'fa-circle-info text-[#3b82f6]'))
            }`} />
            <div className="flex-1 text-xs font-medium leading-relaxed">{t.message}</div>
            <button className="text-text-muted hover:text-white transition-colors text-xs">
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>

      {/* Sidebar Navigation */}
      <aside className="h-screen sticky top-0 p-5 glass border-r border-white/6 flex flex-col gap-6 select-none bg-bg-dark/40 z-30">
        <div className="flex items-center gap-2.5 text-2xl font-bold font-heading">
          <i className="fa-solid fa-cube text-accent glow-text"></i>
          <span className="text-white glow-text">Track.</span>
        </div>

        {/* Global Search trigger bar */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="flex items-center justify-between px-3 py-2 bg-white/[0.02] border border-white/6 hover:bg-white/4 hover:border-white/12 rounded-xl text-left cursor-pointer transition-all duration-300"
          title="Search anything (Ctrl+K)"
        >
          <div className="flex items-center gap-2 text-text-muted text-xs">
            <i className="fa-solid fa-magnifying-glass text-[10px]"></i>
            <span>Search workspace...</span>
          </div>
          <span className="text-[9px] font-bold bg-white/5 border border-white/8 px-1.5 py-0.2 rounded text-text-muted select-none">
            Ctrl+K
          </span>
        </button>

        {/* Profile Card */}
        <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/6 rounded-xl relative">
          <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center text-accent text-lg">
            <i className="fa-solid fa-user-tie"></i>
          </div>
          <div className="flex flex-col overflow-hidden flex-1">
            <span className="text-sm font-semibold text-white truncate max-w-full" title={user.username}>{user.username}</span>
            <span className="text-[10px] text-text-muted font-medium">Local Workspace</span>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="text-text-muted hover:text-red-400 p-1.5 transition-colors cursor-pointer text-sm"
          >
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
          </button>
        </div>

        {/* Main Navigation Links */}
        <nav className="flex flex-col gap-1">
          <button
            onClick={() => { setActiveView('dashboard'); setActiveProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-heading font-medium transition-all text-left cursor-pointer ${
              activeView === 'dashboard'
                ? 'bg-accent text-white shadow-[0_4px_15px_var(--accent-glow)]'
                : 'text-text-secondary hover:text-white hover:bg-white/4'
            }`}
          >
            <i className="fa-solid fa-chart-line text-xs"></i> <span>Dashboard</span>
          </button>
          
          <button
            onClick={() => { setActiveView('priority-matrix'); setActiveProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-heading font-medium transition-all text-left cursor-pointer ${
              activeView === 'priority-matrix'
                ? 'bg-accent text-white shadow-[0_4px_15px_var(--accent-glow)]'
                : 'text-text-secondary hover:text-white hover:bg-white/4'
            }`}
          >
            <i className="fa-solid fa-table-cells text-xs"></i> <span>Priority Matrix</span>
          </button>

          <button
            onClick={() => { setActiveView('weekly-review'); setActiveProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-heading font-medium transition-all text-left cursor-pointer ${
              activeView === 'weekly-review'
                ? 'bg-accent text-white shadow-[0_4px_15px_var(--accent-glow)]'
                : 'text-text-secondary hover:text-white hover:bg-white/4'
            }`}
          >
            <i className="fa-solid fa-calendar-week text-xs"></i> <span>Weekly Review</span>
          </button>

          <button
            onClick={() => { setActiveView('analytics'); setActiveProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-heading font-medium transition-all text-left cursor-pointer ${
              activeView === 'analytics'
                ? 'bg-accent text-white shadow-[0_4px_15px_var(--accent-glow)]'
                : 'text-text-secondary hover:text-white hover:bg-white/4'
            }`}
          >
            <i className="fa-solid fa-chart-column text-xs"></i> <span>Analytics</span>
          </button>

          <button
            onClick={() => { setActiveView('settings'); setActiveProjectId(null); }}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-heading font-medium transition-all text-left cursor-pointer ${
              activeView === 'settings'
                ? 'bg-accent text-white shadow-[0_4px_15px_var(--accent-glow)]'
                : 'text-text-secondary hover:text-white hover:bg-white/4'
            }`}
          >
            <i className="fa-solid fa-sliders text-xs"></i> <span>Settings</span>
          </button>
        </nav>

        {/* Projects Sidebar Section */}
        <div className="flex flex-col gap-2.5 flex-1 overflow-hidden mt-2">
          <div className="flex justify-between items-center text-[10px] font-bold text-text-muted tracking-wider select-none px-1.5">
            <span>MY PROJECTS</span>
            <button
              onClick={() => setProjectModal({ isOpen: true, data: null })}
              className="text-text-secondary hover:text-white p-1 rounded hover:bg-white/4 cursor-pointer text-xs"
              title="New Project"
            >
              <i className="fa-solid fa-plus"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1">
            {projects.length === 0 ? (
              <div className="p-3 text-center text-[11px] text-text-muted">No active projects.</div>
            ) : (
              projects.map(p => {
                const pendingCount = (p.tasks || []).filter(t => t.status !== 'done').length;
                const isActive = activeView === 'project-detail' && activeProjectId === p.id;

                return (
                  <button
                    key={p.id}
                    onClick={() => { setActiveProjectId(p.id); setActiveView('project-detail'); }}
                    className={`w-full flex justify-between items-center px-3.5 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition-all text-left cursor-pointer truncate ${
                      isActive
                        ? 'bg-white/8 text-white border border-white/10'
                        : 'text-text-secondary hover:text-white hover:bg-white/[0.015]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1 pr-2">
                      <i className={`fa-solid fa-folder ${isActive ? 'text-accent' : 'text-text-muted'}`}></i>
                      <span className="truncate" title={p.name}>{p.name}</span>
                    </div>
                    {pendingCount > 0 && (
                      <span className="flex-shrink-0 px-1.5 py-0.5 rounded-full bg-accent/25 border border-accent/35 text-[9px] font-extrabold text-white text-center min-w-5">
                        {pendingCount}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </aside>

      {/* Main Container Content */}
      <main className="p-8 overflow-y-auto w-full max-w-full">
        {activeView === 'dashboard' && (
          <Dashboard
            projects={projects}
            onProjectSelect={(id) => { setActiveProjectId(id); setActiveView('project-detail'); }}
            onTaskEdit={(task, projId) => { setActiveProjectId(projId); setTaskModal({ isOpen: true, data: task }); }}
            onTaskUpdate={handleTaskUpdate}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            selectedGanttProjects={selectedGanttProjects}
            onSelectedGanttProjectsChange={setSelectedGanttProjects}
            escapeHTML={escapeHTML}
          />
        )}

        {activeView === 'priority-matrix' && (
          <PriorityMatrix
            projects={projects}
            onTaskUpdate={handleTaskUpdate}
            onTaskEdit={(task, projId) => { setActiveProjectId(projId); setTaskModal({ isOpen: true, data: task }); }}
          />
        )}

        {activeView === 'weekly-review' && (
          <WeeklyReview
            projects={projects}
            onTaskUpdate={handleTaskUpdate}
          />
        )}

        {activeView === 'analytics' && (
          <Analytics
            projects={projects}
          />
        )}

        {activeView === 'project-detail' && activeProject && (
          <ProjectDetail
            project={activeProject}
            onNavigate={(view) => { setActiveView(view); setActiveProjectId(null); }}
            onEditProject={(proj) => setProjectModal({ isOpen: true, data: proj })}
            onDeleteProject={handleProjectDelete}
            onAddTask={() => setTaskModal({ isOpen: true, data: null })}
            onEditTask={(task) => setTaskModal({ isOpen: true, data: task })}
            onDeleteTask={handleTaskDelete}
            onTaskUpdate={handleTaskUpdate}
            onStartTimer={handleStartTimer}
            onStopTimer={handleStopTimer}
            escapeHTML={escapeHTML}
          />
        )}

        {activeView === 'settings' && (
          <Settings
            startupEnabled={startupEnabled}
            onStartupToggle={handleStartupToggle}
            theme={theme}
            onThemeChange={setTheme}
          />
        )}
      </main>

      {/* Modal: Project create/modify */}
      <ProjectModal
        isOpen={projectModal.isOpen}
        onClose={() => setProjectModal({ isOpen: false, data: null })}
        project={projectModal.data}
        onSubmit={handleProjectSubmit}
        showToast={showToast}
      />

      {/* Modal: Task create/modify */}
      <TaskModal
        isOpen={taskModal.isOpen}
        onClose={() => setTaskModal({ isOpen: false, data: null })}
        task={taskModal.data}
        project={taskModal.data ? projects.find(p => p.tasks.some(t => t.id === taskModal.data.id)) : projects.find(p => p.id === activeProjectId)}
        onSubmit={handleTaskSubmit}
        showToast={showToast}
      />

      {/* Global Pomodoro Timer Widget */}
      <Pomodoro
        onTaskUpdate={handleTaskUpdate}
        showToast={showToast}
      />

      {/* Global Command Palette Search */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        projects={projects}
        onSelectResult={handleSearchResultClick}
      />
    </div>
  );
}
