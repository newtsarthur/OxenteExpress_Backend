import { PrismaClient } from '@prisma/client';
import { uploadAndOptimizeImage } from '../image/uploadImageController.js';

const prisma = new PrismaClient();

export const createVehicle = async (req, res) => {
  try {
    const { model, plate, color, volumeLiters, weightMaxKg } = req.body;
    const userId = req.userId; // ID vindo do middleware de autenticação

    // 1. Validação de tamanho do modelo
    if (!model || model.trim().length === 0) {
      return res.status(400).json({ message: "Modelo do veículo é obrigatório." });
    }
    if (model.trim().length > 50) {
      return res.status(400).json({ message: "Modelo do veículo não pode ter mais de 50 caracteres." });
    }

    // 2. Validação de perfil: apenas RIDER pode ter veículo
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user || user.type !== 'RIDER') {
      return res.status(403).json({ 
        message: "Acesso negado. Apenas entregadores podem cadastrar veículos." 
      });
    }

    // 2. Verifica se o entregador já possui um veículo cadastrado
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { ownerId: userId }
    });

    if (existingVehicle) {
      return res.status(400).json({ message: "Você já possui um veículo cadastrado." });
    }

    // 3. Cria o registro do veículo no MongoDB
    let vehicle = await prisma.vehicle.create({
      data: {
        model,
        plate,
        color: color || null,
        volumeLiters: parseFloat(volumeLiters) || 0,
        weightMaxKg: parseFloat(weightMaxKg) || 0,
        ownerId: userId
      }
    });

    // 4. 🔥 Lógica da Imagem do Veículo
    if (req.file) {
      try {
        // Salvamos na pasta 'vehicles' usando o userId como nome do arquivo
        const vehicleUrl = await uploadAndOptimizeImage(req.file, 'vehicles', userId);
        
        // Atualiza o veículo com o caminho da imagem (ex: vehicles/userId.webp)
        vehicle = await prisma.vehicle.update({
          where: { id: vehicle.id },
          data: { vehicleUrl } 
        });
      } catch (uploadError) {
        console.error("Veículo criado, mas falha no upload da imagem:", uploadError);
      }
    }

    res.status(201).json({ 
      message: "Veículo cadastrado com sucesso!", 
      vehicle 
    });

  } catch (error) {
    // Tratamento para placa duplicada (Unique no Prisma)
    if (error.code === 'P2002') {
      return res.status(400).json({ message: "Esta placa já está cadastrada em outro veículo." });
    }
    res.status(500).json({ message: "Erro ao cadastrar veículo.", error: error.message });
  }
};