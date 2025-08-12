import { Injectable, Logger } from '@nestjs/common';
import { warn } from 'node:console';
import { EventBus } from 'src/event/eventBus';
import { FailedStep, PointsDeductedEvent, PurchaseEvent, PurchaseFailedEvent, PurchaseStartedEvent } from 'src/interface/ChoreographySaga.event';
import { UserService } from 'src/user/user.service';

@Injectable()
export class ChoreographyUserService extends UserService {
  constructor(private eventBus: EventBus) {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.eventBus.subscribe(PurchaseEvent.PURCHASE_STARTED, async (event: PurchaseStartedEvent) => {
      try {
        const { transactionId, request } = event.data;

        await this.deductPoints(request.userId, request.price);

        await this.eventBus.publish({
          eventId: this.generateEventId(),
          eventType: PurchaseEvent.POINTS_DEDUCTED,
          timestamp: new Date(),
          data: {
            transactionId,
            userId: request.userId,
            amount: request.price,
            request,
          },
        } as PointsDeductedEvent);
      } catch (error) {
        Logger.error(`❌ [ChoreographyUserService] 포인트 차감 실패`);

        // 실패 이벤트 발생
        this.eventBus.publish({
          eventId: this.generateEventId(),
          eventType: PurchaseEvent.PURCHASE_FAILED,
          timestamp: new Date(),
          data: {
            transactionId: event.data.transactionId,
            reason: error.message,
            failedStep: FailedStep.POINTS_DEDUCTION,
            request: event.data.request,
          },
        } as PurchaseFailedEvent);
      }
    });

    this.eventBus.subscribe(PurchaseEvent.PURCHASE_FAILED, async (event: PurchaseFailedEvent) => {
      if (event.data.failedStep !== FailedStep.POINTS_DEDUCTION) {
        Logger.log(`[ChoreographyUserService] 포인트 환불 처리`);
        const { transactionId, request } = event.data;
        await this.addPoints(request.userId, request.price);
        Logger.log(`transactionId: ${transactionId}`);
      }
    })
  }


  private generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
