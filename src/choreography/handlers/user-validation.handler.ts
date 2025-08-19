import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../events/interfaces/event-handler.interface';
import { EventBusService } from '../../events/event-bus.service';
import { EventFactory } from '../../events/event-factory';
import { UserService } from '../../services/user.service';
import { SagaRepositoryService } from '../../orchestrator/saga-repository.service';
import {
  SagaStep,
  SagaStepResult,
} from '../../orchestrator/interfaces/saga-state.interface';
import {
  PurchaseInitiatedEvent,
  UserValidatedEvent,
  UserValidationFailedEvent,
} from '../../events/purchase-events';

/**
 * 사용자 검증을 담당하는 독립적인 이벤트 핸들러
 * 코레오그래피 패턴에서 PurchaseInitiated 이벤트에 반응하여 사용자 검증을 수행
 */
@Injectable()
export class UserValidationHandler
  implements EventHandler<PurchaseInitiatedEvent>
{
  private readonly logger = new Logger(UserValidationHandler.name);

  constructor(
    private readonly userService: UserService,
    private readonly eventBus: EventBusService,
    private readonly eventFactory: EventFactory,
    private readonly sagaRepository: SagaRepositoryService,
  ) {}

  async handle(event: PurchaseInitiatedEvent): Promise<void> {
    const startTime = Date.now();
    const { transactionId, userId, price } = event;

    this.logger.log(
      `🔍 Starting user validation for transaction: ${transactionId}`,
    );

    try {
      // Saga 상태 조회
      const sagaState = await this.sagaRepository.findById(transactionId);
      if (!sagaState) {
        throw new Error(`Saga state not found: ${transactionId}`);
      }

      // step 실행전 사용자 상태 저장
      const beforeState = await this.userService.getUserProfile(userId);
      console.log(
        '🚀 ~ UserValidationHandler ~ handle ~ beforeState:',
        beforeState,
      );

      // 사용자 검증 수행
      const validationResult = await this.userService.validateUser({
        userId,
        transactionId,
        requiredBalance: price,
      });

      const afterState = await this.userService.getUserProfile(userId);
      console.log(
        '🚀 ~ UserValidationHandler ~ handle ~ afterState:',
        afterState,
      );

      // Saga 상태 업데이트
      const stepResult: SagaStepResult = {
        step: SagaStep.USER_VALIDATION,
        status: validationResult.isValid ? 'success' : 'failed',
        stateSnapshot: {
          before: { balance: beforeState?.balance },
          after: { balance: afterState?.balance },
          changes: [
            {
              field: 'balance',
              from: beforeState?.balance,
              to: afterState?.balance,
            },
          ],
        },
        data: validationResult,
        executedAt: new Date(),
        duration: Date.now() - startTime,
      };

      if (!validationResult.isValid) {
        stepResult.error = {
          code: validationResult.errorCode || 'USER_VALIDATION_FAILED',
          message: validationResult.reason || 'User validation failed',
          details: validationResult,
        };
      }

      await this.sagaRepository.updateStepResult(transactionId, stepResult);

      // 다음 단계를 위한 이벤트 발행
      if (validationResult.isValid) {
        this.logger.log(
          `✅ User validation successful: ${userId} (${transactionId})`,
        );

        const nextEvent = new UserValidatedEvent(
          this.eventFactory.generateEventId(),
          this.eventFactory.getCurrentTimestamp(),
          transactionId,
          this.eventFactory.generateVersion(),
          userId,
          transactionId,
          validationResult.currentBalance,
        );

        await this.eventBus.publish(nextEvent);
      } else {
        this.logger.warn(
          `❌ User validation failed: ${userId} (${transactionId}) - ${validationResult.reason}`,
        );

        const failureEvent = new UserValidationFailedEvent(
          this.eventFactory.generateEventId(),
          this.eventFactory.getCurrentTimestamp(),
          transactionId,
          this.eventFactory.generateVersion(),
          userId,
          transactionId,
          validationResult.reason || 'User validation failed',
          validationResult.errorCode || 'VALIDATION_FAILED',
        );

        await this.eventBus.publish(failureEvent);
      }
    } catch (error) {
      this.logger.error(`💥 User validation error: ${transactionId}`, error);

      // 에러 상태 업데이트
      const errorStepResult: SagaStepResult = {
        step: SagaStep.USER_VALIDATION,
        status: 'failed' as const,
        error: {
          code: 'USER_VALIDATION_ERROR',
          message: error.message || 'User validation error',
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
      const failureEvent = new UserValidationFailedEvent(
        this.eventFactory.generateEventId(),
        this.eventFactory.getCurrentTimestamp(),
        transactionId,
        this.eventFactory.generateVersion(),
        userId,
        transactionId,
        error.message || 'User validation error',
        'USER_VALIDATION_ERROR',
      );

      await this.eventBus.publish(failureEvent);
    }
  }
}
