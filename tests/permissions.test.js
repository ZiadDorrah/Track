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
    // This is the actual regression test for the hardcoded-fallback
    // vulnerability that was found and fixed: a fresh process, in a
    // throwaway directory, with JWT_SECRET deliberately unset, must exit
    // non-zero rather than silently falling back to a known/guessable value.
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

    // Prove it wasn't silently created despite the error.
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
    // firstadmin plays the manager role for this scenario.
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

    // Confirm it wasn't silently applied anyway - the admin must still be
    // able to authenticate and act as themselves afterward.
    const stillWorks = await request(app).get('/api/auth/me').set('Cookie', managerCookies);
    assert.equal(stillWorks.status, 200);
    assert.equal(stillWorks.body.user.isAdmin, true, 'still an admin after the rejected attempt');

    // A real change to someone else must still work normally.
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
