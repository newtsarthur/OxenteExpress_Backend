
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

export const getStoreProducts = async (req, res) => {
  try {
    const userId = req.userId; // ID da loja logada vindo do middleware auth

    // Busca apenas os produtos que pertencem a esta loja
    const products = await prisma.product.findMany({
      where: {
        storeId: userId
      },
      orderBy: {
        name: 'asc' // Organiza por ordem alfabética
      }
    });

    // Se não houver produtos, retornamos uma lista vazia com status 200
    res.status(200).json(products);

  } catch (error) {
    console.error("Erro ao buscar produtos:", error);
    res.status(500).json({ message: "Erro ao carregar o estoque." });
  }
};