import express from 'express';
import multer from 'multer';

import { register } from '../controllers/user/createUserController.js';
import { login } from '../controllers/user/loginUserController.js';

import auth from '../middlewares/auth.js';

const router = express.Router(); // Inicializa o router antes de usá-lo
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Auth
router.post('/cadastro', upload.single('image'), register);
router.post('/login', login);
// router.get('/user/profile', auth, getUserProfile);

export default router;