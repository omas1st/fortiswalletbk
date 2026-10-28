const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authRequired, adminOnly } = require('../middleware/auth');

router.use(authRequired, adminOnly);

// Users
router.get('/users', ctrl.listUsers);
router.get('/users/:id', ctrl.getUser);
router.put('/users/:id/assets', ctrl.updateAssets);

// Transactions
router.delete('/users/:id/transactions/:txnId', ctrl.deleteTransaction); // 🔧 NEW

// Notifications
router.put('/users/:id/notifications', ctrl.updateNotificationsBulk);
router.put('/users/:id/notifications/:notifId', ctrl.updateNotification);
router.delete('/users/:id/notifications/:notifId', ctrl.deleteNotification);
router.post('/users/:id/notifications', ctrl.createNotification);

// Verifications
router.get('/verifications', ctrl.listVerifications);
router.post('/verifications/:id/approve', ctrl.approveVerification);
router.post('/withdrawal-code/:userId', ctrl.setWithdrawalCode);

// Buy approvals
router.get('/approvals', ctrl.listApprovals);
router.post('/approvals/:id/approve', ctrl.approvePayment);

// Withdrawals
router.get('/withdrawals', ctrl.listWithdrawals);
router.post('/withdrawals/:id/approve', ctrl.approveWithdrawal);

// Settings
router.get('/settings', ctrl.getSettings);
router.put('/settings/assets/:symbol', ctrl.updatePercent);
router.put('/settings/paypal', ctrl.updatePaypalId);              // 🔧 NEW
router.put('/settings/payment-locks', ctrl.updatePaymentLocks);   // 🔧 NEW
router.post('/settings/run-daily', ctrl.triggerDailyIncrease);

module.exports = router;