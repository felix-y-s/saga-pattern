import { Module, OnModuleInit } from '@nestjs/common';
import { ItemPurchaseOrchestratorService } from './item-purchase-orchestrator.service';
import { SagaRepositoryService } from './saga-repository.service';
import { PurchaseEventHandler } from './event-handlers/purchase-event.handler';
import { EventBusService } from '../events/event-bus.service';

@Module({
  providers: [
    ItemPurchaseOrchestratorService,
    SagaRepositoryService,
    PurchaseEventHandler,
  ],
  exports: [
    ItemPurchaseOrchestratorService,
    SagaRepositoryService,
  ],
})
export class OrchestratorModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly purchaseEventHandler: PurchaseEventHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    // 이벤트 핸들러 등록
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    // Purchase 관련 이벤트들을 구매 이벤트 핸들러에 등록
    const purchaseEvents = [
      'PurchaseInitiated',
      'UserValidated',
      'UserValidationFailed',
      'ItemGranted', 
      'ItemGrantFailed',
      'LogRecorded',
      'LogFailed',
      'NotificationSent',
      'NotificationFailed',
      'PurchaseCompleted',
      'PurchaseFailed',
      'CompensationInitiated',
      'CompensationCompleted',
      'CompensationFailed',
    ];

    purchaseEvents.forEach(eventType => {
      this.eventBus.subscribe(eventType, this.purchaseEventHandler);
    });

    console.log(`✅ Registered ${purchaseEvents.length} purchase event handlers`);
  }
}