# 🗺️ NestJS Saga Pattern - 컴포넌트 매핑 및 구조 분석

## 📋 목차

- [전체 아키텍처 맵](#전체-아키텍처-맵)
- [컴포넌트별 상세 분석](#컴포넌트별-상세-분석)
- [데이터 플로우 다이어그램](#데이터-플로우-다이어그램)
- [API 엔드포인트 매핑](#api-엔드포인트-매핑)
- [이벤트 플로우 매핑](#이벤트-플로우-매핑)

## 🏗️ 전체 아키텍처 맵

### 레이어별 구조
```
┌─────────────────────────────────────────────────────────────────┐
│                        🌐 HTTP API 레이어                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │          app.controller.ts (620+ lines)                     │ │
│  │  ┌─────────────────┬─────────────────┬─────────────────────┐ │ │
│  │  │ Purchase APIs   │ Monitoring APIs │ Configuration APIs  │ │ │
│  │  │ /purchase       │ /saga/{id}      │ /config/saga-mode   │ │ │
│  │  │ /purchase/      │ /choreography/  │ /patterns/          │ │ │
│  │  │ choreography    │ transaction/{id}│ comparison          │ │ │
│  │  └─────────────────┴─────────────────┴─────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                        ⚙️ 패턴 제어 레이어                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │    saga-pattern.config.ts - 런타임 패턴 전환 제어           │ │
│  │  ┌─────────────────────┐   ┌─────────────────────────────┐   │ │
│  │  │   ORCHESTRATION     │   │      CHOREOGRAPHY           │   │ │
│  │  │   (중앙집중식)        │   │      (분산 이벤트)            │   │ │
│  │  │                     │   │                             │   │ │
│  │  │ orchestrator/       │ ⚡ │ choreography/               │   │ │
│  │  │ ├─ modules          │   │ ├─ handlers/                │   │ │
│  │  │ ├─ services         │   │ ├─ coordinator              │   │ │
│  │  │ └─ handlers         │   │ └─ module                   │   │ │
│  │  └─────────────────────┘   └─────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                        🚌 이벤트 시스템 레이어                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                   EventBus Service                          │ │
│  │  ┌─────────────────┬─────────────────┬─────────────────────┐ │ │
│  │  │ Event Publishing│ Event Routing   │ Handler Management  │ │ │
│  │  │ publish()       │ subscribe()     │ unsubscribe()       │ │ │
│  │  └─────────────────┴─────────────────┴─────────────────────┘ │ │
│  │                                                             │ │
│  │  📦 Event Types: PurchaseEvents (14개 이벤트)               │ │
│  │  🏭 Event Factory: 이벤트 생성 및 검증                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌──────────────────────────────────────────────────────────────────┐
│                        🏢 비즈니스 로직 레이어                        │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Domain Services                          │ │
│  │  ┌─────────────┬──────────────┬──────────────┬─────────────┐ │ │
│  │  │UserService  │ ItemService  │ LogService   │Notification │ │ │
│  │  │(사용자검증)    │ (아이템지급)    │ (로그기록)     │Service      │ │ │
│  │  │             │              │              │(알림발송)     │ │ │
│  │  │• 잔액확인     │ • 재고확인     │ • 거래기록      │• 다채널알림    │ │ │
│  │  │• 잔액차감     │ • 아이템지급    │ • 상태추적     │• 재시도로직    │ │ │
│  │  │• 보상처리     │ • 보상처리     │ • 통계생성      │• 실패처리     │ │ │
│  │  └─────────────┴──────────────┴──────────────┴─────────────┘ │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
                               ↕
┌──────────────────────────────────────────────────────────────────┐
│                        💾 데이터 저장소 레이어                        │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │              SagaRepository (상태 관리)                        │ │
│  │  ┌─────────────────┬─────────────────┬─────────────────────┐ │ │
│  │  │ Saga State      │ Transaction Log │ Compensation Data   │ │ │
│  │  │ 저장 및 조회       │ 이벤트 추적        │ 보상 트랜잭션           │ │ │
│  │  └─────────────────┴─────────────────┴─────────────────────┘ │ │
│  └──────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────┘
```

## 🔍 컴포넌트별 상세 분석

### 🎮 API 컨트롤러 레이어

#### app.controller.ts (620+ 라인)
```typescript
// 핵심 역할: HTTP 요청 처리 및 비즈니스 로직 라우팅
📍 위치: src/app.controller.ts

🔧 주요 메서드:
├─ 🛒 구매 관련
│  ├─ POST /purchase                    # Orchestration 패턴 구매
│  └─ POST /purchase/choreography       # Choreography 패턴 구매
├─ 📊 모니터링 관련  
│  ├─ GET /saga/{id}                    # Orchestration 상태 조회
│  ├─ GET /choreography/transaction/{id} # Choreography 상태 조회
│  ├─ GET /sagas/stats                  # 전체 통계
│  └─ GET /choreography/stats           # Choreography 통계
├─ ⚙️ 설정 관련
│  ├─ GET /config/saga-mode             # 현재 패턴 모드 확인
│  ├─ POST /config/saga-mode            # 패턴 모드 변경
│  └─ GET /patterns/comparison          # 패턴 비교 정보
└─ 🧪 테스트 관련
   ├─ POST /test-eventbus               # EventBus 테스트
   └─ POST /test-services               # 서비스 테스트
```

### ⚙️ 패턴 제어 시스템

#### saga-pattern.config.ts
```typescript
📍 위치: src/config/saga-pattern.config.ts
🎯 목적: 런타임 패턴 전환 및 충돌 방지

🔧 핵심 기능:
├─ SagaPatternMode 열거형 정의
├─ 환경변수 기반 설정 (SAGA_PATTERN_MODE)
├─ 패턴별 활성화 함수
│  ├─ isOrchestrationMode()
│  └─ isChoreographyMode()
└─ 설정 변경 및 검증 로직
```

### 🎭 Orchestration 패턴 (중앙집중식)

```
orchestrator/
├── 📋 interfaces/
│   ├── orchestrator.interface.ts          # 오케스트레이터 계약
│   └── saga-state.interface.ts            # Saga 상태 정의
├── 🎬 event-handlers/
│   ├── purchase-event.handler.ts          # 구매 이벤트 모니터링
│   └── purchase-orchestration.handler.ts  # 비즈니스 로직 실행
├── 🏗️ 핵심 서비스
│   ├── item-purchase-orchestrator.service.ts # 중앙 워크플로우 관리
│   ├── saga-repository.service.ts         # 상태 저장소
│   └── saga-context.ts                    # 실행 컨텍스트
└── 📦 orchestrator.module.ts              # 모듈 구성
```

#### ItemPurchaseOrchestratorService (핵심)
```typescript
📍 위치: src/orchestrator/item-purchase-orchestrator.service.ts
🎯 역할: 전체 구매 워크플로우 중앙 제어

🔄 실행 플로우:
1️⃣ executePurchaseWithTransactionId()
   ├─ 사용자 검증 (UserService.validateUser)
   ├─ 아이템 지급 (ItemService.grantItem)  
   ├─ 로그 기록 (LogService.recordLog)
   └─ 알림 발송 (NotificationService.sendNotification)

💔 실패 시 보상 플로우:
2️⃣ executeCompensation()
   ├─ 성공한 단계들을 역순으로 보상
   └─ 각 서비스의 compensate 메서드 호출
```

### 🎪 Choreography 패턴 (분산 이벤트)

```
choreography/
├── 🎭 handlers/                         # 독립 이벤트 핸들러들
│   ├── user-validation.handler.ts       # 사용자 검증 독립 처리
│   ├── item-grant.handler.ts            # 아이템 지급 독립 처리
│   ├── log-record.handler.ts            # 로그 기록 독립 처리
│   ├── notification.handler.ts          # 알림 발송 독립 처리
│   └── compensation.handler.ts          # 보상 트랜잭션 독립 처리
├── 🎯 purchase-coordinator.service.ts   # 초기 이벤트 발행
└── 📦 choreography.module.ts            # 핸들러 등록 및 관리
```

#### 핸들러별 책임
```typescript
// 각 핸들러는 완전히 독립적으로 동작

🔸 UserValidationHandler
   입력: PurchaseInitiated → 출력: UserValidated | UserValidationFailed
   
🔸 ItemGrantHandler  
   입력: UserValidated → 출력: ItemGranted | ItemGrantFailed
   
🔸 LogRecordHandler
   입력: ItemGranted → 출력: LogRecorded | LogFailed
   
🔸 NotificationHandler
   입력: LogRecorded → 출력: PurchaseCompleted | NotificationFailed
   
🔸 CompensationHandler
   입력: *Failed 이벤트들 → 출력: CompensationCompleted | PurchaseFailed
```

### 🚌 EventBus 시스템

#### EventBus Service (핵심 인프라)
```typescript
📍 위치: src/events/event-bus.service.ts
🎯 목적: 전체 시스템의 이벤트 허브

🔧 핵심 메서드:
├─ publish<T>(event: T): Promise<void>     # 이벤트 발행
├─ subscribe<T>(eventType, handler)       # 핸들러 구독
├─ unsubscribe(eventType, handler)        # 구독 해제
└─ getHandlers(eventType)                 # 핸들러 목록 조회

📊 이벤트 통계:
├─ 총 이벤트 타입: 14개
├─ 성공 이벤트: 8개
├─ 실패 이벤트: 5개  
└─ 완료 이벤트: 1개
```

#### 이벤트 타입 계층구조
```typescript
📍 위치: src/events/purchase-events.ts

🌳 이벤트 계층:
BaseEvent (추상)
├─ PurchaseInitiated          # 구매 시작
├─ UserValidated              # 사용자 검증 성공
├─ UserValidationFailed       # 사용자 검증 실패
├─ ItemGranted                # 아이템 지급 성공
├─ ItemGrantFailed            # 아이템 지급 실패
├─ LogRecorded                # 로그 기록 성공
├─ LogFailed                  # 로그 기록 실패
├─ NotificationSent           # 알림 발송 성공
├─ NotificationFailed         # 알림 발송 실패
├─ PurchaseCompleted          # 구매 완료
├─ PurchaseFailed             # 구매 실패
├─ CompensationStarted        # 보상 시작
├─ CompensationCompleted      # 보상 완료
└─ CompensationFailed         # 보상 실패
```

### 🏢 도메인 서비스 레이어

#### 서비스별 상세 분석

##### UserService
```typescript
📍 위치: src/services/user.service.ts
🎯 담당: 사용자 검증 및 잔액 관리

💡 핵심 메서드:
├─ validateUser(dto): UserValidationResult
│  ├─ 사용자 존재 확인
│  ├─ 상태 검증 (활성/정지)
│  ├─ 잔액 확인 및 차감
│  └─ 구매 한도 검증
├─ compensateUserValidation(): boolean
│  └─ 차감된 잔액 복구
└─ getUserProfile(), resetUserBalance()

📊 테스트 데이터:
├─ user-123: 잔액 1000, 활성
├─ user-456: 잔액 50, 활성  
└─ user-suspended: 잔액 1000, 정지
```

##### ItemService  
```typescript
📍 위치: src/services/item.service.ts
🎯 담당: 아이템 관리 및 인벤토리

💡 핵심 메서드:
├─ grantItem(dto): ItemGrantResult
│  ├─ 아이템 존재 확인
│  ├─ 활성 상태 검증
│  ├─ 재고 확인 및 차감
│  └─ 사용자 인벤토리 추가
├─ compensateItemGrant(): boolean
│  ├─ 재고 복원
│  └─ 인벤토리에서 제거
└─ getItemInfo(), getUserInventory()

📦 테스트 데이터:
├─ item-sword: 가격 100, 재고 50개
├─ item-potion: 가격 20, 재고 100개
├─ item-out-of-stock: 재고 0개
└─ item-disabled: 비활성화됨
```

##### LogService
```typescript
📍 위치: src/services/log.service.ts
🎯 담당: 거래 로깅 및 추적

💡 핵심 메서드:
├─ recordLog(dto): LogResult
│  ├─ 거래 정보 기록
│  ├─ 타임스탬프 생성
│  └─ 로그 ID 반환
├─ updateLogStatus(): boolean
├─ getLogsByTransaction()
├─ getLogsByUser()
└─ getLogStatistics()
```

##### NotificationService
```typescript
📍 위치: src/services/notification.service.ts
🎯 담당: 다채널 알림 발송

💡 핵심 메서드:
├─ sendNotification(dto): NotificationResult
│  ├─ 채널별 발송 (email, sms, push)
│  ├─ 실패율 시뮬레이션
│  └─ 재시도 로직
├─ retryNotification(): boolean
└─ getNotificationsByUser()

🔧 고급 기능:
├─ 실패율 설정 가능 (테스트용)
├─ 채널별 우선순위
└─ 배치 발송 지원
```

## 📊 데이터 플로우 다이어그램

### Orchestration 데이터 플로우
```
[Client Request] 
       ↓
[app.controller.ts::purchase]
       ↓
[ItemPurchaseOrchestratorService::executePurchaseWithTransactionId]
       ↓
┌─────────────────────────────────────────────┐
│              순차 실행 플로우                 │
├─────────────────────────────────────────────┤
│ 1️⃣ UserService.validateUser                │
│    ├─ 사용자 검증                           │
│    └─ 잔액 차감                            │
│         ↓                                  │
│ 2️⃣ ItemService.grantItem                  │
│    ├─ 재고 확인                            │
│    └─ 아이템 지급                           │
│         ↓                                  │
│ 3️⃣ LogService.recordLog                   │
│    └─ 거래 로그 기록                        │
│         ↓                                  │
│ 4️⃣ NotificationService.sendNotification    │
│    └─ 사용자 알림 발송                       │
└─────────────────────────────────────────────┘
       ↓
[SagaRepository::save] ← [각 단계별 상태 업데이트]
       ↓
[Client Response] ← [최종 결과 반환]
```

### Choreography 데이터 플로우
```
[Client Request]
       ↓
[app.controller.ts::purchaseWithChoreography]
       ↓
[PurchaseCoordinatorService::initiatePurchase]
       ↓
[EventBus.publish(PurchaseInitiated)] ← [즉시 응답]
       ↓                              ↗
┌─────────────────────────────────────────────┐
│              비동기 이벤트 체인               │
├─────────────────────────────────────────────┤
│ 📬 PurchaseInitiated                       │
│       ↓                                    │
│ 🔸 UserValidationHandler                   │
│    ├─ 사용자 검증 처리                      │  
│    └─ UserValidated 이벤트 발행             │
│         ↓                                  │
│ 🔸 ItemGrantHandler                        │
│    ├─ 아이템 지급 처리                      │
│    └─ ItemGranted 이벤트 발행               │
│         ↓                                  │
│ 🔸 LogRecordHandler                        │
│    ├─ 로그 기록 처리                        │
│    └─ LogRecorded 이벤트 발행               │
│         ↓                                  │  
│ 🔸 NotificationHandler                     │
│    ├─ 알림 발송 처리                        │
│    └─ PurchaseCompleted 이벤트 발행         │
└─────────────────────────────────────────────┘
       ↓
[SagaRepository] ← [각 핸들러별 상태 업데이트]
```

## 🗺️ API 엔드포인트 매핑

### 구매 API 매핑
| HTTP 메서드 | 엔드포인트 | 컨트롤러 메서드 | 사용 패턴 | 응답 특성 |
|------------|-----------|----------------|----------|----------|
| `POST` | `/purchase` | `purchase()` | Orchestration | 동기식 - 즉시 완료 |
| `POST` | `/purchase/choreography` | `purchaseWithChoreography()` | Choreography | 비동기식 - 처리 시작 |

### 모니터링 API 매핑  
| HTTP 메서드 | 엔드포인트 | 컨트롤러 메서드 | 대상 패턴 | 반환 데이터 |
|------------|-----------|----------------|----------|-----------|
| `GET` | `/saga/{transactionId}` | `getSagaStatus()` | Orchestration | Saga 상태 + 단계별 결과 |
| `GET` | `/choreography/transaction/{id}` | `getChoreographyTransaction()` | Choreography | 트랜잭션 상태 + 핸들러 정보 |
| `GET` | `/sagas/stats` | `getSagaStatistics()` | Orchestration | 전체 통계 |
| `GET` | `/choreography/stats` | `getChoreographyStatistics()` | Choreography | Choreography 통계 |

### 설정 API 매핑
| HTTP 메서드 | 엔드포인트 | 컨트롤러 메서드 | 목적 |
|------------|-----------|----------------|------|
| `GET` | `/config/saga-mode` | `getCurrentSagaMode()` | 현재 패턴 확인 |
| `POST` | `/config/saga-mode` | `setSagaPatternMode()` | 패턴 변경 |
| `GET` | `/patterns/comparison` | `getPatternsComparison()` | 패턴 비교 정보 |

### 테스트 API 매핑
| HTTP 메서드 | 엔드포인트 | 컨트롤러 메서드 | 테스트 대상 |
|------------|-----------|----------------|------------|
| `POST` | `/test-eventbus` | `testEventBus()` | EventBus 시스템 |
| `POST` | `/test-services` | `testServices()` | 모든 도메인 서비스 |
| `POST` | `/compensate/{transactionId}` | `manualCompensation()` | 수동 보상 |

## 🔄 이벤트 플로우 매핑

### 이벤트 → 핸들러 매핑 (Choreography)
```
📬 이벤트 타입                   → 🎭 처리 핸들러
├─ PurchaseInitiated           → UserValidationHandler
├─ UserValidated               → ItemGrantHandler  
├─ ItemGranted                 → LogRecordHandler
├─ LogRecorded                 → NotificationHandler
├─ UserValidationFailed        → CompensationHandler
├─ ItemGrantFailed             → CompensationHandler
├─ LogFailed                   → CompensationHandler
├─ NotificationFailed          → CompensationHandler (선택적)
└─ PurchaseCompleted           → 처리 완료 (핸들러 없음)
```

### 상태 전환 매핑
```
💾 Saga 상태                   → 🔄 다음 가능 상태
├─ PENDING                    → IN_PROGRESS
├─ IN_PROGRESS                → COMPLETED | FAILED
├─ COMPLETED                  → (최종 상태)
├─ FAILED                     → COMPENSATING
├─ COMPENSATING               → COMPENSATED | FAILED
└─ COMPENSATED                → (최종 상태)
```

### 보상 매핑 (실패 시)
```
💔 실패 단계                    → 🔧 보상 액션
├─ 사용자 검증 실패              → (보상 불필요)
├─ 아이템 지급 실패              → 사용자 잔액 복구
├─ 로그 기록 실패               → 사용자 잔액 복구 + 아이템 회수
└─ 알림 발송 실패               → 전체 단계 보상 (선택적)
```

## 📈 성능 및 확장성 고려사항

### 컴포넌트별 성능 특성
| 컴포넌트 | 평균 처리시간 | 확장성 | 병목지점 |
|----------|---------------|--------|----------|
| **API Controller** | <10ms | 높음 | HTTP 연결 수 |
| **EventBus** | <2ms | 높음 | 메모리 기반 핸들러 |
| **UserService** | <5ms | 중간 | 잔액 계산 로직 |
| **ItemService** | <8ms | 중간 | 재고 관리 |
| **LogService** | <15ms | 높음 | 로그 저장 |
| **NotificationService** | <20ms | 낮음 | 외부 API 호출 |

### 패턴별 성능 비교
| 특성 | Orchestration | Choreography |
|------|---------------|--------------|
| **초기 응답** | 50-100ms (완료) | 5-15ms (시작) |
| **전체 완료** | 50-100ms | 50-200ms |
| **메모리 사용** | 낮음 | 중간 |
| **CPU 사용** | 중간 | 낮음 |
| **확장성** | 중간 | 높음 |

---

**📍 관련 문서**: [📋 메인](./README.md) | [🗂️ 프로젝트 인덱스](./PROJECT_INDEX.md) | [🌐 API 가이드](./API_GUIDE.md) | [🎪 코레오그래피](./CHOREOGRAPHY_GUIDE.md)

**최종 업데이트**: 2024년 12월 | **버전**: 2.0.0