# AggregateID vs TransactionID 완벽 가이드

## 📋 개요

Event Sourcing과 DDD(Domain-Driven Design)에서 `aggregateId`와 `transactionId`는 서로 다른 목적을 가진 식별자입니다. 이 문서에서는 두 개념의 차이점과 실제 사용 사례를 설명합니다.

## 🎯 핵심 개념

### AggregateID
- **정의**: 일관성 경계를 가진 도메인 객체 클러스터의 식별자
- **목적**: Event Store에서 이벤트 스트림을 그룹핑하는 키
- **범위**: 도메인 모델 관점 (사용자, 상품, 주문, 결제 등)

### TransactionID  
- **정의**: 비즈니스 프로세스나 워크플로우를 추적하는 식별자
- **목적**: 분산 트랜잭션의 전체 과정을 추적
- **범위**: 비즈니스 프로세스 관점 (구매, 환불, 교환 등)

## 🏠 쉬운 이해를 위한 비유

### Aggregate = "한 묶음으로 관리해야 하는 것들"

**집 짓기 비유**:
```
집 = Aggregate
├── 방 (침실, 거실, 주방)
├── 문과 창문  
└── 지붕

왜 한 묶음일까?
- 방 하나만 먼저 지을 수 없음 (다 함께 지어야 함)
- 지붕 없이 집이 완성될 수 없음
- 모든 부분이 조화롭게 맞아야 함
```

**온라인 쇼핑 비유**:
```
주문서 #123 = Aggregate
├── 상품1: 신발 (50,000원)
├── 상품2: 모자 (20,000원)  
├── 배송비: 3,000원
└── 총액: 73,000원 ← 일관성이 중요!

규칙: 총액 = 상품가격들의 합 + 배송비
```

## 📊 관계 패턴

### 1. 1:N 관계 (TransactionID 1개 → AggregateID 여러개)

**온라인 쇼핑 예시**:
```typescript
transactionId: "purchase-123"  // 하나의 구매 과정

// 여러 Aggregate에 영향
UserAccountEvent { 
  aggregateId: "user-456", 
  transactionId: "purchase-123" 
}
InventoryEvent { 
  aggregateId: "product-789", 
  transactionId: "purchase-123" 
}
PaymentEvent { 
  aggregateId: "payment-101", 
  transactionId: "purchase-123" 
}
ShippingEvent { 
  aggregateId: "shipping-202", 
  transactionId: "purchase-123" 
}
```

### 2. N:1 관계 (AggregateID 1개 → TransactionID 여러개)

**은행 계좌 예시**:
```typescript
aggregateId: "account-홍길동"  // 홍길동의 계좌

// 여러 거래가 같은 계좌에 영향
DepositEvent { 
  aggregateId: "account-홍길동", 
  transactionId: "salary-202412" 
}
WithdrawEvent { 
  aggregateId: "account-홍길동", 
  transactionId: "coffee-purchase-001" 
}
WithdrawEvent { 
  aggregateId: "account-홍길동", 
  transactionId: "online-shopping-456" 
}
```

**창고 재고 예시**:
```typescript
aggregateId: "warehouse-555"  // 하나의 창고

// 여러 비즈니스 트랜잭션이 같은 창고에 영향
StockInEvent { 
  aggregateId: "warehouse-555", 
  transactionId: "delivery-001" 
}
StockOutEvent { 
  aggregateId: "warehouse-555", 
  transactionId: "order-101" 
}
```

## 🔍 실제 사용 사례

### 복합 결제 시스템

**포인트 + 카드 결제**:
```typescript
// 하나의 구매 과정
transactionId: "purchase-999"

// 두 개의 독립적인 Aggregate
PointDeductedEvent {
  aggregateId: "point-account-123",  // 포인트 시스템
  transactionId: "purchase-999",
  amount: -10000
}

CardChargedEvent {
  aggregateId: "card-456",           // 카드 시스템
  transactionId: "purchase-999", 
  amount: -40000
}
```

**분리하는 이유**:
- 포인트 시스템과 카드 시스템은 독립적
- 하나가 실패해도 다른 하나에 영향 없음
- 각각 다른 데이터베이스/서버에서 관리

### 마이크로서비스 환경

```typescript
// 분산 트랜잭션
transactionId: "purchase-flow-789"

// 각 서비스의 독립적인 Aggregate
// User Service
UserValidatedEvent { 
  aggregateId: "user-123", 
  transactionId: "purchase-flow-789" 
}

// Inventory Service  
ItemReservedEvent { 
  aggregateId: "product-456", 
  transactionId: "purchase-flow-789" 
}

// Payment Service
PaymentProcessedEvent { 
  aggregateId: "payment-session-789", 
  transactionId: "purchase-flow-789" 
}
```

### 장바구니 구매 (Multi-Item)

```typescript
transactionId: "cart-checkout-999"  // 전체 체크아웃

// 각 상품별 Aggregate
ItemPurchasedEvent { 
  aggregateId: "item-001", 
  transactionId: "cart-checkout-999" 
}
ItemPurchasedEvent { 
  aggregateId: "item-002", 
  transactionId: "cart-checkout-999" 
}
ItemPurchasedEvent { 
  aggregateId: "item-003", 
  transactionId: "cart-checkout-999" 
}
```

## 📈 Event Store 활용 패턴

### 조회 패턴

```typescript
// 패턴 1: 비즈니스 프로세스 전체 추적
const events = eventStore.getByTransactionId("purchase-123");
// → 한 번의 구매에서 일어난 모든 이벤트들

// 패턴 2: 특정 도메인 객체의 변경 이력
const events = eventStore.getByAggregateId("account-홍길동");  
// → 홍길동 계좌에서 일어난 모든 거래들
```

### 감사(Audit) 요구사항

```typescript
// 질문 1: "이 주문에서 뭐가 일어났나?"
// → transactionId로 조회하여 전체 프로세스 파악

// 질문 2: "이 계좌에서 어떤 거래들이 있었나?"  
// → aggregateId로 조회하여 특정 계좌의 모든 활동 확인
```

## ⚡ 성능 최적화

### Event Store 스트림 분리

```typescript
// Aggregate별 스트림 분리로 동시성 제어
eventStore.getStream("user-123");      // 사용자 관련 이벤트만
eventStore.getStream("product-456");   // 상품 관련 이벤트만

// 비즈니스 프로세스 전체 추적
sagaRepository.findByTransactionId("purchase-flow-789");
```

## 🔧 도메인 리팩토링 시 고려사항

```typescript
// 초기: 단일 Purchase Aggregate
aggregateId: "purchase-123"
transactionId: "purchase-123"

// 리팩토링 후: 도메인 분리
// transactionId는 유지하되 aggregateId는 분리
UserEvent { 
  aggregateId: "user-456", 
  transactionId: "purchase-123" 
}
OrderEvent { 
  aggregateId: "order-789", 
  transactionId: "purchase-123" 
}
PaymentEvent { 
  aggregateId: "payment-101", 
  transactionId: "purchase-123" 
}
```

## 🎯 설계 가이드라인

### Aggregate 식별 방법

1. **불변조건(Invariant) 기준**
   ```typescript
   // 주문에서 지켜야 할 불변조건:
   // "총 주문 금액 = 각 아이템 가격의 합"
   // → Order와 OrderItem이 같은 Aggregate
   ```

2. **트랜잭션 경계 기준**
   ```typescript
   // 함께 변경되어야 하는 것들 = 같은 Aggregate
   // 독립적으로 변경될 수 있는 것들 = 다른 Aggregate
   ```

3. **동시성 제어 기준**
   ```typescript
   // 동시 접근을 제어해야 하는 범위 = 같은 Aggregate
   ```

### 언제 분리해야 할까?

다음 상황에서 aggregateId와 transactionId 분리가 필요:

- **1:N 관계**: 하나의 트랜잭션 → 여러 Aggregate
- **N:1 관계**: 여러 트랜잭션 → 하나의 Aggregate  
- **마이크로서비스**: 분산 환경에서 도메인 경계 분리
- **성능**: Event Store 스트림 최적화
- **확장성**: 시스템 복잡도 증가 대비

## 💡 현실적인 조언

### 간단한 시스템
단순한 시스템이라면 `transactionId`만 사용해도 충분합니다.

### 복잡한 시스템  
확장성을 고려한다면 처음부터 분리해두는 것을 권장합니다.

### YAGNI 원칙
"You Aren't Gonna Need It" - 실제 필요할 때 추가하는 것도 좋은 전략입니다.

## 📚 참고사항

- Event Sourcing 패턴에서 핵심 개념
- DDD(Domain-Driven Design)의 Aggregate 개념과 연관
- 마이크로서비스 아키텍처에서 특히 중요
- Saga 패턴에서 트랜잭션 관리에 활용

---

**작성일**: 2024년 12월
**버전**: 1.0