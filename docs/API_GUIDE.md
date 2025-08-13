# API 사용 가이드

이중 Saga 패턴 (Orchestration & Choreography) 기반 아이템 구매 시스템의 REST API 사용 가이드입니다.

## 📋 목차

- [기본 정보](#기본-정보)
- [구매 API](#구매-api)
  - [Orchestration API](#orchestration-api)
  - [Choreography API](#choreography-api)
- [모니터링 API](#모니터링-api)
- [패턴 설정 API](#패턴-설정-api)
- [테스트 API](#테스트-api)
- [에러 처리](#에러-처리)
- [사용 예시](#사용-예시)

## 🌐 기본 정보

### Base URL
```
http://localhost:3000
```

### 응답 형식
모든 API는 JSON 형식으로 응답합니다.

### 공통 헤더
```
Content-Type: application/json
Accept: application/json
```

## 🛒 구매 API

### Orchestration API

#### **POST /purchase**
**중앙집중식 오케스트레이터**를 통한 아이템 구매를 실행합니다.

#### 요청
```http
POST /purchase
Content-Type: application/json

{
  "userId": "user-123",
  "itemId": "item-sword", 
  "quantity": 1,
  "price": 100
}
```

#### 요청 필드
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `userId` | string | ✅ | 사용자 ID |
| `itemId` | string | ✅ | 아이템 ID |
| `quantity` | number | ✅ | 구매 수량 |
| `price` | number | ✅ | 총 가격 |

#### 성공 응답 (200 OK)
```json
{
  "success": true,
  "transactionId": "TXN_1734014402456_abc123",
  "status": "completed",
  "completedSteps": [
    "user_validation",
    "item_grant", 
    "log_record",
    "notification"
  ],
  "data": {
    "userId": "user-123",
    "itemId": "item-sword",
    "quantity": 1,
    "price": 100,
    "grantedAt": "2024-12-12T14:20:02.456Z",
    "logId": "LOG_1734014402789_def456",
    "notificationId": "NOTIF_1734014402891_ghi789"
  }
}
```

#### 실패 응답 (200 OK)
```json
{
  "success": false,
  "transactionId": "TXN_1734014402456_abc123", 
  "status": "compensated",
  "completedSteps": ["user_validation"],
  "error": {
    "step": "item_grant",
    "code": "ITEM_NOT_AVAILABLE",
    "message": "Item is not available"
  }
}
```

#### 응답 필드 설명

**공통 필드**
| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | boolean | 구매 성공 여부 |
| `transactionId` | string | 트랜잭션 고유 ID |
| `status` | string | Saga 상태 (completed/failed/compensated) |
| `completedSteps` | string[] | 완료된 단계 목록 |

**성공 시 추가 필드**
| 필드 | 타입 | 설명 |
|------|------|------|
| `data.grantedAt` | string | 아이템 지급 시간 |
| `data.logId` | string | 생성된 로그 ID |
| `data.notificationId` | string | 발송된 알림 ID |

**실패 시 추가 필드**
| 필드 | 타입 | 설명 |
|------|------|------|
| `error.step` | string | 실패한 단계명 |
| `error.code` | string | 에러 코드 |
| `error.message` | string | 에러 메시지 |

### Choreography API

#### **POST /purchase/choreography**
**분산 이벤트 기반 독립 핸들러**를 통한 아이템 구매를 실행합니다.

#### 요청
```http
POST /purchase/choreography
Content-Type: application/json

{
  "userId": "user-123",
  "itemId": "item-sword", 
  "quantity": 1,
  "price": 100
}
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "transactionId": "TXN_1755079254438_1mk11asjo",
  "status": "initiated",
  "message": "Purchase initiated via Choreography pattern (processing asynchronously)",
  "processingInfo": {
    "type": "choreography",
    "description": "Independent event handlers will process each step",
    "statusCheck": {
      "url": "/choreography/transaction/TXN_1755079254438_1mk11asjo",
      "method": "GET",
      "polling": "Check status every 1-2 seconds until completion"
    },
    "eventChain": [
      "PurchaseInitiated → UserValidationHandler",
      "UserValidated → ItemGrantHandler", 
      "ItemGranted → LogRecordHandler",
      "LogRecorded → NotificationHandler",
      "Failures → CompensationHandler"
    ]
  }
}
```

#### 주요 차이점
| 특징 | Orchestration | Choreography |
|------|---------------|--------------|
| **처리 방식** | 동기식 (즉시 완료) | 비동기식 (이벤트 체인) |
| **응답 시간** | ~100ms | ~10ms (초기화만) |
| **상태 확인** | `/saga/{id}` | `/choreography/transaction/{id}` |
| **제어 방식** | 중앙 집중식 | 분산 독립식 |

## 📊 모니터링 API

### Orchestration 모니터링

#### **GET /saga/{transactionId}**
특정 Saga의 상태를 조회합니다.

#### 요청
```http
GET /saga/TXN_1734014402456_abc123
```

#### 성공 응답 (200 OK)
```json
{
  "found": true,
  "saga": {
    "transactionId": "TXN_1734014402456_abc123",
    "status": "completed",
    "purchaseData": {
      "userId": "user-123",
      "itemId": "item-sword",
      "quantity": 1,
      "price": 100
    },
    "steps": [
      {
        "step": "user_validation",
        "status": "success",
        "data": {
          "isValid": true,
          "currentBalance": 900
        },
        "executedAt": "2024-12-12T14:20:01.123Z",
        "duration": 45
      },
      {
        "step": "item_grant",
        "status": "success",
        "data": {
          "success": true,
          "grantedAt": "2024-12-12T14:20:01.234Z"
        },
        "executedAt": "2024-12-12T14:20:01.234Z",
        "duration": 32
      }
    ],
    "compensations": [],
    "startedAt": "2024-12-12T14:20:01.000Z",
    "completedAt": "2024-12-12T14:20:02.456Z"
  }
}
```

#### 실패 응답 (200 OK)
```json
{
  "found": false,
  "message": "Saga not found: TXN_invalid"
}
```

#### **GET /sagas/stats**
전체 Orchestration Saga 통계를 조회합니다.

#### 요청
```http
GET /sagas/stats
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "statistics": {
    "total": 150,
    "pending": 2,
    "inProgress": 5,
    "completed": 120,
    "failed": 15,
    "compensating": 3,
    "compensated": 5
  }
}
```

### Choreography 모니터링

#### **GET /choreography/transaction/{transactionId}**
특정 Choreography 트랜잭션의 상태를 조회합니다.

#### 요청
```http
GET /choreography/transaction/TXN_1755079254438_1mk11asjo
```

#### 성공 응답 (200 OK)
```json
{
  "found": true,
  "transaction": {
    "transactionId": "TXN_1755079254438_1mk11asjo",
    "status": "completed",
    "purchaseData": {
      "userId": "user-123",
      "itemId": "item-sword",
      "quantity": 1,
      "price": 100
    },
    "steps": [
      {
        "step": "user_validation",
        "status": "success",
        "executedAt": "2025-08-13T10:00:54.438Z",
        "duration": 0
      },
      {
        "step": "item_grant", 
        "status": "success",
        "executedAt": "2025-08-13T10:00:54.438Z",
        "duration": 0
      }
    ],
    "compensations": [],
    "startedAt": "2025-08-13T10:00:54.438Z",
    "completedAt": "2025-08-13T10:00:54.442Z"
  },
  "patternUsed": "choreography",
  "eventHandlers": {
    "completed": [
      {
        "step": "user_validation",
        "status": "success",
        "executedAt": "2025-08-13T10:00:54.438Z",
        "duration": 0
      }
    ],
    "compensations": []
  }
}
```

#### **GET /choreography/stats**
전체 Choreography 트랜잭션 통계를 조회합니다.

#### 요청
```http
GET /sagas/stats
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "statistics": {
    "total": 150,
    "pending": 2,
    "inProgress": 5,
    "completed": 120,
    "failed": 15,
    "compensating": 3,
    "compensated": 5
  }
}
```

### **POST /compensate/{transactionId}**
실패한 Saga에 대해 수동 보상을 실행합니다.

#### 요청
```http
POST /compensate/TXN_1734014402456_abc123
```

#### 성공 응답 (200 OK)
```json
{
  "success": true,
  "transactionId": "TXN_1734014402456_abc123",
  "message": "Compensation completed"
}
```

#### 실패 응답 (200 OK)
```json
{
  "success": false,
  "transactionId": "TXN_1734014402456_abc123",
  "error": "Saga not found or already compensated"
}
```

## ⚙️ 패턴 설정 API

### **GET /config/saga-mode**
현재 활성화된 Saga 패턴 모드를 확인합니다.

#### 요청
```http
GET /config/saga-mode
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "config": {
    "mode": "choreography",
    "enableEventLogging": true,
    "enableMetrics": true
  },
  "activeHandlers": {
    "orchestration": false,
    "choreography": true
  },
  "warning": "Handler registration happens at module initialization. Mode changes may require restart."
}
```

### **POST /config/saga-mode**
Saga 패턴 모드를 변경합니다.

#### 요청
```http
POST /config/saga-mode
Content-Type: application/json

{
  "mode": "orchestration"
}
```

#### 성공 응답 (200 OK)
```json
{
  "success": true,
  "previousMode": "choreography",
  "newMode": "orchestration",
  "warning": "Event handlers were registered at startup. Full mode change requires application restart.",
  "recommendation": "Restart the application with SAGA_PATTERN_MODE=orchestration environment variable for complete activation.",
  "currentlyActive": {
    "orchestration": false,
    "choreography": true
  }
}
```

### **GET /patterns/comparison**
두 Saga 패턴의 비교 정보를 제공합니다.

#### 요청
```http
GET /patterns/comparison
```

#### 응답 (200 OK)
```json
{
  "currentMode": "choreography",
  "currentModeActive": {
    "orchestration": false,
    "choreography": true
  },
  "patterns": {
    "orchestration": {
      "endpoint": "/purchase",
      "description": "Centralized control with direct service calls",
      "active": false,
      "advantages": ["Easy to understand", "Clear control flow", "Simple debugging"],
      "disadvantages": ["Single point of failure", "Tight coupling", "Hard to extend"]
    },
    "choreography": {
      "endpoint": "/purchase/choreography",
      "description": "Event-driven decentralized processing", 
      "active": true,
      "advantages": ["Loose coupling", "High scalability", "Independent deployment"],
      "disadvantages": ["Complex debugging", "Eventual consistency", "Event ordering complexity"]
    }
  },
  "configEndpoints": {
    "getCurrentConfig": "GET /config/saga-mode",
    "switchMode": "POST /config/saga-mode"
  }
}
```

## 🧪 테스트 API

### **POST /test-eventbus**
EventBus 시스템을 테스트합니다.

#### 요청
```http
POST /test-eventbus
Content-Type: application/json

{
  "userId": "user-123",
  "itemId": "item-sword",
  "quantity": 1, 
  "price": 100
}
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "eventId": "EVT_1734014402456_abc123",
  "transactionId": "TXN_1734014402456_def456",
  "message": "Event published successfully"
}
```

### **POST /test-services**
모든 도메인 서비스를 개별적으로 테스트합니다.

#### 요청
```http
POST /test-services
Content-Type: application/json

{
  "userId": "user-123",
  "itemId": "item-sword",
  "quantity": 1,
  "price": 100
}
```

#### 응답 (200 OK)
```json
{
  "success": true,
  "results": {
    "user": {
      "isValid": true,
      "userId": "user-123",
      "currentBalance": 900
    },
    "item": {
      "success": true,
      "userId": "user-123",
      "itemId": "item-sword",
      "quantity": 1,
      "grantedAt": "2024-12-12T14:20:01.234Z"
    },
    "log": {
      "success": true,
      "logId": "LOG_1734014402789_ghi789",
      "recordedAt": "2024-12-12T14:20:01.345Z"
    },
    "notification": {
      "success": true,
      "notificationId": "NOTIF_1734014402891_jkl012",
      "sentAt": "2024-12-12T14:20:01.456Z"
    }
  }
}
```

## 🚨 에러 처리

### HTTP 상태 코드
모든 API는 성공적으로 처리되면 `200 OK`를 반환합니다. 
비즈니스 로직 에러는 응답 본문의 `success` 필드로 구분합니다.

### 에러 응답 형식
```json
{
  "success": false,
  "error": "에러 메시지",
  "details": {
    // 추가 에러 정보
  }
}
```

### 주요 에러 코드

#### 사용자 검증 에러
| 코드 | 메시지 | 원인 |
|------|--------|------|
| `USER_NOT_FOUND` | User not found | 존재하지 않는 사용자 ID |
| `USER_NOT_ACTIVE` | User status is suspended | 정지된 사용자 |
| `INSUFFICIENT_BALANCE` | Insufficient balance | 잔액 부족 |
| `PURCHASE_LIMIT_EXCEEDED` | Purchase limit exceeded | 구매 한도 초과 |

#### 아이템 지급 에러
| 코드 | 메시지 | 원인 |
|------|--------|------|
| `ITEM_NOT_FOUND` | Item not found | 존재하지 않는 아이템 |
| `ITEM_NOT_AVAILABLE` | Item is not available | 비활성화된 아이템 |
| `INSUFFICIENT_STOCK` | Insufficient stock | 재고 부족 |

#### 시스템 에러
| 코드 | 메시지 | 원인 |
|------|--------|------|
| `LOG_RECORD_ERROR` | Failed to record log | 로그 기록 실패 |
| `NOTIFICATION_ERROR` | Internal notification error | 알림 시스템 에러 |

## 💡 사용 예시

### 1️⃣ **Orchestration 패턴 정상 구매 플로우**

```bash
# 1. 구매 요청 (중앙집중식)
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "itemId": "item-sword",
    "quantity": 1,
    "price": 100
  }'

# 응답: success: true, transactionId: "TXN_..." (즉시 완료)

# 2. 상태 확인  
curl http://localhost:3000/saga/TXN_1734014402456_abc123

# 응답: 완료된 Saga 상태 정보
```

### 1️⃣-2 **Choreography 패턴 정상 구매 플로우**

```bash
# 1. 구매 요청 (분산 이벤트 기반)
curl -X POST http://localhost:3000/purchase/choreography \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "itemId": "item-sword",
    "quantity": 1,
    "price": 100
  }'

# 응답: success: true, status: "initiated" (비동기 처리 시작)

# 2. 상태 확인 (폴링 필요)
curl http://localhost:3000/choreography/transaction/TXN_1755079254438_1mk11asjo

# 응답: 처리 중이거나 완료된 트랜잭션 상태
```

### 2️⃣ **실패 및 보상 플로우**

```bash
# 1. 실패하는 구매 (잔액 부족)
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-456",
    "itemId": "item-sword", 
    "quantity": 1,
    "price": 100
  }'

# 응답: success: false, error: { "code": "INSUFFICIENT_BALANCE" }

# 2. 실패하는 구매 (아이템 지급 실패 - 보상 발생)
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "itemId": "item-disabled",
    "quantity": 1,
    "price": 50
  }'

# 응답: success: false, status: "compensated"
```

### 3️⃣ **패턴 전환 플로우**

```bash
# 1. 현재 패턴 확인
curl http://localhost:3000/config/saga-mode

# 2. 패턴 비교 정보 확인
curl http://localhost:3000/patterns/comparison

# 3. 패턴 전환 (런타임)
curl -X POST http://localhost:3000/config/saga-mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "orchestration"}'

# 4. 완전한 패턴 전환 (재시작 필요)
SAGA_PATTERN_MODE=orchestration npm run start:dev
```

### 4️⃣ **모니터링 플로우**

```bash
# Orchestration 모니터링
curl http://localhost:3000/sagas/stats
curl http://localhost:3000/saga/TXN_1734014402456_abc123

# Choreography 모니터링  
curl http://localhost:3000/choreography/stats
curl http://localhost:3000/choreography/transaction/TXN_1755079254438_1mk11asjo

# 수동 보상 (패턴 무관)
curl -X POST http://localhost:3000/compensate/TXN_1734014402456_abc123
```

### 5️⃣ **시스템 테스트**

```bash
# 1. EventBus 테스트
curl -X POST http://localhost:3000/test-eventbus \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "itemId": "item-sword",
    "quantity": 1,
    "price": 100
  }'

# 2. 도메인 서비스 테스트
curl -X POST http://localhost:3000/test-services \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123", 
    "itemId": "item-sword",
    "quantity": 1,
    "price": 100
  }'
```

## 📈 성능 고려사항

### 응답 시간 비교
| 패턴 | 초기 응답 | 완료 시간 | 용도 |
|------|----------|----------|------|
| **Orchestration** | 50-100ms (완료) | 즉시 | 동기식 처리 필요 |
| **Choreography** | 5-15ms (시작) | 50-200ms | 비동기 처리 가능 |

### 패턴별 특성
**Orchestration 장점**:
- 즉시 완료 응답
- 단순한 에러 처리
- 쉬운 디버깅

**Choreography 장점**:  
- 빠른 초기 응답
- 높은 확장성
- 독립적인 서비스 배포

### 동시 처리
현재 구현은 메모리 기반으로 동시성 제한이 있습니다:
- 권장 동시 요청: 100 TPS 이하
- 실제 운영 시 데이터베이스 연결 풀 고려 필요

### 타임아웃
- **Orchestration**: 30초 (NestJS 기본값)
- **Choreography**: 초기 응답 즉시, 개별 핸들러별 타임아웃

## 🔧 개발 환경 설정

### 테스트 데이터 초기화
시스템은 다음 테스트 데이터로 초기화됩니다:

**사용자**
- `user-123`: 잔액 1000, 활성 상태
- `user-456`: 잔액 50, 활성 상태  
- `user-suspended`: 잔액 1000, 정지 상태

**아이템**
- `item-sword`: 가격 100, 재고 50개
- `item-potion`: 가격 20, 재고 100개
- `item-out-of-stock`: 가격 500, 재고 0개
- `item-disabled`: 가격 50, 비활성화됨

### 패턴별 실행 방법
각 패턴에 따른 애플리케이션 실행:

```bash
# Orchestration 모드로 실행 (기본값)
SAGA_PATTERN_MODE=orchestration npm run start:dev

# Choreography 모드로 실행  
SAGA_PATTERN_MODE=choreography npm run start:dev

# 일반 실행 (환경변수 설정 없음 = orchestration)
npm run start:dev
```

### 로그 확인
애플리케이션 로그를 통해 패턴별 처리 과정을 확인할 수 있습니다:

```bash
# Orchestration 모드 로그 예시
[Nest] OrchestratorModule: Current saga pattern mode = orchestration
✅ ORCHESTRATION MODE: Registered 14 monitoring event handlers
⏸️ Choreography handlers DISABLED (Orchestration mode active)

# Choreography 모드 로그 예시  
[Nest] ChoreographyModule: Current saga pattern mode = choreography
✅ CHOREOGRAPHY MODE: All event handlers registered successfully
⏸️ Orchestration handlers DISABLED (Choreography mode active)
```

### 트러블슈팅
**무한 루프 문제 해결됨**: 이전 버전에서 발생했던 두 패턴 간 이벤트 충돌 문제가 완전히 해결되었습니다.

- ✅ **패턴 분리**: 활성 패턴에 따른 핸들러만 등록
- ✅ **충돌 방지**: 비활성 패턴의 핸들러 완전 비활성화  
- ✅ **안전한 전환**: 런타임 및 재시작 기반 패턴 전환 지원

---

**다음 가이드**: [설치 및 실행 가이드](./INSTALLATION.md)