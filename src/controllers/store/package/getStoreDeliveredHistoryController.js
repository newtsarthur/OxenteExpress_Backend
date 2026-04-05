import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStoreDeliveredHistory = async (req, res) => {
  try {
    const storeId = req.userId;

    const orders = await prisma.package.findMany({
      where: {
        storeId,
        status: 'DELIVERED',
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        items: true,
        customer: {
          select: {
            name: true,
            phone: true,
            avatarUrl: true,
          },
        },
        store: {
          select: {
            name: true,
            address: true,
            avatarUrl: true,
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

    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar histórico de pedidos da loja.', error: error.message });
  }
};
