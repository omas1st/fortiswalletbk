const mongoose = require('mongoose');

const ApprovalSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String },
    email: { type: String },
    symbol: { type: String, required: true },
    amount: { type: Number, required: true },
    method: { type: String, default: 'card' },
    cardLast4: { type: String },
    cardName: { type: String },
    totalBalance: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Approval', ApprovalSchema);