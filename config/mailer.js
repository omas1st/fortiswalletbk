const nodemailer = require('nodemailer');

// waitUntil is a no-op outside Vercel — safe to guard.
let waitUntil = null;
try {
  // eslint-disable-next-line global-require
  ({ waitUntil } = require('@vercel/functions'));
} catch (e) {
  waitUntil = null;
}

const SENDER_EMAIL = process.env.SMTP_EMAIL || process.env.ADMIN_EMAIL;
const SENDER_PASSWORD = (
  process.env.SMTP_PASSWORD ||
  process.env.ADMIN_EMAIL_PASSWORD ||
  ''
).replace(/\s+/g, '');
const ADMIN_INBOX = process.env.SMTP_EMAIL || process.env.ADMIN_EMAIL;

let transporter = null;

function logMailerError(label, e) {
  if (!e) {
    console.error(`[mailer] ${label}: unknown error (falsy)`);
    return;
  }
  console.error(
    `[mailer] ${label}:`,
    e.stack || e.message || e.code || e.response || String(e)
  );
}

function getTransporter() {
  if (transporter) return transporter;
  if (!SENDER_EMAIL || !SENDER_PASSWORD) {
    console.error(
      '[mailer] Missing SMTP credentials. SENDER_EMAIL=%s, password_set=%s',
      SENDER_EMAIL,
      Boolean(SENDER_PASSWORD)
    );
    return null;
  }
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: SENDER_EMAIL, pass: SENDER_PASSWORD },
    pool: true,
    maxConnections: 3,
    maxMessages: 100,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  transporter.verify((err) => {
    if (err) logMailerError('Transport verify failed', err);
    else console.log('[mailer] SMTP transport verified and ready');
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  const t = getTransporter();
  if (!t) throw new Error('Email transporter not configured');
  return t.sendMail({
    from: `"Fortis Wallet" <${SENDER_EMAIL}>`,
    to,
    subject,
    html,
    text,
  });
}

async function notifyAdmin(subject, html) {
  try {
    const t = getTransporter();
    if (!t) return;
    await t.sendMail({
      from: `"Fortis Wallet" <${SENDER_EMAIL}>`,
      to: ADMIN_INBOX,
      subject,
      html,
    });
  } catch (e) {
    logMailerError('Admin email failed', e);
  }
}

function scheduleTask(promise) {
  if (waitUntil) {
    try {
      waitUntil(promise);
      return;
    } catch (e) {
      /* fall through */
    }
  }
  setImmediate(() => {
    promise.catch(() => {});
  });
}

function sendMailAsync(opts) {
  const task = sendMail(opts).catch((e) => logMailerError('sendMailAsync failed', e));
  scheduleTask(task);
  return task;
}

function notifyAdminAsync(subject, html) {
  const task = notifyAdmin(subject, html);
  scheduleTask(task);
  return task;
}

module.exports = {
  sendMail,
  sendMailAsync,
  notifyAdmin,
  notifyAdminAsync,
  ADMIN_INBOX,
};