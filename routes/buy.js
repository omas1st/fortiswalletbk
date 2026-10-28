const router = require('express').Router();
const ctrl = require('../controllers/buyController');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);
router.get('/config', ctrl.getConfig);   // 🔧 NEW
router.post('/request', ctrl.requestBuy);

module.exports = router;