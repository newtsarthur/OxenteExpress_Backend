import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'
import axios from 'axios';
import { uploadAndOptimizeImage } from '../../image/uploadImageController.js';

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId; // ID do lojista vindo do middleware de auth

    // 1. Busca o produto para verificar se ele existe e se pertence à loja
    const product = await prisma.product.findUnique({
      where: { id: id }
    });

    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    if (product.storeId !== userId) {
      return res.status(403).json({ message: "Acesso negado. Você só pode deletar seus próprios produtos." });
    }

    // 2. Tenta deletar a imagem do Supabase Storage se ela existir
    if (product.imageUrl) {
      try {
        // Como salvamos apenas "products/id.webp", passamos o caminho direto
        const { error: storageError } = await supabase.storage
          .from('box')
          .remove([product.imageUrl]);

        if (storageError) {
          console.error("Erro ao deletar imagem do storage:", storageError);
          // Opcional: Não travamos o processo se a imagem falhar ao deletar
        }
      } catch (err) {
        console.error("Falha na comunicação com Supabase ao deletar:", err);
      }
    }

    // 3. Deleta o registro do banco de dados
    await prisma.product.delete({
      where: { id: id }
    });

    res.status(200).json({ 
      message: "Produto e imagem removidos com sucesso!" 
    });

  } catch (error) {
    console.error("Erro ao deletar produto:", error);
    res.status(500).json({ error: "Erro interno ao processar a deleção." });
  }
};