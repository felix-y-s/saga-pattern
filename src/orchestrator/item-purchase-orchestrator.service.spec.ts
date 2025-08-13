import { Test, TestingModule } from '@nestjs/testing';
import { ItemPurchaseOrchestratorService } from './item-purchase-orchestrator.service';
import { EventBusService } from '../events/event-bus.service';
import { EventFactory } from '../events/event-factory';
import { UserService } from '../services/user.service';
import { ItemService } from '../services/item.service';
import { LogService } from '../services/log.service';
import { NotificationService } from '../services/notification.service';
import { SagaRepositoryService } from './saga-repository.service';
import { PurchaseRequestDto } from '../dtos/purchase-request.dto';
import { SagaStatus } from './interfaces/saga-state.interface';

describe('ItemPurchaseOrchestratorService', () => {
  let orchestrator: ItemPurchaseOrchestratorService;
  let userService: UserService;
  let itemService: ItemService;
  let logService: LogService;
  let notificationService: NotificationService;
  let sagaRepository: SagaRepositoryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemPurchaseOrchestratorService,
        EventBusService,
        EventFactory,
        UserService,
        ItemService,
        LogService,
        NotificationService,
        SagaRepositoryService,
      ],
    }).compile();

    orchestrator = module.get<ItemPurchaseOrchestratorService>(
      ItemPurchaseOrchestratorService,
    );
    userService = module.get<UserService>(UserService);
    itemService = module.get<ItemService>(ItemService);
    logService = module.get<LogService>(LogService);
    notificationService = module.get<NotificationService>(NotificationService);
    sagaRepository = module.get<SagaRepositoryService>(SagaRepositoryService);
  });

  afterEach(async () => {
    // 각 테스트 후 데이터 초기화
    await sagaRepository.clear();
    await userService.resetUserBalance('user-123', 1000);
    await itemService.resetItemStock('item-sword', 50);
    await logService.clearLogs();
    await notificationService.clearNotifications();
  });

  it('should be defined', () => {
    expect(orchestrator).toBeDefined();
  });

  describe('executePurchase', () => {
    it('should execute successful purchase', async () => {
      const request: PurchaseRequestDto = {
        userId: 'user-123',
        itemId: 'item-sword',
        quantity: 1,
        price: 100,
      };

      const result = await orchestrator.executePurchase(request);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();
      expect(result.completedSteps).toHaveLength(4); // All steps completed
      expect(result.data?.userId).toBe('user-123');
      expect(result.data?.itemId).toBe('item-sword');

      // Verify saga state
      const sagaState = await orchestrator.getSagaState(result.transactionId);
      expect(sagaState?.status).toBe(SagaStatus.COMPLETED);
      expect(sagaState?.steps).toHaveLength(4);
    });

    it('should fail purchase due to insufficient balance', async () => {
      const request: PurchaseRequestDto = {
        userId: 'user-456', // Has only 50 balance
        itemId: 'item-sword',
        quantity: 1,
        price: 100,
      };

      const result = await orchestrator.executePurchase(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('INSUFFICIENT_BALANCE');

      // Verify saga state
      const sagaState = await orchestrator.getSagaState(result.transactionId);
      expect(sagaState?.status).toBe(SagaStatus.FAILED);
      expect(sagaState?.error?.step).toBe('user_validation');
    });

    it('should fail purchase due to item not available', async () => {
      const request: PurchaseRequestDto = {
        userId: 'user-123',
        itemId: 'item-disabled', // Not available item
        quantity: 1,
        price: 50,
      };

      const result = await orchestrator.executePurchase(request);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('ITEM_NOT_AVAILABLE');

      // Verify compensation occurred
      const sagaState = await orchestrator.getSagaState(result.transactionId);
      expect(sagaState?.status).toBe(SagaStatus.COMPENSATED);
      expect(sagaState?.compensations).toHaveLength(1); // User validation compensated

      // Verify user balance restored
      const userProfile = await userService.getUserProfile('user-123');
      expect(userProfile?.balance).toBe(1000); // Balance restored
    });

    it('should continue despite notification failure', async () => {
      // Set notification service to always fail
      await notificationService.setFailureRate(1.0);

      const request: PurchaseRequestDto = {
        userId: 'user-123',
        itemId: 'item-sword',
        quantity: 1,
        price: 100,
      };

      const result = await orchestrator.executePurchase(request);

      // Purchase should still succeed even if notification fails
      expect(result.success).toBe(true);
      expect(result.completedSteps).toContain('user_validation');
      expect(result.completedSteps).toContain('item_grant');
      expect(result.completedSteps).toContain('log_record');

      const sagaState = await orchestrator.getSagaState(result.transactionId);
      expect(sagaState?.status).toBe(SagaStatus.COMPLETED);

      // But notification step should show failure
      const notificationStep = sagaState?.steps.find(
        (s) => s.step === 'notification',
      );
      expect(notificationStep?.status).toBe('failed');
    });
  });

  describe('compensateSaga', () => {
    it('should compensate failed saga', async () => {
      const request: PurchaseRequestDto = {
        userId: 'user-123',
        itemId: 'item-disabled',
        quantity: 1,
        price: 100,
      };

      const result = await orchestrator.executePurchase(request);
      expect(result.success).toBe(false);

      // Verify compensation
      const sagaState = await orchestrator.getSagaState(result.transactionId);
      expect(sagaState?.status).toBe(SagaStatus.COMPENSATED);

      // User balance should be restored
      const userProfile = await userService.getUserProfile('user-123');
      expect(userProfile?.balance).toBe(1000);
    });

    it('should handle manual compensation', async () => {
      // First create a failed saga
      const request: PurchaseRequestDto = {
        userId: 'user-123',
        itemId: 'item-out-of-stock',
        quantity: 1,
        price: 100,
      };

      const result = await orchestrator.executePurchase(request);
      expect(result.success).toBe(false);

      // Manual compensation
      const compensationResult = await orchestrator.compensateSaga(
        result.transactionId,
      );
      expect(compensationResult).toBe(true);

      const sagaState = await orchestrator.getSagaState(result.transactionId);
      expect(sagaState?.status).toBe(SagaStatus.COMPENSATED);
    });
  });

  describe('getSagaState', () => {
    it('should return saga state', async () => {
      const request: PurchaseRequestDto = {
        userId: 'user-123',
        itemId: 'item-sword',
        quantity: 1,
        price: 100,
      };

      const result = await orchestrator.executePurchase(request);
      const sagaState = await orchestrator.getSagaState(result.transactionId);

      expect(sagaState).toBeDefined();
      expect(sagaState?.transactionId).toBe(result.transactionId);
      expect(sagaState?.purchaseData.userId).toBe('user-123');
    });

    it('should return null for non-existent saga', async () => {
      const sagaState = await orchestrator.getSagaState('non-existent');
      expect(sagaState).toBeNull();
    });
  });
});
