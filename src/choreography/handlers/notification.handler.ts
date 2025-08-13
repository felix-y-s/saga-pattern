import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../events/interfaces/event-handler.interface';
import { EventBusService } from '../../events/event-bus.service';
import { EventFactory } from '../../events/event-factory';
import { NotificationService } from '../../services/notification.service';
import { SagaRepositoryService } from '../../orchestrator/saga-repository.service';
import {
  SagaStep,
  SagaStepResult,
  SagaStatus,
} from '../../orchestrator/interfaces/saga-state.interface';
import {
  LogRecordedEvent,
  NotificationSentEvent,
  NotificationFailedEvent,
  PurchaseCompletedEvent,
} from '../../events/purchase-events';

/**
 * 알림 발송을 담당하는 독립적인 이벤트 핸들러
 * 코레오그래피 패턴에서 LogRecorded 이벤트에 반응하여 알림을 발송하고 구매를 완료
 *
 * 주의: 알림 실패는 전체 트랜잭션을 실패시키지 않음 (비즈니스 요구사항)
 */
@Injectable()
export class NotificationHandler implements EventHandler<LogRecordedEvent> {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly eventBus: EventBusService,
    private readonly eventFactory: EventFactory,
    private readonly sagaRepository: SagaRepositoryService,
  ) {}

  async handle(event: LogRecordedEvent): Promise<void> {
    const startTime = Date.now();
    const { transactionId } = event;

    this.logger.log(
      `📢 Starting notification for transaction: ${transactionId}`,
    );

    try {
      // Saga 상태 조회
      const sagaState = await this.sagaRepository.findById(transactionId);
      if (!sagaState) {
        throw new Error(`Saga state not found: ${transactionId}`);
      }

      const { userId, itemId, quantity, price } = sagaState.purchaseData;

      // 알림 발송 수행 (실패해도 전체 트랜잭션은 성공)
      let notificationResult: any;
      try {
        notificationResult = await this.notificationService.sendNotification({
          userId,
          transactionId,
          type: 'purchase_success',
          message: `Purchase completed! You received ${quantity} x ${itemId}`,
          metadata: {
            itemId,
            quantity,
            price,
            logId: event.logId,
            completedAt: new Date(),
          },
        });
      } catch (notificationError) {
        this.logger.warn(
          `⚠️  Notification failed but continuing transaction: ${transactionId}`,
          notificationError,
        );

        notificationResult = {
          success: false,
          reason: notificationError.message || 'Notification service error',
          errorCode: 'NOTIFICATION_SERVICE_ERROR',
        };
      }

      // Saga 상태 업데이트 (알림 실패와 관계없이)
      const stepResult: SagaStepResult = {
        step: SagaStep.NOTIFICATION,
        status: notificationResult.success
          ? ('success' as const)
          : ('failed' as const),
        data: notificationResult,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      if (!notificationResult.success) {
        stepResult.error = {
          code: notificationResult.errorCode || 'NOTIFICATION_FAILED',
          message: notificationResult.reason || 'Notification failed',
          details: notificationResult,
        };

        this.logger.warn(
          `⚠️  Notification failed (non-critical): ${transactionId} - ${notificationResult.reason}`,
        );
      }

      await this.sagaRepository.updateStepResult(transactionId, stepResult);

      // 알림 결과에 따른 이벤트 발행 (정보성)
      if (notificationResult.success) {
        this.logger.log(
          `✅ Notification sent successfully: ${notificationResult.notificationId} (${transactionId})`,
        );

        const notificationEvent = new NotificationSentEvent(
          this.eventFactory.generateEventId(),
          this.eventFactory.getCurrentTimestamp(),
          transactionId,
          this.eventFactory.generateVersion(),
          userId,
          transactionId,
          notificationResult.notificationId,
          'purchase_success',
        );

        await this.eventBus.publish(notificationEvent);
      } else {
        const failureEvent = new NotificationFailedEvent(
          this.eventFactory.generateEventId(),
          this.eventFactory.getCurrentTimestamp(),
          transactionId,
          this.eventFactory.generateVersion(),
          userId,
          transactionId,
          notificationResult.reason || 'Notification failed',
          notificationResult.errorCode || 'NOTIFICATION_FAILED',
          'purchase_success',
        );

        await this.eventBus.publish(failureEvent);
      }

      // 구매 완료 처리 (알림 성공/실패와 관계없이 진행)
      await this.completePurchase(transactionId, sagaState);
    } catch (error) {
      this.logger.error(
        `💥 Critical notification handler error: ${transactionId}`,
        error,
      );

      // 심각한 에러 상태 업데이트
      const errorStepResult: SagaStepResult = {
        step: SagaStep.NOTIFICATION,
        status: 'failed' as const,
        error: {
          code: 'NOTIFICATION_HANDLER_ERROR',
          message: error.message || 'Notification handler critical error',
          details: error,
        },
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      await this.sagaRepository.updateStepResult(
        transactionId,
        errorStepResult,
      );

      // 그래도 구매는 완료 처리 (알림은 부가 기능)
      try {
        const sagaState = await this.sagaRepository.findById(transactionId);
        if (sagaState) {
          await this.completePurchase(transactionId, sagaState);
        }
      } catch (completionError) {
        this.logger.error(
          `💥 Failed to complete purchase after notification error: ${transactionId}`,
          completionError,
        );
      }
    }
  }

  /**
   * 구매 완료 처리 - Saga 상태를 완료로 마킹하고 완료 이벤트 발행
   */
  private async completePurchase(
    transactionId: string,
    sagaState: any,
  ): Promise<void> {
    try {
      // Saga 상태를 완료로 업데이트
      const completedAt = new Date();
      await this.sagaRepository.updateSagaStatus(
        transactionId,
        SagaStatus.COMPLETED,
        completedAt,
      );

      this.logger.log(`🎉 Purchase completed successfully: ${transactionId}`);

      // 구매 완료 이벤트 발행
      const { userId, itemId, quantity, price } = sagaState.purchaseData;

      const completionEvent = new PurchaseCompletedEvent(
        this.eventFactory.generateEventId(),
        this.eventFactory.getCurrentTimestamp(),
        transactionId,
        this.eventFactory.generateVersion(),
        userId,
        itemId,
        quantity,
        transactionId,
        price,
        completedAt,
      );

      await this.eventBus.publish(completionEvent);
    } catch (error) {
      this.logger.error(
        `💥 Purchase completion error: ${transactionId}`,
        error,
      );
      throw error;
    }
  }
}
