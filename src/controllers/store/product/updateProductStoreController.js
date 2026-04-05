import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'
import axios from 'axios';
import { uploadAndOptimizeImage } from '../../image/uploadImageController.js';
import { getIo } from '../../../lib/socket.js';

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, quantity, price, weightKg, volumeLiters, unit } = req.body;
    const userId = req.userId;

    // 1. Busca o produto e valida se ele pertence ao lojista
    const product = await prisma.product.findUnique({
      where: { id: id }
    });

    if (!product) {
      return res.status(404).json({ message: "Produto não encontrado." });
    }

    if (product.storeId !== userId) {
      return res.status(403).json({ message: "Acesso negado. Você não possui permissão para editar este item." });
    }

    // 2. Monta o objeto de atualização apenas com o que foi enviado
    const dataToUpdate = {};
    if (name) dataToUpdate.name = name;
    if (description) dataToUpdate.description = description;
    if (unit) dataToUpdate.unit = unit;
    
    if (price !== undefined && price !== "") dataToUpdate.price = parseFloat(price);
    if (quantity !== undefined && quantity !== "") dataToUpdate.quantity = parseFloat(quantity);
    if (weightKg !== undefined && weightKg !== "") dataToUpdate.weightKg = parseFloat(weightKg);
    if (volumeLiters !== undefined && volumeLiters !== "") dataToUpdate.volumeLiters = parseFloat(volumeLiters);

    // 3. 🔥 Lógica da Imagem: Se o lojista enviou um novo arquivo
    if (req.file) {
      try {
        // O serviço usa o ID existente para nomear o arquivo no bucket 'products'
        const imageUrl = await uploadAndOptimizeImage(req.file, 'products', id);
        console.log(`[updateProduct] new imageUrl for product ${id}:`, imageUrl);
        dataToUpdate.imageUrl = imageUrl;
      } catch (uploadError) {
        console.error("Erro ao atualizar imagem no Supabase:", uploadError);
        return res.status(500).json({ message: "Falha ao processar a imagem do produto.", error: uploadError.message || uploadError });
      }
    }

    // 4. Executa a atualização final no Prisma
    let updatedProduct;
    try {
      updatedProduct = await prisma.product.update({
        where: { id: id },
        data: dataToUpdate
      });
      console.log(`[updateProduct] Salvando no banco para product ${id}:`, dataToUpdate);
    } catch (dbError) {
      console.error(`[updateProduct] Erro ao salvar no banco para product ${id}:`, dbError);
      return res.status(500).json({ message: "Falha ao salvar o produto no banco.", error: dbError.message || dbError });
    }

    const io = getIo();
    if (io) {
      // Emitir para todos os clientes conectados (clientes verão apenas produtos da loja que estão visualizando)
      io.emit('product_updated', {
        action: 'update',
        product: updatedProduct
      });
    }

    res.status(200).json({
      message: "Produto atualizado com sucesso!",
      product: updatedProduct
    });

  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
};