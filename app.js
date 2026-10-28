const express = require('express');
const cors = require('cors');
const { isAllowedOrigin } = require('./config/cors');

const app = express();

// CORS middleware — runs before any route, allows the three production
// domains + localhost, reflects the exact origin back (needed for credentials).
app.use(
  cors({
    origin(origin, cb) {
      // no Origin header (curl, server-to-server, same-origin) — allow
      if (!origin) return cb(null, true);
      return cb(null, isAllowedOrigin(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    maxAge: 86400,
  })
);

// Fast-path OPTIONS in Express as a belt-and-suspenders fallback.
// (api/index.js normally short-circuits this before Express is reached.)

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => res.json({ ok: true, message: 'Fortis Wallet API' }));
app.get('/health', (req, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/user', require('./routes/user'));
app.use('/api/buy', require('./routes/buy'));
app.use('/api/swap', require('./routes/swap'));
app.use('/api/send', require('./routes/send'));
app.use('/api/withdraw', require('./routes/withdraw'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/cron', require('./routes/cron'));

app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

module.exports = app;