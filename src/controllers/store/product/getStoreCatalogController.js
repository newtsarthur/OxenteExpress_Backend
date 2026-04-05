import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Catálogo público (autenticado) de uma loja — para o cliente montar o pedido. */
export const getStoreCatalogById = async (req, res) => {
  try {
    const { storeId } = req.params;

    const store = await prisma.user.findFirst({
      where: { id: storeId, type: 'STORE' },
      select: { id: true },
    });

    if (!store) {
      return res.status(404).json({ message: 'Loja não encontrada.' });
    }

    const products = await prisma.product.findMany({
      where: {
        storeId,
        quantity: { gt: 0 },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json(products);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao carregar produtos da loja.', error: error.message });
  }
};
