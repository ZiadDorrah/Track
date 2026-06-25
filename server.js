const express = require('express');
const cookieParser = require('cookie-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist')));

// Local file database paths
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure database folders and user registry exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([], null, 2));
}

// Memory-based session store (maps sessionToken -> user session object)
const sessions = {};

// Helper functions for Users Database
function getUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

// Helper functions for User-Specific Project Data
function getUserDataPath(userId) {
  return path.join(DATA_DIR, `user_${userId}.json`);
}

function getUserData(userId) {
  const filePath = getUserDataPath(userId);
  if (!fs.existsSync(filePath)) {
    const defaultData = { userId, projects: [] };
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    return { userId, projects: [] };
  }
}

function saveUserData(userId, data) {
  const filePath = getUserDataPath(userId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Middleware: Authenticate User Session
function authenticate(req, res, next) {
  const token = req.cookies.session_token;
  if (!token || !sessions[token]) {
    return res.status(401).json({ error: 'Unauthorized. Please login.' });
  }
  const session = sessions[token];
  // Check if session has expired (e.g. 7 days validity)
  if (Date.now() > session.expiresAt) {
    delete sessions[token];
    res.clearCookie('session_token');
    return res.status(401).json({ error: 'Session expired. Please login again.' });
  }
  req.user = session.user;
  next();
}

// Windows Startup Config Paths & Helpers
const startupScriptPath = path.join(
  process.env.APPDATA || '',
  'Microsoft',
  'Windows',
  'Start Menu',
  'Programs',
  'Startup',
  'TaskTracker.vbs'
);

function getStartupStatus() {
  if (!process.env.APPDATA) return false;
  return fs.existsSync(startupScriptPath);
}

function setStartupStatus(enabled) {
  if (!process.env.APPDATA) return;
  if (enabled) {
    const cwd = process.cwd();
    // VBScript to launch application silently in background
    const vbsContent = `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${cwd}"
WshShell.Run "cmd.exe /c npm start", 0, false
`;
    fs.writeFileSync(startupScriptPath, vbsContent, 'utf8');
  } else {
    if (fs.existsSync(startupScriptPath)) {
      fs.unlinkSync(startupScriptPath);
    }
  }
}

// ================= AUTHENTICATION ENDPOINTS =================

// Signup
app.post('/api/auth/signup', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const users = getUsers();
  const exists = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (exists) {
    return res.status(400).json({ error: 'Username is already taken.' });
  }

  const userId = uuidv4();
  const { salt, hash } = hashPassword(password);
  
  users.push({
    id: userId,
    username,
    salt,
    passwordHash: hash
  });
  saveUsers(users);

  // Initialize empty data file for this user
  getUserData(userId);

  res.status(201).json({ message: 'User registered successfully!' });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const users = getUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Generate Session Token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

  sessions[sessionToken] = {
    user: { id: user.id, username: user.username },
    expiresAt
  };

  res.cookie('session_token', sessionToken, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: 'strict',
    secure: false // Set to true if running over HTTPS
  });

  res.json({ message: 'Login successful!', user: { id: user.id, username: user.username } });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies.session_token;
  if (token) {
    delete sessions[token];
  }
  res.clearCookie('session_token');
  res.json({ message: 'Logged out successfully.' });
});

// Get Current User Profile
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ================= PROJECT ENDPOINTS =================

// Get all projects for current user
app.get('/api/projects', authenticate, (req, res) => {
  const userData = getUserData(req.user.id);
  res.json(userData.projects);
});

// Create project
app.post('/api/projects', authenticate, (req, res) => {
  const { name, description, url, github } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  const userData = getUserData(req.user.id);
  const newProject = {
    id: uuidv4(),
    name,
    description: description || '',
    url: url || '',
    github: github || '',
    tasks: [],
    createdAt: new Date().toISOString()
  };

  userData.projects.push(newProject);
  saveUserData(req.user.id, userData);

  res.status(201).json(newProject);
});

// Update project
app.put('/api/projects/:id', authenticate, (req, res) => {
  const projectId = req.params.id;
  const { name, description, url, github } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  const userData = getUserData(req.user.id);
  const project = userData.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  project.name = name;
  project.description = description || '';
  project.url = url || '';
  project.github = github || '';

  saveUserData(req.user.id, userData);
  res.json(project);
});

// Delete project
app.delete('/api/projects/:id', authenticate, (req, res) => {
  const projectId = req.params.id;
  const userData = getUserData(req.user.id);
  const initialCount = userData.projects.length;
  userData.projects = userData.projects.filter(p => p.id !== projectId);

  if (userData.projects.length === initialCount) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  saveUserData(req.user.id, userData);
  res.json({ message: 'Project deleted successfully.' });
});

// ================= TASK ENDPOINTS =================

// Create task inside a project
app.post('/api/projects/:projectId/tasks', authenticate, (req, res) => {
  const projectId = req.params.projectId;
  const { title, description, status, priority, deadline, scheduleDate, reminder } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Task title is required.' });
  }

  const userData = getUserData(req.user.id);
  const project = userData.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const newTask = {
    id: uuidv4(),
    title,
    description: description || '',
    status: status || 'todo',
    priority: priority || 'medium',
    deadline: deadline || '',
    scheduleDate: scheduleDate || '',
    reminder: reminder !== undefined ? reminder : false,
    subtasks: req.body.subtasks || [],
    timeLogged: req.body.timeLogged || 0,
    timeSessions: req.body.timeSessions || [],
    timerStarted: req.body.timerStarted || null,
    recurring: req.body.recurring || 'none',
    pomodoroSessions: req.body.pomodoroSessions || [],
    createdAt: new Date().toISOString()
  };

  project.tasks.push(newTask);
  saveUserData(req.user.id, userData);

  res.status(201).json(newTask);
});

// Update task inside a project
app.put('/api/projects/:projectId/tasks/:taskId', authenticate, (req, res) => {
  const { projectId, taskId } = req.params;
  const { title, description, status, priority, deadline, scheduleDate, reminder } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Task title is required.' });
  }

  const userData = getUserData(req.user.id);
  const project = userData.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const task = project.tasks.find(t => t.id === taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  task.title = title;
  task.description = description || '';
  task.status = status || 'todo';
  task.priority = priority || 'medium';
  task.deadline = deadline || '';
  task.scheduleDate = scheduleDate || '';
  task.reminder = reminder !== undefined ? reminder : false;
  if (req.body.subtasks !== undefined) task.subtasks = req.body.subtasks;
  if (req.body.timeLogged !== undefined) task.timeLogged = req.body.timeLogged;
  if (req.body.timeSessions !== undefined) task.timeSessions = req.body.timeSessions;
  if (req.body.timerStarted !== undefined) task.timerStarted = req.body.timerStarted;
  if (req.body.recurring !== undefined) task.recurring = req.body.recurring;
  if (req.body.pomodoroSessions !== undefined) task.pomodoroSessions = req.body.pomodoroSessions;

  saveUserData(req.user.id, userData);
  res.json(task);
});

// Delete task from project
app.delete('/api/projects/:projectId/tasks/:taskId', authenticate, (req, res) => {
  const { projectId, taskId } = req.params;

  const userData = getUserData(req.user.id);
  const project = userData.projects.find(p => p.id === projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found.' });
  }

  const initialCount = project.tasks.length;
  project.tasks = project.tasks.filter(t => t.id !== taskId);

  if (project.tasks.length === initialCount) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  saveUserData(req.user.id, userData);
  res.json({ message: 'Task deleted successfully.' });
});

// ================= SETTINGS ENDPOINTS =================

// Get startup setting status
app.get('/api/settings/startup', authenticate, (req, res) => {
  res.json({ enabled: getStartupStatus() });
});

// Enable/Disable startup setting
app.post('/api/settings/startup', authenticate, (req, res) => {
  const { enabled } = req.body;
  if (enabled === undefined) {
    return res.status(400).json({ error: 'enabled boolean value is required.' });
  }

  try {
    setStartupStatus(enabled);
    res.json({ success: true, enabled: getStartupStatus() });
  } catch (err) {
    res.status(500).json({ error: `Failed to configure Windows Startup: ${err.message}` });
  }
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(` Task Tracker Server running at http://localhost:${PORT}`);
  console.log(`===============================================`);

  // Auto-open browser on launch (Windows only)
  if (process.platform === 'win32') {
    console.log('Opening application in default browser...');
    exec(`start http://localhost:${PORT}`);
  }
});
