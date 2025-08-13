import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../events/interfaces/event-handler.interface';
import { EventBusService } from '../../events/event-bus.service';
import { EventFactory } from '../../events/event-factory';
import { ItemService } from '../../services/item.service';
import { SagaRepositoryService } from '../../orchestrator/saga-repository.service';
import { SagaStep, SagaStepResult } from '../../orchestrator/interfaces/saga-state.interface';
import {
  UserValidatedEvent,
  ItemGrantedEvent,
  ItemGrantFailedEvent,
} from '../../events/purchase-events';

/**
 * 아이템 지급을 담당하는 독립적인 이벤트 핸들러
 * 코레오그래피 패턴에서 UserValidated 이벤트에 반응하여 아이템 지급을 수행
 */
@Injectable()
export class ItemGrantHandler implements EventHandler<UserValidatedEvent> {
  private readonly logger = new Logger(ItemGrantHandler.name);

  constructor(
    private readonly itemService: ItemService,
    private readonly eventBus: EventBusService,
    private readonly eventFactory: EventFactory,
    private readonly sagaRepository: SagaRepositoryService,
  ) {}

  async handle(event: UserValidatedEvent): Promise<void> {
    const startTime = Date.now();
    const { transactionId, userId } = event;
    
    this.logger.log(`📦 Starting item grant for transaction: ${transactionId}`);

    try {
      // Saga 상태 조회
      const sagaState = await this.sagaRepository.findById(transactionId);
      if (!sagaState) {
        throw new Error(`Saga state not found: ${transactionId}`);
      }

      const { itemId, quantity } = sagaState.purchaseData;

      // 아이템 지급 수행
      const grantResult = await this.itemService.grantItem({
        userId,
        itemId,
        quantity,
        transactionId,
      });

      // Saga 상태 업데이트
      const stepResult: SagaStepResult = {
        step: SagaStep.ITEM_GRANT,
        status: grantResult.success ? 'success' as const : 'failed' as const,
        data: grantResult,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      if (!grantResult.success) {
        stepResult.error = {
          code: grantResult.errorCode || 'ITEM_GRANT_FAILED',
          message: grantResult.reason || 'Item grant failed',
          details: grantResult,
        };
      }

      await this.sagaRepository.updateStepResult(transactionId, stepResult);

      // 다음 단계를 위한 이벤트 발행
      if (grantResult.success) {
        this.logger.log(`✅ Item grant successful: ${itemId} x${quantity} to ${userId} (${transactionId})`);
        
        const nextEvent = new ItemGrantedEvent(
          this.eventFactory.generateEventId(),
          this.eventFactory.getCurrentTimestamp(),
          transactionId,
          this.eventFactory.generateVersion(),
          userId,
          itemId,
          quantity,
          transactionId,
        );

        await this.eventBus.publish(nextEvent);
      } else {
        this.logger.warn(`❌ Item grant failed: ${itemId} for ${userId} (${transactionId}) - ${grantResult.reason}`);
        
        const failureEvent = new ItemGrantFailedEvent(
          this.eventFactory.generateEventId(),
          this.eventFactory.getCurrentTimestamp(),
          transactionId,
          this.eventFactory.generateVersion(),
          userId,
          itemId,
          transactionId,
          grantResult.reason || 'Item grant failed',
          grantResult.errorCode || 'GRANT_FAILED',
        );

        await this.eventBus.publish(failureEvent);
      }

    } catch (error) {
      this.logger.error(`💥 Item grant error: ${transactionId}`, error);

      // 에러 상태 업데이트
      const errorStepResult: SagaStepResult = {
        step: SagaStep.ITEM_GRANT,
        status: 'failed' as const,
        error: {
          code: 'ITEM_GRANT_ERROR',
          message: error.message || 'Item grant error',
          details: error,
        },
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      await this.sagaRepository.updateStepResult(transactionId, errorStepResult);

      // 실패 이벤트 발행
      const sagaState = await this.sagaRepository.findById(transactionId);
      const { itemId } = sagaState?.purchaseData || {};

      const failureEvent = new ItemGrantFailedEvent(
        this.eventFactory.generateEventId(),
        this.eventFactory.getCurrentTimestamp(),
        transactionId,
        this.eventFactory.generateVersion(),
        userId,
        itemId || 'unknown',
        transactionId,
        error.message || 'Item grant error',
        'ITEM_GRANT_ERROR',
      );

      await this.eventBus.publish(failureEvent);
    }
  }
}