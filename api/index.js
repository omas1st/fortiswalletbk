require('dotenv').config();
const app = require('../app');
const connectDB = require('../config/db');
const { seedAssetSettings, seedGlobalSettings } = require('../utils/seed');

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
  try {
    await ensureReady();
  } catch (err) {
    console.error('Init failed:', err);
    return res.status(500).json({ message: 'Server initializing, please retry' });
  }
  return app(req, res);
};