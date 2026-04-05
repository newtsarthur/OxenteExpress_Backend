import { PrismaClient } from '@prisma/client';
import { uploadAndOptimizeImage } from '../image/uploadImageController.js';
import { getIo } from '../../lib/socket.js';

const prisma = new PrismaClient();

export const updateVehicle = async (req, res) => {
  try {
    const userId = req.userId;
    const { model, plate, color, volumeLiters, weightMaxKg } = req.body;

    // 1. Validação de tamanho do modelo
    if (model && model.trim().length > 50) {
      return res.status(400).json({ message: "Modelo do veículo não pode ter mais de 50 caracteres." });
    }

    // 2. Busca o veículo atual
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { ownerId: userId }
    });

    if (!existingVehicle) {
      return res.status(404).json({ message: "Veículo não encontrado para este usuário." });
    }

    // 2. 🔥 Validação Casada (Placa + Modelo)
    // Se enviou placa nova OU modelo novo, verificamos se os dois estão presentes
    const isChangingPlate = plate && plate !== existingVehicle.plate;
    const isChangingModel = model && model !== existingVehicle.model;

    if (isChangingPlate || isChangingModel) {
      // Se um mudou, o outro PRECISA ser enviado no corpo da requisição
      if (!plate || !model) {
        return res.status(400).json({ 
          message: "Para alterar o veículo, você deve enviar a Placa e o Modelo juntos." 
        });
      }

      // Validação de placa em uso (apenas se a placa enviada for diferente da atual)
      if (isChangingPlate) {
        const plateInUse = await prisma.vehicle.findUnique({ where: { plate } });
        if (plateInUse) {
          return res.status(400).json({ message: "Esta placa já está cadastrada em outro veículo." });
        }
      }
    }

    // 3. Prepara os dados para o update
    const updateData = {};
    if (model) updateData.model = model;
    if (plate) updateData.plate = plate;
    if (color !== undefined) updateData.color = color || null;
    if (volumeLiters) updateData.volumeLiters = parseFloat(volumeLiters);
    if (weightMaxKg) updateData.weightMaxKg = parseFloat(weightMaxKg);

    // 4. Lógica da Imagem
    if (req.file) {
      try {
        const vehicleUrl = await uploadAndOptimizeImage(req.file, 'vehicles', userId);
        updateData.vehicleUrl = vehicleUrl;
      } catch (uploadError) {
        console.error("Erro ao atualizar imagem:", uploadError);
      }
    }

    // 5. Executa a atualização
    const updatedVehicle = await prisma.vehicle.update({
      where: { ownerId: userId },
      data: updateData
    });

    // 6. Emite evento de atualização via Socket.io
    const io = getIo();
    if (io) {
      io.emit('rider_updated', {
        action: 'update',
        riderId: userId,
        vehicle: updatedVehicle
      });
    }

    res.status(200).json({ 
      message: "Veículo atualizado com sucesso!", 
      vehicle: updatedVehicle 
    });

  } catch (error) {
    res.status(500).json({ message: "Erro ao atualizar veículo.", error: error.message });
  }
};