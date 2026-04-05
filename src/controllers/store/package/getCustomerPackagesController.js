import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Pedidos do cliente logado, com Batch → Rider → Vehicle (schema Prisma). */
export const getCustomerPackages = async (req, res) => {
  try {
    const customerId = req.userId;

    const packages = await prisma.package.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        store: {
          select: {
            id: true,
            name: true,
            address: true,
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
    res.status(500).json({ message: 'Erro ao buscar pedidos.', error: error.message });
  }
};
