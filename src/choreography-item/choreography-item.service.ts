import { Injectable, Logger } from '@nestjs/common';
import { EventBus } from 'src/event/eventBus';
import {
  FailedStep,
  ItemAddedEvent,
  PointsDeductedEvent,
  PurchaseEvent,
  PurchaseFailedEvent,
} from 'src/interface/ChoreographySaga.event';
import { ItemService } from 'src/item/item.service';

@Injectable()
export class ChoreographyItemService extends ItemService {
  constructor(private readonly eventBus: EventBus) {
    super();
    this.setupEventHandlers();
  }

  setupEventHandlers() {
    this.eventBus.subscribe(
      PurchaseEvent.POINTS_DEDUCTED,
      async (event: PointsDeductedEvent) => {
        const { transactionId, request } = event.data;
        try {
          Logger.log(`[ChoreographyItemService] 아이템 지급 처리`);
          await this.addItemToInventory(
            request.userId,
            request.itemId,
            request.itemName,
          );

          // 성공 시 다음 단계 이벤트 발행
          await this.eventBus.publish({
            eventId: this.generateEventId(),
            eventType: PurchaseEvent.ITEM_ADDED,
            timestamp: new Date(),
            data: {
              transactionId,
              userId: request.userId,
              itemName: request.itemName,
              request,
            },
          } as ItemAddedEvent);
        } catch (error) {
          console.log(`❌ [ChoreographyItemService] 아이템 지급 실패`);

          await this.eventBus.publish({
            eventId: this.generateEventId(),
            eventType: PurchaseEvent.PURCHASE_FAILED,
            timestamp: new Date(),
            data: {
              transactionId: event.data.transactionId,
              reason: error.message,
              failedStep: FailedStep.ITEM_ADDITION,
              request, 
            }
          } as PurchaseFailedEvent)
        }
      },
    );

    this.eventBus.subscribe(PurchaseEvent.PURCHASE_FAILED, async (event: PurchaseFailedEvent) => {
      const { request } = event.data;
      this.removeItemFromInventory(request.userId, request.itemName);
    });
  }

  private generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
