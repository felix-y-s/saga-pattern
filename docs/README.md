# Saga Pattern 기반 아이템 구매 시스템

NestJS를 사용하여 구현한 **Orchestration Saga Pattern** 기반의 분산 트랜잭션 시스템입니다.

## 📖 목차

- [시스템 개요](#시스템-개요)
- [아키텍처](#아키텍처)
- [핵심 컴포넌트](#핵심-컴포넌트)
- [설치 및 실행](#설치-및-실행)
- [API 가이드](#api-가이드)
- [테스트](#테스트)

## 🎯 시스템 개요

본 시스템은 게임 내 아이템 구매 과정을 **Saga Pattern**으로 구현하여, 분산 트랜잭션의 일관성과 안정성을 보장합니다.

### 구매 프로세스
1. **사용자 검증**: 잔액 확인 및 차감
2. **아이템 지급**: 재고 확인 및 사용자 인벤토리에 추가
3. **로그 기록**: 구매 내역 저장
4. **알림 발송**: 사용자에게 완료 알림

### 핵심 특징
- ✅ **중앙집중식 오케스트레이션**: 단일 오케스트레이터가 전체 플로우 관리
- ✅ **자동 보상 트랜잭션**: 실패 시 자동으로 이전 단계들을 롤백
- ✅ **이벤트 기반 아키텍처**: 각 단계별로 이벤트 발행 및 처리
- ✅ **완전한 상태 관리**: Saga 진행 상황과 결과를 추적 및 저장

## 🏗️ 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                    Purchase Request                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────▼────────────────┐
         │    ItemPurchaseOrchestrator     │ ◄─── Saga 상태 관리
         │   (중앙 집중식 오케스트레이터)         │
         └────────┬───────────────┬────────┘
                  │               │
       ┌──────────▼──────────┐   │   ┌──────────────────┐
       │     EventBus        │   │   │ SagaRepository   │
       │  (이벤트 발행/구독)     │   │   │   (상태 저장소)     │
       └─────────────────────┘   │   └──────────────────┘
                                 │
    ┌────────────────────────────▼───────────────────────────┐
    │                 Domain Services                        │
    ├─────────────┬──────────────┬────────────┬──────────────┤
    │ UserService │ ItemService  │ LogService │ NotifService │
    │ (사용자검증)   │ (아이템지급)    │ (로그기록)   │   (알림발송)   │
    └─────────────┴──────────────┴────────────┴──────────────┘
```

### 컴포넌트 구성

#### 🎭 **오케스트레이터 레이어**
- **ItemPurchaseOrchestrator**: Saga 워크플로우 전체 관리
- **SagaRepository**: Saga 상태 저장 및 조회
- **SagaContext**: 상태 변경 및 컨텍스트 관리

#### 🚌 **이벤트 레이어**  
- **EventBus**: 이벤트 발행/구독 시스템
- **PurchaseEventHandler**: 구매 관련 이벤트 처리
- **14개 이벤트 타입**: 각 단계별 성공/실패 이벤트

#### 🏢 **도메인 서비스 레이어**
- **UserService**: 사용자 잔액 관리 및 검증
- **ItemService**: 아이템 재고 관리 및 지급
- **LogService**: 구매 로그 기록 및 조회
- **NotificationService**: 다채널 알림 발송

## 🔄 Saga 상태 전환

```
[시작] → PENDING → IN_PROGRESS → COMPLETED [성공]
                        ↓
                      FAILED → COMPENSATING → COMPENSATED [실패후보상]
```

## 📊 이벤트 플로우

### 성공 플로우
```
PurchaseInitiated → UserValidated → ItemGranted → 
LogRecorded → NotificationSent → PurchaseCompleted
```

### 실패 플로우 (아이템 지급 실패 시)
```
PurchaseInitiated → UserValidated → ItemGrantFailed → 
CompensationInitiated → CompensationCompleted → PurchaseFailed
```

## 🛠️ 기술 스택

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Testing**: Jest 30.x
- **Architecture**: Saga Pattern (Orchestration)
- **Event System**: Custom EventBus Implementation

## 📁 프로젝트 구조

```
src/
├── orchestrator/           # Saga 오케스트레이터
│   ├── interfaces/        # Saga 상태 및 인터페이스 정의
│   ├── event-handlers/    # 이벤트 핸들러
│   └── *.service.ts       # 오케스트레이터 서비스들
├── events/                # 이벤트 시스템
│   ├── interfaces/        # 이벤트 인터페이스
│   ├── event-bus.service.ts
│   └── purchase-events.ts
├── services/              # 도메인 서비스
│   ├── user.service.ts
│   ├── item.service.ts
│   ├── log.service.ts
│   └── notification.service.ts
├── dtos/                  # 데이터 전송 객체
└── interfaces/            # 도메인 인터페이스
```

## 🚀 빠른 시작

자세한 내용은 각 섹션별 가이드를 참조하세요:

- [설치 및 실행 가이드](./INSTALLATION.md)
- [API 사용 가이드](./API_GUIDE.md)
- [EventBus 시스템 가이드](./EVENTBUS_GUIDE.md)
- [도메인 서비스 가이드](./DOMAIN_SERVICES_GUIDE.md)
- [Saga 오케스트레이터 가이드](./ORCHESTRATOR_GUIDE.md)
- [테스트 시나리오 가이드](./TESTING_GUIDE.md)

## 📋 주요 기능

### ✨ 핵심 기능
- 🔄 **자동 보상 트랜잭션**: 실패 시 자동 롤백
- 📊 **실시간 상태 추적**: Saga 진행 상황 모니터링
- 🎯 **이벤트 기반 확장성**: 새로운 단계 쉽게 추가 가능
- 🛡️ **에러 처리**: 각 단계별 상세한 에러 정보 제공
- 📈 **메트릭 수집**: 성공/실패 통계 및 성능 모니터링

### 🔧 개발자 도구
- 📝 **완전한 타입 안전성**: TypeScript로 모든 컴포넌트 구현
- 🧪 **포괄적인 테스트**: 단위/통합 테스트 완벽 커버리지
- 📖 **상세한 로깅**: 각 단계별 디버깅 로그 제공
- 🎛️ **관리 API**: Saga 상태 조회 및 수동 보상 지원

## 🤝 기여하기

1. 이슈 생성 또는 기존 이슈 확인
2. 피처 브랜치 생성: `git checkout -b feature/new-feature`
3. 변경사항 커밋: `git commit -am 'Add some feature'`
4. 브랜치에 푸시: `git push origin feature/new-feature`
5. Pull Request 생성

## 📜 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다.

---

**개발팀**: NestJS Saga Pattern Implementation Team
**문의**: [이메일 주소]
**문서 버전**: 1.0.0
**최종 업데이트**: 2024년 12월