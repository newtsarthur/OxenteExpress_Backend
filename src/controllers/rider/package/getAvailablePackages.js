import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Função auxiliar para cálculo de distância (Haversine)
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Função auxiliar para cálculo de frete baseado em distância
const calculateDeliveryFee = (distanceKm) => {
  const baseFee = 5.0; // Taxa fixa: R$ 5,00
  const perKmFee = 1.5; // Taxa por km: R$ 1,50/km
  return parseFloat((baseFee + distanceKm * perKmFee).toFixed(2));
};

export const getAvailablePackages = async (req, res) => {
  try {
    const riderId = req.userId;
    const { lat, lon, maxDistance = 10 } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({ message: "Sua localização (lat/lon) é necessária." });
    }

    // 1. Busca os dados do Rider e seu Veículo
    const rider = await prisma.user.findUnique({
      where: { id: riderId },
      include: { vehicle: true }
    });

    if (!rider || rider.type !== 'RIDER' || !rider.vehicle) {
      return res.status(403).json({ message: "Acesso restrito a entregadores com veículo cadastrado." });
    }

    // 2. Busca pacotes READY no banco
    const packages = await prisma.package.findMany({
      where: {
        status: 'READY',
        totalWeightKg: { lte: Number(rider.vehicle.weightMaxKg) },
        totalVolumeLiters: { lte: Number(rider.vehicle.volumeLiters) }
      },
      include: {
        store: { 
          select: { 
            name: true, 
            address: true, 
            coordinates: true,
            avatarUrl: true,
          } 
        }
      }
    });

    // 3. Filtra por batchId e Distância
    const available = packages.filter(pkg => {
      // Se já tiver batchId, o pacote já foi aceito por alguém
      if (pkg.batchId) return false;

      const [sLat, sLon] = pkg.store.coordinates.split(',').map(Number);
      const distance = calculateDistance(parseFloat(lat), parseFloat(lon), sLat, sLon);
      
      pkg.distanceToStore = parseFloat(distance.toFixed(2));
      return distance <= parseFloat(maxDistance);
    });

    // Ordena pelo mais próximo
    available.sort((a, b) => a.distanceToStore - b.distanceToStore);

    // --- AJUSTE DE SEGURANÇA AQUI ---
    // Mapeamos apenas os campos que o entregador pode ver na "vitrine" de pedidos
    const sanitizedPackages = available.map(pkg => ({
      id: pkg.id,
      orderNumber: pkg.orderNumber,
      totalWeightKg: pkg.totalWeightKg,
      totalVolumeLiters: pkg.totalVolumeLiters,
      deliveryAddress: pkg.deliveryAddress,
      status: pkg.status,
      store: {
        name: pkg.store.name,
        address: pkg.store.address,
        avatarUrl: pkg.store.avatarUrl,
      },
      distanceToStore: pkg.distanceToStore,
      deliveryFee: calculateDeliveryFee(pkg.distanceToStore)
      // pickupCode e deliveryCode NÃO são enviados aqui
    }));

    res.status(200).json({
      riderVehicle: rider.vehicle.model,
      capacityUsed: `Máx ${rider.vehicle.weightMaxKg}kg / ${rider.vehicle.volumeLiters}L`,
      count: sanitizedPackages.length,
      packages: sanitizedPackages
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};