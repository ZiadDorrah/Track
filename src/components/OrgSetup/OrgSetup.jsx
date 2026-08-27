import React, { useState } from 'react';

export default function OrgSetup({ onComplete, showToast }) {
  const [step, setStep] = useState(1);
  const [orgName, setOrgName] = useState('');
  const [orgDescription, setOrgDescription] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminTitle, setAdminTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetup = async (e) => {
    e.preventDefault();
    if (!orgName.trim() || !adminUsername.trim() || !adminPassword.trim()) {
      showToast('All required fields must be filled.', 'error');
      return;
    }
    setLoading(true);
    try {
      const setupRes = await fetch('/api/org/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgName: orgName.trim(), orgDescription: orgDescription.trim(), adminUsername: adminUsername.trim(), adminPassword, adminTitle: adminTitle.trim() })
      });
      const setupData = await setupRes.json();
      if (!setupRes.ok) throw new Error(setupData.error || 'Setup failed.');

      // Auto-login as admin
      const loginRes = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername.trim(), password: adminPassword })
      });
      const loginData = await loginRes.json();
      if (!loginRes.ok) throw new Error(loginData.error || 'Login after setup failed.');

      showToast(`Welcome to ${orgName.trim()}! Organization created.`, 'success');
      onComplete(loginData.user);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-[#06070a]">
      {/* Background glows */}
      <div className="glow-bg pointer-events-none select-none">
        <div className="glow-sphere glow-sphere-1"></div>
        <div className="glow-sphere glow-sphere-2"></div>
      </div>

      <div className="glass border border-white/8 p-10 rounded-2xl max-w-lg w-full mx-4 shadow-2xl relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
            <i className="fa-solid fa-building-columns text-xl text-accent"></i>
          </div>
          <div>
            <h1 className="text-2xl font-extrabold font-heading text-white glow-text">Track. Enterprise</h1>
            <p className="text-xs text-text-muted mt-0.5">Set up your organization workspace</p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-8">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                step >= s ? 'bg-accent text-white shadow-[0_0_12px_var(--accent-glow)]' : 'bg-white/5 border border-white/10 text-text-muted'
              }`}>
                {step > s ? <i className="fa-solid fa-check text-[10px]"></i> : s}
              </div>
              <span className={`text-xs font-medium ${step >= s ? 'text-white' : 'text-text-muted'}`}>
                {s === 1 ? 'Organization' : 'Admin Account'}
              </span>
              {s < 2 && <div className={`h-px w-8 ${step > s ? 'bg-accent' : 'bg-white/10'}`}></div>}
            </div>
          ))}
        </div>

        <form onSubmit={step === 2 ? handleSetup : (e) => { e.preventDefault(); if (orgName.trim()) setStep(2); }}>
          {step === 1 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold font-heading text-white mb-1">Create Your Organization</h2>
                <p className="text-xs text-text-muted">Your team's central workspace for projects and tasks.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Organization Name <span className="text-accent">*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  placeholder="Acme Corp"
                  className="bg-black/20 border border-white/10 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-accent transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Description <span className="text-text-muted">(optional)</span></label>
                <input
                  type="text"
                  value={orgDescription}
                  onChange={e => setOrgDescription(e.target.value)}
                  placeholder="Brief description of your organization"
                  className="bg-black/20 border border-white/10 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-accent transition-all"
                />
              </div>

              <button
                type="submit"
                disabled={!orgName.trim()}
                className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-heading font-semibold rounded-xl text-sm transition-all mt-2 flex items-center justify-center gap-2 cursor-pointer"
              >
                Continue <i className="fa-solid fa-arrow-right text-xs"></i>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-lg font-bold font-heading text-white mb-1">Administrator Account</h2>
                <p className="text-xs text-text-muted">This account has full control over <strong className="text-white">{orgName}</strong>.</p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Username <span className="text-accent">*</span></label>
                <input
                  autoFocus
                  type="text"
                  value={adminUsername}
                  onChange={e => setAdminUsername(e.target.value)}
                  placeholder="admin"
                  className="bg-black/20 border border-white/10 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-accent transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Password <span className="text-accent">*</span></label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={e => setAdminPassword(e.target.value)}
                  placeholder="••••••••"
                  className="bg-black/20 border border-white/10 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-accent transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Job Title <span className="text-text-muted">(optional)</span></label>
                <input
                  type="text"
                  value={adminTitle}
                  onChange={e => setAdminTitle(e.target.value)}
                  placeholder="CEO, Director, Administrator..."
                  className="bg-black/20 border border-white/10 text-white px-4 py-3 rounded-xl text-sm focus:outline-none focus:border-accent transition-all"
                />
              </div>

              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setStep(1)} className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary hover:text-white rounded-xl text-sm font-semibold transition-all cursor-pointer">
                  <i className="fa-solid fa-arrow-left text-xs mr-1.5"></i> Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !adminUsername.trim() || !adminPassword.trim()}
                  className="flex-1 py-3 bg-accent hover:bg-accent-hover disabled:opacity-40 disabled:cursor-not-allowed text-white font-heading font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? <><i className="fa-solid fa-circle-notch animate-spin text-xs"></i> Creating...</> : <><i className="fa-solid fa-rocket text-xs"></i> Launch Organization</>}
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="text-center text-[11px] text-text-muted mt-6">
          <i className="fa-solid fa-shield-halved text-accent mr-1.5"></i>
          All data stored locally on this server — no cloud, no tracking.
        </p>
      </div>
    </div>
  );
}
