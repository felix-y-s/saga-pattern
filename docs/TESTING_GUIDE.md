# 테스트 시나리오 가이드

Saga 패턴 기반 아이템 구매 시스템의 종합적인 테스트 시나리오 가이드입니다.

## 📋 목차

- [테스트 개요](#테스트-개요)
- [단위 테스트](#단위-테스트)
- [통합 테스트](#통합-테스트)
- [API 테스트](#api-테스트)
- [성능 테스트](#성능-테스트)
- [시나리오 테스트](#시나리오-테스트)

## 🎯 테스트 개요

### 테스트 전략
시스템의 안정성과 신뢰성을 보장하기 위해 다음과 같은 테스트 전략을 사용합니다:

- **단위 테스트**: 개별 컴포넌트의 정확성 검증
- **통합 테스트**: 컴포넌트 간 상호작용 검증  
- **API 테스트**: 외부 인터페이스 동작 검증
- **시나리오 테스트**: 실제 비즈니스 플로우 검증

### 테스트 커버리지 목표
- **코드 커버리지**: 90% 이상
- **브랜치 커버리지**: 85% 이상
- **기능 커버리지**: 100% (모든 주요 기능)

## 🔬 단위 테스트

### EventBus 테스트

#### 테스트 실행
```bash
npm test src/events/event-bus.service.spec.ts
```

#### 주요 테스트 케이스
- ✅ 이벤트 발행 및 핸들러 실행
- ✅ 다중 핸들러 등록 및 실행
- ✅ 핸들러 실패 시 에러 전파
- ✅ 구독 해제 기능
- ✅ 핸들러가 없는 이벤트 처리

```typescript
describe('EventBusService', () => {
  it('should publish event to subscribed handlers', async () => {
    const handler = new MockEventHandler();
    const event = new PurchaseInitiatedEvent(/*...*/);
    
    eventBus.subscribe('PurchaseInitiated', handler);
    await eventBus.publish(event);
    
    expect(handler.handledEvents).toHaveLength(1);
    expect(handler.handledEvents[0]).toBe(event);
  });
});
```

### 도메인 서비스 테스트

#### UserService 테스트
```bash
npm test src/services/user.service.spec.ts
```

**핵심 테스트 시나리오**:
- ✅ 충분한 잔액으로 사용자 검증 성공
- ✅ 잔액 부족으로 검증 실패
- ✅ 존재하지 않는 사용자 검증 실패
- ✅ 정지된 사용자 검증 실패
- ✅ 보상 트랜잭션으로 잔액 복구
- ✅ 존재하지 않는 사용자 보상 실패

#### ItemService 테스트  
```bash
npm test src/services/item.service.spec.ts
```

**핵심 테스트 시나리오**:
- ✅ 정상 아이템 지급
- ✅ 존재하지 않는 아이템 지급 실패
- ✅ 재고 부족으로 지급 실패
- ✅ 비활성화된 아이템 지급 실패
- ✅ 보상 트랜잭션으로 아이템 회수

### Orchestrator 테스트

#### 테스트 실행
```bash
npm test src/orchestrator/item-purchase-orchestrator.service.spec.ts
```

**핵심 테스트 시나리오**:
- ✅ 성공적인 전체 구매 플로우
- ✅ 사용자 검증 실패로 인한 구매 실패
- ✅ 아이템 지급 실패 및 자동 보상
- ✅ 알림 실패 시에도 구매 완료
- ✅ 수동 보상 트랜잭션 실행
- ✅ Saga 상태 조회

```typescript
describe('ItemPurchaseOrchestratorService', () => {
  it('should execute successful purchase', async () => {
    const request = {
      userId: 'user-123',
      itemId: 'item-sword',
      quantity: 1,
      price: 100,
    };

    const result = await orchestrator.executePurchase(request);

    expect(result.success).toBe(true);
    expect(result.completedSteps).toHaveLength(4);
    
    const sagaState = await orchestrator.getSagaState(result.transactionId);
    expect(sagaState?.status).toBe(SagaStatus.COMPLETED);
  });
});
```

## 🔗 통합 테스트

### EventBus + Services 통합

#### 테스트 목적
EventBus를 통한 서비스 간 이벤트 기반 통신 검증

#### 테스트 시나리오
```typescript
describe('EventBus Integration', () => {
  it('should handle purchase flow through events', async () => {
    // Given: 이벤트 핸들러 등록
    eventBus.subscribe('PurchaseInitiated', purchaseEventHandler);
    
    // When: 구매 시작 이벤트 발행
    const event = new PurchaseInitiatedEvent(/*...*/);
    await eventBus.publish(event);
    
    // Then: 핸들러가 이벤트를 처리했는지 확인
    expect(purchaseEventHandler.handled).toBeTruthy();
  });
});
```

### Orchestrator + Services 통합

#### 테스트 목적
오케스트레이터와 모든 도메인 서비스 간 통합 동작 검증

#### 실행 방법
```bash
# 통합 테스트 실행 (모든 서비스 포함)
npm test -- --testNamePattern="Integration"
```

## 🌐 API 테스트

### 구매 API 테스트

#### 성공 케이스
```bash
# 테스트 서버 실행
npm run start:dev

# 성공 케이스
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "itemId": "item-sword",
    "quantity": 1,
    "price": 100
  }'

# 기대 응답: HTTP 200 OK
# {
#   "success": true,
#   "transactionId": "TXN_...",
#   "status": "completed",
#   "completedSteps": ["user_validation", "item_grant", "log_record", "notification"]
# }
```

#### 실패 케이스들

**1. 잔액 부족**
```bash
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-456",
    "itemId": "item-sword",
    "quantity": 1,
    "price": 100
  }'

# 기대 응답: success: false, error: "INSUFFICIENT_BALANCE"
```

**2. 존재하지 않는 아이템**
```bash
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "itemId": "non-existent",
    "quantity": 1,
    "price": 100
  }'

# 기대 응답: success: false, error: "ITEM_NOT_FOUND"
```

**3. 재고 부족**
```bash
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "itemId": "item-out-of-stock",
    "quantity": 1,
    "price": 500
  }'

# 기대 응답: success: false, error: "INSUFFICIENT_STOCK"
```

### 모니터링 API 테스트

#### Saga 상태 조회
```bash
# 유효한 트랜잭션 ID로 조회
curl http://localhost:3000/saga/TXN_valid_transaction_id

# 기대 응답: found: true, saga: { ... }

# 존재하지 않는 트랜잭션 ID로 조회
curl http://localhost:3000/saga/invalid_id

# 기대 응답: found: false, message: "Saga not found"
```

#### 통계 조회
```bash
curl http://localhost:3000/sagas/stats

# 기대 응답: 
# {
#   "success": true,
#   "statistics": {
#     "total": 10,
#     "completed": 7,
#     "failed": 2,
#     "compensated": 1
#   }
# }
```

## ⚡ 성능 테스트

### 부하 테스트

#### Apache Bench 사용
```bash
# 100개 요청, 동시 연결 10개
ab -n 100 -c 10 -H "Content-Type: application/json" \
  -p purchase_payload.json \
  http://localhost:3000/purchase

# purchase_payload.json:
# {
#   "userId": "user-123",
#   "itemId": "item-sword", 
#   "quantity": 1,
#   "price": 100
# }
```

#### 성능 지표 목표
- **평균 응답 시간**: < 100ms
- **95% 응답 시간**: < 200ms
- **처리량**: > 500 TPS
- **에러율**: < 1%

### 메모리 테스트

#### 메모리 누수 검사
```bash
# 메모리 사용량 모니터링하며 반복 테스트
for i in {1..1000}; do
  curl -s -X POST http://localhost:3000/purchase \
    -H "Content-Type: application/json" \
    -d '{"userId":"user-123","itemId":"item-sword","quantity":1,"price":100}' \
    > /dev/null
  
  if [ $((i % 100)) -eq 0 ]; then
    echo "Completed $i requests"
    # 메모리 사용량 확인
    ps aux | grep node
  fi
done
```

## 📋 시나리오 테스트

### 시나리오 1: 정상 구매 플로우

#### 준비 단계
```bash
# 1. 서버 시작
npm run start:dev

# 2. 초기 사용자 잔액 확인
curl http://localhost:3000/test-services \
  -X POST -H "Content-Type: application/json" \
  -d '{"userId":"user-123","itemId":"item-sword","quantity":1,"price":100}'
```

#### 실행 단계
```bash
# 3. 구매 실행
TRANSACTION_ID=$(curl -s -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","itemId":"item-sword","quantity":1,"price":100}' \
  | jq -r '.transactionId')

echo "Transaction ID: $TRANSACTION_ID"
```

#### 검증 단계
```bash
# 4. 구매 결과 확인
curl http://localhost:3000/saga/$TRANSACTION_ID

# 5. 사용자 잔액 변화 확인 (1000 → 900)
# 6. 아이템 재고 변화 확인 (50 → 49)
# 7. 로그 기록 확인
# 8. 알림 발송 확인
```

### 시나리오 2: 보상 트랜잭션 플로우

#### 실행
```bash
# 1. 비활성화된 아이템으로 구매 시도 (보상 발생)
FAILED_TRANSACTION_ID=$(curl -s -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","itemId":"item-disabled","quantity":1,"price":50}' \
  | jq -r '.transactionId')

# 2. 실패 상태 확인
curl http://localhost:3000/saga/$FAILED_TRANSACTION_ID
```

#### 검증
```bash
# 3. 보상 완료 확인
# - status: "compensated"
# - compensations 배열에 보상 내역 존재
# - 사용자 잔액 복구 확인 (차감된 50이 다시 복구)
```

### 시나리오 3: 동시 구매 테스트

#### 동시성 테스트
```bash
#!/bin/bash
# concurrent_purchase_test.sh

echo "Starting concurrent purchase test..."

# 동시에 10개의 구매 요청 실행
for i in {1..10}; do
  (
    RESULT=$(curl -s -X POST http://localhost:3000/purchase \
      -H "Content-Type: application/json" \
      -d "{\"userId\":\"user-123\",\"itemId\":\"item-potion\",\"quantity\":1,\"price\":20}")
    
    SUCCESS=$(echo $RESULT | jq -r '.success')
    TRANSACTION_ID=$(echo $RESULT | jq -r '.transactionId')
    
    echo "Request $i: Success=$SUCCESS, TxnID=$TRANSACTION_ID"
  ) &
done

# 모든 백그라운드 작업 완료 대기
wait

echo "Concurrent test completed"

# 통계 확인
curl http://localhost:3000/sagas/stats
```

### 시나리오 4: 알림 실패 허용 테스트

#### 알림 시스템 장애 시뮬레이션
```bash
# 1. 알림 실패율을 100%로 설정 (개발용 기능)
# NotificationService.setFailureRate(1.0) - 코드레벨 설정

# 2. 구매 실행
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-123","itemId":"item-sword","quantity":1,"price":100}'

# 3. 결과 검증
# - 전체 구매는 성공 (success: true)
# - 알림 단계만 실패
# - 사용자는 아이템을 정상적으로 받음
```

## 🧪 자동화된 테스트 스위트

### 전체 테스트 실행
```bash
# 모든 테스트 실행
npm test

# 커버리지 포함 실행
npm run test:cov

# 워치 모드로 실행 (개발 중)
npm run test:watch

# E2E 테스트만 실행
npm run test:e2e
```

### CI/CD 파이프라인 테스트
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm run test:cov
      - name: Run E2E tests
        run: npm run test:e2e
```

## 🎯 테스트 모범 사례

### 1️⃣ **테스트 격리**
각 테스트는 독립적으로 실행되어야 합니다:
```typescript
afterEach(async () => {
  await sagaRepository.clear();
  await userService.resetUserBalance('user-123', 1000);
  await itemService.resetItemStock('item-sword', 50);
});
```

### 2️⃣ **의미 있는 테스트 이름**
```typescript
// 좋은 예
it('should compensate user validation when item grant fails')

// 나쁜 예  
it('should work correctly')
```

### 3️⃣ **AAA 패턴 (Arrange, Act, Assert)**
```typescript
it('should validate user successfully with sufficient balance', async () => {
  // Arrange
  const dto = { userId: 'user-123', transactionId: 'txn-1', requiredBalance: 100 };
  
  // Act
  const result = await userService.validateUser(dto);
  
  // Assert
  expect(result.isValid).toBe(true);
  expect(result.currentBalance).toBe(900);
});
```

### 4️⃣ **에러 케이스 테스트**
성공 케이스만큼 실패 케이스도 중요합니다:
```typescript
it('should fail validation for insufficient balance', async () => {
  const dto = { userId: 'user-456', transactionId: 'txn-2', requiredBalance: 100 };
  
  const result = await userService.validateUser(dto);
  
  expect(result.isValid).toBe(false);
  expect(result.errorCode).toBe('INSUFFICIENT_BALANCE');
});
```

### 5️⃣ **비동기 테스트**
모든 비동기 작업은 적절히 대기해야 합니다:
```typescript
it('should handle async operations correctly', async () => {
  const promise = orchestrator.executePurchase(request);
  await expect(promise).resolves.toMatchObject({ success: true });
});
```

## 📊 테스트 리포트

### 커버리지 리포트
```bash
npm run test:cov

# HTML 리포트 생성
open coverage/lcov-report/index.html
```

### 성능 테스트 리포트
```bash
# 성능 테스트 결과 예시
Requests per second:    523.45 [#/sec] (mean)
Time per request:       19.103 [ms] (mean)
Time per request:       1.910 [ms] (mean, across all concurrent requests)
Transfer rate:          89.32 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    1   0.5      1       3
Processing:     8   18   4.2     17      35
Waiting:        7   17   4.1     16      34
Total:          9   19   4.3     18      36
```

---

이 테스트 가이드를 통해 시스템의 모든 측면을 검증하고, 안정적인 Saga 패턴 구현을 보장할 수 있습니다.