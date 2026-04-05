import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client'
import axios from 'axios';
import { getIo } from '../../../lib/socket.js';

const prisma = new PrismaClient()

const JWT_SECRET = process.env.JWT_SECRET;

export const createOrder = async (req, res) => {
  try {
    const { storeId, items, address, lat, lon } = req.body;
    const customerId = req.userId;

    // 1. Hierarquia de Localização (Mantida a sua lógica original)
    let finalAddress, finalCoordinates;
    if (address) {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
      const geoResponse = await axios.get(url, { headers: { 'User-Agent': 'OxenteExpress_App' } });
      if (!geoResponse.data || geoResponse.data.length === 0) {
        return res.status(404).json({ message: "Endereço de entrega não encontrado." });
      }
      finalAddress = address;
      finalCoordinates = `${geoResponse.data[0].lat},${geoResponse.data[0].lon}`;
    } else if (lat && lon) {
      finalAddress = "Localização via GPS";
      finalCoordinates = `${lat},${lon}`;
    } else {
      const customer = await prisma.user.findUnique({ where: { id: customerId } });
      if (!customer || !customer.address) {
        return res.status(400).json({ message: "Informe um local ou cadastre um endereço no perfil." });
      }
      finalAddress = customer.address;
      finalCoordinates = customer.coordinates;
    }

    // 2. Busca e Validação de Estoque 🚀
    const productIds = items.map((item) => item.productId);
    const productsFromDb = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { store: true },
    });

    if (productsFromDb.length === 0) {
      return res.status(400).json({ message: "Carrinho inválido ou produtos não encontrados." });
    }

    // Agrupa os itens por loja para criar pedidos separados por storeId
    const storeGroups = new Map();
    const outOfStockItems = [];

    for (const item of items) {
      const productInfo = productsFromDb.find((p) => p.id === item.productId);
      if (!productInfo) {
        outOfStockItems.push("Produto Desconhecido");
        continue;
      }

      if (productInfo.quantity < item.quantity) {
        outOfStockItems.push(productInfo.name);
        continue;
      }

      const groupKey = String(productInfo.storeId);
      if (!storeGroups.has(groupKey)) {
        storeGroups.set(groupKey, {
          storeId: groupKey,
          store: productInfo.store,
          items: [],
          totalPrice: 0,
          totalWeight: 0,
          totalVolume: 0,
        });
      }

      const group = storeGroups.get(groupKey);
      const subtotal = productInfo.price * item.quantity;
      group.items.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: productInfo.price,
        name: productInfo.name,
        description: productInfo.description,
        productImage: productInfo.imageUrl,
        subtotal,
      });
      group.totalPrice += subtotal;
      group.totalWeight += (productInfo.weightKg || 0) * item.quantity;
      group.totalVolume += (productInfo.volumeLiters || 0) * item.quantity;
    }

    const validGroups = Array.from(storeGroups.values()).filter((group) => group.items.length > 0);

    if (validGroups.length === 0) {
      return res.status(400).json({ 
        message: "Pedido cancelado: Todos os itens selecionados estão fora de estoque ou foram removidos.",
        outOfStock: outOfStockItems,
      });
    }

    const createOrderNumber = () => `OX-${Date.now()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371;
      const dLat = (lat2 - lat1) * (Math.PI / 180);
      const dLon = (lon2 - lon1) * (Math.PI / 180);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const calculateDeliveryFee = (distanceKm) => {
      const baseFee = 5.0;
      const perKmFee = 1.5;
      return parseFloat((baseFee + distanceKm * perKmFee).toFixed(2));
    };

    const [customerLat, customerLon] = finalCoordinates.split(',').map((part) => parseFloat(part.trim()));

    const packagesPayload = [];
    const createdPackages = await prisma.$transaction(async (tx) => {
      const created = [];

      for (const group of validGroups) {
        const orderNumber = createOrderNumber();
        const pickupCode = Math.floor(100 + Math.random() * 900).toString();
        const deliveryCode = Math.floor(1000 + Math.random() * 9000).toString();
        const storeCoordinates = group.store.coordinates || '';
        const [storeLat, storeLon] = storeCoordinates.split(',').map((part) => parseFloat(part.trim()));
        const distanceKm = Number.isFinite(storeLat) && Number.isFinite(storeLon) ? calculateDistance(customerLat, customerLon, storeLat, storeLon) : 0;
        const deliveryFee = calculateDeliveryFee(distanceKm);

        for (const item of group.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantity: { decrement: item.quantity } },
          });
        }

        const newPackage = await tx.package.create({
          data: {
            orderNumber,
            pickupCode,
            deliveryCode,
            totalPrice: group.totalPrice,
            totalWeightKg: group.totalWeight,
            totalVolumeLiters: group.totalVolume,
            status: 'PENDING',
            deliveryAddress: finalAddress,
            coordinates: finalCoordinates,
            storeId: group.storeId,
            customerId,
            items: { create: group.items },
          },
          include: { items: true },
        });

        created.push({
          package: newPackage,
          storeId: group.storeId,
          deliveryFee,
        });
      }

      return created;
    });

    const io = getIo();
    if (io) {
      for (const created of createdPackages) {
        io.to(created.storeId).emit('store_new_order', {
          packageId: created.package.id,
          storeId: created.storeId,
          status: created.package.status,
        });
      }
    }

    const totalDeliveryFee = createdPackages.reduce((sum, p) => sum + p.deliveryFee, 0);
    const responsePackages = createdPackages.map((created) => ({
      id: created.package.id,
      orderNumber: created.package.orderNumber,
      status: created.package.status,
      totalPrice: created.package.totalPrice,
      items: created.package.items,
      deliveryCode: created.package.deliveryCode,
      storeId: created.storeId,
      deliveryFee: created.deliveryFee,
    }));

    res.status(201).json({
      message: outOfStockItems.length > 0
        ? `Pedido realizado! Alguns itens foram removidos por falta de estoque: ${outOfStockItems.join(', ')}`
        : 'Pedido realizado com sucesso!',
      deliveryTo: finalAddress,
      deliveryFeeTotal: parseFloat(totalDeliveryFee.toFixed(2)),
      packages: responsePackages,
      outOfStock: outOfStockItems,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Criar item
// export const createPackage = async (req, res) => {
//   try {
//     const { productName, quantity, description, weightKg, volumeLiters } = req.body;
//     const userId = req.userId;

//     // 1. Busca dados da STORE e valida permissão
//     const store = await prisma.user.findUnique({ where: { id: userId } });
    
//     if (!store || store.type !== 'STORE') {
//       return res.status(403).json({ message: "Acesso negado. Somente lojistas podem cadastrar produtos." });
//     }

//     // 2. Verifica se a loja cadastrou o próprio endereço (essencial para futuras coletas)
//     if (!store.address || !store.coordinates) {
//       return res.status(400).json({ 
//         message: "Sua loja ainda não possui um endereço fixo configurado. Atualize seu perfil antes de cadastrar itens." 
//       });
//     }
//     const parsedQuantity = parseFloat(quantity);
//     const parsedWeight = parseFloat(weightKg);
//     const parsedVolume = parseFloat(volumeLiters);

//     if (
//       isNaN(parsedQuantity) || parsedQuantity <= 0 ||
//       isNaN(parsedWeight) || parsedWeight <= 0 ||
//       isNaN(parsedVolume) || parsedVolume <= 0
//     ) {
//       return res.status(400).json({ message: "Dados inválidos" });
//     }

//     // 3. Lógica do Número Sequencial (Ex: Pedido #0001...)
//     const count = await prisma.package.count({ where: { storeId: userId } });
    
//     const nextNumber = count + 1;
//     const formattedNumber = String(nextNumber).padStart(4, '0');
//     const autoTitle = `Item #${formattedNumber} - ${productName}`;

//     // 4. Transação (Estoque + Registro do Pacote)
//     const result = await prisma.$transaction(async (tx) => {
      
//       // Gerenciar Estoque do Produto
//       let product = await tx.product.findFirst({
//         where: { name: productName, storeId: userId }
//       });

//       if (product) {
//         // Soma ao que já existe
//         product = await tx.product.update({
//           where: { id: product.id },
//           data: { quantity: product.quantity + parseFloat(quantity) }
//         });
//       } else {
//         // Cria novo produto no inventário
//         product = await tx.product.create({
//           data: { 
//             name: productName, 
//             quantity: parseFloat(quantity), 
//             storeId: userId,
//             unit: "un" 
//           }
//         });
//       }

//       // Cria o registro do Pacote (Aguardando cliente/destino)
//       const newPackage = await tx.package.create({
//         data: {
//           orderNumber: nextNumber,
//           title: autoTitle,
//           description: description || `Produto: ${productName}`,
//           stockInfo: `Item em estoque: ${parsedQuantity}x ${productName}`,
//           deliveryAddress: "AGUARDANDO PEDIDO",
//           coordinates: "0,0",
//           storeId: userId,
//           weightKg: parsedWeight * parsedQuantity,
//           volumeLiters: parsedVolume * parsedQuantity,
//           status: "IN_WAREHOUSE"
//         }
//       });

//       return { newPackage, currentStock: product.quantity };
//     });

//     res.status(201).json({
//       message: "Produto adicionado ao estoque e registrado!",
//       item: {
//         titulo: result.newPackage.title,
//         quantidadeAdicionada: quantity,
//         estoqueTotal: result.currentStock,
//         localRetirada: store.address
//       }
//     });

//   } catch (error) {
//     console.error("Erro ao cadastrar item:", error);
//     res.status(500).json({ error: error.message });
//   }
// };
