const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    symbol: { type: String, required: true },
    amount: { type: Number, required: true },
    bankName: { type: String },
    bankAddress: { type: String },
    status: { type: String, enum: ['pending', 'successful', 'rejected'], default: 'pending' },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Withdrawal', WithdrawalSchema);