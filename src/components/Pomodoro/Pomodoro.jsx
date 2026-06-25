import React, { useState, useEffect, useRef } from 'react';

// Premium synthesized audio chime
const playFocusChime = (isBreak) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Notes: C5 -> E5 -> G5 -> C6 for work completion, G5 -> E5 -> C5 for break completion
    const notes = isBreak ? [783.99, 659.25, 523.25] : [523.25, 659.25, 783.99, 1046.50];
    const duration = 0.15;
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * duration);
      
      gain.gain.setValueAtTime(0.15, ctx.currentTime + index * duration);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (index + 1) * duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + index * duration);
      osc.stop(ctx.currentTime + (index + 1) * duration);
    });
  } catch (e) {
    console.error('Audio chime failed', e);
  }
};

export default function Pomodoro({ onTaskUpdate, showToast }) {
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState('work'); // work, break
  const [activeTask, setActiveTask] = useState(null);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(true);

  const timerRef = useRef(null);

  // Listen to quick-focus trigger from Task Cards
  useEffect(() => {
    const handleStartFocus = (e) => {
      const { projectId, task } = e.detail;
      setActiveTask(task);
      setActiveProjectId(projectId);
      setMode('work');
      setTimeLeft(25 * 60);
      setIsActive(true);
      setIsMinimized(false);
      showToast(`Focus mode started: "${task.title}"`, 'success');
    };

    window.addEventListener('start-pomodoro-focus', handleStartFocus);
    return () => window.removeEventListener('start-pomodoro-focus', handleStartFocus);
  }, [showToast]);

  // Timer Tick Loop
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      handleSessionComplete();
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, timeLeft]);

  const handleSessionComplete = async () => {
    setIsActive(false);
    
    if (mode === 'work') {
      playFocusChime(false);
      showToast('Focus session complete! Time to take a break.', 'success');
      
      // Auto-log time to task
      if (activeTask && activeProjectId) {
        const durationSec = 25 * 60;
        const newSession = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 5),
          startTime: new Date(Date.now() - durationSec * 1000).toISOString(),
          endTime: new Date().toISOString(),
          duration: durationSec,
          isPomodoro: true
        };

        const updatedSessions = [...(activeTask.timeSessions || []), newSession];
        const updatedPomodoro = [...(activeTask.pomodoroSessions || []), {
          id: newSession.id,
          timestamp: newSession.endTime,
          duration: durationSec
        }];

        // Make API call via dispatch
        await onTaskUpdate(activeTask.id, {
          timeLogged: (activeTask.timeLogged || 0) + durationSec,
          timeSessions: updatedSessions,
          pomodoroSessions: updatedPomodoro
        }, true); // Silent update

        // Update local task reference
        setActiveTask(prev => ({
          ...prev,
          timeLogged: (prev.timeLogged || 0) + durationSec,
          timeSessions: updatedSessions,
          pomodoroSessions: updatedPomodoro
        }));
      }
      
      // Transition to break
      setMode('break');
      setTimeLeft(5 * 60);
    } else {
      // Break complete
      playFocusChime(true);
      showToast("Break's over! Get ready to focus.", 'info');
      setMode('work');
      setTimeLeft(25 * 60);
    }
  };

  const toggleStartPause = () => {
    setIsActive(!isActive);
  };

  const handleReset = () => {
    setIsActive(false);
    setTimeLeft(mode === 'work' ? 25 * 60 : 5 * 60);
  };

  const handleSkip = () => {
    setIsActive(false);
    if (mode === 'work') {
      setMode('break');
      setTimeLeft(5 * 60);
    } else {
      setMode('work');
      setTimeLeft(25 * 60);
    }
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // If minimized, render a small floating bubble
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-45 select-none">
        <button
          onClick={() => setIsMinimized(false)}
          className={`w-12 h-12 rounded-full border flex items-center justify-center text-white cursor-pointer transition-all duration-300 shadow-[0_4px_20px_rgba(0,0,0,0.5)] ${
            isActive 
              ? (mode === 'work' 
                  ? 'bg-amber-500 hover:bg-amber-600 border-amber-400/30 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.4)]' 
                  : 'bg-emerald-500 hover:bg-emerald-600 border-emerald-400/30 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.4)]')
              : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700'
          }`}
          title={isActive ? `Focus: ${formatTime(timeLeft)} (${mode})` : 'Open Pomodoro Focus Timer'}
        >
          {isActive ? (
            <span className="text-[10px] font-extrabold tracking-tighter">{formatTime(timeLeft)}</span>
          ) : (
            <i className="fa-solid fa-hourglass-half text-sm"></i>
          )}
        </button>
      </div>
    );
  }

  // Expanded panel
  return (
    <div className="fixed bottom-6 right-6 z-45 w-80 glass border border-white/10 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col gap-4 animate-fade-in text-white select-none">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/6 pb-2.5">
        <div className="flex items-center gap-2">
          <i className={`fa-solid fa-circle text-[8px] ${mode === 'work' ? 'text-amber-500 animate-pulse' : 'text-emerald-500 animate-pulse'}`}></i>
          <span className="text-xs font-bold tracking-wide uppercase text-text-secondary">
            {mode === 'work' ? 'Focus Session' : 'Short Break'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setIsMinimized(true)}
            className="text-text-muted hover:text-white p-1 hover:bg-white/5 rounded transition-all cursor-pointer text-xs"
            title="Minimize"
          >
            <i className="fa-solid fa-minus"></i>
          </button>
        </div>
      </div>

      {/* Timer View */}
      <div className="flex flex-col items-center gap-1 my-2">
        <h1 className="text-5xl font-extrabold tracking-tight font-heading tabular-nums glow-text">
          {formatTime(timeLeft)}
        </h1>
        <span className="text-[11px] text-text-muted font-medium mt-1">
          {isActive ? 'Running focus session...' : 'Timer paused'}
        </span>
      </div>

      {/* Task Linkage */}
      <div className="p-3 bg-white/[0.015] border border-white/5 rounded-xl flex flex-col gap-1">
        <span className="text-[9px] font-extrabold uppercase text-text-muted">FOCUSING ON</span>
        <span className="text-xs font-bold text-white truncate max-w-full">
          {activeTask ? activeTask.title : <span className="text-text-muted italic font-medium">Free study / General task</span>}
        </span>
        {activeTask && (
          <span className="text-[9px] text-text-secondary mt-0.5">
            Total Logged: {Math.round((activeTask.timeLogged || 0) / 60)}m | Focus Sessions: {activeTask.pomodoroSessions?.length || 0}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        <button
          onClick={toggleStartPause}
          className={`flex-1 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.15)] flex items-center justify-center gap-2 ${
            isActive 
              ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700' 
              : (mode === 'work' 
                  ? 'bg-amber-500 hover:bg-amber-600 text-white hover:shadow-[0_4px_15px_rgba(245,158,11,0.25)]' 
                  : 'bg-emerald-500 hover:bg-emerald-600 text-white hover:shadow-[0_4px_15px_rgba(16,185,129,0.25)]')
          }`}
        >
          <i className={`fa-solid fa-${isActive ? 'pause' : 'play'} text-[9px]`}></i>
          {isActive ? 'Pause' : 'Start Focus'}
        </button>
        <button
          onClick={handleReset}
          className="p-2 border border-white/6 hover:border-white/12 hover:bg-white/5 rounded-lg text-text-muted hover:text-white transition-all cursor-pointer"
          title="Reset Timer"
        >
          <i className="fa-solid fa-arrow-rotate-right text-xs"></i>
        </button>
        <button
          onClick={handleSkip}
          className="p-2 border border-white/6 hover:border-white/12 hover:bg-white/5 rounded-lg text-text-muted hover:text-white transition-all cursor-pointer"
          title="Skip Mode"
        >
          <i className="fa-solid fa-forward text-xs"></i>
        </button>
      </div>
    </div>
  );
}
