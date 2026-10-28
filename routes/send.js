const router = require('express').Router();
const ctrl = require('../controllers/sendController');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);
router.post('/lookup', ctrl.lookup);
router.post('/', ctrl.send);

module.exports = router;