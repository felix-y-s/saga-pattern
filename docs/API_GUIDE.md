# API 사용 가이드

Saga 패턴 기반 아이템 구매 시스템의 REST API 사용 가이드입니다.

## 📋 목차

- [기본 정보](#기본-정보)
- [구매 API](#구매-api)
- [모니터링 API](#모니터링-api)
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

### **POST /purchase**
Saga 패턴을 통한 아이템 구매를 실행합니다.

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

## 📊 모니터링 API

### **GET /saga/{transactionId}**
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

### **GET /sagas/stats**
전체 Saga 통계를 조회합니다.

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

### 1️⃣ **정상 구매 플로우**

```bash
# 1. 구매 요청
curl -X POST http://localhost:3000/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "itemId": "item-sword",
    "quantity": 1,
    "price": 100
  }'

# 응답: success: true, transactionId: "TXN_..."

# 2. 상태 확인  
curl http://localhost:3000/saga/TXN_1734014402456_abc123

# 응답: 완료된 Saga 상태 정보
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

### 3️⃣ **모니터링 플로우**

```bash
# 1. 전체 통계 확인
curl http://localhost:3000/sagas/stats

# 2. 특정 트랜잭션 추적
curl http://localhost:3000/saga/TXN_1734014402456_abc123

# 3. 수동 보상 (필요 시)
curl -X POST http://localhost:3000/compensate/TXN_1734014402456_abc123
```

### 4️⃣ **시스템 테스트**

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

### 응답 시간
- **정상 구매**: 평균 50-100ms
- **실패 구매**: 평균 20-50ms (빠른 실패)
- **보상 포함**: 평균 100-200ms

### 동시 처리
현재 구현은 메모리 기반으로 동시성 제한이 있습니다:
- 권장 동시 요청: 100 TPS 이하
- 실제 운영 시 데이터베이스 연결 풀 고려 필요

### 타임아웃
기본 응답 타임아웃: 30초 (NestJS 기본값)

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

### 로그 확인
애플리케이션 로그를 통해 상세한 처리 과정을 확인할 수 있습니다:
```bash
npm run start:dev
# 또는
npm run start
```

---

**다음 가이드**: [설치 및 실행 가이드](./INSTALLATION.md)