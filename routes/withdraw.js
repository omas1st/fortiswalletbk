const router = require('express').Router();
const ctrl = require('../controllers/withdrawController');
const { authRequired } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authRequired);

router.post('/verification', ctrl.submitVerification);
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

module.exports = router;