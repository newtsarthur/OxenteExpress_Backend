import { PrismaClient } from '@prisma/client';
import { getIo } from '../../../lib/socket.js';

const prisma = new PrismaClient();

export const updatePackageStatus = async (req, res) => {
  try {
    const { packageId, newStatus } = req.body;
    const storeId = req.userId;

    // 1. Busca o pacote e valida se pertence à loja
    const pkg = await prisma.package.findUnique({
      where: { id: packageId }
    });

    if (!pkg) return res.status(404).json({ message: "Pedido não encontrado." });
    if (pkg.storeId !== storeId) return res.status(403).json({ message: "Acesso negado." });

    // 2. Validação simples de fluxo (opcional, mas recomendado)
    const validStatus = ['PREPARING', 'READY', 'CANCELLED'];
    if (!validStatus.includes(newStatus)) {
      return res.status(400).json({ message: "Status inválido para a loja." });
    }

    // 3. Atualiza o status
    const updatedPackage = await prisma.package.update({
      where: { id: packageId },
      data: { status: newStatus },
      // Opcional: Você pode usar 'select' aqui para o Prisma já trazer filtrado
      select: {
        id: true,
        orderNumber: true,
        status: true,
        updatedAt: true
      }
    });

    const io = getIo();
    if (io) {
      io.emit('customer_order_status', {
        packageId,
        status: newStatus,
      });
      if (newStatus === 'READY') {
        io.emit('rider_packages_updated', {
          packageId,
          status: newStatus,
        });
      }
    }

    res.status(200).json({
      message: `Status do pedido ${updatedPackage.orderNumber} atualizado para ${newStatus}.`,
      updatedPackage,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};