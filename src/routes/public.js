import express from 'express';

import { register } from '../controllers/user/createUserController.js';
import { login } from '../controllers/user/loginUserController.js';

import auth from '../middlewares/auth.js';

const router = express.Router(); // Inicializa o router antes de usá-lo

// Auth
router.post('/cadastro', register);
router.post('/login', login);
// router.get('/user/profile', auth, getUserProfile);

// Rotas de API Filmes

export default router;