import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getVehicle = async (req, res) => {
  try {
    const userId = req.userId;

    const vehicle = await prisma.vehicle.findUnique({
      where: { ownerId: userId },
    });

    if (!vehicle) {
      return res.status(404).json({ message: 'Veículo não encontrado para este usuário.' });
    }

    res.status(200).json({ vehicle });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar os dados do veículo.', error: error.message });
  }
};
