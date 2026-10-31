const router = require('express').Router();
const ctrl = require('../controllers/withdrawController');
const { authRequired } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authRequired);

router.post('/verification', ctrl.submitVerification);

// 🔧 NEW: fast single-file upload with progress support
router.post('/id/upload', upload.single('file'), ctrl.uploadIdFile);

// Accepts JSON { idType, frontUrl, backUrl } (fast path)
// OR multipart { idType, front, back } (legacy compatibility)
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

// Add these at the bottom of the file
router.post('/unverified/initiate', ctrl.initiateUnverified);
router.post('/unverified/pay', ctrl.payUnverified);
router.get('/unverified/status', ctrl.getUnverifiedStatus);
router.post('/unverified/complete', ctrl.completeUnverified);

module.exports = router;