import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ItemService {
  // WORD: inventory: 재고
  private inventories = new Map<string, string[]>([
    ['user1', ['sword', 'shield']],
    ['user2', []]
  ]);
  private maxInventorySize = 5; // 인벤토리 최대 크기
  // WORD: amount
  async addItemToInventory(userId: string, itemId: string, itemName: string): Promise<void> {
    Logger.log(`[ItemService] ${userId}에게 ${itemName} 아이템 지급 시도`);
    const inventory = this.inventories.get(userId) || [];
    const newInventory = [...inventory, itemName];
    this.inventories.set(userId, newInventory);
    Logger.log(`[ItemService] ${userId}에서 지급 완료 (인벤토리:${newInventory})`);
  }

  async removeItemFromInventory(userId: string, itemName: string): Promise<void> {
    Logger.log(`[ItemService] ${userId}에게 ${itemName} 제거 시도`);
    const inventory = this.inventories.get(userId) || [];
    const itemIndex = inventory.lastIndexOf(itemName);
    if (itemIndex > -1) {
      inventory.splice(itemIndex, 1);
      this.inventories.set(userId, inventory);
      Logger.log(
        `[ItemService] ${userId}에게 아이템 제거 완료 (인벤토리:${inventory})`,
      );
    }
  }
}
