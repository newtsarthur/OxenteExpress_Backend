import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

// Cadastrar Veículo
export const createVehicle = async (req, res) => {
  try {
    const { model, plate, volumeLiters, weightMaxKg } = req.body;
    const userId = req.userId; // Esse ID vem do middleware 'auth' [cite: 16]

    // 1. Verifica se o usuário já tem um veículo (regra de 1 para 1)
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { ownerId: userId }
    });

    if (existingVehicle) {
      return res.status(400).json({ message: "Você já possui um veículo cadastrado." });
    }

    // 2. Cria o veículo vinculado ao ID do motorista
    const vehicle = await prisma.vehicle.create({
      data: {
        model,
        plate,
        volumeLiters: parseFloat(volumeLiters),
        weightMaxKg: parseFloat(weightMaxKg),
        ownerId: userId // O "vínculo" acontece aqui! 
      }
    });

    res.status(201).json({ message: "Veículo cadastrado com sucesso!", vehicle });
  } catch (error) {
    res.status(500).json({ message: "Erro ao cadastrar veículo.", error: error.message });
  }
};