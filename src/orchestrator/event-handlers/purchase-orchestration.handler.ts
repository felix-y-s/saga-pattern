import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../events/interfaces/event-handler.interface';
import { PurchaseInitiatedEvent } from '../../events/purchase-events';
import { ItemPurchaseOrchestratorService } from '../item-purchase-orchestrator.service';
import { PurchaseRequestDto } from '../../dtos/purchase-request.dto';

@Injectable()
export class PurchaseOrchestrationHandler
  implements EventHandler<PurchaseInitiatedEvent>
{
  private readonly logger = new Logger(PurchaseOrchestrationHandler.name);

  constructor(private readonly orchestrator: ItemPurchaseOrchestratorService) {}

  async handle(event: PurchaseInitiatedEvent): Promise<void> {
    try {
      this.logger.log(
        `🚀 Event-driven purchase initiated: ${event.transactionId}`,
      );
      this.logger.debug(
        `Processing purchase for user ${event.userId}, item ${event.itemId}`,
      );

      // 이벤트 데이터를 PurchaseRequestDto로 변환
      const purchaseRequest: PurchaseRequestDto = {
        userId: event.userId,
        itemId: event.itemId,
        quantity: event.quantity,
        price: event.price,
      };

      // Orchestrator를 통해 실제 구매 프로세스 실행
      const result = await this.orchestrator.executePurchaseFromEvent(
        purchaseRequest,
        event.transactionId, // 이벤트에서 제공된 transactionId 재사용
      );

      if (result.success) {
        this.logger.log(
          `✅ Event-driven purchase completed: ${event.transactionId}`,
        );
        this.logger.debug(
          `Completed steps: ${result.completedSteps.join(', ')}`,
        );
      } else {
        this.logger.warn(
          `❌ Event-driven purchase failed: ${event.transactionId}`,
        );
        if (result.error) {
          this.logger.debug(
            `Failed at step: ${result.error.step}, reason: ${result.error.message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(
        `💥 Event-driven purchase handler error: ${event.transactionId}`,
        error,
      );

      // 심각한 에러 발생 시 추가 처리 가능
      // 예: Dead Letter Queue, 알림 시스템 연동 등
      await this.handleCriticalError(event, error);
    }
  }

  private async handleCriticalError(
    event: PurchaseInitiatedEvent,
    error: any,
  ): Promise<void> {
    this.logger.error(
      `🚨 CRITICAL: Event handler failure requires manual intervention`,
    );
    this.logger.error(
      `Transaction: ${event.transactionId}, User: ${event.userId}, Item: ${event.itemId}`,
    );
    this.logger.error(`Error details: ${error.message}`);

    // 실제 운영 환경에서는 다음과 같은 조치 가능:
    // 1. 외부 모니터링 시스템에 알림
    // 2. Dead Letter Queue에 이벤트 저장
    // 3. 운영팀에 즉시 알림 전송
    // 4. 메트릭 수집 시스템에 오류 지표 전송

    // await this.alertingService.sendCriticalAlert({
    //   type: 'EVENT_HANDLER_FAILURE',
    //   transactionId: event.transactionId,
    //   error: error.message,
    //   timestamp: new Date().toISOString(),
    // });
  }
}
