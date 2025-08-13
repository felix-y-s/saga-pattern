import { Injectable, Logger } from '@nestjs/common';
import { ItemGrantDto } from '../dtos/purchase-request.dto';
import {
  ItemGrantResult,
  ItemInfo,
} from '../interfaces/domain-services.interface';

interface UserInventory {
  itemId: string;
  quantity: number;
  grantedAt: Date[];
}

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  // 모의 아이템 데이터베이스
  private readonly items = new Map<string, ItemInfo>([
    [
      'item-sword',
      {
        itemId: 'item-sword',
        name: 'Magic Sword',
        price: 100,
        stock: 50,
        isAvailable: true,
      },
    ],
    [
      'item-potion',
      {
        itemId: 'item-potion',
        name: 'Health Potion',
        price: 20,
        stock: 100,
        isAvailable: true,
      },
    ],
    [
      'item-out-of-stock',
      {
        itemId: 'item-out-of-stock',
        name: 'Rare Gem',
        price: 500,
        stock: 0,
        isAvailable: true,
      },
    ],
    [
      'item-disabled',
      {
        itemId: 'item-disabled',
        name: 'Disabled Item',
        price: 50,
        stock: 10,
        isAvailable: false,
      },
    ],
  ]);

  // 사용자 인벤토리 (실제로는 데이터베이스)
  private readonly userInventories = new Map<
    string,
    Map<string, UserInventory>
  >();

  async grantItem(dto: ItemGrantDto): Promise<ItemGrantResult> {
    this.logger.debug(
      `Granting item: ${dto.itemId} to user: ${dto.userId}, quantity: ${dto.quantity}`,
    );

    try {
      const item = this.items.get(dto.itemId);

      if (!item) {
        this.logger.warn(`Item not found: ${dto.itemId}`);
        return {
          success: false,
          userId: dto.userId,
          itemId: dto.itemId,
          quantity: 0,
          grantedAt: new Date(),
          reason: 'Item not found',
          errorCode: 'ITEM_NOT_FOUND',
        };
      }

      if (!item.isAvailable) {
        this.logger.warn(`Item not available: ${dto.itemId}`);
        return {
          success: false,
          userId: dto.userId,
          itemId: dto.itemId,
          quantity: 0,
          grantedAt: new Date(),
          reason: 'Item is not available',
          errorCode: 'ITEM_NOT_AVAILABLE',
        };
      }

      if (item.stock < dto.quantity) {
        this.logger.warn(
          `Insufficient stock: ${dto.itemId}, requested: ${dto.quantity}, available: ${item.stock}`,
        );
        return {
          success: false,
          userId: dto.userId,
          itemId: dto.itemId,
          quantity: 0,
          grantedAt: new Date(),
          reason: 'Insufficient stock',
          errorCode: 'INSUFFICIENT_STOCK',
        };
      }

      // 재고 차감
      item.stock -= dto.quantity;

      // 사용자 인벤토리에 아이템 추가
      const grantedAt = new Date();
      this.addToUserInventory(dto.userId, dto.itemId, dto.quantity, grantedAt);

      this.logger.log(
        `Item granted successfully: ${dto.itemId} x${dto.quantity} to ${dto.userId}`,
      );

      return {
        success: true,
        userId: dto.userId,
        itemId: dto.itemId,
        quantity: dto.quantity,
        grantedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error granting item ${dto.itemId} to ${dto.userId}:`,
        error,
      );
      return {
        success: false,
        userId: dto.userId,
        itemId: dto.itemId,
        quantity: 0,
        grantedAt: new Date(),
        reason: 'Internal grant error',
        errorCode: 'GRANT_ERROR',
      };
    }
  }

  async compensateItemGrant(
    userId: string,
    itemId: string,
    quantity: number,
    transactionId: string,
  ): Promise<boolean> {
    this.logger.debug(
      `Compensating item grant: ${itemId} x${quantity} from user: ${userId}, transaction: ${transactionId}`,
    );

    try {
      const item = this.items.get(itemId);
      if (!item) {
        this.logger.error(`Cannot compensate - item not found: ${itemId}`);
        return false;
      }

      // 재고 복원
      item.stock += quantity;

      // 사용자 인벤토리에서 제거
      this.removeFromUserInventory(userId, itemId, quantity);

      this.logger.log(
        `Item grant compensated: ${itemId} x${quantity} from ${userId}`,
      );

      return true;
    } catch (error) {
      this.logger.error(
        `Error compensating item grant ${itemId} from ${userId}:`,
        error,
      );
      return false;
    }
  }

  async getItemInfo(itemId: string): Promise<ItemInfo | null> {
    return this.items.get(itemId) || null;
  }

  async getUserInventory(userId: string): Promise<UserInventory[]> {
    const inventory = this.userInventories.get(userId);
    return inventory ? Array.from(inventory.values()) : [];
  }

  private addToUserInventory(
    userId: string,
    itemId: string,
    quantity: number,
    grantedAt: Date,
  ): void {
    if (!this.userInventories.has(userId)) {
      this.userInventories.set(userId, new Map());
    }

    const userInventory = this.userInventories.get(userId)!;
    const existingItem = userInventory.get(itemId);

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.grantedAt.push(grantedAt);
    } else {
      userInventory.set(itemId, {
        itemId,
        quantity,
        grantedAt: [grantedAt],
      });
    }
  }

  private removeFromUserInventory(
    userId: string,
    itemId: string,
    quantity: number,
  ): void {
    const userInventory = this.userInventories.get(userId);
    if (!userInventory) return;

    const existingItem = userInventory.get(itemId);
    if (!existingItem) return;

    existingItem.quantity -= quantity;
    if (existingItem.quantity <= 0) {
      userInventory.delete(itemId);
    }
  }

  // 테스트를 위한 메소드
  async resetItemStock(itemId: string, stock: number): Promise<void> {
    const item = this.items.get(itemId);
    if (item) {
      item.stock = stock;
      this.logger.debug(`Reset item stock: ${itemId} -> ${stock}`);
    }
  }
}
