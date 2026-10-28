const router = require('express').Router();
const ctrl = require('../controllers/authController');
const { authRequired } = require('../middleware/auth');

router.post('/register', ctrl.register);
router.post('/login', ctrl.login);
router.post('/forgot-password', ctrl.forgotPassword);
router.post('/verify-code', ctrl.verifyResetCode);
router.post('/reset-password', ctrl.resetPassword);
router.get('/me', authRequired, ctrl.me);

module.exports = router;