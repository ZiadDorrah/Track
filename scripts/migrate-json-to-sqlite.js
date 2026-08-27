const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const db = require('../server/db');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

async function runMigration() {
  console.log('Starting migration from JSON files to SQLite...');
  await db.initPromise;

  if (!fs.existsSync(USERS_FILE)) {
    console.log('No users.json file found. Migration skipped.');
    return;
  }

  let users = [];
  try {
    users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch (err) {
    console.error('Failed to parse users.json:', err.message);
    return;
  }

  let importedUsersCount = 0;
  let importedProjectsCount = 0;
  let importedTasksCount = 0;
  let importedTimeSessionsCount = 0;
  let importedTemplatesCount = 0;

  for (const u of users) {
    const email = `${u.username.toLowerCase()}@company.local`;
    const displayName = u.username.charAt(0).toUpperCase() + u.username.slice(1);
    const jobTitle = u.username.toLowerCase() === 'admin' ? 'System Administrator' : 'Software Engineer';
    const isAdmin = u.username.toLowerCase() === 'admin' ? 1 : 0;
    const createdAt = new Date().toISOString();

    const userRes = await db.run(`
      INSERT OR IGNORE INTO users (id, username, email, display_name, job_title, is_admin, salt, password_hash, created_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [u.id, u.username, email, displayName, jobTitle, isAdmin, u.salt, u.passwordHash, createdAt]);

    if (userRes.changes > 0) importedUsersCount++;

    const userFilePath = path.join(DATA_DIR, `user_${u.id}.json`);
    if (fs.existsSync(userFilePath)) {
      let userData;
      try {
        userData = JSON.parse(fs.readFileSync(userFilePath, 'utf8'));
      } catch (e) {
        console.error(`Error reading ${userFilePath}:`, e.message);
        continue;
      }

      const projects = userData.projects || [];
      for (const p of projects) {
        const pCreated = p.createdAt || createdAt;
        const projRes = await db.run(`
          INSERT OR IGNORE INTO projects (id, name, description, url, github, owner_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [p.id, p.name, p.description || '', p.url || '', p.github || '', u.id, pCreated]);

        if (projRes.changes > 0) importedProjectsCount++;

        await db.run(`
          INSERT OR IGNORE INTO project_members (id, project_id, user_id, added_by_id, created_at)
          VALUES (?, ?, ?, ?, ?)
        `, [uuidv4(), p.id, u.id, u.id, pCreated]);

        const tasks = p.tasks || [];
        for (const t of tasks) {
          const taskRes = await db.run(`
            INSERT OR IGNORE INTO tasks (
              id, project_id, title, description, status, priority, deadline, schedule_date,
              reminder, recurring, urgent, important, time_logged, timer_started,
              subtasks_json, notes_json, custom_fields_json, pomodoro_sessions_json,
              assignee_id, created_by_id, created_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            t.id,
            p.id,
            t.title,
            t.description || '',
            t.status || 'todo',
            t.priority || 'medium',
            t.deadline || '',
            t.scheduleDate || '',
            t.reminder ? 1 : 0,
            t.recurring || 'none',
            t.urgent ? 1 : 0,
            t.important ? 1 : 0,
            t.timeLogged || 0,
            t.timerStarted || null,
            JSON.stringify(t.subtasks || []),
            JSON.stringify(t.notes || []),
            JSON.stringify(t.customFields || {}),
            JSON.stringify(t.pomodoroSessions || []),
            u.id,
            u.id,
            t.createdAt || createdAt,
            t.completedAt || null
          ]);
          if (taskRes.changes > 0) importedTasksCount++;

          const timeSessions = t.timeSessions || [];
          for (const ts of timeSessions) {
            const tsRes = await db.run(`
              INSERT OR IGNORE INTO time_sessions (id, task_id, user_id, start_time, end_time, duration)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [
              ts.id || uuidv4(),
              t.id,
              u.id,
              ts.startTime,
              ts.endTime || null,
              ts.duration || 0
            ]);
            if (tsRes.changes > 0) importedTimeSessionsCount++;
          }
        }
      }

      const templates = userData.templates || [];
      for (const tmpl of templates) {
        const tmplRes = await db.run(`
          INSERT OR IGNORE INTO templates (id, owner_id, name, description, category, tasks_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          tmpl.id,
          u.id,
          tmpl.name,
          tmpl.description || '',
          tmpl.category || 'General',
          JSON.stringify(tmpl.tasks || []),
          tmpl.createdAt || createdAt
        ]);
        if (tmplRes.changes > 0) importedTemplatesCount++;
      }
    }
  }

  console.log(`Migration Summary:
- Users: ${importedUsersCount}
- Projects: ${importedProjectsCount}
- Tasks: ${importedTasksCount}
- Time Sessions: ${importedTimeSessionsCount}
- Templates: ${importedTemplatesCount}`);
  console.log('Migration completed successfully.');
}

runMigration().catch(err => {
  console.error('MIGRATION FATAL ERROR:', err);
  process.exit(1);
});
