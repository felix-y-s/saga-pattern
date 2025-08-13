# 📚 NestJS Saga Pattern - 코드 참조 인덱스

## 📋 목차

- [핵심 클래스 및 인터페이스](#핵심-클래스-및-인터페이스)
- [메서드 시그니처 참조](#메서드-시그니처-참조)
- [이벤트 타입 정의](#이벤트-타입-정의)
- [설정 및 상수](#설정-및-상수)
- [에러 코드 매핑](#에러-코드-매핑)
- [테스트 데이터](#테스트-데이터)

## 🏗️ 핵심 클래스 및 인터페이스

### 🎭 패턴 제어

#### SagaPatternConfig
```typescript
// 📍 src/config/saga-pattern.config.ts

export enum SagaPatternMode {
  ORCHESTRATION = 'orchestration',
  CHOREOGRAPHY = 'choreography',
}

export interface SagaPatternConfig {
  mode: SagaPatternMode;
  enableEventLogging?: boolean;
  enableMetrics?: boolean;
}

// 핵심 함수
export function getSagaPatternConfig(): SagaPatternConfig
export function isOrchestrationMode(): boolean
export function isChoreographyMode(): boolean
```

### 🚌 이벤트 시스템

#### EventBusService
```typescript
// 📍 src/events/event-bus.service.ts

@Injectable()
export class EventBusService implements EventBusInterface {
  
  // 이벤트 발행
  async publish<T extends BaseEvent>(event: T): Promise<void>
  
  // 핸들러 구독
  subscribe<T extends BaseEvent>(
    eventType: string, 
    handler: EventHandler<T>
  ): void
  
  // 구독 해제
  unsubscribe<T extends BaseEvent>(
    eventType: string, 
    handler: EventHandler<T>
  ): void
  
  // 핸들러 목록 조회
  getHandlers(eventType: string): EventHandler<any>[]
}
```

#### BaseEvent
```typescript
// 📍 src/events/interfaces/base-event.ts

export abstract class BaseEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly transactionId: string;
  
  constructor(transactionId: string) {
    this.eventId = `EVT_${Date.now()}_${Math.random().toString(36)}`;
    this.eventType = this.constructor.name;
    this.timestamp = new Date();
    this.transactionId = transactionId;
  }
}
```

### 🎪 Choreography 핸들러

#### EventHandler 인터페이스
```typescript
// 📍 src/events/interfaces/event-handler.interface.ts

export interface EventHandler<T extends BaseEvent> {
  handle(event: T): Promise<void>;
}
```

#### UserValidationHandler
```typescript
// 📍 src/choreography/handlers/user-validation.handler.ts

@Injectable()
export class UserValidationHandler implements EventHandler<PurchaseInitiatedEvent> {
  
  async handle(event: PurchaseInitiatedEvent): Promise<void> {
    const { transactionId, userId, price } = event;
    
    // 1. 비즈니스 로직 실행
    const result = await this.userService.validateUser({
      userId, transactionId, requiredBalance: price
    });
    
    // 2. Saga 상태 업데이트
    await this.updateSagaState(transactionId, result);
    
    // 3. 다음 이벤트 발행
    if (result.isValid) {
      await this.publishSuccessEvent(transactionId, result);
    } else {
      await this.publishFailureEvent(transactionId, result);
    }
  }
}
```

### 🎭 Orchestration 서비스

#### ItemPurchaseOrchestratorService
```typescript
// 📍 src/orchestrator/item-purchase-orchestrator.service.ts

@Injectable()
export class ItemPurchaseOrchestratorService {
  
  // 메인 실행 메서드
  async executePurchaseWithTransactionId(
    transactionId: string, 
    purchaseData: PurchaseRequestDto
  ): Promise<PurchaseResult> {
    
    // 각 단계 순차 실행
    const steps = [
      () => this.executeUserValidation(transactionId, purchaseData),
      () => this.executeItemGrant(transactionId, purchaseData),
      () => this.executeLogRecord(transactionId, purchaseData),
      () => this.executeNotification(transactionId, purchaseData)
    ];
    
    // 실행 및 보상 로직
    return await this.executeStepsWithCompensation(transactionId, steps);
  }
  
  // 보상 실행
  private async executeCompensation(
    transactionId: string, 
    completedSteps: SagaStepResult[]
  ): Promise<void>
}
```

#### SagaRepository
```typescript
// 📍 src/orchestrator/saga-repository.service.ts

@Injectable()
export class SagaRepository {
  
  // Saga 상태 저장
  async save(saga: SagaState): Promise<void>
  
  // Saga 조회
  async findById(transactionId: string): Promise<SagaState | null>
  
  // 모든 Saga 조회
  async findAll(): Promise<SagaState[]>
  
  // 상태별 조회
  async findByStatus(status: SagaStatus): Promise<SagaState[]>
  
  // 단계 결과 업데이트
  async updateStepResult(
    transactionId: string, 
    stepResult: SagaStepResult
  ): Promise<void>
  
  // Saga 상태 업데이트
  async updateSagaStatus(
    transactionId: string, 
    status: SagaStatus
  ): Promise<void>
}
```

### 🏢 도메인 서비스

#### UserService
```typescript
// 📍 src/services/user.service.ts

@Injectable()
export class UserService {
  
  // 사용자 검증
  async validateUser(dto: UserValidationDto): Promise<UserValidationResult> {
    // 사용자 존재 확인, 상태 검증, 잔액 확인 및 차감
  }
  
  // 검증 보상 (잔액 복구)
  async compensateUserValidation(
    userId: string, 
    amount: number, 
    transactionId: string
  ): Promise<boolean>
  
  // 사용자 프로필 조회
  async getUserProfile(userId: string): Promise<UserProfile | null>
  
  // 잔액 리셋 (테스트용)
  async resetUserBalance(userId: string, balance: number): Promise<void>
}
```

#### ItemService
```typescript
// 📍 src/services/item.service.ts

@Injectable()
export class ItemService {
  
  // 아이템 지급
  async grantItem(dto: ItemGrantDto): Promise<ItemGrantResult> {
    // 아이템 확인, 재고 체크, 지급 처리
  }
  
  // 아이템 지급 보상
  async compensateItemGrant(
    userId: string, 
    itemId: string, 
    quantity: number, 
    transactionId: string
  ): Promise<boolean>
  
  // 아이템 정보 조회
  async getItemInfo(itemId: string): Promise<ItemInfo | null>
  
  // 사용자 인벤토리 조회
  async getUserInventory(userId: string): Promise<UserInventory[]>
}
```

## 🔧 메서드 시그니처 참조

### API 컨트롤러 메서드

#### 구매 관련
```typescript
// 📍 src/app.controller.ts

// Orchestration 구매
@Post('purchase')
async purchase(@Body() body: PurchaseRequestDto): Promise<PurchaseResult>

// Choreography 구매  
@Post('purchase/choreography')
async purchaseWithChoreography(@Body() body: PurchaseRequestDto): Promise<{
  success: boolean;
  transactionId: string;
  status: string;
  message: string;
  processingInfo: ChoreographyProcessingInfo;
}>
```

#### 모니터링 관련
```typescript
// Orchestration 상태 조회
@Get('saga/:transactionId')
async getSagaStatus(@Param('transactionId') transactionId: string): Promise<{
  found: boolean;
  saga?: SagaState;
  message?: string;
}>

// Choreography 상태 조회
@Get('choreography/transaction/:transactionId')
async getChoreographyTransaction(@Param('transactionId') transactionId: string): Promise<{
  found: boolean;
  transaction?: SagaState;
  patternUsed: string;
  eventHandlers: {
    completed: any[];
    compensations: any[];
  };
}>

// 통계 조회
@Get('sagas/stats')
async getSagaStatistics(): Promise<{
  success: boolean;
  statistics: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    compensating: number;
    compensated: number;
  };
}>
```

#### 설정 관련
```typescript
// 현재 패턴 모드 조회
@Get('config/saga-mode')
getCurrentSagaMode(): {
  success: boolean;
  config: SagaPatternConfig;
  activeHandlers: {
    orchestration: boolean;
    choreography: boolean;
  };
  warning: string;
}

// 패턴 모드 변경
@Post('config/saga-mode')
setSagaPatternMode(@Body() body: { mode: string }): {
  success: boolean;
  previousMode: string;
  newMode: string;
  warning: string;
  recommendation: string;
  currentlyActive: {
    orchestration: boolean;
    choreography: boolean;
  };
}
```

## 📬 이벤트 타입 정의

### 이벤트 클래스 계층
```typescript
// 📍 src/events/purchase-events.ts

// 기본 구매 이벤트
export class PurchaseInitiatedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly userId: string,
    public readonly itemId: string,
    public readonly quantity: number,
    public readonly price: number
  )
}

// 성공 이벤트들
export class UserValidatedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly userId: string,
    public readonly validationResult: UserValidationResult
  )
}

export class ItemGrantedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly userId: string,
    public readonly itemId: string,
    public readonly quantity: number,
    public readonly grantResult: ItemGrantResult
  )
}

export class LogRecordedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly logId: string,
    public readonly logResult: LogResult
  )
}

export class NotificationSentEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly notificationId: string,
    public readonly notificationResult: NotificationResult
  )
}

export class PurchaseCompletedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly completedSteps: string[],
    public readonly finalResult: any
  )
}

// 실패 이벤트들
export class UserValidationFailedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly userId: string,
    public readonly reason: string,
    public readonly errorCode: string
  )
}

export class ItemGrantFailedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly userId: string,
    public readonly itemId: string,
    public readonly reason: string,
    public readonly errorCode: string
  )
}

// 보상 이벤트들
export class CompensationStartedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly failureReason: string,
    public readonly stepsToCompensate: string[]
  )
}

export class CompensationCompletedEvent extends BaseEvent {
  constructor(
    transactionId: string,
    public readonly compensatedSteps: string[],
    public readonly compensationResults: any[]
  )
}
```

## ⚙️ 설정 및 상수

### Saga 상태 열거형
```typescript
// 📍 src/orchestrator/interfaces/saga-state.interface.ts

export enum SagaStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress', 
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated'
}

export enum SagaStep {
  USER_VALIDATION = 'user_validation',
  ITEM_GRANT = 'item_grant',
  LOG_RECORD = 'log_record',
  NOTIFICATION = 'notification'
}

export enum StepStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  COMPENSATED = 'compensated'
}
```

### DTO 인터페이스
```typescript
// 📍 src/dtos/purchase-request.dto.ts

export interface PurchaseRequestDto {
  userId: string;
  itemId: string;
  quantity: number;
  price: number;
}

export interface UserValidationDto {
  userId: string;
  transactionId: string;
  requiredBalance: number;
}

export interface ItemGrantDto {
  userId: string;
  itemId: string;
  quantity: number;
  transactionId: string;
}

export interface LogRecordDto {
  transactionId: string;
  userId: string;
  itemId: string;
  quantity: number;
  price: number;
  status: 'success' | 'failed';
}

export interface NotificationDto {
  userId: string;
  transactionId: string;
  type: 'purchase_success' | 'purchase_failed';
  message: string;
  channels: string[];
}
```

### 결과 타입 정의
```typescript
// 📍 src/interfaces/domain-services.interface.ts

export interface UserValidationResult {
  isValid: boolean;
  userId: string;
  currentBalance?: number;
  reason?: string;
  errorCode?: string;
}

export interface ItemGrantResult {
  success: boolean;
  userId: string;
  itemId: string;
  quantity: number;
  grantedAt: Date;
  reason?: string;
  errorCode?: string;
}

export interface LogResult {
  success: boolean;
  logId?: string;
  recordedAt?: Date;
  reason?: string;
  errorCode?: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  sentAt?: Date;
  channels?: string[];
  reason?: string;
  errorCode?: string;
}

export interface PurchaseResult {
  success: boolean;
  transactionId: string;
  status: string;
  completedSteps: string[];
  data?: any;
  error?: {
    step: string;
    code: string;
    message: string;
  };
  message?: string;
}
```

## 🚨 에러 코드 매핑

### 사용자 검증 에러
```typescript
export const USER_ERROR_CODES = {
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_NOT_ACTIVE: 'USER_NOT_ACTIVE', 
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  PURCHASE_LIMIT_EXCEEDED: 'PURCHASE_LIMIT_EXCEEDED'
} as const;
```

### 아이템 관련 에러
```typescript
export const ITEM_ERROR_CODES = {
  ITEM_NOT_FOUND: 'ITEM_NOT_FOUND',
  ITEM_NOT_AVAILABLE: 'ITEM_NOT_AVAILABLE',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',
  GRANT_ERROR: 'GRANT_ERROR'
} as const;
```

### 시스템 에러
```typescript
export const SYSTEM_ERROR_CODES = {
  LOG_RECORD_ERROR: 'LOG_RECORD_ERROR',
  NOTIFICATION_ERROR: 'NOTIFICATION_ERROR',
  SAGA_STATE_ERROR: 'SAGA_STATE_ERROR',
  EVENT_PUBLISH_ERROR: 'EVENT_PUBLISH_ERROR'
} as const;
```

## 📊 테스트 데이터

### 사용자 테스트 데이터
```typescript
// 📍 src/services/user.service.ts

const TEST_USERS = new Map<string, UserProfile>([
  ['user-123', {
    userId: 'user-123',
    name: 'Test User 123', 
    balance: 1000,
    status: 'active',
    purchaseLimit: 500
  }],
  ['user-456', {
    userId: 'user-456',
    name: 'Test User 456',
    balance: 50,
    status: 'active', 
    purchaseLimit: 100
  }],
  ['user-suspended', {
    userId: 'user-suspended',
    name: 'Suspended User',
    balance: 1000,
    status: 'suspended',
    purchaseLimit: 0
  }]
]);
```

### 아이템 테스트 데이터
```typescript
// 📍 src/services/item.service.ts

const TEST_ITEMS = new Map<string, ItemInfo>([
  ['item-sword', {
    itemId: 'item-sword',
    name: 'Magic Sword',
    price: 100,
    stock: 50,
    isAvailable: true
  }],
  ['item-potion', {
    itemId: 'item-potion', 
    name: 'Health Potion',
    price: 20,
    stock: 100,
    isAvailable: true
  }],
  ['item-out-of-stock', {
    itemId: 'item-out-of-stock',
    name: 'Rare Gem',
    price: 500,
    stock: 0,
    isAvailable: true
  }],
  ['item-disabled', {
    itemId: 'item-disabled',
    name: 'Disabled Item',
    price: 50,
    stock: 10,
    isAvailable: false
  }]
]);
```

### 테스트 시나리오 데이터
```typescript
// 성공 시나리오
export const SUCCESS_SCENARIOS = {
  basic_purchase: {
    userId: 'user-123',
    itemId: 'item-sword', 
    quantity: 1,
    price: 100,
    expectedResult: 'success'
  },
  bulk_purchase: {
    userId: 'user-123',
    itemId: 'item-potion',
    quantity: 5,
    price: 100,
    expectedResult: 'success'
  }
};

// 실패 시나리오
export const FAILURE_SCENARIOS = {
  insufficient_balance: {
    userId: 'user-456',
    itemId: 'item-sword',
    quantity: 1, 
    price: 100,
    expectedError: 'INSUFFICIENT_BALANCE'
  },
  item_not_available: {
    userId: 'user-123',
    itemId: 'item-disabled',
    quantity: 1,
    price: 50,
    expectedError: 'ITEM_NOT_AVAILABLE'
  },
  out_of_stock: {
    userId: 'user-123',
    itemId: 'item-out-of-stock',
    quantity: 1,
    price: 500,
    expectedError: 'INSUFFICIENT_STOCK'
  },
  user_suspended: {
    userId: 'user-suspended',
    itemId: 'item-potion',
    quantity: 1,
    price: 20,
    expectedError: 'USER_NOT_ACTIVE'
  }
};
```

## 🔍 주요 타입 별칭

```typescript
// Saga 관련
export type TransactionId = string;
export type EventId = string;
export type StepResult = 'success' | 'failed' | 'compensated';

// 함수 타입
export type EventHandlerFunction<T extends BaseEvent> = (event: T) => Promise<void>;
export type CompensationFunction = (transactionId: string, stepData: any) => Promise<boolean>;
export type ValidationFunction<T> = (data: T) => Promise<boolean>;

// 유니온 타입
export type PurchaseStatus = 'initiated' | 'processing' | 'completed' | 'failed' | 'compensated';
export type NotificationChannel = 'email' | 'sms' | 'push' | 'webhook';
export type LogLevel = 'info' | 'warn' | 'error' | 'debug';
```

## 📚 유틸리티 함수

```typescript
// 📍 src/events/event-factory.ts

export class EventFactory {
  static createPurchaseInitiated(
    transactionId: string, 
    purchaseData: PurchaseRequestDto
  ): PurchaseInitiatedEvent
  
  static createUserValidated(
    transactionId: string, 
    userId: string, 
    result: UserValidationResult
  ): UserValidatedEvent
  
  static createCompensationStarted(
    transactionId: string, 
    reason: string, 
    steps: string[]
  ): CompensationStartedEvent
}

// 📍 src/orchestrator/saga-context.ts

export class SagaContext {
  static create(transactionId: string, purchaseData: PurchaseRequestDto): SagaContext
  
  addStepResult(step: SagaStep, result: SagaStepResult): void
  
  getCompletedSteps(): SagaStep[]
  
  getFailedStep(): SagaStep | null
  
  shouldCompensate(): boolean
}
```

---

**📍 관련 문서**: [🗂️ 프로젝트 인덱스](./PROJECT_INDEX.md) | [🗺️ 컴포넌트 맵](./COMPONENT_MAP.md) | [🌐 API 가이드](./API_GUIDE.md)

**최종 업데이트**: 2024년 12월 | **버전**: 2.0.0 | **파일 수**: 39개 TypeScript 파일