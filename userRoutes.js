const express = require('express');
const router = express.Router();
const { basicAuth } = require('../middleware/auth');
const {
  registerUser,
  loginUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
  getUserStats,
} = require('../controllers/userController');

// Public routes
router.post('/register', registerUser);
router.post('/login', loginUser);

// Protected routes (require Basic Auth or JWT)
router.get('/stats', basicAuth, getUserStats);
router.get('/', basicAuth, getAllUsers);
router.get('/:id', basicAuth, getUserById);
router.put('/:id', basicAuth, updateUser);
router.delete('/:id', basicAuth, deleteUser);

module.exports = router;
