import React, { useState, useEffect, useRef } from 'react';

const WORK_SECS = 25 * 60;
const BREAK_SECS = 5 * 60;

function formatCountdown(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function PomodoroTimer({ projects, onLogTime, showToast }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState('idle'); // idle | working | break | paused
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECS);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [sessionCount, setSessionCount] = useState(0);
  const intervalRef = useRef(null);
  const elapsedRef = useRef(0);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const selectedTask = selectedProject?.tasks?.find(t => t.id === selectedTaskId);

  useEffect(() => {
    if (mode === 'working' || mode === 'break') {
      intervalRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            if (mode === 'working') {
              finishWork();
            } else {
              finishBreak();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [mode]);

  const finishWork = () => {
    const elapsed = WORK_SECS - 0; // full session completed
    if (selectedTaskId && selectedProjectId) {
      onLogTime(selectedProjectId, selectedTaskId, WORK_SECS);
    }
    setSessionCount(c => c + 1);
    setMode('break');
    setSecondsLeft(BREAK_SECS);
    showToast('Focus session complete! Take a 5-minute break.', 'success', 8000);
  };

  const finishBreak = () => {
    setMode('idle');
    setSecondsLeft(WORK_SECS);
    showToast('Break over! Ready for the next session?', 'info');
  };

  const startTimer = () => {
    if (!selectedTaskId) {
      showToast('Select a task to focus on first.', 'warning');
      return;
    }
    elapsedRef.current = 0;
    setMode('working');
    setSecondsLeft(WORK_SECS);
  };

  const pauseTimer = () => {
    clearInterval(intervalRef.current);
    elapsedRef.current = WORK_SECS - secondsLeft;
    setMode('paused');
  };

  const resumeTimer = () => {
    setMode('working');
  };

  const stopTimer = () => {
    clearInterval(intervalRef.current);
    const elapsed = WORK_SECS - secondsLeft;
    if (elapsed > 30 && selectedTaskId && selectedProjectId) {
      onLogTime(selectedProjectId, selectedTaskId, elapsed);
      showToast(`Logged ${Math.round(elapsed / 60)}m to "${selectedTask?.title}".`, 'info');
    }
    setMode('idle');
    setSecondsLeft(WORK_SECS);
  };

  const skipBreak = () => {
    clearInterval(intervalRef.current);
    setMode('idle');
    setSecondsLeft(WORK_SECS);
  };

  const progressPct = mode === 'break'
    ? ((BREAK_SECS - secondsLeft) / BREAK_SECS) * 100
    : ((WORK_SECS - secondsLeft) / WORK_SECS) * 100;

  const isActive = mode === 'working' || mode === 'break';

  return (
    <div className="fixed bottom-6 left-6 z-40">
      {/* Collapsed Pill Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          title="Focus Timer (Pomodoro)"
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full shadow-lg transition-all cursor-pointer border ${
            mode === 'working'
              ? 'bg-accent border-accent/50 shadow-[0_0_20px_var(--accent-glow)]'
              : mode === 'break'
              ? 'bg-emerald-600/80 border-emerald-400/40 shadow-[0_0_18px_rgba(16,185,129,0.35)]'
              : mode === 'paused'
              ? 'bg-yellow-600/70 border-yellow-400/30'
              : 'bg-[#0f111c]/90 backdrop-blur-sm border-white/8 hover:border-white/16'
          }`}
        >
          <i className={`fa-solid ${
            mode === 'break' ? 'fa-mug-hot' : 'fa-stopwatch'
          } text-sm ${isActive || mode === 'paused' ? 'text-white' : 'text-text-muted'}`}></i>
          {isActive && (
            <span className="text-white text-xs font-bold font-heading tabular-nums">
              {formatCountdown(secondsLeft)}
            </span>
          )}
          {!isActive && mode !== 'paused' && (
            <span className="text-text-muted text-xs font-medium">Focus</span>
          )}
          {mode === 'paused' && (
            <span className="text-yellow-200 text-xs font-bold">Paused</span>
          )}
          {sessionCount > 0 && (
            <span className="text-[10px] bg-white/15 text-white border border-white/20 px-1.5 py-0.5 rounded-full font-bold">
              {sessionCount}
            </span>
          )}
        </button>
      )}

      {/* Expanded Panel */}
      {isOpen && (
        <div className="w-72 glass border border-white/10 rounded-2xl flex flex-col gap-0 shadow-2xl animate-fade-in overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center px-4 py-3.5 border-b border-white/6">
            <div className="flex items-center gap-2">
              <i className={`fa-solid fa-stopwatch text-sm ${
                mode === 'working' ? 'text-accent' : mode === 'break' ? 'text-emerald-400' : 'text-text-muted'
              }`}></i>
              <span className="text-sm font-bold font-heading text-white">Focus Timer</span>
              {sessionCount > 0 && (
                <span className="text-[10px] bg-accent/20 text-accent border border-accent/30 px-1.5 py-0.5 rounded-full font-bold">
                  {sessionCount} done
                </span>
              )}
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-text-muted hover:text-white text-xs cursor-pointer p-1"
            >
              <i className="fa-solid fa-minus"></i>
            </button>
          </div>

          <div className="px-4 py-4 flex flex-col gap-3.5">
            {/* Mode Badge */}
            <div className={`text-center text-[10px] font-bold uppercase tracking-widest py-1.5 rounded-lg ${
              mode === 'working' ? 'bg-accent/12 text-accent' :
              mode === 'break' ? 'bg-emerald-500/12 text-emerald-400' :
              mode === 'paused' ? 'bg-yellow-500/10 text-yellow-400' :
              'bg-white/3 text-text-muted'
            }`}>
              {mode === 'working' ? '● Focus Session' : mode === 'break' ? '☕ Break Time' : mode === 'paused' ? '⏸ Paused' : '○ Ready'}
            </div>

            {/* Countdown Ring + Number */}
            <div className="flex flex-col items-center gap-2">
              <div className={`text-4xl font-bold font-heading tabular-nums tracking-tight ${
                mode === 'working' ? 'text-white' : mode === 'break' ? 'text-emerald-400' : 'text-text-secondary'
              }`}>
                {formatCountdown(secondsLeft)}
              </div>
              {/* Progress Bar */}
              <div className="w-full h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    mode === 'break' ? 'bg-emerald-500' : 'bg-accent'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-[10px] text-text-muted">
                {mode === 'working' ? '25-min work session' : mode === 'break' ? '5-min break' : 'Select task & start'}
              </div>
            </div>

            {/* Task Selector (idle / paused) */}
            {(mode === 'idle' || mode === 'paused') && (
              <div className="flex flex-col gap-2">
                <select
                  value={selectedProjectId}
                  onChange={e => { setSelectedProjectId(e.target.value); setSelectedTaskId(''); }}
                  className="bg-black/20 border border-white/8 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-accent cursor-pointer"
                >
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {selectedProjectId && (
                  <select
                    value={selectedTaskId}
                    onChange={e => setSelectedTaskId(e.target.value)}
                    className="bg-black/20 border border-white/8 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-accent cursor-pointer"
                  >
                    <option value="">Select task...</option>
                    {(selectedProject?.tasks || [])
                      .filter(t => t.status !== 'done')
                      .map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))
                    }
                  </select>
                )}
              </div>
            )}

            {/* Active Task Card */}
            {selectedTask && (mode === 'working' || mode === 'paused') && (
              <div className="bg-white/3 border border-white/6 rounded-xl px-3 py-2.5">
                <div className="text-[10px] text-text-muted mb-1">Focused on</div>
                <div className="text-xs font-semibold text-white truncate">{selectedTask.title}</div>
                <div className="text-[10px] text-text-muted mt-0.5">{selectedProject?.name}</div>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              {mode === 'idle' && (
                <button
                  onClick={startTimer}
                  className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold font-heading rounded-xl transition-all cursor-pointer shadow-[0_4px_15px_var(--accent-glow)]"
                >
                  <i className="fa-solid fa-play mr-1.5 text-xs"></i> Start
                </button>
              )}
              {mode === 'working' && (
                <>
                  <button
                    onClick={pauseTimer}
                    className="flex-1 py-2.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-sm font-bold font-heading rounded-xl transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-pause mr-1.5 text-xs"></i> Pause
                  </button>
                  <button
                    onClick={stopTimer}
                    title="Stop & log partial time"
                    className="py-2.5 px-4 bg-red-500/12 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-sm font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-stop text-xs"></i>
                  </button>
                </>
              )}
              {mode === 'paused' && (
                <>
                  <button
                    onClick={resumeTimer}
                    className="flex-1 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-bold font-heading rounded-xl transition-all cursor-pointer shadow-[0_4px_15px_var(--accent-glow)]"
                  >
                    <i className="fa-solid fa-play mr-1.5 text-xs"></i> Resume
                  </button>
                  <button
                    onClick={stopTimer}
                    title="Stop & log partial time"
                    className="py-2.5 px-4 bg-red-500/12 hover:bg-red-500/20 border border-red-500/25 text-red-300 text-sm font-bold rounded-xl transition-all cursor-pointer"
                  >
                    <i className="fa-solid fa-stop text-xs"></i>
                  </button>
                </>
              )}
              {mode === 'break' && (
                <button
                  onClick={skipBreak}
                  className="flex-1 py-2.5 bg-white/6 hover:bg-white/10 border border-white/10 text-white text-sm font-bold font-heading rounded-xl transition-all cursor-pointer"
                >
                  <i className="fa-solid fa-forward-step mr-1.5 text-xs"></i> Skip Break
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
