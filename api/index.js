require('dotenv').config();
const app = require('../app');
const connectDB = require('../config/db');
const { seedAssetSettings, seedGlobalSettings } = require('../utils/seed');
const { applyCorsHeaders } = require('../config/cors');

let ready = false;
let initPromise = null;

async function ensureReady() {
  if (ready) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await connectDB();
    await seedAssetSettings();
    await seedGlobalSettings();
    ready = true;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}

module.exports = async (req, res) => {
  // 🔧 CRITICAL: set CORS headers BEFORE any async work so preflight never waits on DB.
  try {
    applyCorsHeaders(req, res);
  } catch (e) {
    /* headers already sent? ignore */
  }

  // 🔧 Short-circuit preflight — no need to hit MongoDB for an OPTIONS.
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  try {
    await ensureReady();
  } catch (err) {
    console.error('Init failed:', err);
    // CORS headers already set above, so the browser will see this 500 properly.
    return res.status(500).json({
      message: 'Server is initializing. Please retry in a few seconds.',
    });
  }

  return app(req, res);
};