const router = require('express').Router();
const ctrl = require('../controllers/withdrawController');
const { authRequired } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authRequired);

/* ---------- KYC Withdrawal Flow ---------- */

router.post('/verification', ctrl.submitVerification);

// Single-file upload (auto-upload on user selection)
router.post('/id/upload', upload.single('file'), ctrl.uploadIdFile);

// Save ID (accepts either pre-uploaded URLs OR legacy multipart)
router.post(
  '/id',
  upload.fields([
    { name: 'front', maxCount: 1 },
    { name: 'back', maxCount: 1 },
  ]),
  ctrl.uploadId
);

router.post('/amount', ctrl.submitAmount);
router.post('/bank', ctrl.submitBank);
router.post('/bank-connect', ctrl.connectBank);
router.post('/verify-code', ctrl.verifyCode);
router.post('/resend-code', ctrl.resendCode);

/* ---------- Unverified Withdrawal Flow ---------- */
// 🔧 These were missing — that's why "Route not found" appeared.

router.post('/unverified/initiate', ctrl.initiateUnverified);
router.post('/unverified/pay', ctrl.payUnverified);
router.get('/unverified/status', ctrl.getUnverifiedStatus);
router.post('/unverified/complete', ctrl.completeUnverified);

module.exports = router;