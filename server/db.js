const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'track.db');
const rawDb = new sqlite3.Database(DB_PATH);

// Enable WAL mode and foreign key constraints
rawDb.serialize(() => {
  rawDb.run('PRAGMA journal_mode = WAL;');
  rawDb.run('PRAGMA foreign_keys = ON;');
});

const db = {
  rawDb,
  exec(sql) {
    return new Promise((resolve, reject) => {
      rawDb.exec(sql, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  },
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve({ changes: this.changes, lastID: this.lastID });
      });
    });
  },
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  },
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      rawDb.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  },
  prepare(sql) {
    return {
      run(...params) {
        return new Promise((resolve, reject) => {
          rawDb.run(sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params, function (err) {
            if (err) reject(err);
            else resolve({ changes: this.changes, lastID: this.lastID });
          });
        });
      },
      get(...params) {
        return new Promise((resolve, reject) => {
          rawDb.get(sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        });
      },
      all(...params) {
        return new Promise((resolve, reject) => {
          rawDb.all(sql, params.length === 1 && Array.isArray(params[0]) ? params[0] : params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      }
    };
  }
};

async function initSchema() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      display_name TEXT,
      job_title TEXT,
      is_admin INTEGER DEFAULT 0,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS manager_employee (
      id TEXT PRIMARY KEY,
      manager_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(manager_id, employee_id),
      FOREIGN KEY (manager_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      url TEXT DEFAULT '',
      github TEXT DEFAULT '',
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS project_members (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      added_by_id TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(project_id, user_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'todo',
      priority TEXT DEFAULT 'medium',
      deadline TEXT DEFAULT '',
      schedule_date TEXT DEFAULT '',
      reminder INTEGER DEFAULT 0,
      recurring TEXT DEFAULT 'none',
      urgent INTEGER DEFAULT 0,
      important INTEGER DEFAULT 0,
      time_logged REAL DEFAULT 0,
      timer_started TEXT,
      subtasks_json TEXT DEFAULT '[]',
      notes_json TEXT DEFAULT '[]',
      custom_fields_json TEXT DEFAULT '{}',
      pomodoro_sessions_json TEXT DEFAULT '[]',
      assignee_id TEXT,
      created_by_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS time_sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration REAL DEFAULT 0,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'General',
      tasks_json TEXT DEFAULT '[]',
      created_at TEXT NOT NULL,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      entity_type TEXT,
      entity_id TEXT,
      actor_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_mgr_emp_manager ON manager_employee(manager_id);
    CREATE INDEX IF NOT EXISTS idx_mgr_emp_employee ON manager_employee(employee_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_creator ON tasks(created_by_id);
    CREATE INDEX IF NOT EXISTS idx_time_sessions_task ON time_sessions(task_id);
    CREATE INDEX IF NOT EXISTS idx_time_sessions_user ON time_sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at);
  `);
}

db.initPromise = initSchema();

module.exports = db;
