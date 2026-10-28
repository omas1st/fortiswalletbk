const mongoose = require('mongoose');

const AssetSubSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true },
    name: { type: String, required: true },
    amount: { type: Number, default: 0 }, // total USD balance (incl. profit)
    profit: { type: Number, default: 0 }, // cumulative profit contributed to `amount`
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    password: { type: String, required: true },
    walletAddress: { type: String, required: true, unique: true, index: true },
    assets: [AssetSubSchema],
    resetCode: { type: String },
    resetCodeExpiry: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);