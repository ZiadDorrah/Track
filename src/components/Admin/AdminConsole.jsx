import React, { useState, useEffect } from 'react';
import { useCurrentUser } from '../../context/CurrentUserContext.jsx';

export default function AdminConsole({ showToast }) {
  const { user: currentUser } = useCurrentUser();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [isProvisionOpen, setIsProvisionOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [managingLinkUser, setManagingLinkUser] = useState(null);

  // Form states - Provision User
  const [provisionForm, setProvisionForm] = useState({
    username: '',
    password: '',
    email: '',
    displayName: '',
    jobTitle: '',
    isAdmin: false,
    managerIds: []
  });

  // Form states - Edit User
  const [editForm, setEditForm] = useState({
    displayName: '',
    jobTitle: '',
    isAdmin: false,
    isActive: true
  });

  // Form state - Add Manager Link
  const [selectedManagerId, setSelectedManagerId] = useState('');

  // Fetch users on mount
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        throw new Error(`Failed to load users (${res.status})`);
      }
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      console.error('Fetch users error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // Handle Provision submit
  const handleProvisionSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provisionForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to provision user');

      showToast?.('User account provisioned successfully!', 'success');
      setIsProvisionOpen(false);
      setProvisionForm({
        username: '',
        password: '',
        email: '',
        displayName: '',
        jobTitle: '',
        isAdmin: false,
        managerIds: []
      });
      fetchUsers();
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  // Handle Edit submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update user');

      showToast?.('User account updated!', 'success');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  // Handle Add Manager Link
  const handleAddManagerLink = async (e) => {
    e.preventDefault();
    if (!managingLinkUser || !selectedManagerId) return;
    try {
      const res = await fetch('/api/admin/managers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId: selectedManagerId,
          employeeId: managingLinkUser.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add manager link');

      showToast?.('Manager link added!', 'success');
      const addedManagerId = selectedManagerId;
      setSelectedManagerId('');
      setManagingLinkUser(prev => prev ? {
        ...prev,
        managerIds: [...(prev.managerIds || []), addedManagerId]
      } : null);
      fetchUsers();
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  // Handle Remove Manager Link
  const handleRemoveManagerLink = async (managerId) => {
    if (!managingLinkUser) return;
    try {
      const res = await fetch('/api/admin/managers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          managerId,
          employeeId: managingLinkUser.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove manager link');

      showToast?.('Manager link removed', 'info');
      fetchUsers();
      // Update modal user reference
      setManagingLinkUser(prev => prev ? {
        ...prev,
        managerIds: prev.managerIds.filter(id => id !== managerId)
      } : null);
    } catch (err) {
      showToast?.(err.message, 'error');
    }
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setEditForm({
      displayName: u.displayName || '',
      jobTitle: u.jobTitle || '',
      isAdmin: u.isAdmin || false,
      isActive: u.isActive !== undefined ? u.isActive : true
    });
  };

  const getUserNameById = (id) => {
    const found = users.find(u => u.id === id);
    return found ? (found.displayName || found.username) : id;
  };

  // Compute Metrics
  const totalAccounts = users.length;
  const activeCount = users.filter(u => u.isActive).length;
  const adminCount = users.filter(u => u.isAdmin).length;
  const totalManagerLinks = users.reduce((acc, u) => acc + (u.managerIds?.length || 0), 0);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-bold font-heading text-white flex items-center gap-3">
            <i className="fa-solid fa-user-shield text-accent glow-text"></i>
            Admin Console
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Provision employee accounts, assign job titles, and manage organizational reporting lines.
          </p>
        </div>
        <button
          onClick={() => setIsProvisionOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-lg shadow-accent/20 cursor-pointer transition-all flex items-center gap-2"
        >
          <i className="fa-solid fa-user-plus text-xs"></i>
          Provision New User
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="glass border border-white/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/15 text-accent border border-accent/30 flex items-center justify-center text-xl">
            <i className="fa-solid fa-users"></i>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white leading-none mb-1">{totalAccounts}</h3>
            <p className="text-xs text-text-secondary font-medium">Total Accounts</p>
          </div>
        </div>

        <div className="glass border border-white/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl">
            <i className="fa-solid fa-user-check"></i>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white leading-none mb-1">{activeCount}</h3>
            <p className="text-xs text-text-secondary font-medium">Active Employees</p>
          </div>
        </div>

        <div className="glass border border-white/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center text-xl">
            <i className="fa-solid fa-shield-halved"></i>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white leading-none mb-1">{adminCount}</h3>
            <p className="text-xs text-text-secondary font-medium">System Admins</p>
          </div>
        </div>

        <div className="glass border border-white/10 p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xl">
            <i className="fa-solid fa-sitemap"></i>
          </div>
          <div>
            <h3 className="text-2xl font-extrabold text-white leading-none mb-1">{totalManagerLinks}</h3>
            <p className="text-xs text-text-secondary font-medium">Reporting Links</p>
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="glass border border-white/10 rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <i className="fa-solid fa-id-card text-accent"></i> Company User Directory
          </h2>
          <button
            onClick={fetchUsers}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary hover:text-white transition-all text-xs flex items-center gap-1.5"
            title="Refresh Directory"
          >
            <i className={`fa-solid fa-rotate-right ${loading ? 'animate-spin' : ''}`}></i>
            Refresh
          </button>
        </div>

        {error && (
          <div className="p-4 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {loading && users.length === 0 ? (
          <div className="py-12 text-center text-text-secondary text-sm flex items-center justify-center gap-2">
            <i className="fa-solid fa-spinner animate-spin"></i> Loading user directory...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-text-secondary font-semibold">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Job Title</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Managers</th>
                  <th className="py-3 px-4">Direct Reports</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    {/* User Identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center font-bold text-accent">
                          {u.displayName ? u.displayName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-white leading-tight">{u.displayName || u.username}</p>
                          <p className="text-[11px] text-text-secondary">@{u.username} • {u.email}</p>
                        </div>
                      </div>
                    </td>

                    {/* Job Title */}
                    <td className="py-3.5 px-4 font-medium text-text-secondary">
                      {u.jobTitle || '—'}
                    </td>

                    {/* Role Badge */}
                    <td className="py-3.5 px-4">
                      {u.isAdmin ? (
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-bold text-[10px] inline-flex items-center gap-1">
                          <i className="fa-solid fa-crown text-[9px]"></i> Admin
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30 font-semibold text-[10px]">
                          Member
                        </span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {u.isActive ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold text-[10px] inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 font-semibold text-[10px] inline-flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span> Deactivated
                        </span>
                      )}
                    </td>

                    {/* Managers list */}
                    <td className="py-3.5 px-4">
                      {u.managerIds && u.managerIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {u.managerIds.map(mId => (
                            <span key={mId} className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] text-text-secondary">
                              {getUserNameById(mId)}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-text-muted text-[11px]">None</span>
                      )}
                    </td>

                    {/* Direct reports list */}
                    <td className="py-3.5 px-4">
                      {u.employeeIds && u.employeeIds.length > 0 ? (
                        <span className="px-2 py-0.5 rounded bg-accent/10 border border-accent/20 text-[10px] text-accent font-bold">
                          {u.employeeIds.length} direct {u.employeeIds.length === 1 ? 'report' : 'reports'}
                        </span>
                      ) : (
                        <span className="text-text-muted text-[11px]">0</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setManagingLinkUser(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary hover:text-white transition-all text-[11px] font-semibold flex items-center gap-1"
                          title="Manage Reporting Links"
                        >
                          <i className="fa-solid fa-sitemap text-[10px]"></i> Managers
                        </button>
                        <button
                          onClick={() => openEditModal(u)}
                          className="px-2.5 py-1.5 rounded-lg bg-accent/15 hover:bg-accent/25 border border-accent/30 text-accent hover:text-white transition-all text-[11px] font-bold flex items-center gap-1"
                          title="Edit User"
                        >
                          <i className="fa-solid fa-pen-to-square text-[10px]"></i> Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision User Modal */}
      {isProvisionOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass border border-white/10 rounded-2xl w-full max-w-lg p-6 space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-user-plus text-accent"></i> Provision New User Account
              </h3>
              <button
                onClick={() => setIsProvisionOpen(false)}
                className="text-text-muted hover:text-white text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleProvisionSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={provisionForm.username}
                    onChange={e => setProvisionForm({ ...provisionForm, username: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent"
                    placeholder="e.g. jdoe"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={provisionForm.password}
                    onChange={e => setProvisionForm({ ...provisionForm, password: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent"
                    placeholder="Initial password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">Display Name</label>
                  <input
                    type="text"
                    value={provisionForm.displayName}
                    onChange={e => setProvisionForm({ ...provisionForm, displayName: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-semibold mb-1">Job Title</label>
                  <input
                    type="text"
                    value={provisionForm.jobTitle}
                    onChange={e => setProvisionForm({ ...provisionForm, jobTitle: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent"
                    placeholder="e.g. Senior Software Engineer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary font-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  value={provisionForm.email}
                  onChange={e => setProvisionForm({ ...provisionForm, email: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent"
                  placeholder="john.doe@company.local"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-semibold mb-1">Direct Manager(s)</label>
                <select
                  multiple
                  value={provisionForm.managerIds}
                  onChange={e => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setProvisionForm({ ...provisionForm, managerIds: selected });
                  }}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent h-24"
                >
                  {users.map(u => (
                    <option key={u.id} value={u.id} className="bg-bg-dark">
                      {u.displayName || u.username} ({u.jobTitle || 'No Title'})
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-text-muted mt-1 block">Hold Ctrl / Cmd to select multiple managers.</span>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="provisionIsAdmin"
                  checked={provisionForm.isAdmin}
                  onChange={e => setProvisionForm({ ...provisionForm, isAdmin: e.target.checked })}
                  className="rounded border-white/20 bg-white/5 text-accent focus:ring-0"
                />
                <label htmlFor="provisionIsAdmin" className="text-text-secondary font-semibold cursor-pointer">
                  Grant System Administrator Privileges
                </label>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setIsProvisionOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-lg shadow-accent/20"
                >
                  Provision User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-user-gear text-accent"></i> Edit @{editingUser.username}
              </h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-text-muted hover:text-white text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-text-secondary font-semibold mb-1">Display Name</label>
                <input
                  type="text"
                  value={editForm.displayName}
                  onChange={e => setEditForm({ ...editForm, displayName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-semibold mb-1">Job Title</label>
                <input
                  type="text"
                  value={editForm.jobTitle}
                  onChange={e => setEditForm({ ...editForm, jobTitle: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editIsAdmin"
                    checked={editForm.isAdmin}
                    disabled={editingUser.id === currentUser?.id}
                    onChange={e => setEditForm({ ...editForm, isAdmin: e.target.checked })}
                    className="rounded border-white/20 bg-white/5 text-accent focus:ring-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="editIsAdmin" className={`font-semibold ${editingUser.id === currentUser?.id ? 'text-text-muted cursor-not-allowed' : 'text-text-secondary cursor-pointer'}`}>
                    System Administrator Privileges
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="editIsActive"
                    checked={editForm.isActive}
                    disabled={editingUser.id === currentUser?.id}
                    onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                    className="rounded border-white/20 bg-white/5 text-emerald-400 focus:ring-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  />
                  <label htmlFor="editIsActive" className={`font-semibold ${editingUser.id === currentUser?.id ? 'text-text-muted cursor-not-allowed' : 'text-text-secondary cursor-pointer'}`}>
                    Active Account Status
                  </label>
                </div>

                {editingUser.id === currentUser?.id && (
                  <p className="text-[11px] text-amber-400/80 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-info"></i>
                    You can't change your own admin status or deactivate yourself. Ask another admin.
                  </p>
                )}
              </div>

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold shadow-lg shadow-accent/20"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Manager Links Modal */}
      {managingLinkUser && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass border border-white/10 rounded-2xl w-full max-w-md p-6 space-y-6 shadow-2xl animate-fade-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-sitemap text-accent"></i> Reporting Lines for {managingLinkUser.displayName || managingLinkUser.username}
              </h3>
              <button
                onClick={() => setManagingLinkUser(null)}
                className="text-text-muted hover:text-white text-sm"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Current Managers */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-text-secondary">Current Direct Managers</h4>
              {managingLinkUser.managerIds && managingLinkUser.managerIds.length > 0 ? (
                <div className="space-y-2">
                  {managingLinkUser.managerIds.map(mId => (
                    <div key={mId} className="flex justify-between items-center p-2.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                      <span className="font-semibold text-white">{getUserNameById(mId)}</span>
                      <button
                        onClick={() => handleRemoveManagerLink(mId)}
                        className="px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 text-[10px] font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-muted italic">No managers currently assigned.</p>
              )}
            </div>

            {/* Add Manager Form */}
            <form onSubmit={handleAddManagerLink} className="space-y-3 pt-4 border-t border-white/10">
              <label className="block text-xs font-bold text-text-secondary">Add New Direct Manager</label>
              <div className="flex gap-2">
                <select
                  value={selectedManagerId}
                  onChange={e => setSelectedManagerId(e.target.value)}
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
                >
                  <option value="">Select a manager...</option>
                  {users
                    .filter(u => u.id !== managingLinkUser.id && !managingLinkUser.managerIds?.includes(u.id))
                    .map(u => (
                      <option key={u.id} value={u.id} className="bg-bg-dark">
                        {u.displayName || u.username} ({u.jobTitle || 'No Title'})
                      </option>
                    ))}
                </select>
                <button
                  type="submit"
                  disabled={!selectedManagerId}
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-xs font-bold"
                >
                  Add Link
                </button>
              </div>
            </form>

            <div className="flex justify-end border-t border-white/10 pt-4 mt-6">
              <button
                type="button"
                onClick={() => setManagingLinkUser(null)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
