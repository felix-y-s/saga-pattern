import { Module, OnModuleInit } from '@nestjs/common';
import { ItemPurchaseOrchestratorService } from './item-purchase-orchestrator.service';
import { SagaRepositoryService } from './saga-repository.service';
import { PurchaseEventHandler } from './event-handlers/purchase-event.handler';
import { PurchaseOrchestrationHandler } from './event-handlers/purchase-orchestration.handler';
import { EventBusService } from '../events/event-bus.service';
import {
  isOrchestrationMode,
  getSagaPatternConfig,
} from '../config/saga-pattern.config';

@Module({
  providers: [
    ItemPurchaseOrchestratorService,
    SagaRepositoryService,
    PurchaseEventHandler,
    PurchaseOrchestrationHandler,
  ],
  exports: [ItemPurchaseOrchestratorService, SagaRepositoryService],
})
export class OrchestratorModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly purchaseEventHandler: PurchaseEventHandler,
    private readonly purchaseOrchestrationHandler: PurchaseOrchestrationHandler,
  ) {}

  async onModuleInit(): Promise<void> {
    // 설정에 따라 이벤트 핸들러 등록
    this.registerEventHandlers();
  }

  private registerEventHandlers(): void {
    const config = getSagaPatternConfig();
    console.log(
      `🔧 OrchestratorModule: Current saga pattern mode = ${config.mode}`,
    );

    // 오케스트레이션 모드일 때만 핸들러 등록
    if (!isOrchestrationMode()) {
      console.log(
        '⏸️ Orchestration handlers DISABLED (Choreography mode active)',
      );
      return;
    }

    // Purchase 관련 이벤트들을 모니터링 핸들러에 등록
    const monitoringEvents = [
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

    // 모니터링용 핸들러 등록 (로깅만 수행, 비즈니스 로직 없음)
    monitoringEvents.forEach((eventType) => {
      this.eventBus.subscribe(eventType, this.purchaseEventHandler);
    });

    // 비즈니스 로직용 핸들러 등록 - PurchaseInitiated 이벤트 처리
    this.eventBus.subscribe(
      'PurchaseInitiated',
      this.purchaseOrchestrationHandler,
    );

    console.log(
      `✅ ORCHESTRATION MODE: Registered ${monitoringEvents.length} monitoring event handlers`,
    );
    console.log(
      `✅ ORCHESTRATION MODE: Registered 1 business logic handler for PurchaseInitiated`,
    );
    console.log(
      '🎯 Orchestration pattern will handle PurchaseInitiated events',
    );
  }
}
