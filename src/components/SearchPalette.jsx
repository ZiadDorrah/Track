import React, { useState, useEffect, useRef } from 'react';

export default function SearchPalette({ isOpen, onClose, projects, onSelectProject, onSelectTask }) {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { onClose(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();
  const results = [];

  if (q) {
    projects.forEach(p => {
      if (p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)) {
        results.push({ type: 'project', project: p });
      }
      (p.tasks || []).forEach(t => {
        if (t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q)) {
          results.push({ type: 'task', task: t, project: p });
        }
      });
    });
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIdx]) {
      handleSelect(results[selectedIdx]);
    }
  };

  const handleSelect = (result) => {
    if (result.type === 'project') {
      onSelectProject(result.project.id);
    } else {
      onSelectTask(result.task, result.project.id);
    }
    onClose();
  };

  const statusColors = { todo: 'text-text-muted', 'in-progress': 'text-yellow-400', done: 'text-emerald-400' };
  const statusLabels = { todo: 'To Do', 'in-progress': 'In Progress', done: 'Done' };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl glass border border-white/10 rounded-2xl overflow-hidden shadow-2xl animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/6">
          <i className="fa-solid fa-magnifying-glass text-text-muted text-sm flex-shrink-0"></i>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search tasks and projects..."
            className="flex-1 bg-transparent text-white placeholder-text-muted text-sm focus:outline-none"
          />
          {query && (
            <button onClick={() => { setQuery(''); setSelectedIdx(0); inputRef.current?.focus(); }} className="text-text-muted hover:text-white text-xs cursor-pointer flex-shrink-0">
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
          <kbd className="text-[10px] text-text-muted border border-white/10 px-1.5 py-0.5 rounded font-mono flex-shrink-0">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {!q && (
            <div className="p-8 text-center">
              <i className="fa-solid fa-magnifying-glass text-2xl text-white/10 mb-3 block"></i>
              <p className="text-xs text-text-muted">Type to search across all projects and tasks</p>
              <div className="flex justify-center gap-4 mt-4 text-[11px] text-text-muted">
                {projects.length > 0 && (
                  <>
                    <span><i className="fa-solid fa-folder mr-1 text-accent/50"></i>{projects.length} project{projects.length !== 1 ? 's' : ''}</span>
                    <span><i className="fa-solid fa-list-check mr-1 text-accent/50"></i>{projects.reduce((n, p) => n + (p.tasks || []).length, 0)} tasks</span>
                  </>
                )}
              </div>
            </div>
          )}

          {q && results.length === 0 && (
            <div className="p-8 text-center">
              <i className="fa-solid fa-face-frown text-2xl text-white/10 mb-3 block"></i>
              <p className="text-xs text-text-muted">No results for <span className="text-text-secondary">"{query}"</span></p>
            </div>
          )}

          {results.length > 0 && (
            <div className="py-2">
              {results.map((r, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelect(r)}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors cursor-pointer border-l-2 ${
                    idx === selectedIdx
                      ? 'bg-accent/10 border-accent'
                      : 'border-transparent hover:bg-white/[0.025]'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs ${
                    r.type === 'project' ? 'bg-accent/20 text-accent' : 'bg-white/5 text-text-secondary'
                  }`}>
                    <i className={`fa-solid ${r.type === 'project' ? 'fa-folder' : 'fa-check-square'}`}></i>
                  </div>

                  <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                    <span className="text-sm font-medium text-white truncate">
                      {r.type === 'project' ? r.project.name : r.task.title}
                    </span>
                    <span className="text-[11px] text-text-muted truncate">
                      {r.type === 'project'
                        ? (r.project.description || 'Project workspace')
                        : <span>{r.project.name} <span className={`font-semibold ${statusColors[r.task.status]}`}>· {statusLabels[r.task.status]}</span></span>
                      }
                    </span>
                  </div>

                  {r.type === 'task' && (
                    <span className={`flex-shrink-0 text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                      r.task.priority === 'high' ? 'bg-red-500/12 text-red-300 border-red-500/20' :
                      r.task.priority === 'medium' ? 'bg-yellow-500/12 text-yellow-300 border-yellow-500/20' :
                      'bg-blue-500/12 text-blue-300 border-blue-500/20'
                    }`}>{r.task.priority}</span>
                  )}

                  {r.type === 'project' && (
                    <span className="flex-shrink-0 text-[10px] text-text-muted">
                      {(r.project.tasks || []).length} tasks
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/6 flex gap-5 text-[10px] text-text-muted select-none">
          <span><kbd className="border border-white/10 px-1 py-0.5 rounded font-mono mr-1">↑↓</kbd>navigate</span>
          <span><kbd className="border border-white/10 px-1 py-0.5 rounded font-mono mr-1">↵</kbd>open</span>
          <span><kbd className="border border-white/10 px-1 py-0.5 rounded font-mono mr-1">ESC</kbd>close</span>
        </div>
      </div>
    </div>
  );
}
