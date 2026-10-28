const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema(
  {
    key: { type: String, unique: true, default: 'global', index: true },
    paypalId: { type: String, default: '' },
    cardLocked: { type: Boolean, default: false },
    paypalLocked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', SettingSchema);