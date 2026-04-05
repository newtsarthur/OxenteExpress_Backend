import express from 'express'
import multer from 'multer'
import { deleteUsers } from '../controllers/user/deleteUserController.js'
import { updateUser } from '../controllers/user/updateUserController.js'
import { createVehicle } from '../controllers/vehicle/createVehicleController.js'
import { updateVehicle } from '../controllers/vehicle/updateVehicleController.js';
import { addProductToStock } from '../controllers/store/product/createProductStoreController.js'
import { getStoreProducts } from '../controllers/store/product/getProductStoreController.js'
import { getStoreCatalogById } from '../controllers/store/product/getStoreCatalogController.js'
import { getNearbyProducts } from '../controllers/store/product/getProductsController.js'
import { updateProduct } from '../controllers/store/product/updateProductStoreController.js'
import { deleteProduct } from '../controllers/store/product/deleteProductStoreController.js';

import { createOrder } from '../controllers/store/package/createPackageController.js';
// import { confirmPickup } from '../controllers/store/package/statusPackageController.js';
import { updatePackageStatus } from '../controllers/store/package/statusPackageController.js';
import { getAvailablePackages } from '../controllers/rider/package/getAvailablePackages.js'
import { getCurrentDelivery } from '../controllers/rider/package/getCurrentDeliveryController.js'
import { acceptPackage } from '../controllers/rider/package/acceptPackageController.js'
import { getRiderDeliveredHistory } from '../controllers/rider/package/getRiderDeliveredHistoryController.js'

import { getStoreOrders } from '../controllers/store/package/getStoreOrdersController.js';
import { getStoreDeliveredHistory } from '../controllers/store/package/getStoreDeliveredHistoryController.js';
import { getCustomerPackages } from '../controllers/store/package/getCustomerPackagesController.js';

import { confirmPickup } from '../controllers/store/package/confirmPickupController.js';

import { finishDelivery } from '../controllers/rider/package/finishDeliveryController.js';
import { getVehicle } from '../controllers/vehicle/getVehicleController.js';



const router = express.Router()

// 🔥 Configuração do Multer para salvar temporariamente na memória (RAM)
// Isso é mais rápido para enviar direto para o Supabase sem sujar seu servidor
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// --- USUÁRIO ---
// Adicionamos upload.single('image') se o usuário quiser atualizar a foto de perfil
router.put('/update', upload.single('image'), updateUser); 
router.delete('/delete-user/:id', deleteUsers)

// --- CLIENTE / BUSCA ---
// POST: body { address?, lat?, lon?, maxDistance? } — mesmo handler de busca
router.post('/stores', getNearbyProducts);

router.get('/store/orders', getStoreOrders);
router.get('/store/:storeId/products', getStoreCatalogById);
router.get('/package/customer', getCustomerPackages);

// --- VEÍCULO ---
// Se o motorista precisar tirar foto do veículo ou documento
router.post('/:id/cadastro_veiculo', upload.single('image'), createVehicle)
router.put('/vehicle/update', upload.single('image'), updateVehicle);
router.get('/vehicle', getVehicle);

// --- PRODUTOS ---
// O campo 'image' no upload.single deve ser o mesmo nome da chave usada no Postman
router.post('/product/create', upload.single('image'), addProductToStock)
router.get('/products', getStoreProducts);
router.put('/product/:id', upload.single('image'), updateProduct)
router.delete('/product/:id', deleteProduct)

// Rota para o Cliente fazer o pedido (Carrinho)
router.post('/package/order', createOrder);
router.patch('/package/status', updatePackageStatus);
router.get('/store/history', getStoreDeliveredHistory);
router.get('/rider/history', getRiderDeliveredHistory);
router.get('/rider/packages', getAvailablePackages);
router.get('/rider/current-delivery', getCurrentDelivery);
router.post('/rider/accept-package', acceptPackage);
router.post('/store/confirm-pickup', confirmPickup);
router.post('/rider/finish-delivery', finishDelivery);

export default router