import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

//Login
export const login = async (req, res) => {
    try {
      const userInfo = req.body;
  
      // Buscar o usuário no banco de dados
      const user = await prisma.user.findUnique({ 
        where: { email: userInfo.email }
      });
  
      // Verifica se ele existe no banco de dados
      if (!user) {
        return res.status(404).json({ message: "Esse usuário não existe" });
      }
  
      const isMatch = await bcrypt.compare(userInfo.password, user.password);
  
      // Compara a senha digitada com a senha salva no banco de dados
      if (!isMatch) {
        return res.status(400).json({ message: "Senha inválida!" });
      }
  
      // Gerar o Token JWT
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  
      // Retorna o token e as informações do usuário
      res.status(200).json({
        token,
        user: {
          id: user.id, // Certifique-se de que o userId está sendo retornado
          name: user.name,
          email: user.email,
          createdAt: user.createdAt,
          type: user.type,
        },
      });
    } catch (error) {
      res.status(500).json({ message: "Erro, tente novamente mais tarde!" });
    }
};