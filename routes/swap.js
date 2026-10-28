const router = require('express').Router();
const ctrl = require('../controllers/swapController');
const { authRequired } = require('../middleware/auth');

router.use(authRequired);
router.post('/', ctrl.swap);

module.exports = router;