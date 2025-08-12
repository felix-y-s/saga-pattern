import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from 'src/event/eventBus';
import { FailedStep, ItemAddedEvent, PurchaseEvent, PurchaseFailedEvent } from 'src/interface/ChoreographySaga.event';
import { LogService } from 'src/log/log.service';

@Injectable()
export class ChoreographyLogService extends LogService {
  constructor(private readonly eventBus: EventBus) {
    super();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.eventBus.subscribe(PurchaseEvent.ITEM_ADDED, async (event: ItemAddedEvent) => {
      const { transactionId, request } = event.data;
      Logger.log(`[ChoreographyLogService] 로그 생성 시도(transactionId:${transactionId}`);
      try {
        await this.createPurchaseLog(transactionId, request);
        await this.eventBus.publish({
          eventId: this.generateEventId(),
          eventType: PurchaseEvent.NOTIFICATION,
          timestamp: new Date(),
          data: {
            transactionId,
            userId: request.userId,
            itemName: request.itemName,
            request
          }
        });
      } catch(error) {
        Logger.error(`❌ [ChoreographyLogService] 로그 생성 중 실패, 실패 이벤트 발송 (${error.message})`);
        this.eventBus.publish({
          eventId: this.generateEventId(),
          eventType: PurchaseEvent.PURCHASE_FAILED,
          timestamp: new Date(),
          data: {
            transactionId: event.data.transactionId,
            reason: error.message,
            failedStep: FailedStep.LOG_ADDITION,
            request,
          },
        } as PurchaseFailedEvent);
      }
    });

    this.eventBus.subscribe(PurchaseEvent.PURCHASE_FAILED, async (event: PurchaseFailedEvent) => {
      if (event.data.failedStep !== FailedStep.LOG_ADDITION) {
        Logger.log(`[ChoreographyLogService] 로그 제거 (transactionId: ${event.data.transactionId})`);
        await this.deletePurchaseLog(event.data.transactionId);
      }
    })
  }

  private generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
