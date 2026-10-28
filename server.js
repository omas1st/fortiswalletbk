require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { seedAssetSettings, seedGlobalSettings } = require('./utils/seed');
const { startDailyIncreaseCron } = require('./utils/cron');

const PORT = process.env.PORT || 5000;

(async () => {
  await connectDB();
  await seedAssetSettings();
  await seedGlobalSettings();
  startDailyIncreaseCron();
  app.listen(PORT, () => console.log(`Fortis Wallet API running on port ${PORT}`));
})();