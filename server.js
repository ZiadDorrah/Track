const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('./server/db');
const { getDirectReports, getRecursiveReports, getManagers, getEligibleAssignees } = require('./server/lib/hierarchy');

const app = express();
const PORT = process.env.PORT || 3005;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'dist')));

// Helper functions for Auth & Passwords
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const checkHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return hash === checkHash;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Middleware: Authenticate User Session
async function authenticate(req, res, next) {
  try {
    await db.initPromise;
    const token = req.cookies.session_token;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized. Please login.' });
    }

    const tokenHash = hashToken(token);
    const session = await db.get(`
      SELECT s.token_hash, s.expires_at, u.id, u.username, u.email, u.display_name, u.job_title, u.is_admin
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token_hash = ? AND u.is_active = 1
    `, [tokenHash]);

    if (!session) {
      res.clearCookie('session_token');
      return res.status(401).json({ error: 'Unauthorized. Session not found.' });
    }

    if (Date.now() > session.expires_at) {
      await db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
      res.clearCookie('session_token');
      return res.status(401).json({ error: 'Session expired. Please login again.' });
    }

    req.user = {
      id: session.id,
      username: session.username,
      email: session.email || '',
      displayName: session.display_name || session.username,
      jobTitle: session.job_title || '',
      isAdmin: Boolean(session.is_admin)
    };
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(500).json({ error: 'Internal authentication failure.' });
  }
}

// Middleware: Admin Authorization
function requireAdmin(req, res, next) {
  authenticate(req, res, () => {
    if (!req.user || !req.user.isAdmin) {
      return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
    }
    next();
  });
}

// Helper formatting functions for Task & Project
function formatTaskRow(t) {
  let subtasks = [];
  let notes = [];
  let customFields = {};
  let pomodoroSessions = [];

  try { subtasks = JSON.parse(t.subtasks_json || '[]'); } catch (e) {}
  try { notes = JSON.parse(t.notes_json || '[]'); } catch (e) {}
  try { customFields = JSON.parse(t.custom_fields_json || '{}'); } catch (e) {}
  try { pomodoroSessions = JSON.parse(t.pomodoro_sessions_json || '[]'); } catch (e) {}

  return {
    id: t.id,
    projectId: t.project_id,
    title: t.title,
    description: t.description || '',
    status: t.status || 'todo',
    priority: t.priority || 'medium',
    deadline: t.deadline || '',
    scheduleDate: t.schedule_date || '',
    reminder: Boolean(t.reminder),
    recurring: t.recurring || 'none',
    urgent: Boolean(t.urgent),
    important: Boolean(t.important),
    timeLogged: t.time_logged || 0,
    timerStarted: t.timer_started || null,
    subtasks,
    notes,
    customFields,
    pomodoroSessions,
    assigneeId: t.assignee_id || t.created_by_id,
    createdById: t.created_by_id,
    createdAt: t.created_at,
    completedAt: t.completed_at || null
  };
}

function formatProjectRow(p, tasks = [], members = []) {
  return {
    id: p.id,
    name: p.name,
    description: p.description || '',
    url: p.url || '',
    github: p.github || '',
    ownerId: p.owner_id,
    createdAt: p.created_at,
    members: members,
    tasks: tasks.map(formatTaskRow)
  };
}

// Cycle Detection Helper for Manager Hierarchy
async function wouldCreateCycle(managerId, employeeId) {
  if (managerId === employeeId) return true;
  const visited = new Set();
  const queue = [managerId];

  while (queue.length > 0) {
    const curr = queue.shift();
    if (curr === employeeId) return true;
    if (visited.has(curr)) continue;
    visited.add(curr);

    const rows = await db.all('SELECT manager_id FROM manager_employee WHERE employee_id = ?', [curr]);
    for (const r of rows) {
      queue.push(r.manager_id);
    }
  }
  return false;
}

// Assignee Validation Helper (Self, Project Member, or Direct Report)
async function isValidAssignee(assigneeId, assignerId, projectId) {
  if (!assigneeId) return true;
  if (assigneeId === assignerId) return true;

  const targetUser = await db.get('SELECT id FROM users WHERE id = ? AND is_active = 1', [assigneeId]);
  if (!targetUser) return false;

  const isMember = await db.get('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, assigneeId]);
  if (isMember) return true;

  const isReport = await db.get('SELECT 1 FROM manager_employee WHERE manager_id = ? AND employee_id = ?', [assignerId, assigneeId]);
  if (isReport) return true;

  return false;
}

// ================= AUTHENTICATION ENDPOINTS =================

// Signup (Restricted to system bootstrap / initial admin account creation only)
app.post('/api/auth/signup', async (req, res) => {
  try {
    await db.initPromise;
    const { username, password, email, displayName, jobTitle } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    // Check if system has already been initialized with an admin
    const userCount = await db.get('SELECT COUNT(*) as count FROM users');
    if (userCount && userCount.count > 0) {
      return res.status(403).json({ error: 'Self-signup is disabled. New user accounts must be provisioned by an administrator.' });
    }

    const exists = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (exists) {
      return res.status(400).json({ error: 'Username is already taken.' });
    }

    const isAdmin = 1; // First user is Admin
    const userId = uuidv4();
    const { salt, hash } = hashPassword(password);
    const userEmail = email || `${username.toLowerCase()}@company.local`;
    const userDisplayName = displayName || (username.charAt(0).toUpperCase() + username.slice(1));
    const userJobTitle = jobTitle || 'Administrator';
    const createdAt = new Date().toISOString();

    await db.run(`
      INSERT INTO users (id, username, email, display_name, job_title, is_admin, salt, password_hash, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [userId, username, userEmail, userDisplayName, userJobTitle, isAdmin, salt, hash, createdAt]);

    res.status(201).json({ message: 'System administrator registered successfully!' });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Failed to register administrator.' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    await db.initPromise;
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await db.get('SELECT * FROM users WHERE LOWER(username) = LOWER(?) AND is_active = 1', [username]);
    if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(sessionToken);
    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
    const createdAt = new Date().toISOString();

    await db.run(`
      INSERT INTO sessions (token_hash, user_id, expires_at, created_at)
      VALUES (?, ?, ?, ?)
    `, [tokenHash, user.id, expiresAt, createdAt]);

    res.cookie('session_token', sessionToken, {
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      sameSite: 'strict',
      secure: false
    });

    const userProfile = {
      id: user.id,
      username: user.username,
      email: user.email || '',
      displayName: user.display_name || user.username,
      jobTitle: user.job_title || '',
      isAdmin: Boolean(user.is_admin)
    };

    res.json({ message: 'Login successful!', user: userProfile });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    await db.initPromise;
    const token = req.cookies.session_token;
    if (token) {
      const tokenHash = hashToken(token);
      await db.run('DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    }
  } catch (err) {
    console.error('Logout error:', err);
  } finally {
    res.clearCookie('session_token');
    res.json({ message: 'Logged out successfully.' });
  }
});

// Get Current User Profile
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ================= ADMIN USER MANAGEMENT ENDPOINTS =================

// Get all users with manager & report details (Admin only)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, email, display_name, job_title, is_admin, is_active, created_at FROM users ORDER BY created_at DESC');
    const managerLinks = await db.all('SELECT id, manager_id, employee_id FROM manager_employee');

    const result = users.map(u => {
      const managers = managerLinks.filter(l => l.employee_id === u.id).map(l => l.manager_id);
      const employees = managerLinks.filter(l => l.manager_id === u.id).map(l => l.employee_id);
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        displayName: u.display_name,
        jobTitle: u.job_title,
        isAdmin: Boolean(u.is_admin),
        isActive: Boolean(u.is_active),
        createdAt: u.created_at,
        managerIds: managers,
        employeeIds: employees
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch user list.' });
  }
});

// Provision new user (Admin only)
app.post('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const { username, password, email, displayName, jobTitle, isAdmin, managerIds } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const exists = await db.get('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [username]);
    if (exists) {
      return res.status(400).json({ error: 'Username already exists.' });
    }

    const userId = uuidv4();
    const { salt, hash } = hashPassword(password);
    const userEmail = email || `${username.toLowerCase()}@company.local`;
    const userDisplayName = displayName || (username.charAt(0).toUpperCase() + username.slice(1));
    const userJobTitle = jobTitle || 'Employee';
    const adminFlag = isAdmin ? 1 : 0;
    const createdAt = new Date().toISOString();

    await db.run(`
      INSERT INTO users (id, username, email, display_name, job_title, is_admin, salt, password_hash, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [userId, username, userEmail, userDisplayName, userJobTitle, adminFlag, salt, hash, createdAt]);

    // Assign managers if provided
    if (Array.isArray(managerIds) && managerIds.length > 0) {
      for (const mId of managerIds) {
        const isCycle = await wouldCreateCycle(mId, userId);
        if (!isCycle) {
          await db.run(`
            INSERT OR IGNORE INTO manager_employee (id, manager_id, employee_id, created_at)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), mId, userId, createdAt]);
        }
      }
    }

    res.status(201).json({ message: 'User provisioned successfully.', userId });
  } catch (err) {
    console.error('Provision user error:', err);
    res.status(500).json({ error: 'Failed to provision user.' });
  }
});

// Update user details & managers (Admin only)
app.put('/api/admin/users/:id', requireAdmin, async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const { email, displayName, jobTitle, isAdmin, isActive, managerIds } = req.body;

    const user = await db.get('SELECT id FROM users WHERE id = ?', [targetUserId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await db.run(`
      UPDATE users
      SET email = COALESCE(?, email),
          display_name = COALESCE(?, display_name),
          job_title = COALESCE(?, job_title),
          is_admin = COALESCE(?, is_admin),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `, [
      email !== undefined ? email : null,
      displayName !== undefined ? displayName : null,
      jobTitle !== undefined ? jobTitle : null,
      isAdmin !== undefined ? (isAdmin ? 1 : 0) : null,
      isActive !== undefined ? (isActive ? 1 : 0) : null,
      targetUserId
    ]);

    if (Array.isArray(managerIds)) {
      // Sync manager relationships
      await db.run('DELETE FROM manager_employee WHERE employee_id = ?', [targetUserId]);
      const createdAt = new Date().toISOString();
      for (const mId of managerIds) {
        const isCycle = await wouldCreateCycle(mId, targetUserId);
        if (!isCycle) {
          await db.run(`
            INSERT OR IGNORE INTO manager_employee (id, manager_id, employee_id, created_at)
            VALUES (?, ?, ?, ?)
          `, [uuidv4(), mId, targetUserId, createdAt]);
        }
      }
    }

    res.json({ message: 'User updated successfully.' });
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Assign manager to employee (Admin only)
app.post('/api/admin/managers', requireAdmin, async (req, res) => {
  try {
    const { managerId, employeeId } = req.body;
    if (!managerId || !employeeId) {
      return res.status(400).json({ error: 'managerId and employeeId are required.' });
    }

    const isCycle = await wouldCreateCycle(managerId, employeeId);
    if (isCycle) {
      return res.status(400).json({ error: 'Cannot assign manager: relationship would create a management hierarchy loop.' });
    }

    const createdAt = new Date().toISOString();
    await db.run(`
      INSERT OR IGNORE INTO manager_employee (id, manager_id, employee_id, created_at)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), managerId, employeeId, createdAt]);

    res.status(201).json({ message: 'Manager assigned successfully.' });
  } catch (err) {
    console.error('Assign manager error:', err);
    res.status(500).json({ error: 'Failed to assign manager.' });
  }
});

// Remove manager-employee relationship (Admin only)
app.delete('/api/admin/managers', requireAdmin, async (req, res) => {
  try {
    const { managerId, employeeId } = req.body;
    if (!managerId || !employeeId) {
      return res.status(400).json({ error: 'managerId and employeeId are required.' });
    }

    await db.run('DELETE FROM manager_employee WHERE manager_id = ? AND employee_id = ?', [managerId, employeeId]);
    res.json({ message: 'Manager unassigned successfully.' });
  } catch (err) {
    console.error('Unassign manager error:', err);
    res.status(500).json({ error: 'Failed to unassign manager.' });
  }
});

// ================= HIERARCHY & TEAM ENDPOINTS =================

// Get eligible assignees for current user
app.get('/api/users/me/assignees', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const { projectId } = req.query;

    if (projectId) {
      // Only owner/member can see who this project's members are - same
      // check used to gate task creation, so it never offers a project the
      // caller couldn't actually assign a task within.
      const project = await db.get(`
        SELECT p.id FROM projects p
        LEFT JOIN project_members pm ON pm.project_id = p.id
        WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
      `, [projectId, me, me]);
      if (!project) {
        return res.status(404).json({ error: 'Project not found or unauthorized.' });
      }
    }

    const assignees = await getEligibleAssignees(me, projectId || null);
    res.json(assignees);
  } catch (err) {
    console.error('Fetch assignees error:', err);
    res.status(500).json({ error: 'Failed to fetch assignees.' });
  }
});

// Get direct reports for current user
app.get('/api/users/me/team', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const team = await getDirectReports(me);
    res.json(team);
  } catch (err) {
    console.error('Fetch team error:', err);
    res.status(500).json({ error: 'Failed to fetch team.' });
  }
});

// Get direct managers for current user
app.get('/api/users/me/managers', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const managers = await getManagers(me);
    res.json(managers);
  } catch (err) {
    console.error('Fetch managers error:', err);
    res.status(500).json({ error: 'Failed to fetch managers.' });
  }
});

// Get all active users in company (for project member management)
app.get('/api/users/all', authenticate, async (req, res) => {
  try {
    const users = await db.all(`
      SELECT id, username, display_name as displayName, job_title as jobTitle, email
      FROM users
      WHERE is_active = 1
      ORDER BY display_name ASC
    `);
    res.json(users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName || u.username,
      jobTitle: u.jobTitle || '',
      email: u.email || ''
    })));
  } catch (err) {
    console.error('Fetch company users error:', err);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

// Get all recursive reports (direct and indirect) for current user
app.get('/api/users/me/team/all', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const reports = await getRecursiveReports(me);
    res.json(reports);
  } catch (err) {
    console.error('Fetch all team reports error:', err);
    res.status(500).json({ error: 'Failed to fetch team reports.' });
  }
});

// Get Manager Rollup Reports (Performance stats per report)
app.get('/api/reports/manager', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const reports = await getRecursiveReports(me);
    const nowIso = new Date().toISOString();

    let teamTotalTasks = 0;
    let teamCompletedTasks = 0;
    let teamOverdueTasks = 0;
    let teamTotalTimeLogged = 0;

    const reportStatsList = [];

    for (const r of reports) {
      // Only count tasks the calling manager can actually see - owns the
      // project, is a member of it, or created the task themself - not
      // every task this report has ever been assigned company-wide.
      const userTasks = await db.all(`
        SELECT t.id, t.status, t.deadline, t.time_logged
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.assignee_id = ?
          AND (
            p.owner_id = ?
            OR t.created_by_id = ?
            OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?)
          )
      `, [r.id, me, me, me]);

      const totalTasks = userTasks.length;
      const completedTasks = userTasks.filter(t => t.status === 'done').length;
      const inProgressTasks = userTasks.filter(t => t.status === 'in-progress').length;
      const todoTasks = userTasks.filter(t => t.status === 'todo').length;
      const overdueTasks = userTasks.filter(t => t.status !== 'done' && t.deadline && t.deadline < nowIso).length;
      const totalTimeLogged = userTasks.reduce((sum, t) => sum + (t.time_logged || 0), 0);
      const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      teamTotalTasks += totalTasks;
      teamCompletedTasks += completedTasks;
      teamOverdueTasks += overdueTasks;
      teamTotalTimeLogged += totalTimeLogged;

      const directManagers = await getManagers(r.id);

      reportStatsList.push({
        user: r,
        managers: directManagers,
        stats: {
          totalTasks,
          completedTasks,
          inProgressTasks,
          todoTasks,
          overdueTasks,
          completionRate,
          totalTimeLogged
        }
      });
    }

    const teamCompletionRate = teamTotalTasks > 0 ? Math.round((teamCompletedTasks / teamTotalTasks) * 100) : 0;

    res.json({
      summary: {
        totalReports: reports.length,
        teamTotalTasks,
        teamCompletedTasks,
        teamCompletionRate,
        teamOverdueTasks,
        teamTotalTimeLogged
      },
      reports: reportStatsList
    });
  } catch (err) {
    console.error('Fetch manager reports error:', err);
    res.status(500).json({ error: 'Failed to generate manager performance reports.' });
  }
});

// ================= PROJECT ENDPOINTS =================

// Get all projects accessible to current user
app.get('/api/projects', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    // A project is visible if the user owns it, is a member of it, or has at
    // least one task in it assigned to or created by them (manager-assigned
    // tasks in a project the employee doesn't otherwise belong to).
    const projects = await db.all(`
      SELECT DISTINCT p.*,
        CASE WHEN p.owner_id = ? OR EXISTS (
          SELECT 1 FROM project_members pm2 WHERE pm2.project_id = p.id AND pm2.user_id = ?
        ) THEN 1 ELSE 0 END AS has_full_access
      FROM projects p
      WHERE p.owner_id = ?
        OR EXISTS (SELECT 1 FROM project_members pm WHERE pm.project_id = p.id AND pm.user_id = ?)
        OR EXISTS (SELECT 1 FROM tasks t WHERE t.project_id = p.id AND (t.assignee_id = ? OR t.created_by_id = ?))
      ORDER BY p.created_at DESC
    `, [me, me, me, me, me, me]);

    const result = [];
    for (const p of projects) {
      // Owners/members see the full board; anyone visible only via an assigned
      // or created task sees just that task, not the rest of the project.
      const hasFullAccess = Boolean(p.has_full_access);

      const tasks = hasFullAccess
        ? await db.all('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC', [p.id])
        : await db.all('SELECT * FROM tasks WHERE project_id = ? AND (assignee_id = ? OR created_by_id = ?) ORDER BY created_at ASC', [p.id, me, me]);

      const members = hasFullAccess
        ? await db.all(`
          SELECT u.id, u.username, u.display_name, u.job_title, pm.created_at as joined_at
          FROM project_members pm
          JOIN users u ON pm.user_id = u.id
          WHERE pm.project_id = ?
        `, [p.id])
        : [];

      result.push(formatProjectRow(p, tasks, members));
    }

    res.json(result);
  } catch (err) {
    console.error('Get projects error:', err);
    res.status(500).json({ error: 'Failed to fetch projects.' });
  }
});

// Create project
app.post('/api/projects', authenticate, async (req, res) => {
  try {
    const { name, description, url, github } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const projectId = uuidv4();
    const ownerId = req.user.id;
    const createdAt = new Date().toISOString();

    await db.run(`
      INSERT INTO projects (id, name, description, url, github, owner_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [projectId, name, description || '', url || '', github || '', ownerId, createdAt]);

    // Add owner as a member automatically
    await db.run(`
      INSERT INTO project_members (id, project_id, user_id, added_by_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [uuidv4(), projectId, ownerId, ownerId, createdAt]);

    const newProject = formatProjectRow({
      id: projectId,
      name,
      description: description || '',
      url: url || '',
      github: github || '',
      owner_id: ownerId,
      created_at: createdAt
    }, [], []);

    res.status(201).json(newProject);
  } catch (err) {
    console.error('Create project error:', err);
    res.status(500).json({ error: 'Failed to create project.' });
  }
});

// Update project
app.put('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { name, description, url, github } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Project name is required.' });
    }

    const me = req.user.id;
    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.owner_id !== me) {
      return res.status(403).json({ error: 'Forbidden. Only the project owner can edit project details.' });
    }

    await db.run(`
      UPDATE projects
      SET name = ?, description = ?, url = ?, github = ?
      WHERE id = ?
    `, [name, description || '', url || '', github || '', projectId]);

    const tasks = await db.all('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC', [projectId]);
    const members = await db.all(`
      SELECT u.id, u.username, u.display_name, u.job_title, pm.created_at as joined_at
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `, [projectId]);

    res.json(formatProjectRow({
      ...project,
      name,
      description: description || '',
      url: url || '',
      github: github || ''
    }, tasks, members));
  } catch (err) {
    console.error('Update project error:', err);
    res.status(500).json({ error: 'Failed to update project.' });
  }
});

// Delete project
app.delete('/api/projects/:id', authenticate, async (req, res) => {
  try {
    const projectId = req.params.id;
    const me = req.user.id;

    const project = await db.get('SELECT * FROM projects WHERE id = ? AND owner_id = ?', [projectId, me]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found or only project owner can delete it.' });
    }

    await db.run('DELETE FROM tasks WHERE project_id = ?', [projectId]);
    await db.run('DELETE FROM project_members WHERE project_id = ?', [projectId]);
    await db.run('DELETE FROM projects WHERE id = ?', [projectId]);

    res.json({ message: 'Project deleted successfully.' });
  } catch (err) {
    console.error('Delete project error:', err);
    res.status(500).json({ error: 'Failed to delete project.' });
  }
});

// Add project member (Owner only)
app.post('/api/projects/:id/members', authenticate, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { userId } = req.body;
    const me = req.user.id;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required.' });
    }

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.owner_id !== me) {
      return res.status(403).json({ error: 'Forbidden. Only the project owner can add project members.' });
    }

    const targetUser = await db.get('SELECT id, username, display_name, job_title, email FROM users WHERE id = ? AND is_active = 1', [userId]);
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found or inactive.' });
    }

    const isDirectReport = await db.get('SELECT 1 FROM manager_employee WHERE manager_id = ? AND employee_id = ?', [me, userId]);
    if (!isDirectReport) {
      return res.status(403).json({ error: 'Forbidden. You can only add your own direct reports as project members.' });
    }

    const memberId = uuidv4();
    const createdAt = new Date().toISOString();

    await db.run(`
      INSERT OR IGNORE INTO project_members (id, project_id, user_id, added_by_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [memberId, projectId, userId, me, createdAt]);

    const updatedMembers = await db.all(`
      SELECT u.id, u.username, u.display_name as displayName, u.job_title as jobTitle, u.email, pm.created_at as joinedAt
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `, [projectId]);

    res.status(201).json({
      message: 'Member added successfully.',
      members: updatedMembers.map(m => ({
        id: m.id,
        username: m.username,
        displayName: m.displayName || m.username,
        jobTitle: m.jobTitle || '',
        email: m.email || '',
        joinedAt: m.joinedAt
      }))
    });
  } catch (err) {
    console.error('Add project member error:', err);
    res.status(500).json({ error: 'Failed to add project member.' });
  }
});

// Remove project member (Owner only)
app.delete('/api/projects/:id/members/:userId', authenticate, async (req, res) => {
  try {
    const { id: projectId, userId } = req.params;
    const me = req.user.id;

    const project = await db.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    if (project.owner_id !== me) {
      return res.status(403).json({ error: 'Forbidden. Only the project owner can remove project members.' });
    }

    if (userId === project.owner_id) {
      return res.status(400).json({ error: 'Project owner cannot be removed from project members.' });
    }

    await db.run('DELETE FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, userId]);

    const updatedMembers = await db.all(`
      SELECT u.id, u.username, u.display_name as displayName, u.job_title as jobTitle, u.email, pm.created_at as joinedAt
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ?
    `, [projectId]);

    res.json({
      message: 'Member removed successfully.',
      members: updatedMembers.map(m => ({
        id: m.id,
        username: m.username,
        displayName: m.displayName || m.username,
        jobTitle: m.jobTitle || '',
        email: m.email || '',
        joinedAt: m.joinedAt
      }))
    });
  } catch (err) {
    console.error('Remove project member error:', err);
    res.status(500).json({ error: 'Failed to remove project member.' });
  }
});

// Get project time-tracking aggregate rollup
app.get('/api/projects/:id/time-rollup', authenticate, async (req, res) => {
  try {
    const projectId = req.params.id;
    const me = req.user.id;

    // Check project accessibility
    const project = await db.get(`
      SELECT p.*
      FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
    `, [projectId, me, me]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    // 1. Total Project Time Logged
    const totalTimeRow = await db.get(`
      SELECT SUM(time_logged) as total_seconds
      FROM tasks
      WHERE project_id = ?
    `, [projectId]);

    const totalProjectTimeSeconds = totalTimeRow ? (totalTimeRow.total_seconds || 0) : 0;

    // 2. Per-Member Rollup
    const memberRollupRows = await db.all(`
      SELECT u.id as user_id, u.username, u.display_name, u.job_title,
             SUM(t.time_logged) as total_seconds,
             COUNT(t.id) as task_count
      FROM tasks t
      JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
      GROUP BY u.id
      ORDER BY total_seconds DESC
    `, [projectId]);

    const memberRollup = memberRollupRows.map(r => ({
      userId: r.user_id,
      username: r.username,
      displayName: r.display_name || r.username,
      jobTitle: r.job_title || 'Team Member',
      totalTimeSeconds: r.total_seconds || 0,
      taskCount: r.task_count || 0
    }));

    // 3. Per-Task Leaderboard (Tasks with logged time)
    const taskRollupRows = await db.all(`
      SELECT t.id, t.title, t.status, t.time_logged, u.display_name as assignee_name, u.username as assignee_username
      FROM tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ? AND t.time_logged > 0
      ORDER BY t.time_logged DESC
      LIMIT 20
    `, [projectId]);

    const taskRollup = taskRollupRows.map(t => ({
      taskId: t.id,
      taskTitle: t.title,
      status: t.status,
      assigneeName: t.assignee_name || t.assignee_username || 'Unassigned',
      totalTimeSeconds: t.time_logged || 0
    }));

    // 4. Time Sessions History
    const sessionRows = await db.all(`
      SELECT ts.id, ts.task_id, t.title as task_title, u.display_name as user_name, u.username,
             ts.start_time, ts.end_time, ts.duration as duration_seconds
      FROM time_sessions ts
      JOIN tasks t ON ts.task_id = t.id
      LEFT JOIN users u ON ts.user_id = u.id
      WHERE t.project_id = ?
      ORDER BY ts.start_time DESC
      LIMIT 50
    `, [projectId]);

    const sessions = sessionRows.map(s => ({
      id: s.id,
      taskId: s.task_id,
      taskTitle: s.task_title,
      userName: s.user_name || s.username || 'User',
      startTime: s.start_time,
      endTime: s.end_time,
      durationSeconds: s.duration_seconds || 0,
      notes: s.notes || ''
    }));

    res.json({
      projectId,
      projectName: project.name,
      totalProjectTimeSeconds,
      memberRollup,
      taskRollup,
      sessions
    });
  } catch (err) {
    console.error('Fetch time-rollup error:', err);
    res.status(500).json({ error: 'Failed to generate time-tracking rollup.' });
  }
});

// ================= TASK ENDPOINTS =================

// Create task inside a project
app.post('/api/projects/:projectId/tasks', authenticate, async (req, res) => {
  try {
    const projectId = req.params.projectId;
    const { title, description, status, priority, deadline, scheduleDate, reminder, assigneeId } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const me = req.user.id;
    const project = await db.get(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
    `, [projectId, me, me]);

    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const taskId = uuidv4();
    const taskStatus = status || 'todo';
    const createdAt = new Date().toISOString();
    const completedAt = req.body.completedAt || (taskStatus === 'done' ? createdAt : null);
    const assignedUser = assigneeId || me;

    const validAssignee = await isValidAssignee(assignedUser, me, projectId);
    if (!validAssignee) {
      return res.status(400).json({ error: 'Invalid assigneeId. Assignee must be an active user who is a project member or your direct report.' });
    }

    await db.run(`
      INSERT INTO tasks (
        id, project_id, title, description, status, priority, deadline, schedule_date,
        reminder, recurring, urgent, important, time_logged, timer_started,
        subtasks_json, notes_json, custom_fields_json, pomodoro_sessions_json,
        assignee_id, created_by_id, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      taskId,
      projectId,
      title,
      description || '',
      taskStatus,
      priority || 'medium',
      deadline || '',
      scheduleDate || '',
      reminder ? 1 : 0,
      req.body.recurring || 'none',
      req.body.urgent ? 1 : 0,
      req.body.important ? 1 : 0,
      req.body.timeLogged || 0,
      req.body.timerStarted || null,
      JSON.stringify(req.body.subtasks || []),
      JSON.stringify(req.body.notes || []),
      JSON.stringify(req.body.customFields || {}),
      JSON.stringify(req.body.pomodoroSessions || []),
      assignedUser,
      me,
      createdAt,
      completedAt
    ]);

    const createdTask = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.status(201).json(formatTaskRow(createdTask));
  } catch (err) {
    console.error('Create task error:', err);
    res.status(500).json({ error: 'Failed to create task.' });
  }
});

// Update task inside a project
app.put('/api/projects/:projectId/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const { title, description, status, priority, deadline, scheduleDate, reminder, assigneeId } = req.body;
    if (!title) {
      return res.status(400).json({ error: 'Task title is required.' });
    }

    const me = req.user.id;
    const project = await db.get(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
    `, [projectId, me, me]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const existingTask = await db.get('SELECT * FROM tasks WHERE id = ? AND project_id = ?', [taskId, projectId]);
    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const targetAssignee = assigneeId !== undefined ? assigneeId : existingTask.assignee_id;
    if (assigneeId !== undefined && assigneeId !== existingTask.assignee_id) {
      const validAssignee = await isValidAssignee(targetAssignee, me, projectId);
      if (!validAssignee) {
        return res.status(400).json({ error: 'Invalid assigneeId. Assignee must be an active user who is a project member or your direct report.' });
      }
    }

    let completedAt = existingTask.completed_at;
    const newStatus = status || existingTask.status;

    if (newStatus === 'done' && existingTask.status !== 'done') {
      completedAt = new Date().toISOString();
    } else if (newStatus !== 'done' && existingTask.status === 'done') {
      completedAt = null;
    }
    if (req.body.completedAt !== undefined) {
      completedAt = req.body.completedAt;
    }

    const subtasksJson = req.body.subtasks !== undefined ? JSON.stringify(req.body.subtasks) : existingTask.subtasks_json;
    const notesJson = req.body.notes !== undefined ? JSON.stringify(req.body.notes) : existingTask.notes_json;
    const customFieldsJson = req.body.customFields !== undefined ? JSON.stringify(req.body.customFields) : existingTask.custom_fields_json;
    const pomodoroJson = req.body.pomodoroSessions !== undefined ? JSON.stringify(req.body.pomodoroSessions) : existingTask.pomodoro_sessions_json;

    await db.run(`
      UPDATE tasks
      SET title = ?, description = ?, status = ?, priority = ?, deadline = ?, schedule_date = ?,
          reminder = ?, recurring = ?, urgent = ?, important = ?, time_logged = ?, timer_started = ?,
          subtasks_json = ?, notes_json = ?, custom_fields_json = ?, pomodoro_sessions_json = ?,
          assignee_id = ?, completed_at = ?
      WHERE id = ? AND project_id = ?
    `, [
      title,
      description || '',
      newStatus,
      priority || 'medium',
      deadline || '',
      scheduleDate || '',
      reminder !== undefined ? (reminder ? 1 : 0) : existingTask.reminder,
      req.body.recurring !== undefined ? req.body.recurring : existingTask.recurring,
      req.body.urgent !== undefined ? (req.body.urgent ? 1 : 0) : existingTask.urgent,
      req.body.important !== undefined ? (req.body.important ? 1 : 0) : existingTask.important,
      req.body.timeLogged !== undefined ? req.body.timeLogged : existingTask.time_logged,
      req.body.timerStarted !== undefined ? req.body.timerStarted : existingTask.timer_started,
      subtasksJson,
      notesJson,
      customFieldsJson,
      pomodoroJson,
      assigneeId !== undefined ? assigneeId : existingTask.assignee_id,
      completedAt,
      taskId,
      projectId
    ]);

    // Handle timeSessions persistence if updated
    if (Array.isArray(req.body.timeSessions)) {
      const me = req.user.id;
      for (const ts of req.body.timeSessions) {
        await db.run(`
          INSERT OR REPLACE INTO time_sessions (id, task_id, user_id, start_time, end_time, duration)
          VALUES (?, ?, ?, ?, ?, ?)
        `, [
          ts.id || uuidv4(),
          taskId,
          me,
          ts.startTime,
          ts.endTime || null,
          ts.duration || 0
        ]);
      }
    }

    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
    res.json(formatTaskRow(updatedTask));
  } catch (err) {
    console.error('Update task error:', err);
    res.status(500).json({ error: 'Failed to update task.' });
  }
});

// Delete task from project
app.delete('/api/projects/:projectId/tasks/:taskId', authenticate, async (req, res) => {
  try {
    const { projectId, taskId } = req.params;
    const me = req.user.id;
    const project = await db.get(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
    `, [projectId, me, me]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    const task = await db.get('SELECT id FROM tasks WHERE id = ? AND project_id = ?', [taskId, projectId]);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    await db.run('DELETE FROM tasks WHERE id = ?', [taskId]);
    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    console.error('Delete task error:', err);
    res.status(500).json({ error: 'Failed to delete task.' });
  }
});

// Bulk Task Operations
app.post('/api/projects/:projectId/tasks/bulk', authenticate, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { taskIds, action, value } = req.body;

    if (!Array.isArray(taskIds) || taskIds.length === 0 || !action) {
      return res.status(400).json({ error: 'Invalid bulk request parameters.' });
    }

    const me = req.user.id;
    const project = await db.get(`
      SELECT p.* FROM projects p
      LEFT JOIN project_members pm ON pm.project_id = p.id
      WHERE p.id = ? AND (p.owner_id = ? OR pm.user_id = ?)
    `, [projectId, me, me]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found or unauthorized.' });
    }

    if (action === 'delete') {
      for (const tId of taskIds) {
        await db.run('DELETE FROM tasks WHERE id = ? AND project_id = ?', [tId, projectId]);
      }
    } else if (action === 'status') {
      const now = new Date().toISOString();
      for (const tId of taskIds) {
        const task = await db.get('SELECT status FROM tasks WHERE id = ?', [tId]);
        if (task) {
          const completedAt = value === 'done' ? (task.status !== 'done' ? now : undefined) : null;
          if (completedAt !== undefined) {
            await db.run('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ? AND project_id = ?', [value, completedAt, tId, projectId]);
          } else {
            await db.run('UPDATE tasks SET status = ? WHERE id = ? AND project_id = ?', [value, tId, projectId]);
          }
        }
      }
    } else if (action === 'priority') {
      for (const tId of taskIds) {
        await db.run('UPDATE tasks SET priority = ? WHERE id = ? AND project_id = ?', [value, tId, projectId]);
      }
    }

    const tasks = await db.all('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC', [projectId]);
    res.json(tasks.map(formatTaskRow));
  } catch (err) {
    console.error('Bulk task operation error:', err);
    res.status(500).json({ error: 'Failed to execute bulk task operation.' });
  }
});

// ================= PROJECT TEMPLATES ENDPOINTS =================

// Get all project templates for user
app.get('/api/templates', authenticate, async (req, res) => {
  try {
    const me = req.user.id;
    const templates = await db.all('SELECT * FROM templates WHERE owner_id = ? ORDER BY created_at DESC', [me]);

    const result = templates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description || '',
      category: t.category || 'General',
      tasks: JSON.parse(t.tasks_json || '[]'),
      createdAt: t.created_at
    }));

    res.json(result);
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ error: 'Failed to fetch templates.' });
  }
});

// Save a project as a reusable template
app.post('/api/templates', authenticate, async (req, res) => {
  try {
    const { name, description, category, tasks } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Template name is required.' });
    }

    const templateId = uuidv4();
    const ownerId = req.user.id;
    const createdAt = new Date().toISOString();
    const formattedTasks = (tasks || []).map(t => ({
      title: t.title,
      description: t.description || '',
      priority: t.priority || 'medium',
      urgent: Boolean(t.urgent),
      important: Boolean(t.important),
      subtasks: (t.subtasks || []).map(s => ({ text: s.text || s.title || '', completed: false }))
    }));

    await db.run(`
      INSERT INTO templates (id, owner_id, name, description, category, tasks_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [templateId, ownerId, name, description || '', category || 'General', JSON.stringify(formattedTasks), createdAt]);

    res.status(201).json({
      id: templateId,
      name,
      description: description || '',
      category: category || 'General',
      tasks: formattedTasks,
      createdAt
    });
  } catch (err) {
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Failed to create template.' });
  }
});

// Delete template
app.delete('/api/templates/:id', authenticate, async (req, res) => {
  try {
    const templateId = req.params.id;
    const me = req.user.id;

    await db.run('DELETE FROM templates WHERE id = ? AND owner_id = ?', [templateId, me]);
    res.json({ message: 'Template deleted.' });
  } catch (err) {
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Failed to delete template.' });
  }
});

// Spin up new project from template
app.post('/api/projects/from-template/:templateId', authenticate, async (req, res) => {
  try {
    const { templateId } = req.params;
    const { projectName, projectDescription } = req.body;
    const me = req.user.id;

    let templateData = null;
    const dbTemplate = await db.get('SELECT * FROM templates WHERE id = ? AND owner_id = ?', [templateId, me]);

    if (dbTemplate) {
      templateData = {
        name: dbTemplate.name,
        description: dbTemplate.description,
        tasks: JSON.parse(dbTemplate.tasks_json || '[]')
      };
    } else if (templateId === 'onboarding') {
      templateData = {
        name: 'New Client Onboarding',
        description: 'Standard client onboarding workflow with tasks',
        tasks: [
          { title: 'Kickoff Call & Requirements', description: 'Schedule introductory meeting and gather project requirements', priority: 'high', urgent: true, important: true, status: 'todo' },
          { title: 'Setup Shared Drive & Repository', description: 'Provision client folder, git repository, and access permissions', priority: 'medium', urgent: false, important: true, status: 'todo' },
          { title: 'Send Welcome Packet & Invoice', description: 'Deliver welcome documents and initial deposit invoice', priority: 'medium', urgent: true, important: false, status: 'todo' }
        ]
      };
    } else if (templateId === 'sprint') {
      templateData = {
        name: 'Sprint Week Plan',
        description: 'Agile sprint iteration template with planning & review tasks',
        tasks: [
          { title: 'Sprint Grooming & Estimation', description: 'Review backlog items and assign story points', priority: 'high', urgent: true, important: true, status: 'todo' },
          { title: 'Feature Development Sprint', description: 'Execute core feature tickets', priority: 'high', urgent: false, important: true, status: 'todo' },
          { title: 'Testing & QA Review', description: 'Run unit & integration test suites', priority: 'medium', urgent: false, important: true, status: 'todo' },
          { title: 'Sprint Retrospective & Demo', description: 'Review sprint velocity and document retro findings', priority: 'low', urgent: false, important: false, status: 'todo' }
        ]
      };
    }

    if (!templateData) {
      return res.status(404).json({ error: 'Template not found.' });
    }

    const projectId = uuidv4();
    const createdAt = new Date().toISOString();

    await db.run(`
      INSERT INTO projects (id, name, description, url, github, owner_id, created_at)
      VALUES (?, ?, ?, '', '', ?, ?)
    `, [projectId, projectName || templateData.name, projectDescription || templateData.description || '', me, createdAt]);

    await db.run(`
      INSERT INTO project_members (id, project_id, user_id, added_by_id, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [uuidv4(), projectId, me, me, createdAt]);

    const createdTasks = [];
    for (const t of (templateData.tasks || [])) {
      const taskId = uuidv4();
      await db.run(`
        INSERT INTO tasks (
          id, project_id, title, description, status, priority, deadline, schedule_date,
          reminder, recurring, urgent, important, time_logged, timer_started,
          subtasks_json, notes_json, custom_fields_json, pomodoro_sessions_json,
          assignee_id, created_by_id, created_at, completed_at
        ) VALUES (?, ?, ?, ?, 'todo', ?, '', '', 0, 'none', ?, ?, 0, NULL, ?, '[]', '{}', '[]', ?, ?, ?, NULL)
      `, [
        taskId,
        projectId,
        t.title,
        t.description || '',
        t.priority || 'medium',
        t.urgent ? 1 : 0,
        t.important ? 1 : 0,
        JSON.stringify(t.subtasks || []),
        me,
        me,
        createdAt
      ]);

      const row = await db.get('SELECT * FROM tasks WHERE id = ?', [taskId]);
      createdTasks.push(formatTaskRow(row));
    }

    const newProject = formatProjectRow({
      id: projectId,
      name: projectName || templateData.name,
      description: projectDescription || templateData.description || '',
      url: '',
      github: '',
      owner_id: me,
      created_at: createdAt
    }, createdTasks, []);

    res.status(201).json(newProject);
  } catch (err) {
    console.error('Spin project from template error:', err);
    res.status(500).json({ error: 'Failed to create project from template.' });
  }
});

// Catch-all route to serve SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Start Server
db.initPromise.then(() => {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(` Track Multi-User Enterprise Server running at http://localhost:${PORT}`);
    console.log(` SQLite Database initialized & WAL journal active.`);
    console.log(`===============================================`);
  });
}).catch(err => {
  console.error('Fatal error during database startup:', err);
});
