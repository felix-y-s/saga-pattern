import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from '../events/event-bus.service';
import { EventFactory } from '../events/event-factory';
import { UserService } from '../services/user.service';
import { ItemService } from '../services/item.service';
import { LogService } from '../services/log.service';
import { NotificationService } from '../services/notification.service';
import { SagaRepositoryService } from './saga-repository.service';
import { SagaContextImpl } from './saga-context';
import { IOrchestratorService, PurchaseResult } from './interfaces/orchestrator.interface';
import { SagaState, SagaStatus, SagaStep, SagaStepResult } from './interfaces/saga-state.interface';
import { PurchaseRequestDto } from '../dtos/purchase-request.dto';
import {
  PurchaseInitiatedEvent,
  UserValidatedEvent,
  UserValidationFailedEvent,
  ItemGrantedEvent,
  ItemGrantFailedEvent,
  LogRecordedEvent,
  LogFailedEvent,
  NotificationSentEvent,
  NotificationFailedEvent,
  PurchaseCompletedEvent,
  PurchaseFailedEvent,
  CompensationInitiatedEvent,
  CompensationCompletedEvent,
} from '../events/purchase-events';

@Injectable()
export class ItemPurchaseOrchestratorService implements IOrchestratorService {
  private readonly logger = new Logger(ItemPurchaseOrchestratorService.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly eventFactory: EventFactory,
    private readonly userService: UserService,
    private readonly itemService: ItemService,
    private readonly logService: LogService,
    private readonly notificationService: NotificationService,
    private readonly sagaRepository: SagaRepositoryService,
  ) {}

  async executePurchase(request: PurchaseRequestDto): Promise<PurchaseResult> {
    const transactionId = this.eventFactory.generateTransactionId();
    return this.executePurchaseWithTransactionId(request, transactionId);
  }

  async executePurchaseFromEvent(request: PurchaseRequestDto, transactionId: string): Promise<PurchaseResult> {
    this.logger.log(`Starting event-driven purchase orchestration: ${transactionId}`);
    return this.executePurchaseWithTransactionId(request, transactionId);
  }

  private async executePurchaseWithTransactionId(request: PurchaseRequestDto, transactionId: string): Promise<PurchaseResult> {
    this.logger.log(`Starting purchase orchestration: ${transactionId}`);
    
    // 초기 Saga 상태 생성
    const sagaState: SagaState = {
      transactionId,
      status: SagaStatus.PENDING,
      purchaseData: {
        userId: request.userId,
        itemId: request.itemId,
        quantity: request.quantity,
        price: request.price,
      },
      steps: [],
      compensations: [],
      startedAt: new Date(),
    };

    const context = new SagaContextImpl(sagaState);
    await this.sagaRepository.save(context.state);

    // 구매 시작 이벤트 발행
    await this.publishPurchaseInitiatedEvent(context);

    try {
      // Saga 실행
      context.updateState({ status: SagaStatus.IN_PROGRESS });
      await this.sagaRepository.update(transactionId, { status: SagaStatus.IN_PROGRESS });

      // Step 1: 사용자 검증
      await this.executeUserValidation(context);
      if (context.isFailed()) {
        return this.handleSagaFailure(context);
      }

      // Step 2: 아이템 지급
      await this.executeItemGrant(context);
      if (context.isFailed()) {
        await this.compensateSaga(transactionId);
        return this.handleSagaFailure(context);
      }

      // Step 3: 로그 기록
      await this.executeLogRecord(context);
      if (context.isFailed()) {
        await this.compensateSaga(transactionId);
        return this.handleSagaFailure(context);
      }

      // Step 4: 알림 발송 (실패해도 전체 트랜잭션은 성공)
      await this.executeNotification(context);
      
      // 모든 단계 완료
      context.markCompleted();
      await this.sagaRepository.update(transactionId, context.state);
      
      await this.publishPurchaseCompletedEvent(context);
      
      this.logger.log(`Purchase orchestration completed successfully: ${transactionId}`);
      
      return this.buildSuccessResult(context);

    } catch (error) {
      this.logger.error(`Purchase orchestration failed: ${transactionId}`, error);
      
      context.markFailed(SagaStep.USER_VALIDATION, error);
      await this.sagaRepository.update(transactionId, context.state);
      
      await this.compensateSaga(transactionId);
      return this.handleSagaFailure(context);
    }
  }

  private async executeUserValidation(context: SagaContextImpl): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing user validation: ${context.state.transactionId}`);
      
      const result = await this.userService.validateUser({
        userId: context.state.purchaseData.userId,
        transactionId: context.state.transactionId,
        requiredBalance: context.state.purchaseData.price,
      });

      const stepResult: SagaStepResult = {
        step: SagaStep.USER_VALIDATION,
        status: result.isValid ? 'success' : 'failed',
        data: result,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      if (!result.isValid) {
        stepResult.error = {
          code: result.errorCode || 'USER_VALIDATION_FAILED',
          message: result.reason || 'User validation failed',
          details: result,
        };

        await this.publishUserValidationFailedEvent(context, result);
      } else {
        await this.publishUserValidatedEvent(context, result);
      }

      context.addStepResult(stepResult);
      await this.sagaRepository.update(context.state.transactionId, context.state);

    } catch (error) {
      const stepResult: SagaStepResult = {
        step: SagaStep.USER_VALIDATION,
        status: 'failed',
        error: {
          code: 'USER_VALIDATION_ERROR',
          message: error.message || 'User validation error',
          details: error,
        },
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      context.addStepResult(stepResult);
      throw error;
    }
  }

  private async executeItemGrant(context: SagaContextImpl): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing item grant: ${context.state.transactionId}`);
      
      const result = await this.itemService.grantItem({
        userId: context.state.purchaseData.userId,
        itemId: context.state.purchaseData.itemId,
        quantity: context.state.purchaseData.quantity,
        transactionId: context.state.transactionId,
      });

      const stepResult: SagaStepResult = {
        step: SagaStep.ITEM_GRANT,
        status: result.success ? 'success' : 'failed',
        data: result,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      if (!result.success) {
        stepResult.error = {
          code: result.errorCode || 'ITEM_GRANT_FAILED',
          message: result.reason || 'Item grant failed',
          details: result,
        };

        await this.publishItemGrantFailedEvent(context, result);
      } else {
        await this.publishItemGrantedEvent(context, result);
      }

      context.addStepResult(stepResult);
      await this.sagaRepository.update(context.state.transactionId, context.state);

    } catch (error) {
      const stepResult: SagaStepResult = {
        step: SagaStep.ITEM_GRANT,
        status: 'failed',
        error: {
          code: 'ITEM_GRANT_ERROR',
          message: error.message || 'Item grant error',
          details: error,
        },
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      context.addStepResult(stepResult);
      throw error;
    }
  }

  private async executeLogRecord(context: SagaContextImpl): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing log record: ${context.state.transactionId}`);
      
      const result = await this.logService.recordLog({
        transactionId: context.state.transactionId,
        userId: context.state.purchaseData.userId,
        itemId: context.state.purchaseData.itemId,
        quantity: context.state.purchaseData.quantity,
        price: context.state.purchaseData.price,
        status: 'success',
        step: 'purchase_completed',
        metadata: {
          executedSteps: context.getExecutedSteps(),
          duration: context.getDuration(),
        },
      });

      const stepResult: SagaStepResult = {
        step: SagaStep.LOG_RECORD,
        status: result.success ? 'success' : 'failed',
        data: result,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      if (!result.success) {
        stepResult.error = {
          code: result.errorCode || 'LOG_RECORD_FAILED',
          message: result.reason || 'Log record failed',
          details: result,
        };

        await this.publishLogFailedEvent(context, result);
      } else {
        await this.publishLogRecordedEvent(context, result);
      }

      context.addStepResult(stepResult);
      await this.sagaRepository.update(context.state.transactionId, context.state);

    } catch (error) {
      const stepResult: SagaStepResult = {
        step: SagaStep.LOG_RECORD,
        status: 'failed',
        error: {
          code: 'LOG_RECORD_ERROR',
          message: error.message || 'Log record error',
          details: error,
        },
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      context.addStepResult(stepResult);
      throw error;
    }
  }

  private async executeNotification(context: SagaContextImpl): Promise<void> {
    const startTime = Date.now();
    
    try {
      this.logger.debug(`Executing notification: ${context.state.transactionId}`);
      
      const result = await this.notificationService.sendNotification({
        userId: context.state.purchaseData.userId,
        transactionId: context.state.transactionId,
        type: 'purchase_success',
        message: `Purchase completed! You received ${context.state.purchaseData.quantity} x ${context.state.purchaseData.itemId}`,
        metadata: {
          itemId: context.state.purchaseData.itemId,
          quantity: context.state.purchaseData.quantity,
          price: context.state.purchaseData.price,
        },
      });

      const stepResult: SagaStepResult = {
        step: SagaStep.NOTIFICATION,
        status: result.success ? 'success' : 'failed',
        data: result,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      if (!result.success) {
        stepResult.error = {
          code: result.errorCode || 'NOTIFICATION_FAILED',
          message: result.reason || 'Notification failed',
          details: result,
        };

        await this.publishNotificationFailedEvent(context, result);
        
        // 알림 실패는 전체 트랜잭션을 실패시키지 않음
        this.logger.warn(`Notification failed but transaction continues: ${context.state.transactionId}`);
      } else {
        await this.publishNotificationSentEvent(context, result);
      }

      context.addStepResult(stepResult);
      await this.sagaRepository.update(context.state.transactionId, context.state);

    } catch (error) {
      this.logger.warn(`Notification error (non-critical): ${context.state.transactionId}`, error);
      
      const stepResult: SagaStepResult = {
        step: SagaStep.NOTIFICATION,
        status: 'failed',
        error: {
          code: 'NOTIFICATION_ERROR',
          message: error.message || 'Notification error',
          details: error,
        },
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      context.addStepResult(stepResult);
      // 알림 에러는 전체 플로우를 중단시키지 않음
    }
  }

  async compensateSaga(transactionId: string): Promise<boolean> {
    try {
      // WORD: compensation: 보상
      this.logger.log(`Starting saga compensation: ${transactionId}`);

      const sagaState = await this.sagaRepository.findById(transactionId);
      if (!sagaState) {
        this.logger.error(`Saga not found for compensation: ${transactionId}`);
        return false;
      }

      const context = new SagaContextImpl(sagaState);

      if (!context.shouldCompensate()) {
        this.logger.debug(`No compensation needed for saga: ${transactionId}`);
        return true;
      }

      context.updateState({ status: SagaStatus.COMPENSATING });
      await this.sagaRepository.update(transactionId, {
        status: SagaStatus.COMPENSATING,
      });

      await this.publishCompensationInitiatedEvent(context);

      // 성공한 단계들을 역순으로 보상
      const successfulSteps = context.getExecutedSteps().reverse();

      for (const step of successfulSteps) {
        await this.executeCompensation(context, step);
      }

      context.updateState({ status: SagaStatus.COMPENSATED });
      await this.sagaRepository.update(transactionId, context.state);

      await this.publishCompensationCompletedEvent(context);

      this.logger.log(`Saga compensation completed: ${transactionId}`);
      return true;
    } catch (error) {
      this.logger.error(`Saga compensation failed: ${transactionId}`, error);
      return false;
    }
  }

  private async executeCompensation(context: SagaContextImpl, step: SagaStep): Promise<void> {
    this.logger.debug(`Executing compensation for step ${step}: ${context.state.transactionId}`);

    try {
      let success = false;

      switch (step) {
        case SagaStep.USER_VALIDATION:
          success = await this.userService.compensateUserValidation(
            context.state.purchaseData.userId,
            context.state.purchaseData.price,
            context.state.transactionId,
          );
          break;

        case SagaStep.ITEM_GRANT:
          success = await this.itemService.compensateItemGrant(
            context.state.purchaseData.userId,
            context.state.purchaseData.itemId,
            context.state.purchaseData.quantity,
            context.state.transactionId,
          );
          break;

        case SagaStep.LOG_RECORD:
          // 로그는 보상하지 않고 상태만 업데이트
          const logId = context.state.steps.find(s => s.step === SagaStep.LOG_RECORD)?.data?.logId;
          if (logId) {
            success = await this.logService.updateLogStatus(logId, 'compensated', {
              compensatedAt: new Date(),
              reason: 'Transaction compensated',
            });
          }
          break;

        case SagaStep.NOTIFICATION:
          // 알림은 보상하지 않음
          success = true;
          break;

        default:
          this.logger.warn(`Unknown step for compensation: ${step}`);
          success = true;
      }

      context.addCompensation({
        step,
        action: 'compensate',
        data: { success },
        executedAt: new Date(),
        status: success ? 'success' : 'failed',
      });

      if (!success) {
        throw new Error(`Compensation failed for step: ${step}`);
      }

    } catch (error) {
      this.logger.error(`Compensation error for step ${step}:`, error);
      
      context.addCompensation({
        step,
        action: 'compensate',
        data: { error: error.message },
        executedAt: new Date(),
        status: 'failed',
      });

      throw error;
    }
  }

  async getSagaState(transactionId: string): Promise<SagaState | null> {
    return await this.sagaRepository.findById(transactionId);
  }

  private async handleSagaFailure(context: SagaContextImpl): Promise<PurchaseResult> {
    await this.publishPurchaseFailedEvent(context);
    
    return {
      success: false,
      transactionId: context.state.transactionId,
      status: context.state.status,
      completedSteps: context.getExecutedSteps(),
      error: context.state.error ? {
        step: context.state.error.step,
        code: context.state.error.code,
        message: context.state.error.message,
      } : undefined,
    };
  }

  private buildSuccessResult(context: SagaContextImpl): PurchaseResult {
    const logStep = context.state.steps.find(s => s.step === SagaStep.LOG_RECORD);
    const notificationStep = context.state.steps.find(s => s.step === SagaStep.NOTIFICATION);
    const itemStep = context.state.steps.find(s => s.step === SagaStep.ITEM_GRANT);

    return {
      success: true,
      transactionId: context.state.transactionId,
      status: context.state.status,
      completedSteps: context.getExecutedSteps(),
      data: {
        userId: context.state.purchaseData.userId,
        itemId: context.state.purchaseData.itemId,
        quantity: context.state.purchaseData.quantity,
        price: context.state.purchaseData.price,
        grantedAt: itemStep?.data?.grantedAt,
        logId: logStep?.data?.logId,
        notificationId: notificationStep?.data?.notificationId,
      },
    };
  }

  // 이벤트 발행 메소드들
  private async publishPurchaseInitiatedEvent(context: SagaContextImpl): Promise<void> {
    const event = new PurchaseInitiatedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.purchaseData.itemId,
      context.state.purchaseData.quantity,
      context.state.purchaseData.price,
      context.state.transactionId,
    );

    await this.eventBus.publish(event);
  }

  private async publishUserValidatedEvent(context: SagaContextImpl, result: any): Promise<void> {
    const event = new UserValidatedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.transactionId,
      result.currentBalance,
    );

    await this.eventBus.publish(event);
  }

  private async publishUserValidationFailedEvent(context: SagaContextImpl, result: any): Promise<void> {
    const event = new UserValidationFailedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.transactionId,
      result.reason || 'User validation failed',
      result.errorCode || 'VALIDATION_FAILED',
    );

    await this.eventBus.publish(event);
  }

  private async publishItemGrantedEvent(context: SagaContextImpl, result: any): Promise<void> {
    const event = new ItemGrantedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.purchaseData.itemId,
      context.state.purchaseData.quantity,
      context.state.transactionId,
    );

    await this.eventBus.publish(event);
  }

  private async publishItemGrantFailedEvent(context: SagaContextImpl, result: any): Promise<void> {
    const event = new ItemGrantFailedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.purchaseData.itemId,
      context.state.transactionId,
      result.reason || 'Item grant failed',
      result.errorCode || 'GRANT_FAILED',
    );

    await this.eventBus.publish(event);
  }

  private async publishLogRecordedEvent(context: SagaContextImpl, result: any): Promise<void> {
    const event = new LogRecordedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.transactionId,
      result.logId,
      {
        userId: context.state.purchaseData.userId,
        itemId: context.state.purchaseData.itemId,
        quantity: context.state.purchaseData.quantity,
        price: context.state.purchaseData.price,
      },
    );

    await this.eventBus.publish(event);
  }

  private async publishLogFailedEvent(context: SagaContextImpl, result: any): Promise<void> {
    const event = new LogFailedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.transactionId,
      result.reason || 'Log record failed',
      result.errorCode || 'LOG_FAILED',
      {
        userId: context.state.purchaseData.userId,
        itemId: context.state.purchaseData.itemId,
      },
    );

    await this.eventBus.publish(event);
  }

  private async publishNotificationSentEvent(context: SagaContextImpl, result: any): Promise<void> {
    const event = new NotificationSentEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.transactionId,
      result.notificationId,
      'purchase_success',
    );

    await this.eventBus.publish(event);
  }

  private async publishNotificationFailedEvent(context: SagaContextImpl, result: any): Promise<void> {
    const event = new NotificationFailedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.transactionId,
      result.reason || 'Notification failed',
      result.errorCode || 'NOTIFICATION_FAILED',
      'purchase_success',
    );

    await this.eventBus.publish(event);
  }

  private async publishPurchaseCompletedEvent(context: SagaContextImpl): Promise<void> {
    const event = new PurchaseCompletedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.purchaseData.itemId,
      context.state.purchaseData.quantity,
      context.state.transactionId,
      context.state.purchaseData.price,
      context.state.completedAt || new Date(),
    );

    await this.eventBus.publish(event);
  }

  private async publishPurchaseFailedEvent(context: SagaContextImpl): Promise<void> {
    const event = new PurchaseFailedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.purchaseData.userId,
      context.state.purchaseData.itemId,
      context.state.transactionId,
      context.state.error?.message || 'Purchase failed',
      context.state.error?.step || SagaStep.USER_VALIDATION,
      context.state.error?.code || 'PURCHASE_FAILED',
    );

    await this.eventBus.publish(event);
  }

  private async publishCompensationInitiatedEvent(context: SagaContextImpl): Promise<void> {
    const event = new CompensationInitiatedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.transactionId,
      'purchase_compensation',
      context.state.error?.step || 'unknown',
    );

    await this.eventBus.publish(event);
  }

  private async publishCompensationCompletedEvent(context: SagaContextImpl): Promise<void> {
    const event = new CompensationCompletedEvent(
      this.eventFactory.generateEventId(),
      this.eventFactory.getCurrentTimestamp(),
      context.state.transactionId,
      this.eventFactory.generateVersion(),
      context.state.transactionId,
      'purchase_compensation',
      {
        compensatedSteps: context.state.compensations.map(c => c.step),
        completedAt: new Date(),
      },
    );

    await this.eventBus.publish(event);
  }
}