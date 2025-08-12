import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { ItemPurchaseOrchestratorService } from './item-purchase-orchestrator/item-purchase-orchestrator.service';
import { type PurchaseItemRequest } from './interface/Purchase';
import { EventBus } from './event/eventBus';
import { PurchaseEvent, PurchaseStartedEvent } from './interface/ChoreographySaga.event';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly itemPurchaseOrchestratorService: ItemPurchaseOrchestratorService,
    private readonly eventBus: EventBus,
  ) {}

  @Get()
  getHello(): string {
    const request: PurchaseItemRequest = {
      userId: 'user1',
      itemId: 'item1',
      itemName: '전설 검',
      price: 2000,
      quantity: 1,
    };
    this.itemPurchaseOrchestratorService.purchaseItem(request);
    return this.appService.getHello();
  }

  @Post('choreography')
  async purchaseWithChoreography(@Body() request: PurchaseItemRequest) {
    Logger.log(`[Controller] Choreography 방식으로 구매 처리`);

    const transactionId = this.generateTransactionId();

    // 구매 시작 이벤트 발생
    this.eventBus.publish({
      eventId: this.generateEventId(),
      eventType: PurchaseEvent.PURCHASE_STARTED,
      timestamp: new Date(),
      data: {
        transactionId: this.generateTransactionId(),
        request,
      },
    } as PurchaseStartedEvent);

    // FIXME: 클라이언트에게 실행 완료를 알릴 방법이 없다.
    return {
      message: '구매 처리가 시작되었습니다.',
      transactionId,
    };
  }

  private generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
