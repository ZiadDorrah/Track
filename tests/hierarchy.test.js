const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupTestDb, cleanupTestDb, extractCookies } = require('./helpers.js');

const testDbPath = setupTestDb();

const request = require('supertest');
const app = require('../server.js');
const db = require('../server/db.js');
const { getDirectReports, getRecursiveReports, getManagers, getEligibleAssignees } = require('../server/lib/hierarchy.js');

test('Hierarchy traversal - real data, real HTTP setup, no early-return bailouts', async (t) => {
  await db.initPromise;

  // Bootstrap the first (admin) account, then provision a 3-level chain
  // through the real admin API: managerA -> employeeX -> employeeZ, plus a
  // sibling employeeY who also reports to managerA, and an outsider with no
  // relationship to any of them.
  let adminCookies;
  const ids = {};

  await t.test('setup: bootstrap admin + provision a real 3-level hierarchy', async () => {
    const signup = await request(app)
      .post('/api/auth/signup')
      .send({ username: 'managerA', password: 'Pass123!ABC', displayName: 'Manager A' });
    assert.equal(signup.status, 201);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'managerA', password: 'Pass123!ABC' });
    assert.equal(login.status, 200);
    adminCookies = extractCookies(login);
    ids.managerA = login.body.user.id;

    const provision = async (username) => {
      const res = await request(app)
        .post('/api/admin/users')
        .set('Cookie', adminCookies)
        .send({ username, password: 'Pass123!ABC' });
      assert.equal(res.status, 201, `provisioning ${username} should succeed`);
      return res.body.userId;
    };

    ids.employeeX = await provision('employeeX');
    ids.employeeY = await provision('employeeY');
    ids.employeeZ = await provision('employeeZ');
    ids.outsider = await provision('outsider');

    const link = async (managerId, employeeId) => {
      const res = await request(app)
        .post('/api/admin/managers')
        .set('Cookie', adminCookies)
        .send({ managerId, employeeId });
      assert.equal(res.status, 201, 'manager link should be created');
    };

    await link(ids.managerA, ids.employeeX);
    await link(ids.managerA, ids.employeeY);
    await link(ids.employeeX, ids.employeeZ);
  });

  await t.test('getDirectReports returns exactly the direct reports, no more, no fewer', async () => {
    const reports = await getDirectReports(ids.managerA);
    const reportIds = reports.map(r => r.id).sort();
    assert.deepEqual(reportIds, [ids.employeeX, ids.employeeY].sort(), 'managerA directly manages X and Y only');

    const outsiderReports = await getDirectReports(ids.outsider);
    assert.deepEqual(outsiderReports, [], 'an unrelated user has no reports');
  });

  await t.test('getRecursiveReports includes the skip-level report, not just direct ones', async () => {
    const recursive = await getRecursiveReports(ids.managerA);
    const recursiveIds = recursive.map(r => r.id).sort();
    assert.deepEqual(recursiveIds, [ids.employeeX, ids.employeeY, ids.employeeZ].sort(),
      'managerA\'s recursive reports include X, Y, and skip-level Z');
  });

  await t.test('getManagers returns the real manager, not everyone', async () => {
    const managersOfX = await getManagers(ids.employeeX);
    assert.deepEqual(managersOfX.map(m => m.id), [ids.managerA], 'X\'s only manager is managerA');

    const managersOfOutsider = await getManagers(ids.outsider);
    assert.deepEqual(managersOfOutsider, [], 'an unrelated user has no managers');
  });

  await t.test('getEligibleAssignees puts self first, then direct reports, excludes unrelated users', async () => {
    const assignees = await getEligibleAssignees(ids.managerA);
    const assigneeIds = assignees.map(a => a.id);
    assert.equal(assigneeIds[0], ids.managerA, 'self is always first');
    assert.ok(assigneeIds.includes(ids.employeeX), 'direct report X is eligible');
    assert.ok(assigneeIds.includes(ids.employeeY), 'direct report Y is eligible');
    assert.ok(!assigneeIds.includes(ids.employeeZ), 'skip-level report Z is not directly eligible');
    assert.ok(!assigneeIds.includes(ids.outsider), 'unrelated user is not eligible');
  });

  await t.test('cycle detection rejects a manager link that would loop the hierarchy', async () => {
    // A -> X -> Z already exists. Linking Z as a manager of A would close
    // the loop (A reports to X reports to Z reports to A).
    const res = await request(app)
      .post('/api/admin/managers')
      .set('Cookie', adminCookies)
      .send({ managerId: ids.employeeZ, employeeId: ids.managerA });
    assert.equal(res.status, 400, 'a cycle-creating link must be rejected');
    assert.match(res.body.error, /loop|cycle/i);

    // Confirm it was actually rejected, not just reported as an error -
    // managerA's manager list should still be empty.
    const managersOfA = await getManagers(ids.managerA);
    assert.deepEqual(managersOfA, [], 'the rejected link must not have been written');
  });
});

after(() => {
  cleanupTestDb(testDbPath);
});
