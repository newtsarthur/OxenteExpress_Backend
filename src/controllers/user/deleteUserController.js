import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const prisma = new PrismaClient();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
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

    // 1. Busca o usuário com seus vínculos básicos
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        vehicle: true // Traz os dados do veículo se for RIDER
      }
    });

    if (!user) {
      return res.status(404).json({ message: "Usuário não encontrado!" });
    }

    const filesToDelete = [];
    if (user.avatarUrl) filesToDelete.push(user.avatarUrl);

    // 2. 🔥 Lógica de Limpeza por TIPO
    
    // Se for LOJA (STORE): Apaga produtos e suas imagens
    if (user.type === 'STORE') {
      const products = await prisma.product.findMany({
        where: { storeId: userId },
        select: { productUrl: true }
      });

      // Adiciona as imagens dos produtos na fila de deleção do storage
      products.forEach(p => {
        if (p.productUrl) filesToDelete.push(p.productUrl);
      });

      await prisma.product.deleteMany({ where: { storeId: userId } });
    }

    // Se for ENTREGADOR (RIDER): Apaga o veículo e a imagem dele
    if (user.type === 'RIDER' && user.vehicle) {
      if (user.vehicle.vehicleUrl) filesToDelete.push(user.vehicle.vehicleUrl);
      
      await prisma.vehicle.delete({ where: { ownerId: userId } });
    }

    // Comum a todos: Apaga comentários (se existirem no seu schema)
    // await prisma.comment.deleteMany({ where: { userId } });

    // 3. Limpa o Storage de uma vez só
    if (filesToDelete.length > 0) {
      try {
        await supabase.storage.from('box').remove(filesToDelete);
      } catch (err) {
        console.error("Erro ao limpar arquivos do storage:", err);
      }
    }

    // 4. Finalmente apaga o usuário
    const deletedUser = await prisma.user.delete({
      where: { id: userId },
    });

    res.status(200).json({ 
      message: `Conta de ${user.type} e todos os dados vinculados foram removidos.`, 
      deletedUser 
    });

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ message: "Token inválido" });
    }
    res.status(500).json({ message: "Erro ao deletar usuário.", error: error.message });
  }
};