# EventBus 시스템 가이드

EventBus는 본 Saga 시스템의 핵심 메시징 인프라로, 모든 컴포넌트 간 이벤트 기반 통신을 담당합니다.

## 📋 목차

- [개요](#개요)
- [아키텍처](#아키텍처)
- [이벤트 타입](#이벤트-타입)
- [사용법](#사용법)
- [이벤트 핸들러](#이벤트-핸들러)
- [모범 사례](#모범-사례)

## 🎯 개요

EventBus는 **발행-구독(Publisher-Subscriber) 패턴**을 구현하여 컴포넌트 간 느슨한 결합을 실현합니다.

### 핵심 특징
- ✅ **타입 안전성**: TypeScript 제네릭을 통한 완전한 타입 검증
- ✅ **비동기 처리**: Promise 기반 이벤트 처리
- ✅ **에러 전파**: 핸들러 실패 시 예외 전파
- ✅ **다중 핸들러**: 하나의 이벤트에 여러 핸들러 등록 가능
- ✅ **상세 로깅**: 디버깅을 위한 완전한 로그 지원

## 🏗️ 아키텍처

```typescript
// 기본 인터페이스 구조
BaseEvent ← PurchaseEvents (14개 이벤트)
    ↑
EventHandler<T> → EventBusService
    ↑
PurchaseEventHandler
```

### 핵심 컴포넌트

#### 1️⃣ **BaseEvent 인터페이스**
모든 이벤트의 기본 구조를 정의합니다.

```typescript
interface BaseEvent {
  readonly eventId: string;        // 고유 이벤트 ID
  readonly eventType: string;      // 이벤트 타입명
  readonly timestamp: Date;        // 발생 시간
  readonly aggregateId: string;    // 관련 Aggregate ID (트랜잭션ID)
  readonly version: number;        // 이벤트 버전
}
```

#### 2️⃣ **EventBusService**
이벤트 발행과 구독을 관리하는 메인 서비스입니다.

```typescript
@Injectable()
export class EventBusService implements IEventBus {
  // 이벤트 타입별 핸들러 맵
  private readonly eventHandlers = new Map<string, Set<EventHandler>>();
  
  async publish<T extends BaseEvent>(event: T): Promise<void>
  subscribe<T extends BaseEvent>(eventType: string, handler: EventHandler<T>): void
  unsubscribe(eventType: string, handler: EventHandler): void
}
```

#### 3️⃣ **EventHandler 인터페이스**
이벤트 처리 로직을 정의하는 인터페이스입니다.

```typescript
interface EventHandler<T extends BaseEvent = BaseEvent> {
  handle(event: T): Promise<void>;
}
```

## 📨 이벤트 타입

Saga 시스템에서 사용되는 14개 이벤트 타입:

### 🎯 **구매 플로우 이벤트**

#### **PurchaseInitiatedEvent**
구매 프로세스가 시작될 때 발행됩니다.
```typescript
new PurchaseInitiatedEvent(
  eventId: string,
  timestamp: Date,
  aggregateId: string,    // transactionId
  version: number,
  userId: string,
  itemId: string,
  quantity: number,
  price: number,
  transactionId: string
);
```

#### **UserValidated/FailedEvent**
사용자 검증 결과를 알리는 이벤트입니다.
```typescript
// 성공 시
new UserValidatedEvent(eventId, timestamp, aggregateId, version,
  userId, transactionId, userBalance);

// 실패 시  
new UserValidationFailedEvent(eventId, timestamp, aggregateId, version,
  userId, transactionId, reason, errorCode);
```

#### **ItemGranted/FailedEvent**
아이템 지급 결과를 알리는 이벤트입니다.
```typescript
// 성공 시
new ItemGrantedEvent(eventId, timestamp, aggregateId, version,
  userId, itemId, quantity, transactionId);

// 실패 시
new ItemGrantFailedEvent(eventId, timestamp, aggregateId, version,
  userId, itemId, transactionId, reason, errorCode);
```

#### **LogRecorded/FailedEvent**
로그 기록 결과를 알리는 이벤트입니다.
```typescript
// 성공 시
new LogRecordedEvent(eventId, timestamp, aggregateId, version,
  transactionId, logId, logData);

// 실패 시
new LogFailedEvent(eventId, timestamp, aggregateId, version,
  transactionId, reason, errorCode, logData);
```

#### **NotificationSent/FailedEvent**
알림 발송 결과를 알리는 이벤트입니다.
```typescript
// 성공 시
new NotificationSentEvent(eventId, timestamp, aggregateId, version,
  userId, transactionId, notificationId, notificationType);

// 실패 시
new NotificationFailedEvent(eventId, timestamp, aggregateId, version,
  userId, transactionId, reason, errorCode, notificationType);
```

### 🏁 **완료/실패 이벤트**

#### **PurchaseCompletedEvent**
전체 구매 프로세스가 성공적으로 완료되었을 때 발행됩니다.
```typescript
new PurchaseCompletedEvent(eventId, timestamp, aggregateId, version,
  userId, itemId, quantity, transactionId, totalPrice, completedAt);
```

#### **PurchaseFailedEvent**
구매 프로세스가 실패했을 때 발행됩니다.
```typescript
new PurchaseFailedEvent(eventId, timestamp, aggregateId, version,
  userId, itemId, transactionId, failureReason, failedStep, errorCode);
```

### 🔄 **보상 이벤트**

#### **CompensationInitiated/Completed/FailedEvent**
보상 트랜잭션의 시작, 완료, 실패를 알리는 이벤트입니다.
```typescript
// 보상 시작
new CompensationInitiatedEvent(eventId, timestamp, aggregateId, version,
  transactionId, compensationType, originalFailedStep);

// 보상 완료
new CompensationCompletedEvent(eventId, timestamp, aggregateId, version,
  transactionId, compensationType, compensationDetails);

// 보상 실패 (심각한 상황)
new CompensationFailedEvent(eventId, timestamp, aggregateId, version,
  transactionId, compensationType, reason, errorCode);
```

## 🎮 사용법

### 1️⃣ **이벤트 발행하기**

```typescript
@Injectable()
export class SomeService {
  constructor(private eventBus: EventBusService) {}
  
  async doSomething() {
    // 이벤트 생성
    const event = new PurchaseInitiatedEvent(
      this.generateEventId(),
      new Date(),
      'transaction-123',
      1,
      'user-456',
      'item-sword',
      1,
      100,
      'transaction-123'
    );
    
    // 이벤트 발행
    await this.eventBus.publish(event);
  }
}
```

### 2️⃣ **이벤트 구독하기**

```typescript
@Injectable()
export class MyEventHandler implements EventHandler<PurchaseInitiatedEvent> {
  async handle(event: PurchaseInitiatedEvent): Promise<void> {
    console.log(`Purchase started: ${event.transactionId}`);
    // 비즈니스 로직 처리
  }
}

// 모듈에서 등록
@Module({})
export class SomeModule implements OnModuleInit {
  constructor(
    private eventBus: EventBusService,
    private handler: MyEventHandler
  ) {}
  
  onModuleInit() {
    this.eventBus.subscribe('PurchaseInitiated', this.handler);
  }
}
```

### 3️⃣ **이벤트 팩토리 사용**

```typescript
@Injectable()
export class EventFactory {
  generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  getCurrentTimestamp(): Date {
    return new Date();
  }
  
  generateVersion(): number {
    return 1;
  }
}
```

## 🎭 이벤트 핸들러

### **PurchaseEventHandler**
모든 구매 관련 이벤트를 처리하는 중앙 핸들러입니다.

```typescript
@Injectable()
export class PurchaseEventHandler implements EventHandler<any> {
  async handle(event: any): Promise<void> {
    switch (event.eventType) {
      case 'PurchaseInitiated':
        await this.handlePurchaseInitiated(event);
        break;
      case 'PurchaseCompleted':
        await this.handlePurchaseCompleted(event);
        // 성공 메트릭 수집, 완료 알림 등
        break;
      case 'PurchaseFailed':
        await this.handlePurchaseFailed(event);
        // 실패 메트릭 수집, 에러 알림 등
        break;
      case 'CompensationFailed':
        await this.handleCriticalCompensationFailure(event);
        // 심각한 상황 - 수동 개입 필요
        break;
      // ... 다른 이벤트 처리
    }
  }
}
```

### **자동 핸들러 등록**
OrchestratorModule에서 모든 이벤트 핸들러가 자동으로 등록됩니다.

```typescript
@Module({})
export class OrchestratorModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    const purchaseEvents = [
      'PurchaseInitiated', 'UserValidated', 'UserValidationFailed',
      'ItemGranted', 'ItemGrantFailed', 'LogRecorded', 'LogFailed',
      'NotificationSent', 'NotificationFailed', 'PurchaseCompleted',
      'PurchaseFailed', 'CompensationInitiated', 'CompensationCompleted',
      'CompensationFailed'
    ];
    
    purchaseEvents.forEach(eventType => {
      this.eventBus.subscribe(eventType, this.purchaseEventHandler);
    });
  }
}
```

## 📊 로깅과 모니터링

EventBus는 상세한 로깅을 제공합니다:

### **발행 로그**
```log
[EventBusService] Publishing event: PurchaseInitiated {
  eventId: "EVT_1734014402456_abc123",
  aggregateId: "TXN_1734014402456_def456", 
  timestamp: "2024-12-12T14:20:02.456Z"
}
```

### **처리 로그**
```log
[EventBusService] Event PurchaseInitiated handled successfully by PurchaseEventHandler
```

### **에러 로그**
```log
[EventBusService] Error handling event PurchaseInitiated with SomeHandler: 
Error: Handler processing failed
    at SomeHandler.handle (handler.ts:15:11)
    ...
```

## ⚡ 성능 고려사항

### **병렬 처리**
동일한 이벤트에 등록된 여러 핸들러는 병렬로 실행됩니다.

```typescript
// 모든 핸들러를 병렬로 실행
const publishPromises = Array.from(handlers).map(handler => 
  handler.handle(event)
);
await Promise.all(publishPromises);
```

### **에러 전파**
하나의 핸들러라도 실패하면 전체 발행이 실패합니다.
```typescript
// 핸들러 실패 시 예외 전파
if (error) {
  this.logger.error(`Error handling event ${event.eventType}:`, error.stack);
  throw error; // 에러 전파로 Saga 실패 처리
}
```

## 🎯 모범 사례

### 1️⃣ **이벤트 설계**
- **불변성**: 이벤트는 readonly 속성으로 구현
- **명확한 명명**: 이벤트명은 과거형으로 명확하게 작성
- **버전 관리**: 이벤트 스키마 변경 시 버전 관리

### 2️⃣ **핸들러 구현**
- **멱등성**: 동일 이벤트를 여러 번 처리해도 안전하게 구현
- **에러 처리**: 예상 가능한 에러는 적절히 처리하고 로깅
- **성능**: 장시간 실행되는 작업은 별도 큐 시스템 활용

### 3️⃣ **테스트**
- **핸들러 테스트**: 각 이벤트 핸들러별 단위 테스트 작성
- **통합 테스트**: EventBus와 핸들러 통합 테스트 수행
- **이벤트 순서**: 이벤트 발행 순서와 처리 검증

### 4️⃣ **모니터링**
- **메트릭 수집**: 이벤트 발행량, 처리 시간, 실패율 모니터링
- **알림 설정**: 심각한 이벤트(보상 실패 등)에 대한 즉시 알림
- **대시보드**: EventBus 상태 실시간 모니터링

## 🚨 주의사항

### **메모리 관리**
현재 구현은 메모리 기반입니다. 운영 환경에서는 다음을 고려해야 합니다:
- Redis나 다른 외부 저장소 활용
- 이벤트 저장소 분리 (Event Store)
- 메모리 누수 방지

### **순서 보장**
현재 EventBus는 이벤트 순서를 보장하지 않습니다. 순서가 중요한 경우:
- 이벤트 시퀀스 번호 추가
- 메시지 큐 시스템 활용 (RabbitMQ, Apache Kafka)

### **트랜잭션 처리**
이벤트 발행과 비즈니스 로직이 동일한 트랜잭션에 있지 않습니다:
- Outbox Pattern 적용 검토
- Saga 패턴의 보상 로직으로 일관성 보장

---

**다음 가이드**: [도메인 서비스 가이드](./DOMAIN_SERVICES_GUIDE.md)