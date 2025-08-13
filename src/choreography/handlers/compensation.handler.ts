import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../events/interfaces/event-handler.interface';
import { EventBusService } from '../../events/event-bus.service';
import { EventFactory } from '../../events/event-factory';
import { UserService } from '../../services/user.service';
import { ItemService } from '../../services/item.service';
import { LogService } from '../../services/log.service';
import { SagaRepositoryService } from '../../orchestrator/saga-repository.service';
import { SagaContextImpl } from '../../orchestrator/saga-context';
import { SagaStep, SagaStatus } from '../../orchestrator/interfaces/saga-state.interface';
import {
  UserValidationFailedEvent,
  ItemGrantFailedEvent,
  LogFailedEvent,
  CompensationInitiatedEvent,
  CompensationCompletedEvent,
  PurchaseFailedEvent,
} from '../../events/purchase-events';

/**
 * 보상 트랜잭션을 담당하는 독립적인 이벤트 핸들러
 * 코레오그래피 패턴에서 각종 실패 이벤트에 반응하여 보상 작업을 수행
 */
@Injectable()
export class CompensationHandler implements EventHandler<UserValidationFailedEvent | ItemGrantFailedEvent | LogFailedEvent> {
  private readonly logger = new Logger(CompensationHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly itemService: ItemService,
    private readonly logService: LogService,
    private readonly eventBus: EventBusService,
    private readonly eventFactory: EventFactory,
    private readonly sagaRepository: SagaRepositoryService,
  ) {}

  async handle(event: UserValidationFailedEvent | ItemGrantFailedEvent | LogFailedEvent): Promise<void> {
    const { transactionId } = event;
    
    this.logger.log(`🔄 Starting compensation for transaction: ${transactionId}`);

    try {
      // Saga 상태 조회
      const sagaState = await this.sagaRepository.findById(transactionId);
      if (!sagaState) {
        this.logger.error(`Saga state not found for compensation: ${transactionId}`);
        return;
      }

      const context = new SagaContextImpl(sagaState);

      // 보상이 필요한지 확인
      if (!this.shouldCompensate(context, event)) {
        this.logger.debug(`No compensation needed for saga: ${transactionId}`);
        await this.markPurchaseAsFailed(transactionId, context, event);
        return;
      }

      // 보상 시작
      context.updateState({ status: SagaStatus.COMPENSATING });
      await this.sagaRepository.update(transactionId, { status: SagaStatus.COMPENSATING });

      // 보상 시작 이벤트 발행
      await this.publishCompensationInitiatedEvent(transactionId, event);

      // 성공한 단계들을 역순으로 보상
      const successfulSteps = this.getSuccessfulSteps(context);
      this.logger.debug(`Compensating steps: ${successfulSteps.join(', ')} for ${transactionId}`);

      for (const step of successfulSteps.reverse()) {
        await this.executeCompensationStep(context, step);
      }

      // 보상 완료
      context.updateState({ status: SagaStatus.COMPENSATED });
      await this.sagaRepository.update(transactionId, context.state);

      await this.publishCompensationCompletedEvent(transactionId, context);
      await this.markPurchaseAsFailed(transactionId, context, event);

      this.logger.log(`✅ Compensation completed successfully: ${transactionId}`);

    } catch (error) {
      this.logger.error(`💥 Compensation failed: ${transactionId}`, error);
      
      // 보상 실패는 심각한 문제이므로 별도 처리가 필요할 수 있음
      await this.handleCriticalCompensationFailure(transactionId, event, error);
    }
  }

  /**
   * 보상이 필요한지 판단
   */
  private shouldCompensate(context: SagaContextImpl, failureEvent: any): boolean {
    // UserValidationFailed의 경우 보상 불필요 (아직 아무것도 실행하지 않음)
    if (failureEvent instanceof UserValidationFailedEvent || failureEvent.eventType === 'UserValidationFailed') {
      return false;
    }

    // 성공한 단계가 있는 경우에만 보상 필요
    const successfulSteps = this.getSuccessfulSteps(context);
    return successfulSteps.length > 0;
  }

  /**
   * 성공한 단계들을 추출
   */
  private getSuccessfulSteps(context: SagaContextImpl): SagaStep[] {
    return context.state.steps
      .filter(step => step.status === 'success')
      .map(step => step.step);
  }

  /**
   * 특정 단계의 보상 실행
   */
  private async executeCompensationStep(context: SagaContextImpl, step: SagaStep): Promise<void> {
    this.logger.debug(`Executing compensation for step ${step}: ${context.state.transactionId}`);

    try {
      let success = false;
      const { userId, itemId, quantity, price } = context.state.purchaseData;

      switch (step) {
        case SagaStep.USER_VALIDATION:
          // 사용자 검증 보상 (예: 차감된 포인트 복구)
          success = await this.userService.compensateUserValidation(
            userId,
            price,
            context.state.transactionId,
          );
          break;

        case SagaStep.ITEM_GRANT:
          // 아이템 지급 보상 (지급된 아이템 회수)
          success = await this.itemService.compensateItemGrant(
            userId,
            itemId,
            quantity,
            context.state.transactionId,
          );
          break;

        case SagaStep.LOG_RECORD:
          // 로그 보상 (로그 상태를 보상됨으로 표시)
          const logStep = context.state.steps.find(s => s.step === SagaStep.LOG_RECORD);
          const logId = logStep?.data?.logId;
          if (logId) {
            success = await this.logService.updateLogStatus(logId, 'compensated', {
              compensatedAt: new Date(),
              reason: 'Transaction compensated',
            });
          } else {
            success = true; // 로그ID가 없으면 성공으로 처리
          }
          break;

        case SagaStep.NOTIFICATION:
          // 알림은 보상하지 않음 (이미 발송된 알림은 취소 불가)
          success = true;
          break;

        default:
          this.logger.warn(`Unknown step for compensation: ${step}`);
          success = true;
      }

      // 보상 결과 기록
      context.addCompensation({
        step,
        action: 'compensate',
        data: { success, executedAt: new Date() },
        executedAt: new Date(),
        status: success ? 'success' : 'failed',
      });

      if (!success) {
        throw new Error(`Compensation failed for step: ${step}`);
      }

      this.logger.debug(`✅ Compensation successful for step ${step}: ${context.state.transactionId}`);

    } catch (error) {
      this.logger.error(`💥 Compensation error for step ${step}:`, error);
      
      context.addCompensation({
        step,
        action: 'compensate',
        data: { error: error.message, executedAt: new Date() },
        executedAt: new Date(),
        status: 'failed',
      });

      throw error;
    }
  }

  /**
   * 구매 실패로 마킹하고 실패 이벤트 발행
   */
  private async markPurchaseAsFailed(transactionId: string, context: SagaContextImpl, originalEvent: any): Promise<void> {
    try {
      // Saga 상태를 실패로 업데이트
      const failedAt = new Date();
      const errorInfo = this.extractErrorInfo(originalEvent);
      
      context.markFailed(errorInfo.step, {
        code: errorInfo.code,
        message: errorInfo.message,
        details: originalEvent,
      });

      await this.sagaRepository.update(transactionId, {
        ...context.state,
        status: SagaStatus.FAILED,
        failedAt,
      });

      // 구매 실패 이벤트 발행
      const { userId, itemId } = context.state.purchaseData;
      
      const failureEvent = new PurchaseFailedEvent(
        this.eventFactory.generateEventId(),
        this.eventFactory.getCurrentTimestamp(),
        transactionId,
        this.eventFactory.generateVersion(),
        userId,
        itemId,
        transactionId,
        errorInfo.message,
        errorInfo.step,
        errorInfo.code,
      );

      await this.eventBus.publish(failureEvent);
      
      this.logger.log(`❌ Purchase marked as failed: ${transactionId} - ${errorInfo.message}`);

    } catch (error) {
      this.logger.error(`💥 Failed to mark purchase as failed: ${transactionId}`, error);
    }
  }

  /**
   * 원본 실패 이벤트에서 에러 정보 추출
   */
  private extractErrorInfo(event: any): { step: SagaStep; code: string; message: string } {
    if (event.eventType === 'UserValidationFailed') {
      return {
        step: SagaStep.USER_VALIDATION,
        code: event.errorCode || 'USER_VALIDATION_FAILED',
        message: event.reason || 'User validation failed',
      };
    } else if (event.eventType === 'ItemGrantFailed') {
      return {
        step: SagaStep.ITEM_GRANT,
        code: event.errorCode || 'ITEM_GRANT_FAILED',
        message: event.reason || 'Item grant failed',
      };
    } else if (event.eventType === 'LogFailed') {
      return {
        step: SagaStep.LOG_RECORD,
        code: event.errorCode || 'LOG_FAILED',
        message: event.reason || 'Log record failed',
      };
    } else {
      return {
        step: SagaStep.USER_VALIDATION,
        code: 'UNKNOWN_FAILURE',
        message: 'Unknown failure occurred',
      };
    }
  }

  private async publishCompensationInitiatedEvent(transactionId: string, originalEvent: any): Promise<void> {
    const errorInfo = this.extractErrorInfo(originalEvent);
    
    const event = new CompensationInitiatedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      transactionId,
      this.eventFactory.generateVersion(),
      transactionId,
      'purchase_compensation',
      errorInfo.step,
    );

    await this.eventBus.publish(event);
  }

  private async publishCompensationCompletedEvent(transactionId: string, context: SagaContextImpl): Promise<void> {
    const event = new CompensationCompletedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      transactionId,
      this.eventFactory.generateVersion(),
      transactionId,
      'purchase_compensation',
      {
        compensatedSteps: context.state.compensations.map(c => c.step),
        completedAt: new Date(),
      },
    );

    await this.eventBus.publish(event);
  }

  private async handleCriticalCompensationFailure(transactionId: string, originalEvent: any, error: any): Promise<void> {
    this.logger.error(`🚨 CRITICAL: Compensation failure requires manual intervention`);
    this.logger.error(`Transaction: ${transactionId}, Original failure: ${originalEvent.eventType}`);
    this.logger.error(`Compensation error: ${error.message}`);
    
    // 실제 운영 환경에서는 다음과 같은 조치 가능:
    // 1. 외부 모니터링 시스템에 긴급 알림
    // 2. Dead Letter Queue에 이벤트 저장
    // 3. 운영팀에 즉시 알림 전송
    // 4. 수동 보상을 위한 작업 큐에 추가
    
    // 임시로 구매 실패로 마킹
    try {
      const sagaState = await this.sagaRepository.findById(transactionId);
      if (sagaState) {
        const context = new SagaContextImpl(sagaState);
        await this.markPurchaseAsFailed(transactionId, context, originalEvent);
      }
    } catch (markingError) {
      this.logger.error(`💥 Failed to mark purchase as failed after compensation failure: ${transactionId}`, markingError);
    }
  }
}