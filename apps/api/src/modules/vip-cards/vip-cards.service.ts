import prisma from '../../common/database';
import { AppError } from '../../middleware/error.middleware';
import { io } from '../../index';
import {
  CreateVipCardInput,
  UpdateVipCardInput,
  LoadBalanceInput,
  PurchaseInput,
  TransferInput,
} from './vip-cards.schema';

export class VipCardsService {
  /**
   * Get all VIP cards for a tenant
   */
  async findAll(tenantId: string) {
    return prisma.vIPCard.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a VIP card by ID
   */
  async findById(tenantId: string, id: string) {
    const card = await prisma.vIPCard.findFirst({
      where: { id, tenantId },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            createdBy: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!card) {
      throw new AppError('VIP card not found', 404);
    }

    return card;
  }

  /**
   * Create a new VIP card
   */
  async create(tenantId: string, input: CreateVipCardInput) {
    return prisma.vIPCard.create({
      data: {
        tenantId,
        cardNumber: input.cardNumber,
        type: input.type,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        pin: input.pin,
      },
    });
  }

  /**
   * Update a VIP card
   */
  async update(tenantId: string, id: string, input: UpdateVipCardInput) {
    await this.findById(tenantId, id);

    return prisma.vIPCard.update({
      where: { id },
      data: input,
    });
  }

  /**
   * Load balance onto a VIP card
   */
  async loadBalance(tenantId: string, id: string, userId: string, input: LoadBalanceInput) {
    const card = await this.findById(tenantId, id);

    if (card.status !== 'ACTIVE') {
      throw new AppError('Card is not active', 400);
    }

    const balanceBefore = Number(card.balance);
    const balanceAfter = balanceBefore + input.amount;

    const result = await prisma.$transaction(async (tx) => {
      await tx.vIPCardTransaction.create({
        data: {
          cardId: id,
          type: 'LOAD',
          amount: input.amount,
          balanceBefore,
          balanceAfter,
          notes: input.notes,
          createdById: userId,
        },
      });

      return tx.vIPCard.update({
        where: { id },
        data: { balance: balanceAfter, lastUsedAt: new Date() },
      });
    });

    io.to(`tenant:${tenantId}`).emit('vip-card:balance-updated', {
      cardId: result.id,
      cardNumber: result.cardNumber,
      balance: result.balance,
      type: 'LOAD',
    });

    return result;
  }

  /**
   * Purchase using a VIP card
   */
  async purchase(tenantId: string, id: string, userId: string, input: PurchaseInput) {
    const card = await this.findById(tenantId, id);

    if (card.status !== 'ACTIVE') {
      throw new AppError('Card is not active', 400);
    }

    const balanceBefore = Number(card.balance);
    if (balanceBefore < input.amount) {
      throw new AppError(`Insufficient balance. Available: ${balanceBefore}`, 400);
    }

    const balanceAfter = balanceBefore - input.amount;

    const result = await prisma.$transaction(async (tx) => {
      await tx.vIPCardTransaction.create({
        data: {
          cardId: id,
          type: 'PURCHASE',
          amount: input.amount,
          balanceBefore,
          balanceAfter,
          orderId: input.orderId,
          notes: input.notes,
          createdById: userId,
        },
      });

      return tx.vIPCard.update({
        where: { id },
        data: { balance: balanceAfter, lastUsedAt: new Date() },
      });
    });

    io.to(`tenant:${tenantId}`).emit('vip-card:balance-updated', {
      cardId: result.id,
      cardNumber: result.cardNumber,
      balance: result.balance,
      type: 'PURCHASE',
    });

    return result;
  }

  /**
   * Transfer balance between VIP cards
   */
  async transfer(tenantId: string, fromCardId: string, userId: string, input: TransferInput) {
    const fromCard = await this.findById(tenantId, fromCardId);
    const toCard = await this.findById(tenantId, input.toCardId);

    if (fromCard.status !== 'ACTIVE') {
      throw new AppError('Source card is not active', 400);
    }
    if (toCard.status !== 'ACTIVE') {
      throw new AppError('Destination card is not active', 400);
    }

    const fromBefore = Number(fromCard.balance);
    if (fromBefore < input.amount) {
      throw new AppError(`Insufficient balance. Available: ${fromBefore}`, 400);
    }

    const toBefore = Number(toCard.balance);
    const fromAfter = fromBefore - input.amount;
    const toAfter = toBefore + input.amount;

    const result = await prisma.$transaction(async (tx) => {
      // Debit from source
      await tx.vIPCardTransaction.create({
        data: {
          cardId: fromCardId,
          type: 'TRANSFER_OUT',
          amount: input.amount,
          balanceBefore: fromBefore,
          balanceAfter: fromAfter,
          relatedCardId: input.toCardId,
          notes: input.notes,
          createdById: userId,
        },
      });

      // Credit to destination
      await tx.vIPCardTransaction.create({
        data: {
          cardId: input.toCardId,
          type: 'TRANSFER_IN',
          amount: input.amount,
          balanceBefore: toBefore,
          balanceAfter: toAfter,
          relatedCardId: fromCardId,
          notes: input.notes,
          createdById: userId,
        },
      });

      const updatedFrom = await tx.vIPCard.update({
        where: { id: fromCardId },
        data: { balance: fromAfter, lastUsedAt: new Date() },
      });

      const updatedTo = await tx.vIPCard.update({
        where: { id: input.toCardId },
        data: { balance: toAfter, lastUsedAt: new Date() },
      });

      return { from: updatedFrom, to: updatedTo };
    });

    io.to(`tenant:${tenantId}`).emit('vip-card:balance-updated', {
      cardId: result.from.id,
      cardNumber: result.from.cardNumber,
      balance: result.from.balance,
      type: 'TRANSFER_OUT',
    });

    io.to(`tenant:${tenantId}`).emit('vip-card:balance-updated', {
      cardId: result.to.id,
      cardNumber: result.to.cardNumber,
      balance: result.to.balance,
      type: 'TRANSFER_IN',
    });

    return result;
  }

  /**
   * Block a VIP card
   */
  async block(tenantId: string, id: string) {
    await this.findById(tenantId, id);

    return prisma.vIPCard.update({
      where: { id },
      data: { status: 'BLOCKED' },
    });
  }

  /**
   * Unblock a VIP card
   */
  async unblock(tenantId: string, id: string) {
    const card = await this.findById(tenantId, id);

    if (card.status !== 'BLOCKED') {
      throw new AppError('Card is not blocked', 400);
    }

    return prisma.vIPCard.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });
  }
}

export const vipCardsService = new VipCardsService();
