import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getRiderDeliveredHistory = async (req, res) => {
  try {
    const riderId = req.userId;

    const riderBatches = await prisma.batch.findMany({
      where: { riderId },
      select: { id: true },
    });

    const batchIds = riderBatches.map((b) => b.id);
    if (batchIds.length === 0) {
      return res.status(200).json([]);
    }

    const packages = await prisma.package.findMany({
      where: {
        batchId: { in: batchIds },
        status: 'DELIVERED',
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: true,
        store: {
          select: {
            id: true,
            name: true,
            address: true,
            avatarUrl: true,
          },
        },
        customer: {
          select: {
            name: true,
          },
        },
        batch: {
          include: {
            rider: {
              include: {
                vehicle: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json(packages);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar histórico de entregas do entregador.', error: error.message });
  }
};
