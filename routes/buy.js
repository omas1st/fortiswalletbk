const router = require('express').Router();
const ctrl = require('../controllers/buyController');
const { authRequired } = require('../middleware/auth');
const upload = require('../middleware/upload');

router.use(authRequired);
router.get('/config', ctrl.getConfig);
router.post('/upload', upload.single('file'), ctrl.uploadGiftCard); // 🔧 NEW
router.post('/request', ctrl.requestBuy);

module.exports = router;