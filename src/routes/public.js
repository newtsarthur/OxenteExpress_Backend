import express from 'express';
import multer from 'multer';

import { register } from '../controllers/user/createUserController.js';
import { login } from '../controllers/user/loginUserController.js';
import { searchFipeVehicles, getFipeBrands, getFipeYears, getFipeDetails } from '../controllers/vehicle/searchFipeVehiclesController.js';

import auth from '../middlewares/auth.js';

const router = express.Router(); // Inicializa o router antes de usá-lo
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Auth
router.post('/cadastro', upload.single('image'), register);
router.post('/login', login);
// router.get('/user/profile', auth, getUserProfile);

// FIPE - Busca de veículos (público)
router.get('/vehicle/fipe/search', searchFipeVehicles);
router.get('/vehicle/fipe/brands', getFipeBrands);
router.get('/vehicle/fipe/years', getFipeYears);
router.get('/vehicle/fipe/details', getFipeDetails);

export default router;