const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);
router.get('/dashboard', ctrl.getDashboard);
router.post('/assets', ctrl.addAsset);
router.get('/notifications', ctrl.getNotifications);
router.post('/notifications/read-all', ctrl.readAllNotifications);
router.put('/profile', ctrl.updateProfile);
router.put('/password', ctrl.updatePassword);

module.exports = router;