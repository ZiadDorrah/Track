import React, { useState } from 'react';
import './PriorityMatrix.css';

export default function PriorityMatrix({ projects, onTaskUpdate, onTaskEdit }) {
  const [draggedOverQuadrant, setDraggedOverQuadrant] = useState(null); // 'q1', 'q2', 'q3', 'q4' or null

  // Flatten all active tasks with project context
  const activeTasks = [];
  projects.forEach(p => {
    (p.tasks || []).forEach(t => {
      if (t.status !== 'done') {
        activeTasks.push({
          ...t,
          projectId: p.id,
          projectName: p.name
        });
      }
    });
  });

  // Split tasks into quadrants
  const q1Tasks = activeTasks.filter(t => t.urgent && t.important);
  const q2Tasks = activeTasks.filter(t => !t.urgent && t.important);
  const q3Tasks = activeTasks.filter(t => t.urgent && !t.important);
  const q4Tasks = activeTasks.filter(t => !t.urgent && !t.important);

  const handleDragStart = (e, taskId, projectId) => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ taskId, projectId }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, quadrant) => {
    e.preventDefault();
    if (draggedOverQuadrant !== quadrant) {
      setDraggedOverQuadrant(quadrant);
    }
  };

  const handleDragLeave = () => {
    setDraggedOverQuadrant(null);
  };

  const handleDrop = (e, urgent, important) => {
    e.preventDefault();
    setDraggedOverQuadrant(null);
    try {
      const dataStr = e.dataTransfer.getData('text/plain');
      if (!dataStr) return;
      const { taskId, projectId } = JSON.parse(dataStr);
      onTaskUpdate(taskId, { urgent, important }, false, projectId);
    } catch (err) {
      console.error('Drop error', err);
    }
  };

  const renderTaskCard = (t) => {
    return (
      <div
        key={t.id}
        draggable
        onDragStart={(e) => handleDragStart(e, t.id, t.projectId)}
        className="matrix-task-card p-3 bg-[#0f111c]/60 border border-white/6 hover:border-white/15 rounded-lg flex flex-col gap-2 cursor-grab active:cursor-grabbing hover:-translate-y-[1px] transition-all"
      >
        <div className="flex justify-between items-start gap-2">
          <h4 className="text-xs font-semibold text-white leading-snug break-words flex-1 pr-1">{t.title}</h4>
          <button
            onClick={() => onTaskEdit(t, t.projectId)}
            className="text-[10px] text-text-muted hover:text-white p-0.5 rounded transition-colors cursor-pointer"
            title="Edit Task Details"
          >
            <i className="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
        {t.description && (
          <p className="text-[10px] text-text-secondary line-clamp-2 leading-relaxed break-words">{t.description}</p>
        )}
        <div className="flex justify-between items-center text-[9px] text-text-muted select-none mt-1">
          <span className="truncate max-w-[90px]" title={t.projectName}>
            <i className="fa-solid fa-diagram-project text-[8px] mr-1"></i> {t.projectName}
          </span>
          <span className={`px-1 rounded uppercase font-bold text-[8px] ${
            t.priority === 'high' ? 'text-[#fda4af]' :
            (t.priority === 'medium' ? 'text-[#fef08a]' : 'text-[#bfdbfe]')
          }`}>{t.priority}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight">Priority Matrix</h1>
        <p className="text-sm text-text-secondary mt-1">
          Eisenhower Matrix quadrant mapping. Drag and drop pending tasks between quadrants to adjust urgencies and importances.
        </p>
      </div>

      {/* 2x2 Eisenhower Quadrants Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mt-2">
        {/* Quadrant 1: Urgent & Important */}
        <div
          onDragOver={(e) => handleDragOver(e, 'q1')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, true, true)}
          className={`matrix-quadrant glass border p-5 flex flex-col gap-4 min-h-[300px] transition-all duration-200 ${
            draggedOverQuadrant === 'q1' 
              ? 'border-red-500/50 bg-red-500/[0.03] shadow-[0_0_20px_rgba(239,68,68,0.15)] scale-[1.01]' 
              : 'border-red-500/10 hover:border-red-500/20'
          }`}
        >
          <div className="flex justify-between items-center select-none pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-fire text-red-500 animate-pulse"></i>
              <span>Q1: Urgent & Important</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">
              {q1Tasks.length} {q1Tasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>
          
          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[350px] pr-1">
            {q1Tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted gap-2 border border-dashed border-red-500/10 rounded-lg min-h-[100px]">
                <i className="fa-solid fa-circle-check text-red-400/30 text-lg"></i>
                <p className="text-[10px]">No critical items pending. Awesome!</p>
              </div>
            ) : (
              q1Tasks.map(renderTaskCard)
            )}
          </div>
        </div>

        {/* Quadrant 2: Important but Not Urgent */}
        <div
          onDragOver={(e) => handleDragOver(e, 'q2')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, false, true)}
          className={`matrix-quadrant glass border p-5 flex flex-col gap-4 min-h-[300px] transition-all duration-200 ${
            draggedOverQuadrant === 'q2' 
              ? 'border-amber-500/50 bg-amber-500/[0.03] shadow-[0_0_20px_rgba(245,158,11,0.15)] scale-[1.01]' 
              : 'border-amber-500/10 hover:border-amber-500/20'
          }`}
        >
          <div className="flex justify-between items-center select-none pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-star text-amber-500"></i>
              <span>Q2: Important, Not Urgent</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">
              {q2Tasks.length} {q2Tasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[350px] pr-1">
            {q2Tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted gap-2 border border-dashed border-amber-500/10 rounded-lg min-h-[100px]">
                <i className="fa-solid fa-calendar-plus text-amber-400/30 text-lg"></i>
                <p className="text-[10px]">Schedule planning items here to stay ahead.</p>
              </div>
            ) : (
              q2Tasks.map(renderTaskCard)
            )}
          </div>
        </div>

        {/* Quadrant 3: Urgent but Not Important */}
        <div
          onDragOver={(e) => handleDragOver(e, 'q3')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, true, false)}
          className={`matrix-quadrant glass border p-5 flex flex-col gap-4 min-h-[300px] transition-all duration-200 ${
            draggedOverQuadrant === 'q3' 
              ? 'border-blue-500/50 bg-blue-500/[0.03] shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.01]' 
              : 'border-blue-500/10 hover:border-blue-500/20'
          }`}
        >
          <div className="flex justify-between items-center select-none pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-bolt text-blue-500"></i>
              <span>Q3: Urgent, Not Important</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">
              {q3Tasks.length} {q3Tasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[350px] pr-1">
            {q3Tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted gap-2 border border-dashed border-blue-500/10 rounded-lg min-h-[100px]">
                <i className="fa-solid fa-shuffle text-blue-400/30 text-lg"></i>
                <p className="text-[10px]">No urgent distractions. Focus on your goals!</p>
              </div>
            ) : (
              q3Tasks.map(renderTaskCard)
            )}
          </div>
        </div>

        {/* Quadrant 4: Not Urgent & Not Important */}
        <div
          onDragOver={(e) => handleDragOver(e, 'q4')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, false, false)}
          className={`matrix-quadrant glass border p-5 flex flex-col gap-4 min-h-[300px] transition-all duration-200 ${
            draggedOverQuadrant === 'q4' 
              ? 'border-white/20 bg-white/[0.02] shadow-[0_0_20px_rgba(255,255,255,0.05)] scale-[1.01]' 
              : 'border-white/5 hover:border-white/10'
          }`}
        >
          <div className="flex justify-between items-center select-none pb-2 border-b border-white/5">
            <h3 className="text-sm font-bold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-couch text-text-muted"></i>
              <span>Q4: Neither (Eliminate/Backlog)</span>
            </h3>
            <span className="text-[10px] font-extrabold bg-white/5 text-text-muted border border-white/8 px-2 py-0.5 rounded-full">
              {q4Tasks.length} {q4Tasks.length === 1 ? 'task' : 'tasks'}
            </span>
          </div>

          <div className="flex flex-col gap-2.5 overflow-y-auto max-h-[350px] pr-1">
            {q4Tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center text-text-muted gap-2 border border-dashed border-white/5 rounded-lg min-h-[100px]">
                <i className="fa-solid fa-folder-open text-text-muted/20 text-lg"></i>
                <p className="text-[10px]">No low-value backlogs here.</p>
              </div>
            ) : (
              q4Tasks.map(renderTaskCard)
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
