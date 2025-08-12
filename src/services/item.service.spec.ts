import { Test, TestingModule } from '@nestjs/testing';
import { ItemService } from './item.service';
import { ItemGrantDto } from '../dtos/purchase-request.dto';

describe('ItemService', () => {
  let service: ItemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ItemService],
    }).compile();

    service = module.get<ItemService>(ItemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('grantItem', () => {
    it('should grant item successfully', async () => {
      const dto: ItemGrantDto = {
        userId: 'user-123',
        itemId: 'item-sword',
        quantity: 1,
        transactionId: 'txn-1',
      };

      const result = await service.grantItem(dto);

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.itemId).toBe('item-sword');
      expect(result.quantity).toBe(1);
    });

    it('should fail to grant non-existent item', async () => {
      const dto: ItemGrantDto = {
        userId: 'user-123',
        itemId: 'non-existent',
        quantity: 1,
        transactionId: 'txn-2',
      };

      const result = await service.grantItem(dto);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ITEM_NOT_FOUND');
    });

    it('should fail to grant out of stock item', async () => {
      const dto: ItemGrantDto = {
        userId: 'user-123',
        itemId: 'item-out-of-stock',
        quantity: 1,
        transactionId: 'txn-3',
      };

      const result = await service.grantItem(dto);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_STOCK');
    });

    it('should fail to grant unavailable item', async () => {
      const dto: ItemGrantDto = {
        userId: 'user-123',
        itemId: 'item-disabled',
        quantity: 1,
        transactionId: 'txn-4',
      };

      const result = await service.grantItem(dto);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ITEM_NOT_AVAILABLE');
    });
  });

  describe('compensateItemGrant', () => {
    it('should compensate item grant successfully', async () => {
      // First grant an item
      await service.grantItem({
        userId: 'user-123',
        itemId: 'item-potion',
        quantity: 2,
        transactionId: 'txn-5',
      });

      const result = await service.compensateItemGrant('user-123', 'item-potion', 2, 'txn-5');
      expect(result).toBe(true);

      // Check item stock is restored
      const itemInfo = await service.getItemInfo('item-potion');
      expect(itemInfo?.stock).toBe(100); // Stock restored
    });

    it('should fail to compensate for non-existent item', async () => {
      const result = await service.compensateItemGrant('user-123', 'non-existent', 1, 'txn-6');
      expect(result).toBe(false);
    });
  });
});