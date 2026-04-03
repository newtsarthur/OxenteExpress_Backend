import express from 'express'
// import { getUsers } from '../controllers/user/usersListController.js'
import { deleteUsers } from '../controllers/user/deleteUserController.js'
import { createVehicle } from '../controllers/vehicle/createVehicleController.js'
const router = express.Router()

//Listar usuários
// router.get('/listar-users', getUsers)

//Cadastrar veículo
router.post('/:id/cadastro_veiculo', createVehicle)

//Deletar usuário
router.delete('/delete-user/:id', deleteUsers)
export default router