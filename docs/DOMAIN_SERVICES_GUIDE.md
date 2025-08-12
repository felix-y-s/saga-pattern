# 도메인 서비스 가이드

도메인 서비스는 Saga 시스템의 각 단계를 담당하는 핵심 비즈니스 로직 컴포넌트입니다.

## 📋 목차

- [개요](#개요)
- [UserService](#userservice)
- [ItemService](#itemservice)
- [LogService](#logservice)
- [NotificationService](#notificationservice)
- [통합 가이드](#통합-가이드)
- [모범 사례](#모범-사례)

## 🎯 개요

4개의 독립적인 도메인 서비스가 Saga의 각 단계를 담당합니다:

```
UserService → ItemService → LogService → NotificationService
(사용자검증)   (아이템지급)   (로그기록)    (알림발송)
```

### 공통 특징
- ✅ **완전한 타입 안전성**: TypeScript 인터페이스 기반 구현
- ✅ **보상 트랜잭션**: 각 서비스는 보상 메소드 제공
- ✅ **에러 처리**: 상세한 에러 코드와 메시지 제공
- ✅ **테스트 지원**: 단위 테스트용 헬퍼 메소드 포함

## 👤 UserService

사용자 검증 및 잔액 관리를 담당합니다.

### 📊 **주요 기능**

#### 1️⃣ **사용자 검증** (`validateUser`)
```typescript
async validateUser(dto: UserValidationDto): Promise<UserValidationResult>

// 검증 항목
- 사용자 존재 확인
- 사용자 상태 확인 (active/inactive/suspended)
- 잔액 충분성 검증
- 구매 한도 확인
- 잔액 차감 실행
```

#### 2️⃣ **보상 트랜잭션** (`compensateUserValidation`)
```typescript
async compensateUserValidation(userId: string, amount: number, transactionId: string): Promise<boolean>

// 보상 작업
- 차감된 잔액 복구
- 보상 로그 기록
```

### 🎮 **사용 예시**

```typescript
// 사용자 검증
const validationResult = await userService.validateUser({
  userId: 'user-123',
  transactionId: 'txn-456',
  requiredBalance: 100
});

if (validationResult.isValid) {
  console.log(`검증 성공. 남은 잔액: ${validationResult.currentBalance}`);
} else {
  console.log(`검증 실패: ${validationResult.reason} (${validationResult.errorCode})`);
}

// 보상 실행
if (needsCompensation) {
  const compensated = await userService.compensateUserValidation('user-123', 100, 'txn-456');
  console.log(`보상 ${compensated ? '성공' : '실패'}`);
}
```

### 🗃️ **테스트 데이터**

```typescript
// 기본 사용자 데이터
{
  'user-123': { balance: 1000, status: 'active', purchaseLimit: 500 },
  'user-456': { balance: 50, status: 'active', purchaseLimit: 100 },
  'user-suspended': { balance: 1000, status: 'suspended', purchaseLimit: 0 }
}
```

### 🚨 **에러 코드**

| 코드 | 설명 | 원인 |
|------|------|------|
| `USER_NOT_FOUND` | 사용자 미존재 | 잘못된 userId |
| `USER_NOT_ACTIVE` | 사용자 비활성 | suspended/inactive 상태 |
| `INSUFFICIENT_BALANCE` | 잔액 부족 | 요청 금액 > 현재 잔액 |
| `PURCHASE_LIMIT_EXCEEDED` | 구매 한도 초과 | 요청 금액 > 구매 한도 |
| `VALIDATION_ERROR` | 내부 검증 오류 | 시스템 에러 |

## 🎁 ItemService

아이템 지급 및 재고 관리를 담당합니다.

### 📊 **주요 기능**

#### 1️⃣ **아이템 지급** (`grantItem`)
```typescript
async grantItem(dto: ItemGrantDto): Promise<ItemGrantResult>

// 지급 과정
- 아이템 존재 확인
- 아이템 활성 상태 확인
- 재고 충분성 검증
- 재고 차감
- 사용자 인벤토리에 추가
```

#### 2️⃣ **보상 트랜잭션** (`compensateItemGrant`)
```typescript
async compensateItemGrant(userId: string, itemId: string, quantity: number, transactionId: string): Promise<boolean>

// 보상 작업
- 재고 복구
- 사용자 인벤토리에서 제거
- 보상 로그 기록
```

### 🎮 **사용 예시**

```typescript
// 아이템 지급
const grantResult = await itemService.grantItem({
  userId: 'user-123',
  itemId: 'item-sword',
  quantity: 1,
  transactionId: 'txn-456'
});

if (grantResult.success) {
  console.log(`지급 완료: ${grantResult.itemId} x${grantResult.quantity}`);
} else {
  console.log(`지급 실패: ${grantResult.reason} (${grantResult.errorCode})`);
}

// 사용자 인벤토리 조회
const inventory = await itemService.getUserInventory('user-123');
console.log('사용자 인벤토리:', inventory);
```

### 🗃️ **테스트 데이터**

```typescript
// 기본 아이템 데이터
{
  'item-sword': { name: 'Magic Sword', price: 100, stock: 50, isAvailable: true },
  'item-potion': { name: 'Health Potion', price: 20, stock: 100, isAvailable: true },
  'item-out-of-stock': { name: 'Rare Gem', price: 500, stock: 0, isAvailable: true },
  'item-disabled': { name: 'Disabled Item', price: 50, stock: 10, isAvailable: false }
}
```

### 🚨 **에러 코드**

| 코드 | 설명 | 원인 |
|------|------|------|
| `ITEM_NOT_FOUND` | 아이템 미존재 | 잘못된 itemId |
| `ITEM_NOT_AVAILABLE` | 아이템 비활성 | isAvailable: false |
| `INSUFFICIENT_STOCK` | 재고 부족 | 요청 수량 > 현재 재고 |
| `GRANT_ERROR` | 내부 지급 오류 | 시스템 에러 |

## 📝 LogService

구매 로그 기록 및 관리를 담당합니다.

### 📊 **주요 기능**

#### 1️⃣ **로그 기록** (`recordLog`)
```typescript
async recordLog(dto: LogRecordDto): Promise<LogRecordResult>

// 기록 내용
- 트랜잭션 정보
- 사용자/아이템 정보  
- 처리 결과 상태
- 메타데이터
- 타임스탬프
```

#### 2️⃣ **로그 조회**
```typescript
async getLogsByTransaction(transactionId: string): Promise<PurchaseLogEntry[]>
async getLogsByUser(userId: string): Promise<PurchaseLogEntry[]>
async getLogStatistics(): Promise<LogStats>
```

### 🎮 **사용 예시**

```typescript
// 로그 기록
const logResult = await logService.recordLog({
  transactionId: 'txn-456',
  userId: 'user-123',
  itemId: 'item-sword',
  quantity: 1,
  price: 100,
  status: 'success',
  step: 'purchase_completed',
  metadata: { executedSteps: ['user_validation', 'item_grant'] }
});

console.log(`로그 기록됨: ${logResult.logId}`);

// 트랜잭션별 로그 조회
const transactionLogs = await logService.getLogsByTransaction('txn-456');
console.log('트랜잭션 로그:', transactionLogs);

// 통계 조회
const stats = await logService.getLogStatistics();
console.log(`전체: ${stats.total}, 성공: ${stats.successful}, 실패: ${stats.failed}`);
```

### 🗂️ **로그 구조**

```typescript
interface PurchaseLogEntry {
  logId: string;              // 로그 고유 ID
  transactionId: string;      // 트랜잭션 ID
  userId: string;             // 사용자 ID
  itemId: string;             // 아이템 ID
  quantity: number;           // 수량
  price: number;              // 가격
  status: 'success' | 'failed' | 'compensated';  // 상태
  step: string;               // 처리 단계
  createdAt: Date;            // 생성 시간
  metadata: Record<string, any>;  // 추가 메타데이터
}
```

### 🚨 **에러 코드**

| 코드 | 설명 | 원인 |
|------|------|------|
| `LOG_RECORD_ERROR` | 로그 기록 실패 | 시스템 에러 |

## 📢 NotificationService

사용자 알림 발송을 담당합니다.

### 📊 **주요 기능**

#### 1️⃣ **알림 발송** (`sendNotification`)
```typescript
async sendNotification(dto: NotificationDto): Promise<NotificationResult>

// 알림 처리
- 알림 타입별 채널 선택
- 실패율 시뮬레이션 (개발용)
- 알림 기록 저장
- 다중 채널 지원
```

#### 2️⃣ **재시도 로직** (`retryNotification`)
```typescript
async retryNotification(notificationId: string): Promise<NotificationResult>

// 재시도 특징
- 최대 3회 재시도
- 재시도 시 성공률 80%
- 지수 백오프 없음 (단순 구현)
```

### 🎮 **사용 예시**

```typescript
// 알림 발송
const notifResult = await notificationService.sendNotification({
  userId: 'user-123',
  transactionId: 'txn-456',
  type: 'purchase_success',
  message: 'Purchase completed! You received 1 x item-sword',
  metadata: { itemId: 'item-sword', quantity: 1, price: 100 }
});

if (notifResult.success) {
  console.log(`알림 발송 완료: ${notifResult.notificationId}`);
} else {
  // 재시도 시도
  const retryResult = await notificationService.retryNotification(notifResult.notificationId);
  console.log(`재시도 ${retryResult.success ? '성공' : '실패'}`);
}

// 통계 조회
const stats = await notificationService.getNotificationStats();
console.log(`발송: ${stats.sent}, 실패: ${stats.failed}`);
```

### 📬 **알림 타입 및 채널**

| 알림 타입 | 채널 | 설명 |
|-----------|------|------|
| `purchase_success` | push, email | 구매 성공 알림 |
| `purchase_failed` | push | 구매 실패 알림 |
| `item_granted` | push, in-app | 아이템 지급 알림 |
| `refund` | push, email, sms | 환불 완료 알림 |

### 🔧 **개발 설정**

```typescript
// 실패율 조정 (테스트용)
await notificationService.setFailureRate(0.3); // 30% 실패율

// 알림 기록 초기화
await notificationService.clearNotifications();
```

### 🚨 **에러 코드**

| 코드 | 설명 | 원인 |
|------|------|------|
| `DELIVERY_FAILED` | 전송 실패 | 네트워크/서비스 오류 |
| `NOTIFICATION_NOT_FOUND` | 알림 기록 없음 | 잘못된 notificationId |
| `MAX_RETRIES_EXCEEDED` | 재시도 한계 | 3회 재시도 실패 |
| `RETRY_FAILED` | 재시도 실패 | 재시도 중 오류 |
| `NOTIFICATION_ERROR` | 내부 처리 오류 | 시스템 에러 |

## 🔗 통합 가이드

### 서비스 간 의존성

```typescript
// 오케스트레이터에서 모든 서비스 사용
@Injectable()
export class ItemPurchaseOrchestratorService {
  constructor(
    private readonly userService: UserService,
    private readonly itemService: ItemService, 
    private readonly logService: LogService,
    private readonly notificationService: NotificationService,
  ) {}
}
```

### 데이터 흐름

```
UserValidationDto → UserService → UserValidationResult
                                      ↓
ItemGrantDto → ItemService → ItemGrantResult  
                                      ↓
LogRecordDto → LogService → LogRecordResult
                                      ↓
NotificationDto → NotificationService → NotificationResult
```

### 에러 전파

각 서비스의 에러는 오케스트레이터에서 처리되어 이벤트로 변환됩니다:

```typescript
// UserService 에러 → UserValidationFailedEvent
// ItemService 에러 → ItemGrantFailedEvent  
// LogService 에러 → LogFailedEvent
// NotificationService 에러 → NotificationFailedEvent (비치명적)
```

## 🎯 모범 사례

### 1️⃣ **서비스 설계**
- **단일 책임**: 각 서비스는 하나의 도메인만 담당
- **멱등성**: 동일한 요청을 여러 번 처리해도 안전
- **상태 격리**: 서비스 간 상태 공유 최소화

### 2️⃣ **에러 처리**
- **구체적 에러 코드**: 디버깅과 대응을 위한 명확한 코드
- **상세한 메시지**: 운영자가 이해할 수 있는 에러 설명
- **로깅**: 모든 에러와 중요 작업 로깅

### 3️⃣ **테스트**
- **단위 테스트**: 각 메소드별 성공/실패 시나리오 테스트
- **모의 데이터**: 테스트용 데이터 초기화/정리 메소드 활용
- **보상 테스트**: 보상 트랜잭션 동작 검증

### 4️⃣ **성능**
- **비동기 처리**: 모든 I/O 작업은 Promise 기반
- **배치 처리**: 대량 작업 시 배치 단위 처리 고려
- **캐싱**: 자주 조회되는 데이터 캐싱 활용

### 5️⃣ **운영**
- **메트릭**: 처리량, 응답 시간, 에러율 모니터링
- **알림**: 중요 에러나 임계치 초과 시 알림
- **백업**: 중요 데이터의 정기 백업

## 🚨 주의사항

### **데이터 정합성**
현재 구현은 메모리 기반으로, 실제 운영 환경에서는:
- 데이터베이스 트랜잭션 활용
- 분산 락을 통한 동시성 제어
- 이벤트 소싱 패턴 고려

### **확장성**
서비스 분리 시 고려사항:
- 네트워크 지연시간과 타임아웃
- 서비스 디스커버리와 로드 밸런싱
- 분산 트레이싱과 모니터링

### **보안**
- 사용자 인증/권한 검증
- 민감 정보 암호화
- API 호출 제한 (Rate Limiting)

---

**다음 가이드**: [Saga 오케스트레이터 가이드](./ORCHESTRATOR_GUIDE.md)