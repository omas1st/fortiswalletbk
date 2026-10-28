const bcrypt = require('bcryptjs');
const Notification = require('../models/Notification');
const Transaction = require('../models/Transaction');
const { findAsset } = require('../utils/assets');

// user.assets[i].amount = total USD balance (incl. profit); .profit = cumulative profit.
async function buildDashboard(user) {
  const assets = (user.assets || []).map((a) => ({
    symbol: a.symbol,
    name: a.name,
    amount: Number(a.amount) || 0,
    profit: Number(a.profit) || 0,
  }));

  const totalBalance = assets.reduce((s, a) => s + a.amount, 0);
  const totalProfit = assets.reduce((s, a) => s + a.profit, 0);

  const [deposits, withdrawals] = await Promise.all([
    Transaction.find({ userId: user._id, type: 'buy' }).sort({ createdAt: -1 }).lean(),
    Transaction.find({ userId: user._id, type: 'withdraw' }).sort({ createdAt: -1 }).lean(),
  ]);

  const totalDeposited = deposits.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const totalWithdrawn = withdrawals.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  return {
    user: {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      walletAddress: user.walletAddress,
    },
    totalBalance,
    totalProfit,
    totalDeposited,
    totalWithdrawn,
    assets,
    deposits,
    withdrawals,
  };
}

exports.getDashboard = async (req, res) => {
  try {
    const dashboard = await buildDashboard(req.user);
    return res.json(dashboard);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.addAsset = async (req, res) => {
  try {
    const { symbol } = req.body;
    const meta = findAsset(symbol);
    if (!meta) return res.status(400).json({ message: 'Unknown asset symbol' });

    const user = req.user;
    const existing = user.assets.find((a) => a.symbol === symbol);
    if (existing) return res.json({ message: 'Asset already added', assets: user.assets });

    user.assets.push({ symbol, name: meta.name, amount: 0, profit: 0 });
    await user.save();
    return res.json({ message: 'Asset added', assets: user.assets });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json({ notifications });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.readAllNotifications = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user._id, read: false }, { read: true });
    return res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ message: 'Both names required' });
    req.user.firstName = firstName.trim();
    req.user.lastName = lastName.trim();
    await req.user.save();
    return res.json({
      message: 'Profile updated',
      user: {
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        email: req.user.email,
        phone: req.user.phone,
        walletAddress: req.user.walletAddress,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'All fields required' });
    const match = await bcrypt.compare(currentPassword, req.user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });
    req.user.password = await bcrypt.hash(newPassword, 10);
    await req.user.save();
    return res.json({ message: 'Password updated' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports.buildDashboard = buildDashboard;