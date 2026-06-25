import React, { useState, useMemo } from 'react';
import './Analytics.css';

export default function Analytics({ projects }) {
  const [selectedProjectId, setSelectedProjectId] = useState('all');
  const [chartType, setChartType] = useState('velocity'); // 'velocity' or 'burndown'
  const [hoveredPoint, setHoveredPoint] = useState(null); // { x, y, date, value }

  // Generate date array for the last 14 days (including today)
  const last14Days = useMemo(() => {
    const dates = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      dates.push({
        dateStr: `${year}-${month}-${day}`, // YYYY-MM-DD
        label: `${month}/${day}`,           // MM/DD
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
        rawDate: new Date(year, d.getMonth(), d.getDate())
      });
    }
    return dates;
  }, []);

  // Filter tasks based on selected project
  const filteredTasks = useMemo(() => {
    let tasks = [];
    projects.forEach(p => {
      if (selectedProjectId === 'all' || p.id === selectedProjectId) {
        (p.tasks || []).forEach(t => {
          tasks.push({
            ...t,
            projectName: p.name,
            projectId: p.id
          });
        });
      }
    });
    return tasks;
  }, [projects, selectedProjectId]);

  // Calculate Velocity and Burndown datasets
  const chartData = useMemo(() => {
    return last14Days.map((day, index) => {
      const dayDate = day.rawDate;
      const dayStr = day.dateStr;

      // 1. Velocity: tasks completed exactly on this day
      const completedOnThisDay = filteredTasks.filter(t => {
        if (t.status !== 'done') return false;
        const compDateStr = t.completedAt ? t.completedAt.split('T')[0] : t.createdAt.split('T')[0];
        return compDateStr === dayStr;
      });

      // 2. Burndown: tasks that were created on or before this day, AND were not yet completed (or completed after this day)
      const remainingTasks = filteredTasks.filter(t => {
        const createdDate = new Date(t.createdAt.split('T')[0]);
        if (createdDate > dayDate) return false; // Not created yet

        if (t.status !== 'done') return true; // Pending today, so it was pending on day_d

        const completedDate = new Date(t.completedAt ? t.completedAt.split('T')[0] : t.createdAt.split('T')[0]);
        return completedDate > dayDate; // Completed in the future relative to day_d
      });

      return {
        ...day,
        velocity: completedOnThisDay.length,
        completedTaskNames: completedOnThisDay.map(t => t.title),
        burndown: remainingTasks.length
      };
    });
  }, [last14Days, filteredTasks]);

  // Chart layout dimensions
  const width = 600;
  const height = 280;
  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Max values for scaling
  const maxVelocity = Math.max(...chartData.map(d => d.velocity), 3);
  const maxBurndown = Math.max(...chartData.map(d => d.burndown), 3);

  // SVG Render Helpers
  const points = useMemo(() => {
    if (chartType !== 'burndown') return [];
    return chartData.map((d, i) => {
      const x = padding + (i / 13) * chartWidth;
      const y = padding + chartHeight - (d.burndown / maxBurndown) * chartHeight;
      return { x, y, date: d.label, value: d.burndown, dateStr: d.dateStr };
    });
  }, [chartData, chartType, maxBurndown, chartWidth, chartHeight]);

  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  }, [points]);

  const idealPathD = useMemo(() => {
    if (points.length === 0) return '';
    // Ideal burn line goes from initial burndown count at Day 1 down to 0 at Day 14
    const startX = points[0].x;
    const startY = padding + chartHeight - (chartData[0].burndown / maxBurndown) * chartHeight;
    const endX = points[13].x;
    const endY = padding + chartHeight; // 0 tasks remaining
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }, [points, chartData, maxBurndown, chartHeight]);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header Controls */}
      <div className="flex justify-between items-start gap-4 flex-wrap md:flex-nowrap">
        <div>
          <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight">Analytics & Visibility</h1>
          <p className="text-sm text-text-secondary mt-1">
            Track velocity trends and burndown schedules over the last 14 days.
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3.5 flex-wrap flex-shrink-0 mt-1 select-none">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="bg-black/25 border border-white/6 text-white px-3.5 py-1.5 rounded-lg text-xs focus:outline-none focus:border-accent cursor-pointer"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <div className="flex bg-white/4 p-0.5 border border-white/6 rounded-lg select-none">
            <button
              onClick={() => setChartType('velocity')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                chartType === 'velocity' ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-white'
              }`}
            >
              Velocity
            </button>
            <button
              onClick={() => setChartType('burndown')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                chartType === 'burndown' ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-white'
              }`}
            >
              Burndown
            </button>
          </div>
        </div>
      </div>

      {/* SVG Chart Panel */}
      <div className="glass border border-white/6 p-6 flex flex-col gap-4 relative">
        <h2 className="text-sm font-bold font-heading text-white select-none">
          {chartType === 'velocity' ? 'Velocity: Tasks Completed Per Day' : 'Burndown: Open Tasks Day-by-Day'}
        </h2>

        <div className="w-full relative flex items-center justify-center bg-black/10 rounded-xl py-4 overflow-x-auto">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-[600px] h-auto overflow-visible select-none">
            {/* Gridlines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
              const y = padding + ratio * chartHeight;
              const val = chartType === 'velocity'
                ? Math.round(maxVelocity * (1 - ratio))
                : Math.round(maxBurndown * (1 - ratio));

              return (
                <g key={index} className="opacity-30">
                  <line
                    x1={padding}
                    y1={y}
                    x2={width - padding}
                    y2={y}
                    stroke="rgba(255, 255, 255, 0.15)"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={padding - 10}
                    y={y + 4}
                    textAnchor="end"
                    fill="var(--text-muted)"
                    className="text-[9px] font-bold"
                  >
                    {val}
                  </text>
                </g>
              );
            })}

            {/* X Axis Labels */}
            {chartData.map((d, i) => {
              const x = padding + (i / 13) * chartWidth;
              return (
                <text
                  key={i}
                  x={x}
                  y={height - padding + 15}
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  className="text-[9px] font-bold opacity-75"
                >
                  {d.label}
                </text>
              );
            })}

            {/* Render Velocity Bars */}
            {chartType === 'velocity' && chartData.map((d, i) => {
              const barWidth = 14;
              const x = padding + (i / 13) * chartWidth - barWidth / 2;
              const barHeight = (d.velocity / maxVelocity) * chartHeight;
              const y = padding + chartHeight - barHeight;

              const isHovered = hoveredPoint && hoveredPoint.index === i;

              return (
                <g key={i}>
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={isHovered ? 'var(--accent)' : 'url(#barGrad)'}
                    rx="3"
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredPoint({
                      index: i,
                      x: x + barWidth / 2,
                      y,
                      date: d.label,
                      dateStr: d.dateStr,
                      value: `${d.velocity} completed`,
                      details: d.completedTaskNames
                    })}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />
                  {/* Glowing glow effect on hover */}
                  {isHovered && (
                    <rect
                      x={x - 2}
                      y={y - 2}
                      width={barWidth + 4}
                      height={barHeight + 4}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="1.5"
                      rx="4"
                      className="opacity-50 pointer-events-none"
                    />
                  )}
                </g>
              );
            })}

            {/* Render Burndown Lines */}
            {chartType === 'burndown' && (
              <>
                {/* Ideal Burn Dotted Line */}
                <path
                  d={idealPathD}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.25)"
                  strokeWidth="1.5"
                  strokeDasharray="5 5"
                />
                
                {/* Actual Burndown Solid Path */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shadow-lg"
                  style={{ filter: 'drop-shadow(0 0 6px var(--accent-glow))' }}
                />

                {/* Line Nodes */}
                {points.map((p, i) => {
                  const isHovered = hoveredPoint && hoveredPoint.index === i;
                  return (
                    <circle
                      key={i}
                      cx={p.x}
                      cy={p.y}
                      r={isHovered ? 6 : 4}
                      fill={isHovered ? '#fff' : 'var(--accent)'}
                      stroke={isHovered ? 'var(--accent)' : '#07080d'}
                      strokeWidth={isHovered ? 3 : 1.5}
                      className="transition-all duration-200 cursor-pointer"
                      onMouseEnter={() => setHoveredPoint({
                        index: i,
                        x: p.x,
                        y: p.y,
                        date: p.date,
                        dateStr: p.dateStr,
                        value: `${p.value} active tasks`
                      })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}
              </>
            )}

            {/* Definitions for gradients */}
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.4" />
              </linearGradient>
            </defs>
          </svg>

          {/* Premium Dynamic Tooltip Box */}
          {hoveredPoint && (
            <div
              className="absolute bg-[#0f111c]/95 border border-white/12 text-white p-3 rounded-xl shadow-2xl flex flex-col gap-1 pointer-events-none z-10 transition-all duration-100 max-w-[200px]"
              style={{
                left: `${(hoveredPoint.x / width) * 100}%`,
                top: `${(hoveredPoint.y / height) * 100 - 15}%`,
                transform: 'translate(-50%, -100%)'
              }}
            >
              <span className="text-[10px] font-bold text-text-muted">{new Date(hoveredPoint.dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
              <span className="text-xs font-extrabold text-white">{hoveredPoint.value}</span>
              {hoveredPoint.details && hoveredPoint.details.length > 0 && (
                <div className="flex flex-col gap-1 mt-1 border-t border-white/5 pt-1 max-h-20 overflow-y-auto">
                  {hoveredPoint.details.map((tName, i) => (
                    <span key={i} className="text-[9px] text-[#10b981] font-semibold truncate">✓ {tName}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
