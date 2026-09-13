const path = require('path');
const os = require('os');
const fs = require('fs');
const crypto = require('crypto');

// Points server/db.js at a fresh, isolated database file instead of the
// real data/track.db this app actually runs on. Must be called before
// requiring server.js or server/db.js for the override to take effect.
function setupTestDb() {
  const testDbPath = path.join(os.tmpdir(), `track-test-${crypto.randomBytes(6).toString('hex')}.db`);
  process.env.DB_PATH = testDbPath;
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = crypto.randomBytes(64).toString('hex');
  }
  return testDbPath;
}

function cleanupTestDb(testDbPath) {
  for (const suffix of ['', '-shm', '-wal']) {
    try { fs.unlinkSync(testDbPath + suffix); } catch (e) { /* fine if it never existed */ }
  }
}

// Pulls the cookies this app actually sets (access_token / refresh_token /
// session_token) out of a supertest response's raw Set-Cookie headers, in a
// form that can be passed straight to `.set('Cookie', ...)` on the next request.
function extractCookies(res) {
  const raw = res.headers['set-cookie'] || [];
  return raw.map(c => c.split(';')[0]);
}

module.exports = { setupTestDb, cleanupTestDb, extractCookies };
