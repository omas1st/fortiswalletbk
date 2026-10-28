const Approval = require('../models/Approval');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const { findAsset } = require('../utils/assets');
const { notifyAdminAsync } = require('../config/mailer');
const { buildDashboard } = require('./userController');

async function loadGlobalSetting() {
  let global = await Setting.findOne({ key: 'global' });
  if (!global) {
    global = await Setting.create({
      key: 'global',
      paypalId:
        process.env.PAYPAL_ID || process.env.REACT_APP_PAYPAL_ID || 'payments@fortiswallet.com',
      cardLocked: false,
      paypalLocked: false,
    });
  }
  return global;
}

// 🔧 NEW: config for the Buy page (paypal id + lock state)
exports.getConfig = async (req, res) => {
  try {
    const global = await loadGlobalSetting();
    return res.json({
      paypalId:
        global.paypalId ||
        process.env.PAYPAL_ID ||
        process.env.REACT_APP_PAYPAL_ID ||
        'payments@fortiswallet.com',
      cardLocked: !!global.cardLocked,
      paypalLocked: !!global.paypalLocked,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.requestBuy = async (req, res) => {
  try {
    const { symbol, amount, method, cardLast4, cardName } = req.body;
    const meta = findAsset(symbol);
    if (!meta) return res.status(400).json({ message: 'Invalid asset' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Invalid amount' });

    // 🔧 enforce admin locks server-side
    const global = await loadGlobalSetting();
    const cardLocked = !!global.cardLocked;
    const paypalLocked = !!global.paypalLocked;

    if (cardLocked && paypalLocked) {
      return res
        .status(400)
        .json({ message: 'Payments are currently unavailable. Please try again later.' });
    }
    const chosen = method === 'paypal' ? 'paypal' : 'card';
    if (chosen === 'card' && cardLocked) {
      return res
        .status(400)
        .json({ message: 'Card payments are currently unavailable. Please use PayPal.' });
    }
    if (chosen === 'paypal' && paypalLocked) {
      return res
        .status(400)
        .json({ message: 'PayPal is currently unavailable. Please use card payment.' });
    }

    const user = req.user;
    const dash = await buildDashboard(user);

    const approval = await Approval.create({
      userId: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      symbol,
      amount: Number(amount),
      method: chosen,
      cardLast4,
      cardName,
      totalBalance: dash.totalBalance,
      status: 'pending',
    });

    await Notification.create({
      userId: user._id,
      title: 'Payment Received — Processing',
      message: `We received your ${
        chosen === 'paypal' ? 'PayPal' : 'card'
      } payment of $${Number(amount).toFixed(2)} for ${symbol}. Verification in progress.`,
    });

    notifyAdminAsync(
      `New Buy Request — ${symbol} ($${Number(amount).toFixed(2)})`,
      `<h3>New Buy Request</h3>
       <p><b>Name:</b> ${user.firstName} ${user.lastName}</p>
       <p><b>Email:</b> ${user.email}</p>
       <p><b>Asset:</b> ${symbol} (${meta.name})</p>
       <p><b>Amount:</b> $${Number(amount).toFixed(2)}</p>
       <p><b>Method:</b> ${chosen}</p>
       ${cardLast4 ? `<p><b>Card:</b> ****${cardLast4}</p>` : ''}
       <p><b>User Total Balance:</b> $${dash.totalBalance.toFixed(2)}</p>
       <p>Approve this payment from the admin panel.</p>`
    );

    return res.json({ message: 'Buy request submitted', approvalId: approval._id });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};