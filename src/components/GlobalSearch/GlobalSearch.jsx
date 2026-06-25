import React, { useState, useEffect, useRef } from 'react';

export default function GlobalSearch({ isOpen, onClose, projects, onSelectResult }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsContainerRef = useRef(null);

  // Focus input on mount
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  // Perform search matching
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const searchResults = [];

    projects.forEach(p => {
      // 1. Match project name/description
      const projectMatches = 
        p.name.toLowerCase().includes(q) || 
        (p.description && p.description.toLowerCase().includes(q));
      
      if (projectMatches) {
        searchResults.push({
          type: 'project',
          id: p.id,
          name: p.name,
          description: p.description,
          projectId: p.id
        });
      }

      // 2. Match tasks inside this project
      (p.tasks || []).forEach(t => {
        const taskMatches = 
          t.title.toLowerCase().includes(q) || 
          (t.description && t.description.toLowerCase().includes(q));
        
        if (taskMatches) {
          searchResults.push({
            type: 'task',
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            priority: t.priority,
            projectName: p.name,
            projectId: p.id,
            taskRaw: t
          });
        }
      });
    });

    setResults(searchResults.slice(0, 10)); // Limit to top 10 results
    setSelectedIndex(0);
  }, [query, projects]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length === 0 ? 0 : (prev + 1) % results.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (results.length === 0 ? 0 : (prev - 1 + results.length) % results.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[selectedIndex]) {
          triggerSelect(results[selectedIndex]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex, onClose]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (resultsContainerRef.current) {
      const selectedEl = resultsContainerRef.current.children[selectedIndex];
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const triggerSelect = (item) => {
    if (item.type === 'project') {
      onSelectResult(item.projectId, null);
    } else {
      onSelectResult(item.projectId, item.taskRaw);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-start justify-center p-4 pt-[10vh] animate-fade-in select-none">
      {/* Search box overlay wrapper */}
      <div className="w-full max-w-xl glass border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden">
        {/* Input area */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/6 bg-black/10">
          <i className="fa-solid fa-magnifying-glass text-text-muted text-sm"></i>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search projects, tasks, descriptions..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none placeholder-text-muted"
          />
          <span className="text-[10px] font-extrabold bg-white/5 border border-white/6 px-2 py-0.5 rounded text-text-muted select-none">
            ESC
          </span>
        </div>

        {/* Results Body */}
        <div className="max-h-[350px] overflow-y-auto p-2" ref={resultsContainerRef}>
          {query.trim() === '' ? (
            <div className="p-8 text-center text-text-muted text-xs">
              Type a title, description, or project name to begin...
            </div>
          ) : results.length === 0 ? (
            <div className="p-8 text-center text-text-muted text-xs">
              No matching workspace records found.
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={`${item.type}-${item.id}`}
                  onClick={() => triggerSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex justify-between items-center px-4 py-3 rounded-xl cursor-pointer transition-all ${
                    isSelected 
                      ? 'bg-accent/15 border border-accent/25 text-white' 
                      : 'border border-transparent text-text-secondary hover:bg-white/[0.015]'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden flex-1 pr-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-sm ${
                      item.type === 'project' 
                        ? 'bg-blue-500/10 text-blue-400' 
                        : 'bg-amber-500/10 text-amber-400'
                    }`}>
                      <i className={item.type === 'project' ? 'fa-solid fa-folder' : 'fa-solid fa-square-check'}></i>
                    </div>
                    
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      <span className="text-xs font-bold truncate">
                        {item.type === 'project' ? item.name : item.title}
                      </span>
                      <span className="text-[10px] text-text-muted truncate">
                        {item.type === 'project' 
                          ? (item.description || 'Project workspace') 
                          : `in ${item.projectName} — ${item.description || 'No description'}`}
                      </span>
                    </div>
                  </div>

                  {/* Status/Type Badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {item.type === 'task' ? (
                      <>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          item.status === 'done' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' :
                          (item.status === 'in-progress' ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' :
                          'bg-blue-500/10 text-blue-300 border border-blue-500/20')
                        }`}>
                          {item.status}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase ${
                          item.priority === 'high' ? 'bg-[#f43f5e]/12 text-[#fda4af] border border-[#f43f5e]/20' :
                          (item.priority === 'medium' ? 'bg-[#eab308]/12 text-[#fef08a] border border-[#eab308]/20' :
                          'bg-[#3b82f6]/12 text-[#bfdbfe] border border-[#3b82f6]/20')
                        }`}>
                          {item.priority}
                        </span>
                      </>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-blue-500/10 text-blue-300 border border-blue-500/20">
                        Workspace
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-white/6 bg-white/[0.01] flex items-center justify-between text-[9px] text-text-muted select-none">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="bg-white/5 border border-white/6 px-1 rounded mr-1">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="bg-white/5 border border-white/6 px-1 rounded mr-1">ENTER</kbd> Select
            </span>
          </div>
          <span>Ctrl + K to toggle</span>
        </div>
      </div>
    </div>
  );
}
