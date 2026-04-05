import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

export const getNearbyProducts = async (req, res) => {
  try {
    const { address, lat, lon, maxDistance = 15 } = req.body; 
    const userId = req.userId; // ID vindo do middleware de auth
    
    let userLat, userLon;
    let locationSource = "";

    // 1. 🔥 Hierarquia de Localização
    if (address) {
      // Prioridade 1: Endereço digitado agora
      const encodedAddress = encodeURIComponent(address);
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`;
      const geoResponse = await axios.get(url, { headers: { 'User-Agent': 'OxenteExpress_App' } });

      if (!geoResponse.data || geoResponse.data.length === 0) {
        return res.status(404).json({ message: "Endereço de entrega não encontrado." });
      }
      userLat = parseFloat(geoResponse.data[0].lat);
      userLon = parseFloat(geoResponse.data[0].lon);
      locationSource = `Endereço fornecido: ${address}`;
    } 
    else if (lat && lon) {
      // Prioridade 2: GPS do celular enviado agora
      userLat = parseFloat(lat);
      userLon = parseFloat(lon);
      locationSource = "GPS atual";
    } 
    else {
      // Prioridade 3: Endereço padrão do perfil do usuário
      const userProfile = await prisma.user.findUnique({
        where: { id: userId },
        select: { coordinates: true, address: true }
      });

      if (!userProfile || !userProfile.coordinates) {
        return res.status(400).json({ 
          message: "Para buscar produtos, informe um local ou cadastre um endereço no seu perfil." 
        });
      }

      const [pLat, pLon] = userProfile.coordinates.split(',').map(Number);
      userLat = pLat;
      userLon = pLon;
      locationSource = `Endereço do perfil: ${userProfile.address}`;
    }

    // 2. Busca lojas que possuem coordenadas e produtos em estoque
    const stores = await prisma.user.findMany({
      where: {
        type: 'STORE',
        coordinates: { not: null }
      },
      include: {
        products: {
          where: { quantity: { gt: 0 } }
        }
      }
    });

    const results = [];
    const storeCount = new Set();

    stores.forEach(store => {
      const [sLat, sLon] = store.coordinates.split(',').map(Number);
      const distance = calculateDistance(userLat, userLon, sLat, sLon);

      if (distance <= maxDistance) {
        storeCount.add(store.id);
        store.products.forEach(product => {
          results.push({
            id: product.id,
            storeId: store.id,
            name: product.name,
            price: product.price,
            quantityAvailable: product.quantity, // Estoque disponível
            // 🔥 Cálculo do valor total em estoque deste produto
            totalInStockValue: parseFloat((product.price * product.quantity).toFixed(2)), 
            productImage: product.imageUrl || null,
            distanceKm: parseFloat(distance.toFixed(2)),
            phone: store.phone,
            storeName: store.name,
            storeImage: store.avatarUrl || null,
            storeAddress: store.address
          });
        });
      }
    });

    // Ordena pelo mais próximo
    results.sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json({
      baseLocation: locationSource,
      radius: `${maxDistance}km`,
      summary: {
        storesFound: storeCount.size,
        productsFound: results.length
      },
      results
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};