import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Entrega ativa do entregador logado (PICKING_UP ou IN_TRANSIT).
 */
export const getCurrentDelivery = async (req, res) => {
  try {
    const riderId = req.userId;

    const riderBatches = await prisma.batch.findMany({
      where: { riderId },
      select: { id: true },
    });
    const batchIds = riderBatches.map((b) => b.id);
    if (batchIds.length === 0) {
      return res.status(200).json({ package: null });
    }

    const pkg = await prisma.package.findFirst({
      where: {
        status: { in: ['PICKING_UP', 'IN_TRANSIT'] },
        batchId: { in: batchIds },
      },
      include: {
        store: { select: { name: true, address: true, avatarUrl: true } },
        customer: { select: { name: true } },
        batch: true,
        items: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!pkg) {
      return res.status(200).json({ package: null });
    }

    const itemLines = pkg.items?.length
      ? pkg.items.map((i) => `${i.quantity}x ${i.name}`)
      : [];

    res.status(200).json({
      package: {
        id: pkg.id,
        orderNumber: pkg.orderNumber,
        status: pkg.status,
        pickupCode: pkg.pickupCode ?? '',
        deliveryCode: pkg.deliveryCode ?? '',
        totalPrice: pkg.totalPrice,
        deliveryAddress: pkg.deliveryAddress,
        createdAt: pkg.createdAt.toISOString(),
        storeName: pkg.store?.name ?? '',
        storeAddress: pkg.store?.address ?? '',
        storeAvatarUrl: pkg.store?.avatarUrl ?? null,
        customerName: pkg.customer?.name ?? 'Cliente',
        customerAddress: pkg.deliveryAddress,
        items: itemLines,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar entrega ativa.', error: error.message });
  }
};
