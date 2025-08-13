# Choreography Pattern 구현 가이드

NestJS Saga Pattern 시스템의 **분산 이벤트 기반 코레오그래피** 패턴 상세 가이드입니다.

## 📋 목차

- [개요](#개요)
- [아키텍처](#아키텍처)
- [핵심 컴포넌트](#핵심-컴포넌트)
- [이벤트 플로우](#이벤트-플로우)
- [독립 핸들러](#독립-핸들러)
- [보상 트랜잭션](#보상-트랜잭션)
- [설정 및 실행](#설정-및-실행)
- [디버깅 가이드](#디버깅-가이드)

## 🎪 개요

### 코레오그래피 패턴이란?
**Choreography Pattern**은 중앙 집중식 오케스트레이터 없이 **독립적인 이벤트 핸들러들**이 이벤트 체인을 통해 분산 트랜잭션을 처리하는 패턴입니다.

### 주요 특징
- 🎯 **완전 분산**: 중앙 제어 없이 각 핸들러가 독립적으로 동작
- ⚡ **비동기 처리**: 이벤트 기반 비동기 처리로 높은 성능
- 🔄 **느슨한 결합**: 핸들러 간 직접 의존성 없음
- 📈 **높은 확장성**: 개별 핸들러 독립 배포 가능
- 🛡️ **결함 격리**: 한 핸들러 실패가 다른 핸들러에 직접 영향 없음

## 🏗️ 아키텍처

### 전체 아키텍처
```
[Purchase Request] → [PurchaseCoordinatorService] → [PurchaseInitiated Event]
                                                            ↓
┌─────────────────────────────────────────────────────────────────────┐
│                      Event-Driven Chain                             │
├─────────────────────────────────────────────────────────────────────┤
│  UserValidationHandler → UserValidated → ItemGrantHandler          │
│          ↓                                      ↓                   │
│  UserValidationFailed                   ItemGranted                 │
│          ↓                                      ↓                   │
│  CompensationHandler ←─────────────── LogRecordHandler              │
│          ↓                                      ↓                   │
│  [Rollback Process]                    LogRecorded                  │
│                                                ↓                    │
│                                      NotificationHandler            │
│                                                ↓                    │
│                                      [PurchaseCompleted]            │
└─────────────────────────────────────────────────────────────────────┘
```

### 핵심 설계 원칙
1. **이벤트 중심**: 모든 통신은 이벤트로만 수행
2. **상태 비저장**: 각 핸들러는 상태를 저장하지 않음
3. **단일 책임**: 각 핸들러는 하나의 비즈니스 단계만 담당
4. **보상 가능**: 모든 작업은 보상 트랜잭션으로 롤백 가능

## 🧩 핵심 컴포넌트

### PurchaseCoordinatorService
**역할**: 구매 프로세스 시작점 (이벤트 발행만 담당)
```typescript
async initiatePurchase(request: PurchaseRequestDto): Promise<PurchaseResult> {
  // 1. Saga 상태 초기화
  const sagaState = await this.createInitialSagaState(request);
  
  // 2. 첫 번째 이벤트 발행 후 즉시 반환
  const event = new PurchaseInitiatedEvent(...);
  await this.eventBus.publish(event);
  
  return { transactionId, status: 'initiated' };
}
```

### 독립 이벤트 핸들러들
각 핸들러는 **완전히 독립적**으로 동작하며 특정 이벤트에만 반응합니다.

#### 1. UserValidationHandler
- **담당**: 사용자 잔액 검증 및 차감
- **입력 이벤트**: `PurchaseInitiated`
- **출력 이벤트**: `UserValidated` | `UserValidationFailed`

#### 2. ItemGrantHandler  
- **담당**: 아이템 재고 확인 및 사용자에게 지급
- **입력 이벤트**: `UserValidated`
- **출력 이벤트**: `ItemGranted` | `ItemGrantFailed`

#### 3. LogRecordHandler
- **담당**: 구매 로그 기록
- **입력 이벤트**: `ItemGranted`
- **출력 이벤트**: `LogRecorded` | `LogFailed`

#### 4. NotificationHandler
- **담당**: 사용자 알림 발송 및 구매 완료 처리
- **입력 이벤트**: `LogRecorded`
- **출력 이벤트**: `PurchaseCompleted` | `NotificationFailed`

#### 5. CompensationHandler
- **담당**: 실패 시 성공한 단계들의 보상 처리
- **입력 이벤트**: `*Failed` (모든 실패 이벤트)
- **출력 이벤트**: `CompensationCompleted` | `PurchaseFailed`

## 🔄 이벤트 플로우

### 성공 플로우
```
PurchaseInitiated
    ↓ (UserValidationHandler)
UserValidated  
    ↓ (ItemGrantHandler)
ItemGranted
    ↓ (LogRecordHandler)
LogRecorded
    ↓ (NotificationHandler)
PurchaseCompleted
```

### 실패 플로우 (아이템 지급 실패 예시)
```
PurchaseInitiated
    ↓ (UserValidationHandler)
UserValidated
    ↓ (ItemGrantHandler)
ItemGrantFailed
    ↓ (CompensationHandler)
[UserService.compensate] → 잔액 복구
    ↓
CompensationCompleted
    ↓
PurchaseFailed
```

### 이벤트 타이밍
| 단계 | 평균 처리 시간 | 누적 시간 |
|------|---------------|----------|
| PurchaseInitiated → UserValidated | ~10ms | 10ms |
| UserValidated → ItemGranted | ~8ms | 18ms |
| ItemGranted → LogRecorded | ~15ms | 33ms |
| LogRecorded → PurchaseCompleted | ~5ms | 38ms |

## 🎛️ 독립 핸들러 상세

### UserValidationHandler 구조
```typescript
@Injectable()
export class UserValidationHandler implements EventHandler<PurchaseInitiatedEvent> {
  async handle(event: PurchaseInitiatedEvent): Promise<void> {
    const { transactionId, userId, price } = event;
    
    try {
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
      
    } catch (error) {
      await this.handleError(transactionId, error);
    }
  }
}
```

### 핸들러 설계 원칙
1. **원자성**: 각 핸들러는 원자적 연산만 수행
2. **멱등성**: 동일한 이벤트를 여러 번 받아도 같은 결과
3. **순서 독립**: 다른 핸들러의 실행 순서에 의존하지 않음
4. **실패 처리**: 모든 예외 상황에 대한 명확한 처리 로직

## 🔄 보상 트랜잭션

### CompensationHandler의 역할
```typescript
async handle(event: FailureEvent): Promise<void> {
  // 1. 실패한 트랜잭션의 Saga 상태 조회
  const sagaState = await this.sagaRepository.findById(event.transactionId);
  
  // 2. 성공한 단계들을 역순으로 보상
  const successfulSteps = sagaState.steps.filter(step => step.status === 'success');
  
  for (const step of successfulSteps.reverse()) {
    await this.compensateStep(step, sagaState);
  }
  
  // 3. 보상 완료 이벤트 발행
  await this.publishCompensationCompleted(event.transactionId);
}
```

### 보상 전략
| 단계 | 보상 방법 | 복구 시간 |
|------|----------|----------|
| **사용자 검증** | 차감된 잔액 복구 | ~5ms |
| **아이템 지급** | 지급된 아이템 제거 | ~8ms |
| **로그 기록** | 로그 상태를 실패로 변경 | ~3ms |
| **알림 발송** | 취소 알림 발송 | ~10ms |

### 보상 정책
- **LIFO (Last In, First Out)**: 마지막에 성공한 단계부터 역순으로 보상
- **Best Effort**: 보상 실패 시 로그 기록 후 계속 진행
- **수동 개입**: 보상이 불가능한 경우 운영팀 알림

## ⚙️ 설정 및 실행

### 환경 변수 설정
```bash
# Choreography 모드 활성화
export SAGA_PATTERN_MODE=choreography
npm run start:dev
```

### 모듈 초기화 로그
```
🎭 ChoreographyModule initialized - Event-driven saga pattern ready
🔧 ChoreographyModule: Current saga pattern mode = choreography
🎭 CHOREOGRAPHY MODE: Activating event handlers...
✅ CHOREOGRAPHY MODE: All event handlers registered successfully

📋 Choreography event subscription summary:
  - UserValidationHandler → PurchaseInitiated (BUSINESS LOGIC)
  - ItemGrantHandler → UserValidated
  - LogRecordHandler → ItemGranted
  - NotificationHandler → LogRecorded
  - CompensationHandler → UserValidationFailed, ItemGrantFailed, LogFailed
🎯 Choreography pattern will handle PurchaseInitiated events
```

### 핸들러 등록 과정
```typescript
// choreography.module.ts
async onModuleInit() {
  // 설정 확인
  if (!isChoreographyMode()) {
    console.log('⏸️ Choreography handlers DISABLED');
    return;
  }
  
  // 각 핸들러를 특정 이벤트에 구독
  eventBus.subscribe('PurchaseInitiated', userValidationHandler);
  eventBus.subscribe('UserValidated', itemGrantHandler);
  eventBus.subscribe('ItemGranted', logRecordHandler);
  eventBus.subscribe('LogRecorded', notificationHandler);
  
  // 실패 이벤트들을 보상 핸들러에 구독
  eventBus.subscribe('UserValidationFailed', compensationHandler);
  eventBus.subscribe('ItemGrantFailed', compensationHandler);
  eventBus.subscribe('LogFailed', compensationHandler);
}
```

## 🔍 디버깅 가이드

### 로그 추적
각 핸들러는 상세한 로그를 제공합니다:

```
[UserValidationHandler] 🔍 Starting user validation for transaction: TXN_xxx
[UserValidationHandler] ✅ User validation successful: user-123
[ItemGrantHandler] 📦 Starting item grant for transaction: TXN_xxx  
[ItemGrantHandler] ✅ Item grant successful: item-sword x1 to user-123
[LogRecordHandler] 📝 Starting log record for transaction: TXN_xxx
[NotificationHandler] 📢 Starting notification for transaction: TXN_xxx
```

### 상태 추적 API
```bash
# 실시간 트랜잭션 상태 확인
curl http://localhost:3000/choreography/transaction/TXN_xxx

# 응답에서 각 단계별 실행 시간과 상태 확인 가능
{
  "transaction": {
    "status": "completed",
    "steps": [
      {
        "step": "user_validation",
        "status": "success", 
        "executedAt": "2025-08-13T10:00:54.438Z",
        "duration": 0
      }
    ]
  },
  "eventHandlers": {
    "completed": [...],
    "compensations": [...]
  }
}
```

### 일반적인 문제 해결

#### 1. 이벤트가 처리되지 않음
**증상**: 트랜잭션이 특정 단계에서 멈춤
**원인**: 해당 이벤트에 대한 핸들러가 등록되지 않음
**해결**: 모듈 초기화 로그에서 핸들러 등록 상태 확인

#### 2. 보상이 실행되지 않음
**증상**: 실패 후에도 이전 단계가 롤백되지 않음  
**원인**: CompensationHandler가 실패 이벤트를 받지 못함
**해결**: 실패 이벤트 구독 설정 확인

#### 3. 무한 루프 (해결됨)
**증상**: 애플리케이션이 응답하지 않음
**원인**: Orchestration과 Choreography 핸들러 충돌 (이미 해결됨)
**해결**: 패턴 설정 확인 - 한 번에 하나의 패턴만 활성화됨

### 성능 모니터링
```bash
# 통계 확인
curl http://localhost:3000/choreography/stats

# 개별 핸들러 성능 추적
# 로그에서 각 핸들러의 실행 시간 확인
[ItemGrantHandler] ✅ Item grant successful: ... (duration: 8ms)
[LogRecordHandler] 📝 Log record completed: ... (duration: 15ms)
```

## 🎯 베스트 프랙티스

### 1. 핸들러 설계
- **단일 책임**: 하나의 핸들러는 하나의 비즈니스 로직만
- **멱등성 보장**: 동일한 이벤트 중복 처리 방지
- **원자성**: 부분 실행 상태 방지

### 2. 에러 처리
- **명확한 실패 이벤트**: 실패 원인을 명확히 전달
- **보상 가능 설계**: 모든 작업에 대한 보상 로직 구현
- **데드레터 큐**: 처리 불가능한 이벤트 별도 보관

### 3. 모니터링
- **상세한 로깅**: 각 단계별 처리 상황 기록
- **메트릭 수집**: 처리 시간, 성공률 등 수집
- **알림 시스템**: 실패 시 즉시 알림

### 4. 테스트
- **단위 테스트**: 각 핸들러 개별 테스트
- **통합 테스트**: 전체 이벤트 체인 테스트
- **장애 시나리오**: 다양한 실패 상황 시뮬레이션

---

**관련 가이드**:
- [API 사용 가이드](./API_GUIDE.md) - Choreography API 사용법
- [EventBus 가이드](./EVENTBUS_GUIDE.md) - 이벤트 시스템 상세
- [테스트 가이드](./TESTING_GUIDE.md) - 테스트 시나리오