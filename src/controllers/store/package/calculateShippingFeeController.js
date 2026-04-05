import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export const calculateShippingFee = async (req, res) => {
  try {
    const { items, address, lat, lon } = req.body;
    const customerId = req.userId;

    // 1. Validação de entrada
    if (!items || items.length === 0) {
      return res.status(400).json({ message: "Carrinho vazio." });
    }

    // 2. Hierarquia de Localização
    let finalCoordinates;
    if (lat && lon) {
      finalCoordinates = `${lat},${lon}`;
    } else if (address) {
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
      const geoResponse = await axios.get(url, { headers: { 'User-Agent': 'OxenteExpress_App' } });
      if (!geoResponse.data || geoResponse.data.length === 0) {
        return res.status(404).json({ message: "Endereço de entrega não encontrado." });
      }
      finalCoordinates = `${geoResponse.data[0].lat},${geoResponse.data[0].lon}`;
    } else {
      const customer = await prisma.user.findUnique({ where: { id: customerId } });
      if (!customer || !customer.coordinates) {
        return res.status(400).json({ message: "Informe uma localização ou cadastre um endereço no perfil." });
      }
      finalCoordinates = customer.coordinates;
    }

    // 3. Busca produtos para determinar lojas
    const productIds = items.map((item) => item.productId);
    const productsFromDb = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { store: true },
    });

    if (productsFromDb.length === 0) {
      return res.status(400).json({ message: "Produtos não encontrados." });
    }

    // 4. Agrupa por loja e calcula frete
    const storeGroups = new Map();

    for (const item of items) {
      const productInfo = productsFromDb.find((p) => p.id === item.productId);
      if (!productInfo) continue;

      const groupKey = String(productInfo.storeId);
      if (!storeGroups.has(groupKey)) {
        storeGroups.set(groupKey, {
          storeId: groupKey,
          store: productInfo.store,
          totalPrice: 0,
        });
      }

      const group = storeGroups.get(groupKey);
      const subtotal = productInfo.price * item.quantity;
      group.totalPrice += subtotal;
    }

    // 5. Calcula distância e frete para cada loja
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

    const shippingBreakdown = [];
    let totalShippingFee = 0;

    for (const group of storeGroups.values()) {
      const storeCoordinates = group.store.coordinates || '';
      const [storeLat, storeLon] = storeCoordinates.split(',').map((part) => parseFloat(part.trim()));
      const distanceKm = Number.isFinite(storeLat) && Number.isFinite(storeLon) 
        ? calculateDistance(customerLat, customerLon, storeLat, storeLon) 
        : 0;
      const shippingFee = calculateDeliveryFee(distanceKm);

      shippingBreakdown.push({
        storeId: group.storeId,
        storeName: group.store.name,
        distanceKm: parseFloat(distanceKm.toFixed(2)),
        shippingFee,
        subtotal: group.totalPrice,
      });

      totalShippingFee += shippingFee;
    }

    res.status(200).json({
      subtotal: Array.from(storeGroups.values()).reduce((sum, g) => sum + g.totalPrice, 0),
      shippingFee: parseFloat(totalShippingFee.toFixed(2)),
      total: parseFloat((Array.from(storeGroups.values()).reduce((sum, g) => sum + g.totalPrice, 0) + totalShippingFee).toFixed(2)),
      breakdown: shippingBreakdown,
    });

  } catch (error) {
    console.error('[calculateShippingFee] error:', error);
    res.status(500).json({ message: "Erro ao calcular frete.", error: error.message });
  }
};
