import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

export const deleteUsers = async (req, res) => {
  try {
    const userId = req.params.id;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: "Token de autenticação não foi informado." });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
  
    if (decoded.id !== userId) {
      return res.status(403).json({ message: "Você não tem permissão para deletar este usuário!" });
    }

    await prisma.comment.deleteMany({
      where: { userId },
    });

    const deletedUser = await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({ message: "Usuário foi deletado com sucesso", deletedUser });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Token inválido" });
    }
    if (error.code === 'P2025') {
      return res.status(404).json({ message: "Usuário não encontrado!" });
    }
    res.status(500).json({ message: "Erro ao deletar usuário.", error: error.message });
  }
};