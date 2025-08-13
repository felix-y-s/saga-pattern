import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../events/interfaces/event-handler.interface';
import { EventBusService } from '../../events/event-bus.service';
import { EventFactory } from '../../events/event-factory';
import { LogService } from '../../services/log.service';
import { SagaRepositoryService } from '../../orchestrator/saga-repository.service';
import {
  SagaStep,
  SagaStepResult,
} from '../../orchestrator/interfaces/saga-state.interface';
import {
  ItemGrantedEvent,
  LogRecordedEvent,
  LogFailedEvent,
} from '../../events/purchase-events';

/**
 * 로그 기록을 담당하는 독립적인 이벤트 핸들러
 * 코레오그래피 패턴에서 ItemGranted 이벤트에 반응하여 로그 기록을 수행
 */
@Injectable()
export class LogRecordHandler implements EventHandler<ItemGrantedEvent> {
  private readonly logger = new Logger(LogRecordHandler.name);

  constructor(
    private readonly logService: LogService,
    private readonly eventBus: EventBusService,
    private readonly eventFactory: EventFactory,
    private readonly sagaRepository: SagaRepositoryService,
  ) {}

  async handle(event: ItemGrantedEvent): Promise<void> {
    const startTime = Date.now();
    const { transactionId, userId, itemId, quantity } = event;

    this.logger.log(`📝 Starting log record for transaction: ${transactionId}`);

    try {
      // Saga 상태 조회 및 추가 정보 수집
      const sagaState = await this.sagaRepository.findById(transactionId);
      if (!sagaState) {
        throw new Error(`Saga state not found: ${transactionId}`);
      }

      const { price } = sagaState.purchaseData;
      const executedSteps = sagaState.steps.map((step) => step.step);
      const totalDuration = Date.now() - sagaState.startedAt.getTime();

      // 로그 기록 수행
      const logResult = await this.logService.recordLog({
        transactionId,
        userId,
        itemId,
        quantity,
        price,
        status: 'success',
        step: 'purchase_completed',
        metadata: {
          executedSteps,
          duration: totalDuration,
          completedAt: new Date(),
        },
      });

      // Saga 상태 업데이트
      const stepResult: SagaStepResult = {
        step: SagaStep.LOG_RECORD,
        status: logResult.success ? ('success' as const) : ('failed' as const),
        data: logResult,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      if (!logResult.success) {
        stepResult.error = {
          code: logResult.errorCode || 'LOG_RECORD_FAILED',
          message: logResult.reason || 'Log record failed',
          details: logResult,
        };
      }

      await this.sagaRepository.updateStepResult(transactionId, stepResult);

      // 다음 단계를 위한 이벤트 발행
      if (logResult.success) {
        this.logger.log(
          `✅ Log record successful: ${logResult.logId} (${transactionId})`,
        );

        const nextEvent = new LogRecordedEvent(
          this.eventFactory.generateEventId(),
          this.eventFactory.getCurrentTimestamp(),
          transactionId,
          this.eventFactory.generateVersion(),
          transactionId,
          logResult.logId,
          {
            userId,
            itemId,
            quantity,
            price,
            completedAt: new Date(),
          },
        );

        await this.eventBus.publish(nextEvent);
      } else {
        this.logger.warn(
          `❌ Log record failed: ${transactionId} - ${logResult.reason}`,
        );

        const failureEvent = new LogFailedEvent(
          this.eventFactory.generateEventId(),
          this.eventFactory.getCurrentTimestamp(),
          transactionId,
          this.eventFactory.generateVersion(),
          transactionId,
          logResult.reason || 'Log record failed',
          logResult.errorCode || 'LOG_FAILED',
          {
            userId,
            itemId,
            quantity,
            price,
          },
        );

        await this.eventBus.publish(failureEvent);
      }
    } catch (error) {
      this.logger.error(`💥 Log record error: ${transactionId}`, error);

      // 에러 상태 업데이트
      const errorStepResult: SagaStepResult = {
        step: SagaStep.LOG_RECORD,
        status: 'failed' as const,
        error: {
          code: 'LOG_RECORD_ERROR',
          message: error.message || 'Log record error',
          details: error,
        },
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      await this.sagaRepository.updateStepResult(
        transactionId,
        errorStepResult,
      );

      // 실패 이벤트 발행
      const sagaState = await this.sagaRepository.findById(transactionId);
      const { price } = sagaState?.purchaseData || {};

      const failureEvent = new LogFailedEvent(
        this.eventFactory.generateEventId(),
        this.eventFactory.getCurrentTimestamp(),
        transactionId,
        this.eventFactory.generateVersion(),
        transactionId,
        error.message || 'Log record error',
        'LOG_RECORD_ERROR',
        {
          userId,
          itemId,
          quantity,
          price: price || 0,
        },
      );

      await this.eventBus.publish(failureEvent);
    }
  }
}
