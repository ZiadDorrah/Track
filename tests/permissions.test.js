const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const jwt = require('jsonwebtoken');
const { setupTestDb, cleanupTestDb, extractCookies } = require('./helpers.js');

const testDbPath = setupTestDb();

const request = require('supertest');
const app = require('../server.js');
const db = require('../server/db.js');

test('Auth & permissions - real HTTP requests against the actual routes, isolated DB', async (t) => {
  await db.initPromise;

  await t.test('server refuses to start without a real JWT_SECRET', () => {
    const scratchDb = path.join(os.tmpdir(), `track-startup-test-${crypto.randomBytes(6).toString('hex')}.db`);
    const result = spawnSync(process.execPath, ['-e', "require('./server.js')"], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, JWT_SECRET: '', DB_PATH: scratchDb, PATH: process.env.PATH },
      encoding: 'utf8'
    });
    assert.equal(result.status, 1, 'process must exit(1) with no JWT_SECRET');
    assert.match(result.stderr, /JWT_SECRET/, 'the failure must explain why');
  });

  await t.test('server also refuses a too-short JWT_SECRET', () => {
    const scratchDb = path.join(os.tmpdir(), `track-startup-test-${crypto.randomBytes(6).toString('hex')}.db`);
    const result = spawnSync(process.execPath, ['-e', "require('./server.js')"], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, JWT_SECRET: 'tooshort', DB_PATH: scratchDb, PATH: process.env.PATH },
      encoding: 'utf8'
    });
    assert.equal(result.status, 1, 'process must exit(1) with a weak JWT_SECRET');
  });

  let bootstrapCookies;

  await t.test('signup bootstraps the first account as admin', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'firstadmin', password: 'CorrectPass123!' });
    assert.equal(res.status, 201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'firstadmin', password: 'CorrectPass123!' });
    assert.equal(login.status, 200);
    assert.equal(login.body.user.isAdmin, true, 'the very first account becomes admin');
    bootstrapCookies = extractCookies(login);
  });

  await t.test('password hashing actually gates login through the real routes', async () => {
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'firstadmin', password: 'WrongPassword123!' });
    assert.equal(wrongPassword.status, 401, 'a wrong password must be rejected');

    const rightPassword = await request(app)
      .post('/api/auth/login')
      .send({ username: 'firstadmin', password: 'CorrectPass123!' });
    assert.equal(rightPassword.status, 200, 'the correct password must still work');
  });

  await t.test('self-signup is locked out once the system is populated, and creates nothing', async () => {
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'sneaky', password: 'WhateverPass123!' });
    assert.equal(res.status, 403, 'signup must be rejected once a user already exists');

    const loginAttempt = await request(app)
      .post('/api/auth/login')
      .send({ username: 'sneaky', password: 'WhateverPass123!' });
    assert.equal(loginAttempt.status, 401, 'the rejected account must not actually exist');
  });

  await t.test('a token forged with the wrong secret is rejected, not just a right one accepted', async () => {
    const forged = jwt.sign({ sub: 'anyone', isAdmin: true }, 'a-completely-different-guessed-secret-value', { expiresIn: '30m' });
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', [`access_token=${forged}`]);
    assert.equal(res.status, 401, 'a token signed with the wrong secret must be rejected');
  });

  let managerCookies, employeeCookies, outsiderCookies;
  const ids = {};

  await t.test('setup: a manager, their report, and an unrelated outsider', async () => {
    const me = await request(app).get('/api/auth/me').set('Cookie', bootstrapCookies);
    ids.manager = me.body.user.id;
    managerCookies = bootstrapCookies;

    const provisioned = await request(app)
      .post('/api/admin/users')
      .set('Cookie', managerCookies)
      .send({ username: 'reportX', password: 'Pass123!ABC' });
    ids.report = provisioned.body.userId;

    const outsider = await request(app)
      .post('/api/admin/users')
      .set('Cookie', managerCookies)
      .send({ username: 'outsiderY', password: 'Pass123!ABC' });
    ids.outsider = outsider.body.userId;

    await request(app)
      .post('/api/admin/managers')
      .set('Cookie', managerCookies)
      .send({ managerId: ids.manager, employeeId: ids.report });

    const empLogin = await request(app).post('/api/auth/login').send({ username: 'reportX', password: 'Pass123!ABC' });
    employeeCookies = extractCookies(empLogin);

    const outLogin = await request(app).post('/api/auth/login').send({ username: 'outsiderY', password: 'Pass123!ABC' });
    outsiderCookies = extractCookies(outLogin);
  });

  let projectId, taskId;

  await t.test('manager creates a project and assigns a task to their report', async () => {
    const proj = await request(app)
      .post('/api/projects')
      .set('Cookie', managerCookies)
      .send({ name: 'Confidential Project' });
    assert.equal(proj.status, 201);
    projectId = proj.body.id;

    const task = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Cookie', managerCookies)
      .send({ title: 'Assigned task', assigneeId: ids.report });
    assert.equal(task.status, 201);
    taskId = task.body.id;
  });

  await t.test('the assigned report sees exactly their own task, nothing more', async () => {
    const res = await request(app).get('/api/projects').set('Cookie', employeeCookies);
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1, 'the report should see exactly one project');
    assert.equal(res.body[0].tasks.length, 1, 'and exactly one task inside it');
    assert.equal(res.body[0].tasks[0].id, taskId);
  });

  await t.test('Phase 12: Directory scoping on /api/users/all', async () => {
    const adminRes = await request(app).get('/api/users/all').set('Cookie', managerCookies);
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.body.length, 3, 'admin sees all 3 users in directory');

    const outsiderRes = await request(app).get('/api/users/all').set('Cookie', outsiderCookies);
    assert.equal(outsiderRes.status, 200);
    assert.equal(outsiderRes.body.length, 1, 'outsider sees only self in directory scoping');
    assert.equal(outsiderRes.body[0].username, 'outsiderY');
  });

  await t.test('Phase 12: KPI Dashboard Anonymization for non-admin users', async () => {
    const adminKpi = await request(app).get('/api/kpi/dashboard').set('Cookie', managerCookies);
    assert.equal(adminKpi.status, 200);
    const unredactedProject = adminKpi.body.projectHealthList.find(p => p.id === projectId);
    assert.equal(unredactedProject.name, 'Confidential Project', 'admin sees unredacted project name');

    const outsiderKpi = await request(app).get('/api/kpi/dashboard').set('Cookie', outsiderCookies);
    assert.equal(outsiderKpi.status, 200);
    // The real project id/name must not appear at all for an outsider - not
    // just have its name swapped while the real id (a stable, trackable
    // identifier) leaks through.
    assert.equal(
      outsiderKpi.body.projectHealthList.find(p => p.id === projectId),
      undefined,
      'the real project id must not be exposed to a non-admin who cannot access it'
    );
    const anonymizedEntry = outsiderKpi.body.projectHealthList.find(p => p.totalTasks === unredactedProject.totalTasks);
    assert.ok(anonymizedEntry, 'the project still appears in the list, under a synthetic id');
    assert.match(anonymizedEntry.name, /Workspace Project/, 'non-admin sees an anonymized project name');
    assert.match(anonymizedEntry.id, /^anon-project-/, 'non-admin gets a synthetic id, not the real one');
  });

  let teamLeadCookies;
  const skipLevelIds = {};

  await t.test('Phase 12 fix: directory scoping is recursive, not direct-only', async () => {
    const teamLead = await request(app)
      .post('/api/admin/users')
      .set('Cookie', managerCookies)
      .send({ username: 'teamLeadA', password: 'Pass123!ABC' });
    skipLevelIds.teamLead = teamLead.body.userId;

    const reportB = await request(app)
      .post('/api/admin/users')
      .set('Cookie', managerCookies)
      .send({ username: 'reportB', password: 'Pass123!ABC' });
    skipLevelIds.reportB = reportB.body.userId;

    const reportC = await request(app)
      .post('/api/admin/users')
      .set('Cookie', managerCookies)
      .send({ username: 'reportC', password: 'Pass123!ABC' });
    skipLevelIds.reportC = reportC.body.userId;

    await request(app).post('/api/admin/managers').set('Cookie', managerCookies)
      .send({ managerId: skipLevelIds.teamLead, employeeId: skipLevelIds.reportB });
    await request(app).post('/api/admin/managers').set('Cookie', managerCookies)
      .send({ managerId: skipLevelIds.reportB, employeeId: skipLevelIds.reportC });

    const teamLeadLogin = await request(app).post('/api/auth/login').send({ username: 'teamLeadA', password: 'Pass123!ABC' });
    teamLeadCookies = extractCookies(teamLeadLogin);

    const directory = await request(app).get('/api/users/all').set('Cookie', teamLeadCookies);
    assert.equal(directory.status, 200);
    const directoryIds = directory.body.map(u => u.id);
    assert.ok(directoryIds.includes(skipLevelIds.reportB), 'teamLeadA sees their direct report');
    assert.ok(directoryIds.includes(skipLevelIds.reportC), 'teamLeadA also sees the skip-level report (reportB\'s own report) - recursive, not direct-only');
  });

  await t.test('Phase 12 fix: KPI memberWorkloadList no longer redacts a name the caller can already see', async () => {
    const proj = await request(app).post('/api/projects').set('Cookie', teamLeadCookies).send({ name: 'TeamLead Project' });
    const task = await request(app)
      .post(`/api/projects/${proj.body.id}/tasks`)
      .set('Cookie', teamLeadCookies)
      .send({ title: 'Report task', assigneeId: skipLevelIds.reportB });
    assert.equal(task.status, 201);

    const teamLeadKpi = await request(app).get('/api/kpi/dashboard').set('Cookie', teamLeadCookies);
    assert.equal(teamLeadKpi.status, 200);
    const reportEntry = teamLeadKpi.body.memberWorkloadList.find(m => m.userId === skipLevelIds.reportB);
    assert.ok(reportEntry, 'teamLeadA (non-admin) can find their direct report\'s real entry by real userId');
    assert.equal(reportEntry.displayName, 'ReportB', 'a manager sees their own direct report\'s real name, not "Team Member N"');

    const outsiderKpi = await request(app).get('/api/kpi/dashboard').set('Cookie', outsiderCookies);
    const outsiderEntry = outsiderKpi.body.memberWorkloadList.find(m => m.userId === skipLevelIds.reportB);
    assert.equal(outsiderEntry, undefined, 'someone with no relationship to reportB must not see their real userId at all');
    const outsiderAnon = outsiderKpi.body.memberWorkloadList.find(m => /^anon-member-/.test(m.userId));
    assert.ok(outsiderAnon, 'reportB still appears to the outsider, but under a synthetic id/name');
  });

  await t.test('Phase 12 fix: bulk assignee action rejects an invalid target instead of silently no-oping', async () => {
    const proj = await request(app).post('/api/projects').set('Cookie', teamLeadCookies).send({ name: 'Bulk Assignee Project' });
    const task = await request(app)
      .post(`/api/projects/${proj.body.id}/tasks`)
      .set('Cookie', teamLeadCookies)
      .send({ title: 'Reassign me', assigneeId: skipLevelIds.reportB });

    const bulk = await request(app)
      .post(`/api/projects/${proj.body.id}/tasks/bulk`)
      .set('Cookie', teamLeadCookies)
      .send({ taskIds: [task.body.id], action: 'assignee', value: '00000000-0000-0000-0000-000000000000' });
    assert.equal(bulk.status, 400, 'an invalid bulk-assignee target must be rejected, not silently accepted');

    const stillAssigned = await request(app).get('/api/projects').set('Cookie', teamLeadCookies);
    const bulkProject = stillAssigned.body.find(p => p.id === proj.body.id);
    const unchangedTask = bulkProject.tasks.find(t => t.id === task.body.id);
    assert.equal(unchangedTask.assigneeId, skipLevelIds.reportB, 'the original assignee must be untouched after the rejected bulk call');
  });

  await t.test('Phase 13 fix: GET /api/notifications includes isRead on every item', async () => {
    const before = await request(app).get('/api/notifications').set('Cookie', employeeCookies);
    assert.equal(before.status, 200);
    assert.ok(before.body.notifications.length > 0, 'the report should have at least the task_assigned notification from earlier');
    for (const n of before.body.notifications) {
      assert.equal(typeof n.isRead, 'boolean', `notification ${n.id} must have a boolean isRead field`);
    }
    const unreadOne = before.body.notifications.find(n => n.isRead === false);
    assert.ok(unreadOne, 'at least one notification should still be unread at this point');

    await request(app).put(`/api/notifications/${unreadOne.id}/read`).set('Cookie', employeeCookies);
    const after = await request(app).get('/api/notifications').set('Cookie', employeeCookies);
    const updated = after.body.notifications.find(n => n.id === unreadOne.id);
    assert.equal(updated.isRead, true, 'isRead must flip to true after marking read, not just the unreadCount summary');
  });

  await t.test('an unrelated outsider sees nothing at all', async () => {
    const res = await request(app).get('/api/projects').set('Cookie', outsiderCookies);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, [], 'someone with no relationship to the project must see an empty list');
  });

  await t.test('the outsider cannot reach the task directly either', async () => {
    const res = await request(app)
      .put(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Cookie', outsiderCookies)
      .send({ title: 'hijacked', status: 'done' });
    assert.equal(res.status, 404, 'an outsider must not be able to modify a task in a project they cannot see');
  });

  await t.test('an admin cannot deactivate or de-admin their own account', async () => {
    const deactivateSelf = await request(app)
      .put(`/api/admin/users/${ids.manager}`)
      .set('Cookie', managerCookies)
      .send({ isActive: false });
    assert.equal(deactivateSelf.status, 400, 'self-deactivation must be rejected');

    const demoteSelf = await request(app)
      .put(`/api/admin/users/${ids.manager}`)
      .set('Cookie', managerCookies)
      .send({ isAdmin: false });
    assert.equal(demoteSelf.status, 400, 'self-demotion must be rejected');

    const stillWorks = await request(app).get('/api/auth/me').set('Cookie', managerCookies);
    assert.equal(stillWorks.status, 200);
    assert.equal(stillWorks.body.user.isAdmin, true, 'still an admin after the rejected attempt');

    const editOther = await request(app)
      .put(`/api/admin/users/${ids.report}`)
      .set('Cookie', managerCookies)
      .send({ jobTitle: 'Senior Engineer' });
    assert.equal(editOther.status, 200, 'editing someone else is unaffected by the self-lockout guard');
  });
});

after(() => {
  cleanupTestDb(testDbPath);
});
