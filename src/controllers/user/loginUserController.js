import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

// Login
export const login = async (req, res) => {
    try {
      const { email, password } = req.body; 
  
      // 1. Buscar o usuário no banco de dados
      const user = await prisma.user.findUnique({ 
        where: { email }
      });
  
      // 2. Verifica se ele existe no banco de dados
      if (!user) {
        return res.status(404).json({ message: "E-mail ou senha incorretos." }); 
      }
  
      // 3. Compara a senha digitada com a senha salva (hash)
      const isMatch = await bcrypt.compare(password, user.password);
  
      if (!isMatch) {
        return res.status(400).json({ message: "E-mail ou senha incorretos." });
      }
  
      // 4. Gerar o Token JWT
      const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
  
      // 5. Retorna o token e as informações do usuário
      res.status(200).json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          avatarUrl: user.avatarUrl, // 🔥 Adicionado para retornar a foto (ex: users/id.webp)
          type: user.type,
          phone: user.phone, 
          address: user.address, // Útil para o front já saber onde o usuário está
          coordinates: user.coordinates,
          createdAt: user.createdAt,
        },
      });
    } catch (error) {
      console.error("Erro no Login:", error);
      res.status(500).json({ message: "Erro, tente novamente mais tarde!" });
    }
};