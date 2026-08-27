const db = require('../db');

/**
 * Get direct reports of a user
 */
async function getDirectReports(userId) {
  await db.initPromise;
  const rows = await db.all(`
    SELECT u.id, u.username, u.email, u.display_name, u.job_title, u.is_admin
    FROM manager_employee me
    JOIN users u ON me.employee_id = u.id
    WHERE me.manager_id = ? AND u.is_active = 1
    ORDER BY u.display_name ASC
  `, [userId]);

  return rows.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email || '',
    displayName: u.display_name || u.username,
    jobTitle: u.job_title || '',
    isAdmin: Boolean(u.is_admin)
  }));
}

/**
 * Get all recursive reports (direct and indirect) of a user
 */
async function getRecursiveReports(userId) {
  await db.initPromise;
  const rows = await db.all(`
    WITH RECURSIVE reports AS (
      SELECT employee_id FROM manager_employee WHERE manager_id = ?
      UNION
      SELECT me.employee_id FROM manager_employee me
      JOIN reports r ON me.manager_id = r.employee_id
    )
    SELECT DISTINCT u.id, u.username, u.email, u.display_name, u.job_title, u.is_admin
    FROM reports r
    JOIN users u ON r.employee_id = u.id
    WHERE u.is_active = 1
    ORDER BY u.display_name ASC
  `, [userId]);

  return rows.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email || '',
    displayName: u.display_name || u.username,
    jobTitle: u.job_title || '',
    isAdmin: Boolean(u.is_admin)
  }));
}

/**
 * Get direct managers of a user
 */
async function getManagers(userId) {
  await db.initPromise;
  const rows = await db.all(`
    SELECT u.id, u.username, u.email, u.display_name, u.job_title, u.is_admin
    FROM manager_employee me
    JOIN users u ON me.manager_id = u.id
    WHERE me.employee_id = ? AND u.is_active = 1
    ORDER BY u.display_name ASC
  `, [userId]);

  return rows.map(u => ({
    id: u.id,
    username: u.username,
    email: u.email || '',
    displayName: u.display_name || u.username,
    jobTitle: u.job_title || '',
    isAdmin: Boolean(u.is_admin)
  }));
}

/**
 * Get eligible assignees for a user (self + direct reports + project members)
 */
async function getEligibleAssignees(userId, projectId = null) {
  await db.initPromise;
  const assigneesMap = new Map();

  // 1. Add self
  const self = await db.get('SELECT id, username, email, display_name, job_title, is_admin FROM users WHERE id = ? AND is_active = 1', [userId]);
  if (self) {
    assigneesMap.set(self.id, {
      id: self.id,
      username: self.username,
      email: self.email || '',
      displayName: self.display_name || self.username,
      jobTitle: self.job_title || '',
      isAdmin: Boolean(self.is_admin)
    });
  }

  // 2. Add direct reports
  const reports = await getDirectReports(userId);
  reports.forEach(r => assigneesMap.set(r.id, r));

  // 3. Add project members if projectId provided
  if (projectId) {
    const members = await db.all(`
      SELECT u.id, u.username, u.email, u.display_name, u.job_title, u.is_admin
      FROM project_members pm
      JOIN users u ON pm.user_id = u.id
      WHERE pm.project_id = ? AND u.is_active = 1
      ORDER BY u.display_name ASC
    `, [projectId]);

    members.forEach(u => {
      if (!assigneesMap.has(u.id)) {
        assigneesMap.set(u.id, {
          id: u.id,
          username: u.username,
          email: u.email || '',
          displayName: u.display_name || u.username,
          jobTitle: u.job_title || '',
          isAdmin: Boolean(u.is_admin)
        });
      }
    });
  }

  return Array.from(assigneesMap.values());
}

module.exports = {
  getDirectReports,
  getRecursiveReports,
  getManagers,
  getEligibleAssignees
};
