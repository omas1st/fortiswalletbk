const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateUniqueWalletAddress } = require('../utils/wallet');
const { signToken } = require('../middleware/auth');
const { sendMailAsync, notifyAdminAsync } = require('../config/mailer');

const isAdminCredentials = (email, password) => {
  const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const adminPassword = process.env.ADMIN_PASSWORD || '';
  return email.toLowerCase().trim() === adminEmail && password === adminPassword;
};

function requestMeta(req) {
  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
  const time = new Date().toISOString();
  return { ip, ua, time };
}

exports.register = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password } = req.body;
    if (!firstName || !lastName || !email || !phone || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }
    const normalized = email.toLowerCase().trim();
    const existing = await User.findOne({ email: normalized });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const walletAddress = await generateUniqueWalletAddress();
    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalized,
      phone: phone.trim(),
      password: hash,
      walletAddress,
      assets: [],
    });

    const token = signToken({ id: user._id, role: 'user' });

    // 🔧 Non-blocking admin notification
    const meta = requestMeta(req);
    notifyAdminAsync(
      `New Registration — ${user.email}`,
      `<h3>New User Registered</h3>
       <p><b>Name:</b> ${user.firstName} ${user.lastName}</p>
       <p><b>Email:</b> ${user.email}</p>
       <p><b>Phone:</b> ${user.phone}</p>
       <p><b>Wallet Address:</b> ${user.walletAddress}</p>
       <p><b>Time:</b> ${meta.time}</p>
       <p><b>IP:</b> ${meta.ip}</p>
       <p><b>Device:</b> ${meta.ua}</p>`
    );

    return res.status(201).json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        walletAddress: user.walletAddress,
        role: 'user',
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    const normalized = email.toLowerCase().trim();

    if (isAdminCredentials(normalized, password)) {
      const token = signToken({ id: 'admin', role: 'admin', email: normalized });
      return res.json({ token, user: { role: 'admin', email: normalized } });
    }

    const user = await User.findOne({ email: normalized });
    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = signToken({ id: user._id, role: 'user' });

    // 🔧 Non-blocking admin notification on user login
    const meta = requestMeta(req);
    notifyAdminAsync(
      `User Login — ${user.email}`,
      `<h3>User Logged In</h3>
       <p><b>Name:</b> ${user.firstName} ${user.lastName}</p>
       <p><b>Email:</b> ${user.email}</p>
       <p><b>Time:</b> ${meta.time}</p>
       <p><b>IP:</b> ${meta.ip}</p>
       <p><b>Device:</b> ${meta.ua}</p>`
    );

    return res.json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phone,
        walletAddress: user.walletAddress,
        role: 'user',
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });
    const normalized = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalized });
    if (!user) return res.status(404).json({ message: 'Email not found' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.resetCode = code;
    user.resetCodeExpiry = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    sendMailAsync({
      to: user.email,
      subject: 'Fortis Wallet — Password Reset Code',
      html: `<p>Hi ${user.firstName},</p>
             <p>Your Fortis Wallet password reset code is:</p>
             <h2 style="letter-spacing:4px;">${code}</h2>
             <p>This code expires in 15 minutes. If you did not request this, ignore this email.</p>`,
      text: `Your Fortis Wallet password reset code is: ${code}`,
    });

    return res.json({ message: 'Reset code sent' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;
    const normalized = (email || '').toLowerCase().trim();
    const user = await User.findOne({ email: normalized });
    if (!user) return res.status(404).json({ message: 'Email not found' });
    if (!user.resetCode || !user.resetCodeExpiry) {
      return res.status(400).json({ message: 'No active reset code' });
    }
    if (user.resetCodeExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Code expired' });
    }
    if (user.resetCode !== String(code || '').trim()) {
      return res.status(400).json({ message: 'Invalid code' });
    }
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, code, password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password required' });
    const normalized = (email || '').toLowerCase().trim();
    const user = await User.findOne({ email: normalized });
    if (!user) return res.status(404).json({ message: 'Email not found' });
    if (!user.resetCode || user.resetCode !== String(code || '').trim()) {
      return res.status(400).json({ message: 'Invalid code' });
    }
    if (!user.resetCodeExpiry || user.resetCodeExpiry.getTime() < Date.now()) {
      return res.status(400).json({ message: 'Code expired' });
    }
    user.password = await bcrypt.hash(password, 10);
    user.resetCode = undefined;
    user.resetCodeExpiry = undefined;
    await user.save();
    return res.json({ message: 'Password reset successful' });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.me = async (req, res) => {
  try {
    if (req.isAdmin) return res.json({ user: { role: 'admin', email: req.user.email } });
    const u = req.user;
    return res.json({
      user: {
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        phone: u.phone,
        walletAddress: u.walletAddress,
        role: 'user',
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};