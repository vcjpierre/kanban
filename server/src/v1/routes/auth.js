const router = require('express').Router()
const userController = require('../controllers/user')
const { body } = require('express-validator')
const validation = require('../handlers/validation')
const tokenHandler = require('../handlers/tokenHandler')
const User = require('../models/user')

router.post(
  '/signup',
  body('username').isLength({ min: 8 }).withMessage(
    'username must be at least 8 characters'
  ),
  body('password').isLength({ min: 8 }).withMessage(
    'password must be at least 8 characters'
  ),
  body('confirmPassword').isLength({ min: 8 }).withMessage(
    'confirmPassword must be at least 8 characters'
  ),  body('username').custom(async (value) => {
    try {
      const user = await User.findOne({ username: value })
        .maxTimeMS(8000)
        .lean() // Use lean for faster queries that don't need the full document
        .exec();
        
      if (user) {
        return Promise.reject('username already used')
      }
      return true;
    } catch (error) {
      console.error('Username validation error:', error);
      // If this is a timeout error, don't block the user experience completely
      if (error.name === 'MongoServerError' && error.message.includes('timeout')) {
        console.warn('Database timeout on username check - allowing to proceed');
        return true; // Let it proceed and we'll catch duplicates at the DB level
      }
      throw new Error('Error checking username availability');
    }
  }),
  validation.validate,
  userController.register
)

router.post(
  '/login',
  body('username').isLength({ min: 8 }).withMessage(
    'username must be at least 8 characters'
  ),
  body('password').isLength({ min: 8 }).withMessage(
    'password must be at least 8 characters'
  ),
  validation.validate,
  userController.login
)

router.post(
  '/verify-token',
  tokenHandler.verifyToken,
  (req, res) => {
    res.status(200).json({ user: req.user })
  }
)

module.exports = router