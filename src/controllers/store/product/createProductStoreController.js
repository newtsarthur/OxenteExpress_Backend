import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'
import axios from 'axios';
import { uploadAndOptimizeImage } from '../../image/uploadImageController.js'; // Importando seu novo serviço

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

export const addProductToStock = async (req, res) => {
  try {
    const { name, description, quantity, price, weightKg, volumeLiters, unit } = req.body;
    const userId = req.userId;

    // 1. Validação de permissão
    const store = await prisma.user.findUnique({ where: { id: userId } });
    if (!store || store.type !== 'STORE') {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const parsedPrice = parseFloat(price) || 0;
    const parsedQty = parseFloat(quantity) || 0;
    const parsedWeight = parseFloat(weightKg) || 0;
    const parsedVolume = parseFloat(volumeLiters) || 0;

    // 2. Busca o produto
    const existingProduct = await prisma.product.findFirst({
      where: { 
        storeId: userId,
        name,
        weightKg: parsedWeight, 
        volumeLiters: parsedVolume 
      }
    });

    let product;

    // 3. Cria ou Atualiza os dados básicos
    if (existingProduct) {
      product = await prisma.product.update({
        where: { id: existingProduct.id },
        data: {
          quantity: existingProduct.quantity + parsedQty,
          description: description || existingProduct.description 
        }
      });
    } else {
      product = await prisma.product.create({
        data: {
          name,
          description,
          price: parsedPrice,
          quantity: parsedQty,
          weightKg: parsedWeight,
          volumeLiters: parsedVolume,
          unit: unit || "un",
          storeId: userId
        }
      });
    }

    // 4. 🔥 Lógica da Imagem (Sempre após ter o ID do 'product')
    if (req.file) {
      try {
        // Envia para o Supabase usando o ID do produto como nome do arquivo
        const imageUrl = await uploadAndOptimizeImage(req.file, 'products', product.id);
        console.log(`[createProductStoreController] new imageUrl for product ${product.id}:`, imageUrl);
        
        // Salva o link no banco
        product = await prisma.product.update({
          where: { id: product.id },
          data: { imageUrl } 
        });
      } catch (uploadError) {
        console.error("Produto salvo, mas imagem falhou:", uploadError);
      }
    }

    res.status(201).json({ 
      message: existingProduct ? "Estoque atualizado!" : "Novo produto criado!", 
      product 
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};