import React from 'react';
import GanttChart from '../GanttChart/GanttChart.jsx';
import './ProjectTimeline.css';

export default function ProjectTimeline({
  projects = [],
  selectedGanttProjects,
  onSelectedGanttProjectsChange,
  onTaskEdit,
  onTaskUpdate,
  showToast
}) {
  return (
    <div className="animate-fade-in w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight flex items-center gap-3">
          <i className="fa-solid fa-timeline text-accent"></i> Project Timelines & Schedule
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Interactive multi-project Gantt chart timeline. Filter project workspaces, toggle day/hour resolution, and edit schedule deadlines.
        </p>
      </div>

      <GanttChart
        projects={projects}
        selectedGanttProjects={selectedGanttProjects}
        onSelectedGanttProjectsChange={onSelectedGanttProjectsChange}
        onTaskSelect={(task, projId) => onTaskEdit(task, projId)}
        onTaskUpdate={onTaskUpdate}
      />
    </div>
  );
}
