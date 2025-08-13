import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from '../events/event-bus.service';
import { EventFactory } from '../events/event-factory';
import { SagaRepositoryService } from '../orchestrator/saga-repository.service';
import {
  SagaState,
  SagaStatus,
} from '../orchestrator/interfaces/saga-state.interface';
import { PurchaseRequestDto } from '../dtos/purchase-request.dto';
import { PurchaseInitiatedEvent } from '../events/purchase-events';
import { PurchaseResult } from '../orchestrator/interfaces/orchestrator.interface';

/**
 * 코레오그래피 패턴을 위한 구매 조정 서비스
 *
 * 역할:
 * - 구매 프로세스 초기화 (Saga 상태 생성)
 * - 첫 번째 이벤트 발행 (PurchaseInitiated)
 * - 이후의 모든 단계는 독립적인 이벤트 핸들러들이 담당
 *
 * 기존 Orchestrator와의 차이점:
 * - 직접적인 서비스 의존성 없음 (EventBus, EventFactory, Repository만)
 * - 각 단계를 직접 실행하지 않고 이벤트로 위임
 * - 단순한 시작점 역할만 수행
 */
@Injectable()
export class PurchaseCoordinatorService {
  private readonly logger = new Logger(PurchaseCoordinatorService.name);

  constructor(
    private readonly eventBus: EventBusService,
    private readonly eventFactory: EventFactory,
    private readonly sagaRepository: SagaRepositoryService,
  ) {}

  /**
   * 코레오그래피 방식으로 구매 프로세스를 시작
   *
   * @param request 구매 요청 정보
   * @returns 트랜잭션 ID와 초기 상태 정보
   */
  async initiatePurchase(
    request: PurchaseRequestDto,
  ): Promise<{ transactionId: string; status: string }> {
    const transactionId = this.eventFactory.generateTransactionId();

    this.logger.log(
      `🚀 Initiating choreography-based purchase: ${transactionId}`,
    );
    this.logger.debug(
      `Request: userId=${request.userId}, itemId=${request.itemId}, quantity=${request.quantity}, price=${request.price}`,
    );

    try {
      // 1. 초기 Saga 상태 생성
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

      // 2. Saga 상태 저장
      await this.sagaRepository.save(sagaState);
      this.logger.debug(`Saga state initialized: ${transactionId}`);

      // 3. 구매 시작 이벤트 발행 (이후는 이벤트 체인이 담당)
      const initiatedEvent = new PurchaseInitiatedEvent(
        this.eventFactory.generateEventId(),
        this.eventFactory.getCurrentTimestamp(),
        transactionId,
        this.eventFactory.generateVersion(),
        request.userId,
        request.itemId,
        request.quantity,
        request.price,
        transactionId,
      );

      await this.eventBus.publish(initiatedEvent);

      this.logger.log(`✅ Purchase initiation completed: ${transactionId}`);
      this.logger.debug(
        `Event published: PurchaseInitiated, now choreography takes over`,
      );

      return {
        transactionId,
        status: 'initiated',
      };
    } catch (error) {
      this.logger.error(
        `💥 Failed to initiate purchase: ${transactionId}`,
        error,
      );

      // 실패 시 Saga 상태도 정리
      try {
        await this.sagaRepository.update(transactionId, {
          status: SagaStatus.FAILED,
          failedAt: new Date(),
          error: {
            step: 'INITIATION' as any,
            code: 'INITIATION_ERROR',
            message: error.message || 'Purchase initiation failed',
            details: error,
          },
        });
      } catch (updateError) {
        this.logger.error(
          `Failed to update saga state after initiation error: ${transactionId}`,
          updateError,
        );
      }

      throw new Error(`Purchase initiation failed: ${error.message}`);
    }
  }

  /**
   * 특정 트랜잭션의 현재 상태를 조회
   *
   * @param transactionId 트랜잭션 ID
   * @returns Saga 상태 정보
   */
  async getTransactionStatus(transactionId: string): Promise<SagaState | null> {
    return await this.sagaRepository.findById(transactionId);
  }

  /**
   * 기존 Orchestrator 인터페이스와의 호환성을 위한 래퍼 메서드
   * 코레오그래피 방식으로 구매를 시작하고 결과를 기다림 (비동기)
   *
   * 주의: 이 메서드는 실제로 완료를 기다리지 않고 즉시 반환
   * 실제 결과는 이벤트를 통해 비동기적으로 처리됨
   */
  async executePurchase(request: PurchaseRequestDto): Promise<PurchaseResult> {
    try {
      const { transactionId } = await this.initiatePurchase(request);

      // 코레오그래피 방식에서는 즉시 반환
      // 실제 결과는 이벤트 체인을 통해 비동기적으로 처리됨
      return {
        success: true,
        transactionId,
        status: 'PENDING' as any,
        completedSteps: [],
        message:
          'Purchase initiated successfully. Processing will continue via event choreography.',
      };
    } catch (error) {
      return {
        success: false,
        transactionId: 'unknown',
        status: 'FAILED' as any,
        completedSteps: [],
        error: {
          step: 'INITIATION' as any,
          code: 'INITIATION_ERROR',
          message: error.message || 'Purchase initiation failed',
        },
      };
    }
  }

  /**
   * 사용자별 구매 내역 조회
   */
  async getUserPurchaseHistory(userId: string): Promise<SagaState[]> {
    return await this.sagaRepository.findByUserId(userId);
  }

  /**
   * 전체 시스템 통계 조회
   */
  async getSystemStatistics(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    compensating: number;
    compensated: number;
  }> {
    return await this.sagaRepository.getStatistics();
  }

  /**
   * 개발/테스트용: 모든 Saga 상태 초기화
   */
  async clearAllTransactions(): Promise<void> {
    await this.sagaRepository.clear();
    this.logger.warn('🧹 All transaction states cleared (development only)');
  }
}
