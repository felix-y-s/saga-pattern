import { Module, OnModuleInit } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PurchaseCoordinatorService } from './purchase-coordinator.service';
import { UserValidationHandler } from './handlers/user-validation.handler';
import { ItemGrantHandler } from './handlers/item-grant.handler';
import { LogRecordHandler } from './handlers/log-record.handler';
import { NotificationHandler } from './handlers/notification.handler';
import { CompensationHandler } from './handlers/compensation.handler';
import { EventBusService } from '../events/event-bus.service';
import {
  isChoreographyMode,
  getSagaPatternConfig,
} from '../config/saga-pattern.config';

// 필요한 의존성 모듈들
import { EventBusModule } from '../events/event-bus.module';
import { ServicesModule } from '../services/services.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module'; // SagaRepository 때문에 필요

/**
 * 코레오그래피 패턴 구현을 위한 모듈
 *
 * 특징:
 * - 각 도메인별 독립적인 이벤트 핸들러들
 * - 중앙집중식 제어 없이 이벤트 체인으로 동작
 * - 느슨한 결합과 높은 확장성 제공
 *
 * 컴포넌트:
 * - PurchaseCoordinatorService: 구매 프로세스 초기화
 * - UserValidationHandler: 사용자 검증 처리
 * - ItemGrantHandler: 아이템 지급 처리
 * - LogRecordHandler: 로그 기록 처리
 * - NotificationHandler: 알림 발송 및 구매 완료 처리
 * - CompensationHandler: 보상 트랜잭션 처리
 */
@Module({
  imports: [
    EventBusModule, // 이벤트 발행/구독 시스템
    ServicesModule, // 도메인 서비스들 (UserService, ItemService, etc.)
    OrchestratorModule, // SagaRepositoryService 사용을 위해 import
  ],
  providers: [
    // 🎯 코디네이터 (구매 프로세스 시작점)
    PurchaseCoordinatorService,

    // 📋 이벤트 핸들러들 (각 단계별 독립 처리)
    UserValidationHandler,
    ItemGrantHandler,
    LogRecordHandler,
    NotificationHandler,
    CompensationHandler,
  ],
  exports: [
    // 외부에서 사용할 수 있도록 내보냄
    PurchaseCoordinatorService,

    // 필요 시 개별 핸들러들도 내보낼 수 있음 (테스트 등)
    UserValidationHandler,
    ItemGrantHandler,
    LogRecordHandler,
    NotificationHandler,
    CompensationHandler,
  ],
})
export class ChoreographyModule implements OnModuleInit {
  constructor(private moduleRef: ModuleRef) {
    console.log(
      '🎭 ChoreographyModule initialized - Event-driven saga pattern ready',
    );
  }

  /**
   * 모듈 초기화 시 이벤트 핸들러들을 EventBus에 등록
   * 설정에 따라 코레오그래피 모드일 때만 핸들러들이 활성화됨
   */
  onModuleInit() {
    const config = getSagaPatternConfig();
    console.log(
      `🔧 ChoreographyModule: Current saga pattern mode = ${config.mode}`,
    );

    // 코레오그래피 모드일 때만 핸들러 등록
    if (!isChoreographyMode()) {
      console.log(
        '⏸️ Choreography handlers DISABLED (Orchestration mode active)',
      );
      return;
    }

    const eventBus = this.moduleRef.get(EventBusService, { strict: false });

    if (!eventBus) {
      throw new Error(
        'EventBusService not found. Make sure EventBusModule is imported.',
      );
    }

    console.log('🎭 CHOREOGRAPHY MODE: Activating event handlers...');

    // 🔍 사용자 검증 핸들러: PurchaseInitiated 이벤트 구독
    const userValidationHandler = this.moduleRef.get(UserValidationHandler, {
      strict: false,
    });
    eventBus.subscribe('PurchaseInitiated', userValidationHandler);

    // 📦 아이템 지급 핸들러: UserValidated 이벤트 구독
    const itemGrantHandler = this.moduleRef.get(ItemGrantHandler, {
      strict: false,
    });
    eventBus.subscribe('UserValidated', itemGrantHandler);

    // 📝 로그 기록 핸들러: ItemGranted 이벤트 구독
    const logRecordHandler = this.moduleRef.get(LogRecordHandler, {
      strict: false,
    });
    eventBus.subscribe('ItemGranted', logRecordHandler);

    // 📢 알림 핸들러: LogRecorded 이벤트 구독
    const notificationHandler = this.moduleRef.get(NotificationHandler, {
      strict: false,
    });
    eventBus.subscribe('LogRecorded', notificationHandler);

    // 🔄 보상 핸들러: 실패 이벤트들 구독
    const compensationHandler = this.moduleRef.get(CompensationHandler, {
      strict: false,
    });
    eventBus.subscribe('UserValidationFailed', compensationHandler);
    eventBus.subscribe('ItemGrantFailed', compensationHandler);
    eventBus.subscribe('LogFailed', compensationHandler);

    console.log(
      '✅ CHOREOGRAPHY MODE: All event handlers registered successfully',
    );
    console.log('📋 Choreography event subscription summary:');
    console.log(
      '  - UserValidationHandler → PurchaseInitiated (BUSINESS LOGIC)',
    );
    console.log('  - ItemGrantHandler → UserValidated');
    console.log('  - LogRecordHandler → ItemGranted');
    console.log('  - NotificationHandler → LogRecorded');
    console.log(
      '  - CompensationHandler → UserValidationFailed, ItemGrantFailed, LogFailed',
    );
    console.log('🎯 Choreography pattern will handle PurchaseInitiated events');
  }
}
