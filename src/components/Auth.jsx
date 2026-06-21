import React, { useState } from 'react';
import './Auth.css';

export default function Auth({ onLoginSuccess, showToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authSubtitle, setAuthSubtitle] = useState('Manage all your projects & tasks in one elegant workspace.');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanUsername = username.trim();
    if (!cleanUsername || !password) {
      showToast('Username and password are required.', 'error');
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Something went wrong.');
      }

      showToast(data.message || (isLogin ? 'Login successful!' : 'Account registered successfully!'), 'success');

      if (isLogin) {
        onLoginSuccess(data.user);
      } else {
        // Switch back to login
        setIsLogin(true);
        setUsername('');
        setPassword('');
        setConfirmPassword('');
        setAuthSubtitle('Account created! Please sign in.');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <div className="w-full max-w-[450px] p-10 glass border border-white/8 auth-card">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 text-3xl font-bold font-heading mb-2">
            <i className="fa-solid fa-cube text-accent glow-text"></i>
            <span className="text-white glow-text">Track.</span>
          </div>
          <p className="text-sm text-text-secondary mt-1">{authSubtitle}</p>
        </div>

        {isLogin ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <h2 className="text-xl font-semibold font-heading text-white mb-2">Welcome Back</h2>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-user mr-1.5"></i> Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                className="bg-black/20 border border-white/6 text-white px-3.5 py-3 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-key mr-1.5"></i> Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="bg-black/20 border border-white/6 text-white px-3.5 py-3 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
              />
            </div>

            <button
              type="submit"
              className="mt-2 bg-accent hover:bg-accent-hover text-white py-3 rounded-lg font-heading font-medium text-sm transition-all cursor-pointer shadow-[0_4px_15px_var(--accent-glow)] hover:shadow-[0_6px_20px_hsla(var(--accent-h),var(--accent-s),var(--accent-l),0.25)] hover:-translate-y-[1px] flex items-center justify-center gap-2"
            >
              <span>Sign In</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>
            </button>

            <p className="text-xs text-text-muted text-center mt-2">
              Don't have an account?{' '}
              <span
                onClick={() => {
                  setIsLogin(false);
                  setUsername('');
                  setPassword('');
                  setAuthSubtitle('Manage all your projects & tasks in one elegant workspace.');
                }}
                className="text-accent cursor-pointer hover:underline"
              >
                Create Account
              </span>
            </p>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <h2 className="text-xl font-semibold font-heading text-white mb-2">Create Account</h2>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-user mr-1.5"></i> Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Choose a username"
                required
                className="bg-black/20 border border-white/6 text-white px-3.5 py-3 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-key mr-1.5"></i> Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a strong password"
                required
                className="bg-black/20 border border-white/6 text-white px-3.5 py-3 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-text-secondary">
                <i className="fa-solid fa-shield mr-1.5"></i> Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Verify password"
                required
                className="bg-black/20 border border-white/6 text-white px-3.5 py-3 rounded-lg text-sm transition-all focus:outline-none focus:border-accent focus:shadow-[0_0_12px_var(--accent-glow)] focus:bg-black/35"
              />
            </div>

            <button
              type="submit"
              className="mt-2 bg-accent hover:bg-accent-hover text-white py-3 rounded-lg font-heading font-medium text-sm transition-all cursor-pointer shadow-[0_4px_15px_var(--accent-glow)] hover:shadow-[0_6px_20px_hsla(var(--accent-h),var(--accent-s),var(--accent-l),0.25)] hover:-translate-y-[1px] flex items-center justify-center gap-2"
            >
              <span>Register Account</span> <i className="fa-solid fa-user-plus"></i>
            </button>

            <p className="text-xs text-text-muted text-center mt-2">
              Already have an account?{' '}
              <span
                onClick={() => {
                  setIsLogin(true);
                  setUsername('');
                  setPassword('');
                  setConfirmPassword('');
                  setAuthSubtitle('Manage all your projects & tasks in one elegant workspace.');
                }}
                className="text-accent cursor-pointer hover:underline"
              >
                Log In
              </span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
