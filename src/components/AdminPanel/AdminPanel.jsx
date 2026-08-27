import React, { useState } from 'react';

const ROLE_META = {
  admin:    { label: 'Admin',    color: 'bg-red-500/20 border-red-500/40 text-red-300',    icon: 'fa-crown' },
  manager:  { label: 'Manager',  color: 'bg-blue-500/20 border-blue-500/40 text-blue-300',  icon: 'fa-user-tie' },
  employee: { label: 'Employee', color: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300', icon: 'fa-user' }
};

function RoleBadge({ role }) {
  const meta = ROLE_META[role] || ROLE_META.employee;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.color}`}>
      <i className={`fa-solid ${meta.icon} text-[8px]`}></i> {meta.label}
    </span>
  );
}

function MemberInitials({ username }) {
  const initials = username ? username.slice(0, 2).toUpperCase() : '??';
  return (
    <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center text-accent font-bold text-sm flex-shrink-0">
      {initials}
    </div>
  );
}

export default function AdminPanel({ org, currentUser, onMemberCreate, onMemberUpdate, onMemberDelete, showToast }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [search, setSearch] = useState('');

  // Add member form state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('employee');
  const [newTitle, setNewTitle] = useState('');
  const [newManagerIds, setNewManagerIds] = useState([]);
  const [addLoading, setAddLoading] = useState(false);

  // Edit member form state
  const [editRole, setEditRole] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editManagerIds, setEditManagerIds] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  if (!org) return null;

  const members = org.members || [];
  const managersAndAdmins = members.filter(m => m.role === 'manager' || m.role === 'admin');

  const filtered = members.filter(m =>
    m.username.toLowerCase().includes(search.toLowerCase()) ||
    (m.jobTitle || '').toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newUsername.trim() || !newPassword.trim()) return;
    setAddLoading(true);
    try {
      await onMemberCreate({ username: newUsername.trim(), password: newPassword, role: newRole, jobTitle: newTitle.trim(), managerIds: newManagerIds });
      setShowAddModal(false);
      setNewUsername(''); setNewPassword(''); setNewRole('employee'); setNewTitle(''); setNewManagerIds([]);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAddLoading(false);
    }
  };

  const openEdit = (member) => {
    setEditingMember(member);
    setEditRole(member.role || 'employee');
    setEditTitle(member.jobTitle || '');
    setEditManagerIds(member.managerIds || []);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      await onMemberUpdate(editingMember.id, { role: editRole, jobTitle: editTitle.trim(), managerIds: editManagerIds });
      setEditingMember(null);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setEditLoading(false);
    }
  };

  const toggleManagerId = (setter, current, id) => {
    setter(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold font-heading text-white tracking-tight">Admin Panel</h1>
        <p className="text-sm text-text-secondary mt-1">Manage your organization, members, roles, and reporting structures.</p>
      </div>

      {/* Org Info Card */}
      <div className="glass border border-white/6 p-6 rounded-2xl flex items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-accent/15 border border-accent/25 flex items-center justify-center flex-shrink-0">
          <i className="fa-solid fa-building-columns text-2xl text-accent"></i>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold font-heading text-white">{org.name}</h2>
          {org.description && <p className="text-sm text-text-secondary mt-0.5">{org.description}</p>}
          <div className="flex items-center gap-4 mt-3 text-xs text-text-muted">
            <span><i className="fa-solid fa-users mr-1.5 text-accent"></i>{members.length} members</span>
            <span><i className="fa-solid fa-calendar mr-1.5"></i>Since {new Date(org.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <div className="text-center px-4 py-2 bg-white/[0.02] border border-white/6 rounded-xl">
            <div className="text-xl font-bold text-white">{members.filter(m => m.role === 'admin').length}</div>
            <div className="text-[10px] text-text-muted">Admins</div>
          </div>
          <div className="text-center px-4 py-2 bg-white/[0.02] border border-white/6 rounded-xl">
            <div className="text-xl font-bold text-white">{members.filter(m => m.role === 'manager').length}</div>
            <div className="text-[10px] text-text-muted">Managers</div>
          </div>
          <div className="text-center px-4 py-2 bg-white/[0.02] border border-white/6 rounded-xl">
            <div className="text-xl font-bold text-white">{members.filter(m => m.role === 'employee').length}</div>
            <div className="text-[10px] text-text-muted">Employees</div>
          </div>
        </div>
      </div>

      {/* Members Section */}
      <div className="glass border border-white/6 p-6 rounded-2xl flex flex-col gap-4">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <h3 className="text-base font-bold font-heading text-white"><i className="fa-solid fa-users text-accent mr-2"></i>Team Members</h3>
          <div className="flex items-center gap-3">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-text-muted text-xs"></i>
              <input
                type="text"
                placeholder="Search members..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-black/20 border border-white/10 text-white pl-8 pr-3 py-1.5 rounded-lg text-xs focus:outline-none focus:border-accent transition-all w-44"
              />
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white font-semibold text-xs rounded-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <i className="fa-solid fa-user-plus"></i> Add Member
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-text-muted text-sm">No members found.</div>
          ) : (
            filtered.map(member => {
              const managerNames = (member.managerIds || []).map(mid => members.find(m => m.id === mid)?.username).filter(Boolean);
              const reports = members.filter(m => (m.managerIds || []).includes(member.id));
              return (
                <div key={member.id} className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/6 hover:border-white/10 rounded-xl transition-all group">
                  <MemberInitials username={member.username} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-white">{member.username}</span>
                      <RoleBadge role={member.role} />
                      {member.id === currentUser.id && (
                        <span className="text-[10px] text-text-muted bg-white/5 px-1.5 py-0.5 rounded">(you)</span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted mt-0.5 flex items-center gap-3 flex-wrap">
                      {member.jobTitle && <span><i className="fa-solid fa-briefcase text-[9px] mr-1"></i>{member.jobTitle}</span>}
                      {managerNames.length > 0 && (
                        <span><i className="fa-solid fa-sitemap text-[9px] mr-1"></i>Reports to: {managerNames.join(', ')}</span>
                      )}
                      {reports.length > 0 && (
                        <span><i className="fa-solid fa-users text-[9px] mr-1"></i>{reports.length} direct report{reports.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  {member.id !== currentUser.id && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(member)}
                        className="p-2 text-text-muted hover:text-white hover:bg-white/5 rounded-lg transition-all cursor-pointer text-xs"
                        title="Edit member"
                      >
                        <i className="fa-solid fa-pen-to-square"></i>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove ${member.username} from the organization?`)) onMemberDelete(member.id);
                        }}
                        className="p-2 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer text-xs"
                        title="Remove member"
                      >
                        <i className="fa-solid fa-user-minus"></i>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Org Hierarchy Visual */}
      <div className="glass border border-white/6 p-6 rounded-2xl">
        <h3 className="text-base font-bold font-heading text-white mb-4"><i className="fa-solid fa-diagram-project text-accent mr-2"></i>Reporting Structure</h3>
        <div className="flex flex-wrap gap-3">
          {members.filter(m => (m.managerIds || []).length === 0).map(root => (
            <HierarchyNode key={root.id} member={root} allMembers={members} depth={0} />
          ))}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass border border-white/10 p-7 rounded-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold font-heading text-white"><i className="fa-solid fa-user-plus text-accent mr-2"></i>Add Team Member</h3>
              <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-white p-1 rounded transition-colors cursor-pointer"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <form onSubmit={handleAdd} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Username *</label>
                <input autoFocus type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="john.doe" className="bg-black/20 border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-accent transition-all" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Password *</label>
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" className="bg-black/20 border border-white/10 text-white px-4 py-2.5 rounded-xl text-sm focus:outline-none focus:border-accent transition-all" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</label>
                  <select value={newRole} onChange={e => setNewRole(e.target.value)} className="bg-black/20 border border-white/10 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-accent cursor-pointer">
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Job Title</label>
                  <input type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Engineer..." className="bg-black/20 border border-white/10 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-accent transition-all" />
                </div>
              </div>
              {managersAndAdmins.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Reports To (Managers)</label>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {managersAndAdmins.map(m => (
                      <label key={m.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-white/3 p-1.5 rounded-lg transition-all">
                        <input type="checkbox" checked={newManagerIds.includes(m.id)} onChange={() => toggleManagerId(setNewManagerIds, newManagerIds, m.id)} className="accent-[var(--accent)]" />
                        <span className="text-sm text-white">{m.username}</span>
                        <RoleBadge role={m.role} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary rounded-xl text-sm font-semibold transition-all cursor-pointer">Cancel</button>
                <button type="submit" disabled={addLoading || !newUsername.trim() || !newPassword.trim()} className="flex-1 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2">
                  {addLoading ? <><i className="fa-solid fa-circle-notch animate-spin text-xs"></i> Adding...</> : <><i className="fa-solid fa-user-plus text-xs"></i> Add Member</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass border border-white/10 p-7 rounded-2xl w-full max-w-md">
            <div className="flex justify-between items-center mb-5">
              <div>
                <h3 className="text-lg font-bold font-heading text-white">Edit Member</h3>
                <p className="text-xs text-text-muted mt-0.5">{editingMember.username}</p>
              </div>
              <button onClick={() => setEditingMember(null)} className="text-text-muted hover:text-white p-1 rounded transition-colors cursor-pointer"><i className="fa-solid fa-xmark"></i></button>
            </div>
            <form onSubmit={handleEdit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Role</label>
                  <select value={editRole} onChange={e => setEditRole(e.target.value)} className="bg-black/20 border border-white/10 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-accent cursor-pointer">
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Job Title</label>
                  <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="Engineer..." className="bg-black/20 border border-white/10 text-white px-3 py-2.5 rounded-xl text-sm focus:outline-none focus:border-accent transition-all" />
                </div>
              </div>
              {managersAndAdmins.filter(m => m.id !== editingMember.id).length > 0 && (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Reports To</label>
                  <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                    {managersAndAdmins.filter(m => m.id !== editingMember.id).map(m => (
                      <label key={m.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-white/3 p-1.5 rounded-lg transition-all">
                        <input type="checkbox" checked={editManagerIds.includes(m.id)} onChange={() => toggleManagerId(setEditManagerIds, editManagerIds, m.id)} className="accent-[var(--accent)]" />
                        <span className="text-sm text-white">{m.username}</span>
                        <RoleBadge role={m.role} />
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setEditingMember(null)} className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-text-secondary rounded-xl text-sm font-semibold transition-all cursor-pointer">Cancel</button>
                <button type="submit" disabled={editLoading} className="flex-1 py-2.5 bg-accent hover:bg-accent-hover disabled:opacity-40 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2">
                  {editLoading ? <><i className="fa-solid fa-circle-notch animate-spin text-xs"></i> Saving...</> : <><i className="fa-solid fa-check text-xs"></i> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function HierarchyNode({ member, allMembers, depth }) {
  const directReports = allMembers.filter(m => (m.managerIds || []).includes(member.id));
  const meta = ROLE_META[member.role] || ROLE_META.employee;
  return (
    <div className={`flex flex-col gap-1 ${depth > 0 ? 'ml-5 border-l border-white/8 pl-3' : ''}`}>
      <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/[0.02] border border-white/6 text-xs`}>
        <i className={`fa-solid ${meta.icon} text-[9px] ${meta.color.split(' ').find(c => c.startsWith('text-'))}`}></i>
        <span className="text-white font-medium">{member.username}</span>
        {member.jobTitle && <span className="text-text-muted">· {member.jobTitle}</span>}
      </div>
      {directReports.map(r => <HierarchyNode key={r.id} member={r} allMembers={allMembers} depth={depth + 1} />)}
    </div>
  );
}
