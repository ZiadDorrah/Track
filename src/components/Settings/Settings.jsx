import React from 'react';
import './Settings.css';

export default function Settings({
  startupEnabled,
  onStartupToggle,
  theme,
  onThemeChange,
  themeMode = 'dark',
  onThemeModeChange,
  completionSound = true,
  onCompletionSoundChange
}) {
  const accents = [
    { id: 'violet', label: 'Violet', color: 'background: hsl(265, 89%, 65%);', bgClass: 'bg-[#8b5cf6]' },
    { id: 'teal', label: 'Teal', color: 'background: hsl(175, 89%, 50%);', bgClass: 'bg-[#14b8a6]' },
    { id: 'blue', label: 'Blue', color: 'background: hsl(210, 89%, 60%);', bgClass: 'bg-[#3b82f6]' },
    { id: 'rose', label: 'Rose', color: 'background: hsl(340, 89%, 60%);', bgClass: 'bg-[#f43f5e]' },
  ];

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight">System Settings</h1>
        <p className="text-sm text-text-secondary mt-1">Manage server configuration, sound feedback, theme appearance, and boot integration.</p>
      </div>

      <div className="glass border border-white/6 p-8 flex flex-col gap-6">
        
        {/* 🌗 Theme Mode (Dark / Light / System) */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-base font-semibold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-circle-half-stroke text-accent"></i> Appearance Theme Mode
            </h3>
            <p className="text-xs text-text-secondary mt-1 max-w-xl">
              Switch between Dark glassmorphism, clean Light mode, or follow system default settings.
            </p>
          </div>
          <div className="flex bg-white/5 border border-white/10 p-1 rounded-xl select-none">
            <button
              onClick={() => onThemeModeChange && onThemeModeChange('dark')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                themeMode === 'dark' ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-white'
              }`}
            >
              <i className="fa-solid fa-moon"></i> Dark
            </button>
            <button
              onClick={() => onThemeModeChange && onThemeModeChange('light')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                themeMode === 'light' ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-white'
              }`}
            >
              <i className="fa-solid fa-sun"></i> Light
            </button>
            <button
              onClick={() => onThemeModeChange && onThemeModeChange('system')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5 ${
                themeMode === 'system' ? 'bg-accent text-white shadow-md' : 'text-text-muted hover:text-white'
              }`}
            >
              <i className="fa-solid fa-desktop"></i> System
            </button>
          </div>
        </div>

        <hr className="border-t border-white/6" />

        {/* 🔔 Task Completion Sound Toggle */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-base font-semibold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-bell text-accent"></i> Completion Audio Chime
            </h3>
            <p className="text-xs text-text-secondary mt-1 max-w-xl">
              Play a short satisfying audio chime whenever a task is completed or moved to Done.
            </p>
          </div>
          <div className="flex-shrink-0">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={completionSound}
                onChange={(e) => onCompletionSoundChange && onCompletionSoundChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>
        </div>

        <hr className="border-t border-white/6" />

        {/* Windows Startup Configuration */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex-1">
            <h3 className="text-base font-semibold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-power-off text-accent"></i> Windows Startup Integration
            </h3>
            <p className="text-xs text-text-secondary mt-1 max-w-xl">
              Enable this to automatically boot the server and open the browser interface whenever your Windows computer turns on.
            </p>
          </div>
          <div className="flex-shrink-0">
            <label className="relative inline-flex items-center cursor-pointer select-none">
              <input
                type="checkbox"
                checked={startupEnabled}
                onChange={(e) => onStartupToggle(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent"></div>
            </label>
          </div>
        </div>

        <hr className="border-t border-white/6" />

        {/* Design Theme Accent picker */}
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-base font-semibold font-heading text-white flex items-center gap-2">
              <i className="fa-solid fa-palette text-accent"></i> Design Theme Accent
            </h3>
            <p className="text-xs text-text-secondary mt-1">Choose your workspace brand accent color.</p>
          </div>

          <div className="flex items-center gap-4 mt-1">
            {accents.map((acc) => (
              <button
                key={acc.id}
                onClick={() => onThemeChange(acc.id)}
                title={acc.label}
                className={`w-8 h-8 rounded-full cursor-pointer transition-all duration-300 relative border-2 ${
                  theme === acc.id ? 'border-white scale-110 shadow-[0_0_12px_rgba(255,255,255,0.4)]' : 'border-transparent hover:scale-105'
                }`}
              >
                <div className={`w-full h-full rounded-full ${acc.bgClass}`} />
              </button>
            ))}
          </div>
        </div>

        <hr className="border-t border-white/6" />

        {/* Local Storage details */}
        <div className="flex flex-col gap-2">
          <h3 className="text-base font-semibold font-heading text-white flex items-center gap-2">
            <i className="fa-solid fa-folder-open text-accent"></i> Local Storage Path
          </h3>
          <p className="text-xs text-text-secondary max-w-xl">
            All credentials and project files are stored locally in the server directory. To backup or export data, look in the folder below.
          </p>
          <code className="mt-1 bg-black/40 border border-white/6 text-accent px-3 py-2 rounded-lg text-xs font-mono select-all w-max max-w-full overflow-x-auto">
            d:\My_Web_Code\Track\data
          </code>
        </div>
      </div>
    </div>
  );
}
