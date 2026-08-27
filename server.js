const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist')));

// ─── Data Directory Setup ──────────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const ORGS_FILE  = path.join(DATA_DIR, 'organizations.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(ORGS_FILE))  fs.writeFileSync(ORGS_FILE,  JSON.stringify([], null, 2));

// ─── Session Store ─────────────────────────────────────
const sessions = {};

// ─── User Helpers ──────────────────────────────────────
function getUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); } catch { return []; }
}
function saveUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }

// ─── Per-User Personal Data ────────────────────────────
function getUserDataPath(userId) { return path.join(DATA_DIR, `user_${userId}.json`); }
function getUserData(userId) {
  const p = getUserDataPath(userId);
  if (!fs.existsSync(p)) {
    const d = { userId, projects: [], templates: [] };
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    return d;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { userId, projects: [], templates: [] }; }
}
function saveUserData(userId, data) { fs.writeFileSync(getUserDataPath(userId), JSON.stringify(data, null, 2)); }

// ─── Organization Data ─────────────────────────────────
function getOrganizations() {
  try { return JSON.parse(fs.readFileSync(ORGS_FILE, 'utf8')); } catch { return []; }
}
function saveOrganizations(orgs) { fs.writeFileSync(ORGS_FILE, JSON.stringify(orgs, null, 2)); }

function getOrgDataPath(orgId) { return path.join(DATA_DIR, `org_${orgId}.json`); }
function getOrgData(orgId) {
  const p = getOrgDataPath(orgId);
  if (!fs.existsSync(p)) {
    const d = { orgId, projects: [], templates: [] };
    fs.writeFileSync(p, JSON.stringify(d, null, 2));
    return d;
  }
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return { orgId, projects: [], templates: [] }; }
}
function saveOrgData(orgId, data) { fs.writeFileSync(getOrgDataPath(orgId), JSON.stringify(data, null, 2)); }

// ─── Org Membership Helpers ────────────────────────────
function getOrgMembers(orgId) {
  return getUsers().filter(u => u.orgId === orgId);
}

function getDirectReports(managerId, allOrgUsers) {
  return allOrgUsers.filter(u => Array.isArray(u.managerIds) && u.managerIds.includes(managerId));
}

function getAllReports(managerId, allOrgUsers, visited = new Set()) {
  if (visited.has(managerId)) return [];
  visited.add(managerId);
  const directs = getDirectReports(managerId, allOrgUsers);
  const all = [...directs];
  directs.forEach(d => all.push(...getAllReports(d.id, allOrgUsers, visited)));
  return all;
}

function canSeeTask(viewerUser, task, allOrgUsers) {
  if (!task.assignedTo) return true;
  if (task.assignedTo === viewerUser.id) return true;
  if (task.assignedBy === viewerUser.id) return true;
  if (viewerUser.role === 'admin') return true;
  if (viewerUser.role === 'manager') {
    const reports = getAllReports(viewerUser.id, allOrgUsers);
    return reports.some(r => r.id === task.assignedTo);
  }
  return false;
}

// ─── Project Storage Router ────────────────────────────
function getProjectStorage(user) {
  if (user.orgId) {
    return { getData: () => getOrgData(user.orgId), saveData: d => saveOrgData(user.orgId, d) };
  }
  return { getData: () => getUserData(user.id), saveData: d => saveUserData(user.id, d) };
}

// ─── Auth Helpers ──────────────────────────────────────
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex') === hash;
}

// ─── Authenticate Middleware ───────────────────────────
function authenticate(req, res, next) {
  const token = req.cookies.session_token;
  if (!token || !sessions[token]) return res.status(401).json({ error: 'Unauthorized. Please login.' });

  const session = sessions[token];
  if (Date.now() > session.expiresAt) {
    delete sessions[token];
    res.clearCookie('session_token');
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }

  const fullUser = getUsers().find(u => u.id === session.user.id);
  if (!fullUser) return res.status(401).json({ error: 'User account not found.' });

  req.user = {
    id: fullUser.id,
    username: fullUser.username,
    orgId: fullUser.orgId || null,
    role: fullUser.role || null,
    jobTitle: fullUser.jobTitle || '',
    managerIds: fullUser.managerIds || []
  };
  next();
}

// ─── Windows Startup Helpers ───────────────────────────
const startupScriptPath = path.join(
  process.env.APPDATA || '',
  'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'TaskTracker.vbs'
);
function getStartupStatus() {
  return !!(process.env.APPDATA && fs.existsSync(startupScriptPath));
}
function setStartupStatus(enabled) {
  if (!process.env.APPDATA) return;
  if (enabled) {
    const vbs = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.CurrentDirectory = "${process.cwd()}"\nWshShell.Run "cmd.exe /c npm start", 0, false\n`;
    fs.writeFileSync(startupScriptPath, vbs, 'utf8');
  } else if (fs.existsSync(startupScriptPath)) {
    fs.unlinkSync(startupScriptPath);
  }
}

// ═══════════════════════════════════════════════════════
// AUTH ENDPOINTS
// ═══════════════════════════════════════════════════════

app.post('/api/auth/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(400).json({ error: 'Username is already taken.' });
  const userId = uuidv4();
  const { salt, hash } = hashPassword(password);
  users.push({ id: userId, username, salt, passwordHash: hash, orgId: null, role: null, jobTitle: '', managerIds: [], createdAt: new Date().toISOString() });
  saveUsers(users);
  getUserData(userId);
  res.status(201).json({ message: 'User registered successfully!' });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !verifyPassword(password, user.salt, user.passwordHash))
    return res.status(401).json({ error: 'Invalid username or password.' });
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  sessions[sessionToken] = { user: { id: user.id, username: user.username }, expiresAt };
  res.cookie('session_token', sessionToken, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000, sameSite: 'strict', secure: false });
  res.json({
    message: 'Login successful!',
    user: { id: user.id, username: user.username, orgId: user.orgId || null, role: user.role || null, jobTitle: user.jobTitle || '', managerIds: user.managerIds || [] }
  });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.session_token;
  if (token) delete sessions[token];
  res.clearCookie('session_token');
  res.json({ message: 'Logged out successfully.' });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ═══════════════════════════════════════════════════════
// ORGANIZATION ENDPOINTS
// ═══════════════════════════════════════════════════════

// Public — check if initial org setup is required
app.get('/api/org/status', (req, res) => {
  const orgs = getOrganizations();
  res.json({ setupRequired: orgs.length === 0 });
});

// First-time org setup: creates org + admin account in one step
app.post('/api/org/setup', (req, res) => {
  const orgs = getOrganizations();
  if (orgs.length > 0) return res.status(400).json({ error: 'An organization already exists.' });
  const { orgName, orgDescription, adminUsername, adminPassword, adminTitle } = req.body;
  if (!orgName || !adminUsername || !adminPassword)
    return res.status(400).json({ error: 'Org name, admin username, and password are required.' });
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === adminUsername.toLowerCase()))
    return res.status(400).json({ error: 'Username already taken.' });
  const orgId = uuidv4();
  const adminId = uuidv4();
  const { salt, hash } = hashPassword(adminPassword);
  orgs.push({ id: orgId, name: orgName, description: orgDescription || '', adminId, createdAt: new Date().toISOString() });
  saveOrganizations(orgs);
  users.push({ id: adminId, username: adminUsername, salt, passwordHash: hash, orgId, role: 'admin', jobTitle: adminTitle || 'Administrator', managerIds: [], createdAt: new Date().toISOString() });
  saveUsers(users);
  getOrgData(orgId);
  res.status(201).json({ message: 'Organization created!', orgId });
});

// Get org info + full member directory
app.get('/api/org', authenticate, (req, res) => {
  if (!req.user.orgId) return res.status(404).json({ error: 'Not in an organization.' });
  const orgs = getOrganizations();
  const org = orgs.find(o => o.id === req.user.orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found.' });
  const members = getOrgMembers(req.user.orgId).map(u => ({
    id: u.id, username: u.username, role: u.role || 'employee',
    jobTitle: u.jobTitle || '', managerIds: u.managerIds || [], createdAt: u.createdAt
  }));
  res.json({ id: org.id, name: org.name, description: org.description, adminId: org.adminId, createdAt: org.createdAt, members });
});

// Create org member (admin only)
app.post('/api/org/members', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  const { username, password, role, jobTitle, managerIds } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  const users = getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase()))
    return res.status(400).json({ error: 'Username already taken.' });
  const { salt, hash } = hashPassword(password);
  const newUser = { id: uuidv4(), username, salt, passwordHash: hash, orgId: req.user.orgId, role: role || 'employee', jobTitle: jobTitle || '', managerIds: managerIds || [], createdAt: new Date().toISOString() };
  users.push(newUser);
  saveUsers(users);
  getUserData(newUser.id);
  res.status(201).json({ id: newUser.id, username: newUser.username, role: newUser.role, jobTitle: newUser.jobTitle, managerIds: newUser.managerIds });
});

// Update org member role/title/managers (admin only)
app.put('/api/org/members/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  const users = getUsers();
  const user = users.find(u => u.id === req.params.id && u.orgId === req.user.orgId);
  if (!user) return res.status(404).json({ error: 'Member not found.' });
  const { role, jobTitle, managerIds } = req.body;
  if (role !== undefined) user.role = role;
  if (jobTitle !== undefined) user.jobTitle = jobTitle;
  if (managerIds !== undefined) user.managerIds = managerIds;
  saveUsers(users);
  res.json({ id: user.id, username: user.username, role: user.role, jobTitle: user.jobTitle, managerIds: user.managerIds });
});

// Remove org member (admin only)
app.delete('/api/org/members/:id', authenticate, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required.' });
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot remove yourself.' });
  const users = getUsers();
  const idx = users.findIndex(u => u.id === req.params.id && u.orgId === req.user.orgId);
  if (idx === -1) return res.status(404).json({ error: 'Member not found.' });
  users.splice(idx, 1);
  saveUsers(users);
  res.json({ message: 'Member removed.' });
});

// ═══════════════════════════════════════════════════════
// PROJECT ENDPOINTS (org-aware)
// ═══════════════════════════════════════════════════════

app.get('/api/projects', authenticate, (req, res) => {
  const { getData } = getProjectStorage(req.user);
  const data = getData();
  if (req.user.orgId) {
    const allOrgUsers = getOrgMembers(req.user.orgId);
    const projects = (data.projects || []).map(p => ({
      ...p,
      tasks: (p.tasks || []).filter(t => canSeeTask(req.user, t, allOrgUsers))
    }));
    return res.json(projects);
  }
  res.json(data.projects || []);
});

app.post('/api/projects', authenticate, (req, res) => {
  const { name, description, url, github } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required.' });
  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  if (!data.projects) data.projects = [];
  const newProject = {
    id: uuidv4(), name, description: description || '', url: url || '', github: github || '',
    ownerId: req.user.id, members: [req.user.id], tasks: [], createdAt: new Date().toISOString()
  };
  data.projects.push(newProject);
  saveData(data);
  res.status(201).json(newProject);
});

app.put('/api/projects/:id', authenticate, (req, res) => {
  const { name, description, url, github } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required.' });
  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  const project = (data.projects || []).find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  Object.assign(project, { name, description: description || '', url: url || '', github: github || '' });
  saveData(data);
  res.json(project);
});

app.delete('/api/projects/:id', authenticate, (req, res) => {
  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  const before = (data.projects || []).length;
  data.projects = (data.projects || []).filter(p => p.id !== req.params.id);
  if (data.projects.length === before) return res.status(404).json({ error: 'Project not found.' });
  saveData(data);
  res.json({ message: 'Project deleted.' });
});

// ═══════════════════════════════════════════════════════
// TASK ENDPOINTS (org-aware, assignedTo/assignedBy)
// ═══════════════════════════════════════════════════════

function buildNewTask(body, creatorId, isOrg) {
  return {
    id: uuidv4(),
    title: body.title,
    description: body.description || '',
    status: body.status || 'todo',
    priority: body.priority || 'medium',
    deadline: body.deadline || '',
    scheduleDate: body.scheduleDate || '',
    reminder: body.reminder !== undefined ? body.reminder : false,
    assignedTo: isOrg ? (body.assignedTo || creatorId) : creatorId,
    assignedBy: creatorId,
    subtasks: body.subtasks || [],
    timeLogged: body.timeLogged || 0,
    timeSessions: body.timeSessions || [],
    timerStarted: body.timerStarted || null,
    recurring: body.recurring || 'none',
    pomodoroSessions: body.pomodoroSessions || [],
    notes: body.notes || [],
    customFields: body.customFields || {},
    urgent: body.urgent || false,
    important: body.important || false,
    completedAt: null,
    createdAt: new Date().toISOString()
  };
}

app.post('/api/projects/:projectId/tasks', authenticate, (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'Task title is required.' });

  if (req.user.orgId && req.body.assignedTo && req.body.assignedTo !== req.user.id) {
    if (req.user.role !== 'admin') {
      const allOrgUsers = getOrgMembers(req.user.orgId);
      const target = allOrgUsers.find(u => u.id === req.body.assignedTo);
      if (!target || !(target.managerIds || []).includes(req.user.id))
        return res.status(403).json({ error: 'You can only assign tasks to your direct reports.' });
    }
  }

  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  const project = (data.projects || []).find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });

  const newTask = buildNewTask(req.body, req.user.id, !!req.user.orgId);
  project.tasks.push(newTask);

  if (req.user.orgId && newTask.assignedTo && !(project.members || []).includes(newTask.assignedTo)) {
    project.members = [...(project.members || []), newTask.assignedTo];
  }

  saveData(data);
  res.status(201).json(newTask);
});

app.put('/api/projects/:projectId/tasks/:taskId', authenticate, (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'Task title is required.' });

  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  const project = (data.projects || []).find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const task = (project.tasks || []).find(t => t.id === req.params.taskId);
  if (!task) return res.status(404).json({ error: 'Task not found.' });

  if (req.user.orgId && req.user.role === 'employee' && task.assignedTo !== req.user.id)
    return res.status(403).json({ error: 'You can only edit your own tasks.' });

  const { title, description, status, priority, deadline, scheduleDate, reminder } = req.body;
  task.title = title;
  task.description = description || '';
  task.status = status || 'todo';
  task.priority = priority || 'medium';
  task.deadline = deadline || '';
  task.scheduleDate = scheduleDate || '';
  task.reminder = reminder !== undefined ? reminder : false;

  if (status === 'done' && !task.completedAt) task.completedAt = new Date().toISOString();
  if (status !== 'done') task.completedAt = null;

  ['subtasks', 'timeLogged', 'timeSessions', 'timerStarted', 'recurring', 'pomodoroSessions',
    'urgent', 'important', 'customFields', 'notes', 'completedAt'].forEach(k => {
    if (req.body[k] !== undefined) task[k] = req.body[k];
  });

  saveData(data);
  res.json(task);
});

app.delete('/api/projects/:projectId/tasks/:taskId', authenticate, (req, res) => {
  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  const project = (data.projects || []).find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const before = (project.tasks || []).length;
  project.tasks = (project.tasks || []).filter(t => t.id !== req.params.taskId);
  if (project.tasks.length === before) return res.status(404).json({ error: 'Task not found.' });
  saveData(data);
  res.json({ message: 'Task deleted.' });
});

app.post('/api/projects/:projectId/tasks/bulk', authenticate, (req, res) => {
  const { taskIds, action, value } = req.body;
  if (!Array.isArray(taskIds) || taskIds.length === 0 || !action)
    return res.status(400).json({ error: 'Invalid bulk request.' });
  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  const project = (data.projects || []).find(p => p.id === req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (action === 'delete') {
    project.tasks = project.tasks.filter(t => !taskIds.includes(t.id));
  } else if (action === 'status') {
    project.tasks.forEach(t => {
      if (taskIds.includes(t.id)) {
        if (value === 'done' && t.status !== 'done') t.completedAt = new Date().toISOString();
        else if (value !== 'done') t.completedAt = null;
        t.status = value;
      }
    });
  } else if (action === 'priority') {
    project.tasks.forEach(t => { if (taskIds.includes(t.id)) t.priority = value; });
  }
  saveData(data);
  res.json(project.tasks);
});

// ═══════════════════════════════════════════════════════
// TEMPLATE ENDPOINTS (org-aware)
// ═══════════════════════════════════════════════════════

const PRESET_TEMPLATES = {
  onboarding: {
    name: 'New Client Onboarding', description: 'Standard client onboarding workflow',
    tasks: [
      { title: 'Kickoff Call & Requirements', description: 'Schedule meeting, gather requirements', priority: 'high', urgent: true, important: true },
      { title: 'Setup Shared Drive & Repository', description: 'Provision folder, repo, and access', priority: 'medium', important: true },
      { title: 'Send Welcome Packet & Invoice', description: 'Deliver welcome docs and deposit invoice', priority: 'medium', urgent: true }
    ]
  },
  sprint: {
    name: 'Sprint Week Plan', description: 'Agile sprint iteration template',
    tasks: [
      { title: 'Sprint Grooming & Estimation', priority: 'high', urgent: true, important: true },
      { title: 'Feature Development Sprint', priority: 'high', important: true },
      { title: 'Testing & QA Review', priority: 'medium', important: true },
      { title: 'Sprint Retrospective & Demo', priority: 'low' }
    ]
  }
};

app.get('/api/templates', authenticate, (req, res) => {
  const { getData } = getProjectStorage(req.user);
  res.json((getData().templates) || []);
});

app.post('/api/templates', authenticate, (req, res) => {
  const { name, description, category, tasks } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required.' });
  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  if (!data.templates) data.templates = [];
  const tmpl = {
    id: uuidv4(), name, description: description || '', category: category || 'General',
    tasks: (tasks || []).map(t => ({
      title: t.title, description: t.description || '', priority: t.priority || 'medium',
      urgent: t.urgent || false, important: t.important || false,
      subtasks: (t.subtasks || []).map(s => ({ text: s.text || s.title || '', completed: false }))
    })),
    createdAt: new Date().toISOString()
  };
  data.templates.push(tmpl);
  saveData(data);
  res.status(201).json(tmpl);
});

app.delete('/api/templates/:id', authenticate, (req, res) => {
  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  data.templates = (data.templates || []).filter(t => t.id !== req.params.id);
  saveData(data);
  res.json({ message: 'Template deleted.' });
});

app.post('/api/projects/from-template/:templateId', authenticate, (req, res) => {
  const { projectName, projectDescription } = req.body;
  const { getData, saveData } = getProjectStorage(req.user);
  const data = getData();
  let tmpl = (data.templates || []).find(t => t.id === req.params.templateId) || PRESET_TEMPLATES[req.params.templateId];
  if (!tmpl) return res.status(404).json({ error: 'Template not found.' });
  const newProject = {
    id: uuidv4(), name: projectName || tmpl.name, description: projectDescription || tmpl.description || '',
    url: '', github: '', ownerId: req.user.id, members: [req.user.id],
    createdAt: new Date().toISOString(),
    tasks: (tmpl.tasks || []).map(t => ({
      id: uuidv4(), title: t.title, description: t.description || '',
      status: 'todo', priority: t.priority || 'medium', deadline: '', scheduleDate: '',
      reminder: false, assignedTo: req.user.id, assignedBy: req.user.id,
      subtasks: t.subtasks || [], timeLogged: 0, timeSessions: [], timerStarted: null,
      recurring: 'none', pomodoroSessions: [], notes: [], customFields: {},
      urgent: t.urgent || false, important: t.important || false,
      completedAt: null, createdAt: new Date().toISOString()
    }))
  };
  if (!data.projects) data.projects = [];
  data.projects.push(newProject);
  saveData(data);
  res.status(201).json(newProject);
});

// ═══════════════════════════════════════════════════════
// REPORTS ENDPOINTS
// ═══════════════════════════════════════════════════════

app.get('/api/reports/team', authenticate, (req, res) => {
  if (!req.user.orgId) return res.status(400).json({ error: 'Not in an organization.' });
  if (req.user.role !== 'manager' && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Manager or admin access required.' });

  const allOrgUsers = getOrgMembers(req.user.orgId);
  const teamMembers = req.user.role === 'admin'
    ? allOrgUsers.filter(u => u.id !== req.user.id)
    : getAllReports(req.user.id, allOrgUsers);

  const orgData = getOrgData(req.user.orgId);
  const allTasks = (orgData.projects || []).flatMap(p => p.tasks || []);
  const now = new Date();
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;

  const report = teamMembers.map(member => {
    const tasks = allTasks.filter(t => t.assignedTo === member.id);
    return {
      member: { id: member.id, username: member.username, role: member.role || 'employee', jobTitle: member.jobTitle || '', managerIds: member.managerIds || [] },
      stats: {
        total: tasks.length,
        done: tasks.filter(t => t.status === 'done').length,
        inProgress: tasks.filter(t => t.status === 'in-progress').length,
        todo: tasks.filter(t => t.status === 'todo').length,
        overdue: tasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length,
        completedLastWeek: tasks.filter(t => t.status === 'done' && t.completedAt && new Date(t.completedAt).getTime() >= weekAgo).length,
        totalTimeSeconds: tasks.reduce((s, t) => s + (t.timeLogged || 0), 0),
        totalPomodoros: tasks.reduce((s, t) => s + (t.pomodoroSessions || []).length, 0)
      }
    };
  });

  res.json({ generatedAt: now.toISOString(), teamSize: teamMembers.length, report });
});

app.get('/api/reports/member/:memberId', authenticate, (req, res) => {
  if (!req.user.orgId) return res.status(400).json({ error: 'Not in an organization.' });
  const allOrgUsers = getOrgMembers(req.user.orgId);
  const targetMember = allOrgUsers.find(u => u.id === req.params.memberId);
  if (!targetMember) return res.status(404).json({ error: 'Member not found.' });

  if (req.params.memberId !== req.user.id && req.user.role !== 'admin') {
    if (req.user.role !== 'manager') return res.status(403).json({ error: 'Access denied.' });
    const myReports = getAllReports(req.user.id, allOrgUsers);
    if (!myReports.some(r => r.id === req.params.memberId)) return res.status(403).json({ error: 'Access denied.' });
  }

  const orgData = getOrgData(req.user.orgId);
  const now = new Date();
  const allTasks = (orgData.projects || []).flatMap(p => (p.tasks || []).filter(t => t.assignedTo === req.params.memberId));

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split('T')[0];
    return {
      date: dateStr,
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      completed: allTasks.filter(t => t.completedAt && t.completedAt.startsWith(dateStr)).length
    };
  });

  res.json({
    member: { id: targetMember.id, username: targetMember.username, role: targetMember.role, jobTitle: targetMember.jobTitle || '', managerIds: targetMember.managerIds || [] },
    stats: {
      total: allTasks.length,
      done: allTasks.filter(t => t.status === 'done').length,
      inProgress: allTasks.filter(t => t.status === 'in-progress').length,
      todo: allTasks.filter(t => t.status === 'todo').length,
      overdue: allTasks.filter(t => t.status !== 'done' && t.deadline && new Date(t.deadline) < now).length,
      totalTimeSeconds: allTasks.reduce((s, t) => s + (t.timeLogged || 0), 0),
      totalPomodoros: allTasks.reduce((s, t) => s + (t.pomodoroSessions || []).length, 0)
    },
    last7DaysCompletions: last7
  });
});

// ═══════════════════════════════════════════════════════
// SETTINGS ENDPOINTS
// ═══════════════════════════════════════════════════════

app.get('/api/settings/startup', authenticate, (req, res) => {
  res.json({ enabled: getStartupStatus() });
});

app.post('/api/settings/startup', authenticate, (req, res) => {
  const { enabled } = req.body;
  if (enabled === undefined) return res.status(400).json({ error: 'enabled value required.' });
  try {
    setStartupStatus(enabled);
    res.json({ success: true, enabled: getStartupStatus() });
  } catch (err) {
    res.status(500).json({ error: `Failed to configure startup: ${err.message}` });
  }
});

// Catch-all SPA route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start server (0.0.0.0 to allow LAN access for team members)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`═══════════════════════════════════════════════`);
  console.log(` Track. Enterprise Server → http://localhost:${PORT}`);
  console.log(` LAN access → http://<your-ip>:${PORT}`);
  console.log(`═══════════════════════════════════════════════`);
  if (process.platform === 'win32') exec(`start http://localhost:${PORT}`);
});
