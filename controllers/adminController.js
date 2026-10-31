const mongoose = require('mongoose');
const User = require('../models/User');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const Approval = require('../models/Approval');
const Withdrawal = require('../models/Withdrawal');
const UnverifiedWithdrawal = require('../models/UnverifiedWithdrawal');
const Verification = require('../models/Verification');
const AssetSetting = require('../models/AssetSetting');
const Setting = require('../models/Setting');
const { findAsset } = require('../utils/assets');
const { sendMailAsync } = require('../config/mailer');
const { calculateProfit } = require('../utils/calProfit');

/* ---------- Users ---------- */

exports.listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -resetCode -resetCodeExpiry');
    const result = users.map((u) => ({
      _id: u._id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      walletAddress: u.walletAddress,
      totalBalance: (u.assets || []).reduce((s, a) => s + (Number(a.amount) || 0), 0),
    }));
    return res.json({ users: result });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getUser = async (req, res) => {
  try {
    let user = await User.findById(req.params.id).select('-password -resetCode -resetCodeExpiry');
    if (!user) return res.status(404).json({ message: 'User not found' });

    user = await calculateProfit(user);

    const [transactions, notifications, verification] = await Promise.all([
      Transaction.find({ userId: user._id }).sort({ createdAt: -1 }),
      Notification.find({ userId: user._id }).sort({ createdAt: -1 }),
      Verification.findOne({ userId: user._id }),
    ]);

    const totalBalance = (user.assets || []).reduce((s, a) => s + (Number(a.amount) || 0), 0);

    return res.json({
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        walletAddress: user.walletAddress,
        totalBalance,
      },
      assets: (user.assets || []).map((a) => ({
        symbol: a.symbol,
        name: a.name,
        amount: Number(a.amount) || 0,
        profit: Number(a.profit) || 0,
      })),
      transactions,
      notifications,
      verification,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateAssets = async (req, res) => {
  try {
    const { assets } = req.body;
    if (!Array.isArray(assets)) return res.status(400).json({ message: 'Assets array required' });

    let user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user = await calculateProfit(user);

    for (const edit of assets) {
      const meta = findAsset(edit.symbol);
      if (!meta) continue;
      const idx = user.assets.findIndex((a) => a.symbol === edit.symbol);

      if (idx === -1) {
        user.assets.push({
          symbol: edit.symbol,
          name: meta.name,
          amount: Number(edit.amount) || 0,
          profit: Number(edit.profit) || 0,
        });
        continue;
      }

      const asset = user.assets[idx];
      const oldProfit = Number(asset.profit) || 0;

      if (edit.amount !== undefined && edit.amount !== '' && edit.amount !== null) {
        asset.amount = Number(edit.amount) || 0;
      }

      if (edit.profit !== undefined && edit.profit !== '' && edit.profit !== null) {
        const newProfit = Number(edit.profit) || 0;
        const delta = newProfit - oldProfit;
        asset.amount = Number(asset.amount || 0) + delta;
        asset.profit = newProfit;
      }
    }
    user.markModified('assets');
    await user.save();
    return res.json({ message: 'Assets updated' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ---------- Transactions ---------- */

exports.deleteTransaction = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.txnId)) {
      return res.status(400).json({ message: 'Invalid transaction ID' });
    }
    const txn = await Transaction.findOneAndDelete({
      _id: req.params.txnId,
      userId: req.params.id,
    });
    if (!txn) return res.status(404).json({ message: 'Transaction not found' });
    return res.json({ message: 'Transaction deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ---------- Notifications editing ---------- */

function buildNotifUpdate({ title, message, createdAt }) {
  const update = {};
  if (title !== undefined) update.title = title;
  if (message !== undefined) update.message = message;
  if (createdAt) {
    const d = new Date(createdAt);
    if (!Number.isNaN(d.getTime())) update.createdAt = d;
  }
  return update;
}

exports.updateNotification = async (req, res) => {
  try {
    if (
      !mongoose.Types.ObjectId.isValid(req.params.notifId) ||
      !mongoose.Types.ObjectId.isValid(req.params.id)
    ) {
      return res.status(400).json({ message: 'Invalid ID' });
    }
    const update = buildNotifUpdate(req.body);
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'Nothing to update' });
    }
    const result = await Notification.collection.updateOne(
      {
        _id: new mongoose.Types.ObjectId(req.params.notifId),
        userId: new mongoose.Types.ObjectId(req.params.id),
      },
      { $set: update }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    const notif = await Notification.findById(req.params.notifId);
    return res.json({ message: 'Notification updated', notification: notif });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateNotificationsBulk = async (req, res) => {
  try {
    const { notifications } = req.body;
    if (!Array.isArray(notifications)) {
      return res.status(400).json({ message: 'notifications array required' });
    }
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    const userId = new mongoose.Types.ObjectId(req.params.id);
    let updated = 0;
    let failed = 0;
    for (const n of notifications) {
      if (!n || !n._id || !mongoose.Types.ObjectId.isValid(n._id)) {
        failed += 1;
        continue;
      }
      const update = buildNotifUpdate(n);
      if (Object.keys(update).length === 0) continue;
      // eslint-disable-next-line no-await-in-loop
      const result = await Notification.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(n._id), userId },
        { $set: update }
      );
      if (result.matchedCount > 0) updated += 1;
      else failed += 1;
    }
    return res.json({
      message: `Saved ${updated} notification${updated === 1 ? '' : 's'}${
        failed ? `, ${failed} skipped` : ''
      }`,
      updated,
      failed,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.createNotification = async (req, res) => {
  try {
    const { title, message, createdAt } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Title and message required' });
    const notif = new Notification({ userId: req.params.id, title, message });
    if (createdAt) {
      const d = new Date(createdAt);
      if (!Number.isNaN(d.getTime())) notif.createdAt = d;
    }
    await notif.save();
    return res.json({ message: 'Notification sent', notification: notif });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.deleteNotification = async (req, res) => {
  try {
    const notif = await Notification.findOneAndDelete({
      _id: req.params.notifId,
      userId: req.params.id,
    });
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    return res.json({ message: 'Notification deleted' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ---------- Verifications ---------- */

exports.listVerifications = async (req, res) => {
  try {
    const list = await Verification.find()
      .populate({ path: 'userId', select: 'firstName lastName email walletAddress' })
      .sort({ createdAt: -1 });
    return res.json({
      verifications: list.map((v) => {
        const obj = v.toObject();
        obj.user = obj.userId;
        return obj;
      }),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.approveVerification = async (req, res) => {
  try {
    const v = await Verification.findById(req.params.id);
    if (!v) return res.status(404).json({ message: 'Verification not found' });
    v.status = 'approved';
    await v.save();
    await Notification.create({
      userId: v.userId,
      title: 'Verification Approved',
      message: 'Your identity verification has been approved.',
    });
    return res.json({ message: 'Verification approved' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.setWithdrawalCode = async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: 'Code required' });
    let v = await Verification.findOne({ userId: req.params.userId });
    if (!v) v = await Verification.create({ userId: req.params.userId });
    v.withdrawalCode = String(code).trim();
    await v.save();
    return res.json({ message: 'Withdrawal code set' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ---------- Buy approvals ---------- */

exports.listApprovals = async (req, res) => {
  try {
    const approvals = await Approval.find({ status: 'pending' })
      .populate({ path: 'userId', select: 'firstName lastName email' })
      .sort({ createdAt: -1 });
    return res.json({
      approvals: approvals.map((a) => {
        const obj = a.toObject();
        obj.user = obj.userId;
        return obj;
      }),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.approvePayment = async (req, res) => {
  try {
    const approval = await Approval.findById(req.params.id);
    if (!approval || approval.status !== 'pending') {
      return res.status(404).json({ message: 'Approval not found or already processed' });
    }
    const meta = findAsset(approval.symbol);
    if (!meta) return res.status(400).json({ message: 'Unknown asset' });

    let user = await User.findById(approval.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user = await calculateProfit(user);

    const amountToCredit = Number(approval.amount) || 0;
    const idx = user.assets.findIndex((a) => a.symbol === approval.symbol);
    if (idx === -1) {
      user.assets.push({ symbol: approval.symbol, name: meta.name, amount: amountToCredit, profit: 0 });
    } else {
      user.assets[idx].amount = Number(user.assets[idx].amount || 0) + amountToCredit;
    }
    user.markModified('assets');
    await user.save();

    approval.status = 'approved';
    await approval.save();

    await Transaction.create({
      userId: user._id,
      type: 'buy',
      symbol: approval.symbol,
      amount: amountToCredit,
      description: `Bought $${amountToCredit.toFixed(2)} of ${approval.symbol} via ${approval.method}`,
    });
    await Notification.create({
      userId: user._id,
      title: 'Payment Approved',
      message: `Your payment of $${amountToCredit.toFixed(2)} was approved. $${amountToCredit.toFixed(2)} of ${approval.symbol} credited to your wallet.`,
    });

    sendMailAsync({
      to: user.email,
      subject: 'Fortis Wallet — Payment Approved',
      html: `<p>Hi ${user.firstName},</p>
             <p>Your payment of <b>$${amountToCredit.toFixed(2)}</b> for <b>${approval.symbol}</b> has been approved and your account has been credited.</p>`,
    });

    return res.json({ message: 'Payment approved' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// 🔧 UPDATED: Accepts rejection reason and does not affect user balance
exports.rejectPayment = async (req, res) => {
  try {
    const { reason } = req.body;
    const approval = await Approval.findById(req.params.id);
    if (!approval || approval.status !== 'pending') {
      return res.status(404).json({ message: 'Approval not found or already processed' });
    }
    
    approval.status = 'rejected';
    await approval.save();

    const user = await User.findById(approval.userId);
    if (user) {
      await Notification.create({
        userId: user._id,
        title: 'Payment Rejected',
        message: `Your payment of $${Number(approval.amount).toFixed(2)} for ${approval.symbol} was rejected. Reason: ${reason || 'No reason provided.'}`,
      });
      sendMailAsync({
        to: user.email,
        subject: 'Fortis Wallet — Payment Rejected',
        html: `<p>Hi ${user.firstName},</p>
               <p>Your payment of <b>$${Number(approval.amount).toFixed(2)}</b> for <b>${approval.symbol}</b> was rejected.</p>
               <p><b>Reason:</b> ${reason || 'No reason provided.'}</p>`,
      });
    }
    
    return res.json({ message: 'Payment rejected' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ---------- Withdrawals ---------- */

exports.listWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({ status: 'pending' })
      .populate({ path: 'userId', select: 'firstName lastName email' })
      .sort({ createdAt: -1 });
    return res.json({
      withdrawals: withdrawals.map((w) => {
        const obj = w.toObject();
        obj.user = obj.userId;
        return obj;
      }),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.approveWithdrawal = async (req, res) => {
  try {
    const w = await Withdrawal.findById(req.params.id);
    if (!w || w.status !== 'pending') {
      return res.status(404).json({ message: 'Withdrawal not found or already processed' });
    }
    
    let user = await User.findById(w.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user = await calculateProfit(user);

    const idx = user.assets.findIndex((a) => a.symbol === w.symbol);
    if (idx === -1 || Number(user.assets[idx].amount) < Number(w.amount)) {
      return res.status(400).json({ message: 'User has insufficient balance to complete withdrawal' });
    }
    user.assets[idx].amount = Number(user.assets[idx].amount) - Number(w.amount);
    user.markModified('assets');
    await user.save();

    w.status = 'successful';
    w.approvedAt = new Date();
    await w.save();

    await Transaction.create({
      userId: user._id,
      type: 'withdraw',
      symbol: w.symbol,
      amount: w.amount,
      description: `Withdrew $${Number(w.amount).toFixed(2)} of ${w.symbol} to ${w.bankName || 'bank'}`,
    });
    await Notification.create({
      userId: user._id,
      title: 'Withdrawal Successful',
      message: `Your withdrawal of $${Number(w.amount).toFixed(2)} of ${w.symbol} was successful.`,
    });

    sendMailAsync({
      to: user.email,
      subject: 'Fortis Wallet — Withdrawal Successful',
      html: `<p>Hi ${user.firstName},</p>
             <p>Your withdrawal of <b>$${Number(w.amount).toFixed(2)} ${w.symbol}</b> has been processed successfully.</p>`,
    });

    return res.json({ message: 'Withdrawal approved' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// 🔧 NEW: Reject Withdrawal (No balance deduction occurs)
exports.rejectWithdrawal = async (req, res) => {
  try {
    const { reason } = req.body;
    const w = await Withdrawal.findById(req.params.id);
    if (!w || w.status !== 'pending') {
      return res.status(404).json({ message: 'Withdrawal not found or already processed' });
    }

    w.status = 'rejected';
    await w.save();

    const user = await User.findById(w.userId);
    if (user) {
      await Notification.create({
        userId: user._id,
        title: 'Withdrawal Rejected',
        message: `Your withdrawal of $${Number(w.amount).toFixed(2)} of ${w.symbol} was rejected. Reason: ${reason || 'No reason provided.'}`,
      });
      sendMailAsync({
        to: user.email,
        subject: 'Fortis Wallet — Withdrawal Rejected',
        html: `<p>Hi ${user.firstName},</p>
               <p>Your withdrawal of <b>$${Number(w.amount).toFixed(2)} ${w.symbol}</b> was rejected.</p>
               <p><b>Reason:</b> ${reason || 'No reason provided.'}</p>`,
      });
    }

    return res.json({ message: 'Withdrawal rejected' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ---------- Unverified Withdrawals ---------- */

exports.listUnverifiedWithdrawals = async (req, res) => {
  try {
    const list = await UnverifiedWithdrawal.find({ status: 'pending_approval' })
      .populate({ path: 'userId', select: 'firstName lastName email' })
      .sort({ createdAt: -1 });
    return res.json({
      withdrawals: list.map((w) => {
        const obj = w.toObject();
        obj.user = obj.userId;
        return obj;
      }),
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.approveUnverifiedWithdrawal = async (req, res) => {
  try {
    const record = await UnverifiedWithdrawal.findById(req.params.id);
    if (!record || record.status !== 'pending_approval') {
      return res.status(404).json({ message: 'Record not found or already processed' });
    }

    if (record.tier === 1) {
      record.tier = 2;
      record.currentPaymentAmount = 10000 * 0.1;
      record.status = 'pending_payment';
    } else if (record.tier === 2) {
      record.tier = 3;
      record.currentPaymentAmount = 50000 * 0.1;
      record.status = 'pending_payment';
    } else if (record.tier === 3) {
      record.tier = 4;
      record.currentPaymentAmount = 100000 * 0.1;
      record.status = 'pending_payment';
    } else if (record.tier === 4) {
      record.status = 'completed';
    }

    await record.save();
    return res.json({ message: 'Unverified withdrawal payment approved', data: record });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// 🔧 UPDATED: Accepts rejection reason
exports.rejectUnverifiedWithdrawal = async (req, res) => {
  try {
    const { reason } = req.body;
    const record = await UnverifiedWithdrawal.findById(req.params.id);
    if (!record || record.status !== 'pending_approval') {
      return res.status(404).json({ message: 'Record not found or already processed' });
    }
    record.status = 'rejected';
    await record.save();

    const user = await User.findById(record.userId);
    if (user) {
      await Notification.create({
        userId: user._id,
        title: 'Unverified Payment Rejected',
        message: `Your unverified withdrawal payment was rejected. Reason: ${reason || 'No reason provided.'}`,
      });
      sendMailAsync({
        to: user.email,
        subject: 'Fortis Wallet — Unverified Payment Rejected',
        html: `<p>Hi ${user.firstName},</p>
               <p>Your unverified withdrawal payment was rejected.</p>
               <p><b>Reason:</b> ${reason || 'No reason provided.'}</p>`,
      });
    }

    return res.json({ message: 'Unverified withdrawal payment rejected' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/* ---------- Global settings ---------- */

exports.getSettings = async (req, res) => {
  try {
    const assets = await AssetSetting.find();
    let global = await Setting.findOne({ key: 'global' });
    if (!global) {
      global = await Setting.create({
        key: 'global',
        paypalId: process.env.PAYPAL_ID || process.env.REACT_APP_PAYPAL_ID || 'payments@fortiswallet.com',
        cardLocked: false,
        paypalLocked: false,
        giftCardLocked: false,
      });
    }
    return res.json({
      assets: assets.map((s) => ({ symbol: s.symbol, name: s.name, percent: s.percent })),
      paypalId: global.paypalId,
      cardLocked: !!global.cardLocked,
      paypalLocked: !!global.paypalLocked,
      giftCardLocked: !!global.giftCardLocked,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updatePercent = async (req, res) => {
  try {
    const { percent } = req.body;
    const setting = await AssetSetting.findOne({ symbol: req.params.symbol });
    if (!setting) return res.status(404).json({ message: 'Asset not found' });
    setting.percent = Number(percent) || 0;
    await setting.save();
    return res.json({ message: 'Percentage updated', setting });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updatePaypalId = async (req, res) => {
  try {
    const { paypalId } = req.body;
    if (!paypalId || !String(paypalId).trim()) {
      return res.status(400).json({ message: 'PayPal ID required' });
    }
    const global = await Setting.findOneAndUpdate(
      { key: 'global' },
      { $set: { paypalId: String(paypalId).trim() } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({ message: 'PayPal ID updated', paypalId: global.paypalId });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updatePaymentLocks = async (req, res) => {
  try {
    const { cardLocked, paypalLocked, giftCardLocked } = req.body;
    const update = {};
    if (typeof cardLocked === 'boolean') update.cardLocked = cardLocked;
    if (typeof paypalLocked === 'boolean') update.paypalLocked = paypalLocked;
    if (typeof giftCardLocked === 'boolean') update.giftCardLocked = giftCardLocked;
    
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No lock fields provided' });
    }
    const global = await Setting.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return res.json({
      message: 'Payment locks updated',
      cardLocked: !!global.cardLocked,
      paypalLocked: !!global.paypalLocked,
      giftCardLocked: !!global.giftCardLocked,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.triggerDailyIncrease = async (req, res) => {
  try {
    const users = await User.find();
    let processed = 0;
    for (const user of users) {
      await calculateProfit(user);
      processed++;
    }
    return res.json({ message: `Profit calculated successfully for ${processed} users` });
  } catch (err) {
    console.error('[admin] trigger increase failed:', err);
    return res.status(500).json({ message: err.message });
  }
};