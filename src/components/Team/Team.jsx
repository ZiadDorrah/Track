import React, { useState, useEffect } from 'react';
import { useCurrentUser } from '../../context/CurrentUserContext.jsx';
import './Team.css';

export default function Team({ showToast }) {
  const { user, isManager, team, managers, refreshUser } = useCurrentUser();
  const [allReports, setAllReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeamData() {
      try {
        setLoading(true);
        const res = await fetch('/api/users/me/team/all');
        if (res.ok) {
          const data = await res.json();
          setAllReports(data);
        }
      } catch (err) {
        console.error('Failed to fetch recursive team:', err);
      } finally {
        setLoading(false);
      }
    }
    loadTeamData();
  }, []);

  return (
    <div className="animate-fade-in max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight flex items-center gap-3">
          <i className="fa-solid fa-users text-accent"></i> Team Directory & Reporting Structure
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Overview of direct reports, management links, and organizational hierarchy.
        </p>
      </div>

      {/* Managers & Profile Header Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Current User Card */}
        <div className="glass border border-white/8 p-6 flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent text-2xl font-bold font-heading shadow-[0_0_15px_var(--accent-glow)]">
            {(user?.displayName || user?.username || 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold font-heading text-white">{user?.displayName || user?.username}</h3>
              {user?.isAdmin && (
                <span className="text-[10px] uppercase font-bold bg-accent/20 text-accent border border-accent/30 px-2 py-0.5 rounded-full">
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary">{user?.jobTitle || 'Team Member'}</p>
            <p className="text-xs text-text-muted mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* Direct Managers Card */}
        <div className="glass border border-white/8 p-6 flex flex-col justify-center">
          <h4 className="text-xs uppercase font-bold tracking-wider text-text-muted mb-2 flex items-center gap-1.5">
            <i className="fa-solid fa-user-shield text-accent"></i> Reporting Manager(s)
          </h4>
          {managers && managers.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {managers.map(m => (
                <div key={m.id} className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-xl">
                  <div className="w-6 h-6 rounded-full bg-accent/30 text-accent text-xs font-bold flex items-center justify-center">
                    {(m.displayName || m.username).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-medium text-white">{m.displayName || m.username}</span>
                  <span className="text-[10px] text-text-muted">({m.jobTitle})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-text-muted italic">No direct managers assigned.</p>
          )}
        </div>
      </div>

      {/* Direct Reports Section */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold font-heading text-white flex items-center gap-2">
            <i className="fa-solid fa-user-group text-accent"></i> Direct Reports ({team.length})
          </h2>
        </div>

        {team.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {team.map(report => (
              <div key={report.id} className="glass border border-white/6 p-5 flex flex-col justify-between hover:border-white/16 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center text-white font-bold font-heading">
                    {(report.displayName || report.username).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold font-heading text-white">{report.displayName || report.username}</h4>
                    <p className="text-xs text-text-secondary">{report.jobTitle || 'Employee'}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-white/6 flex justify-between items-center">
                  <span className="text-[11px] text-text-muted font-mono">{report.email}</span>
                  <span className="text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                    Active
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass border border-white/6 p-8 text-center">
            <i className="fa-solid fa-user-slash text-4xl text-text-muted mb-3"></i>
            <h3 className="text-base font-semibold text-white">No Direct Reports</h3>
            <p className="text-xs text-text-secondary mt-1">You currently have no direct reports linked to your account.</p>
          </div>
        )}
      </div>

      {/* Skip-Level / All Recursive Reports Section */}
      {allReports.length > team.length && (
        <div>
          <h2 className="text-xl font-bold font-heading text-white mb-4 flex items-center gap-2">
            <i className="fa-solid fa-sitemap text-accent"></i> Extended Team Hierarchy ({allReports.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {allReports.map(rep => (
              <div key={rep.id} className="bg-black/20 border border-white/6 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-semibold text-white">{rep.displayName || rep.username}</h4>
                  <p className="text-[11px] text-text-muted">{rep.jobTitle}</p>
                </div>
                <span className="text-[10px] text-text-secondary bg-white/5 px-2 py-1 rounded-lg border border-white/8">
                  Report
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
