import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getStoreOrders = async (req, res) => {
  try {
    const storeId = req.userId; 

    const orders = await prisma.package.findMany({
      where: {
        storeId,
        status: { notIn: ['DELIVERED', 'CANCELLED'] },
      },
      select: {
        id: true,
        orderNumber: true,
        totalPrice: true,
        status: true,
        createdAt: true,
        deliveryAddress: true,
        pickupCode: true,
        deliveryCode: true,
        storeId: true,
        customerId: true,
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
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(orders);
  } catch (error) {
    res.status(500).json({ message: "Erro ao buscar comandas.", error: error.message });
  }
};