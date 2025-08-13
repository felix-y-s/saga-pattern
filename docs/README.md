# Saga Pattern 기반 아이템 구매 시스템

NestJS를 사용하여 구현한 **Orchestration & Choreography(코레오그래피) Saga Pattern** 기반의 분산 트랜잭션 시스템입니다.
- Orchestration: 중앙 집중식
- Choreography: 분산 이벤트

## 📖 목차

- [시스템 개요](#-시스템-개요)
- [아키텍처](#️-아키텍처)
- [이벤트 플로우](#-이벤트-플로우)
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
- 🎯 **이중 패턴 지원**: Orchestration과 Choreography 패턴 모두 구현
- ✅ **자동 보상 트랜잭션**: 실패 시 자동으로 이전 단계들을 롤백
- ✅ **이벤트 기반 아키텍처**: 각 단계별로 이벤트 발행 및 처리
- ✅ **완전한 상태 관리**: Saga 진행 상황과 결과를 추적 및 저장
- 🔄 **패턴 전환**: 환경 변수를 통한 런타임 패턴 선택
- 🛡️ **충돌 방지**: 두 패턴 간 이벤트 충돌 완전 해결

## 🏗️ 아키텍처

### 🎭 이중 패턴 아키텍처 (Orchestration & Choreography)

```
┌─────────────────────────────────────────────────────────────┐
│                    Purchase Request                         │
└─────────────────┬──────────────────┬────────────────────────┘
                  │                  │
      ┌───────────▼──────────┐    ┌──▼─────────────────────┐
      │  ORCHESTRATION MODE  │    │   CHOREOGRAPHY MODE    │
      │   (중앙 집중식)         │    │   (분산 이벤트 기반)       │
      └───────────┬──────────┘    └──┬─────────────────────┘
                  │                  │
  ┌───────────────▼─────────────┐    │  ┌─────────────────────────────┐
  │ ItemPurchaseOrchestrator    │    │  │    Independent Handlers     │
  │ (전체 워크플로우 제어)           │    │  │   (독립적 이벤트 처리)           │
  └─────────────────────────────┘    │  └─────────────────────────────┘
                  │                  │              │
                  │         ┌────────▼────────┐     │
                  │         │ Pattern Config  │     │
                  │         │ (동적 전환 제어)   │     │
                  │         └─────────────────┘     │
                  │                                 │
    ┌─────────────▼─────────────────────────────────▼───────────┐
    │                   EventBus System                         │
    │              (통합 이벤트 발행/구독)                           │
    └─────────────────────┬─────────────────────────────────────┘
                          │
    ┌─────────────────────▼─────────────────────────────────────┐
    │                 Domain Services                           │
    ├─────────────┬──────────────┬────────────┬─────────────────┤
    │ UserService │ ItemService  │ LogService │ NotificationService    │
    │ (사용자검증)   │ (아이템지급)    │ (로그기록)   │   (알림발송)      │
    └─────────────┴──────────────┴────────────┴─────────────────┘
                          │
           ┌──────────────▼──────────────┐
           │      SagaRepository         │
           │      (상태 저장소)             │
           └─────────────────────────────┘
```

### 컴포넌트 구성

#### 🎯 **패턴 제어 레이어**
- **SagaPatternConfig**: 런타임 패턴 전환 제어
- **Pattern Mode Detection**: 환경 변수 기반 모드 감지
- **Event Handler Routing**: 활성 패턴에 따른 핸들러 등록

#### 🎭 **Orchestration 레이어**
- **ItemPurchaseOrchestrator**: Saga 워크플로우 중앙 관리
- **PurchaseOrchestrationHandler**: PurchaseInitiated 이벤트 처리
- **직접 서비스 호출**: 중앙집중식 비즈니스 로직 실행

#### 🎪 **Choreography 레이어**
- **PurchaseCoordinatorService**: 초기 이벤트 발행만 담당
- **UserValidationHandler**: 사용자 검증 독립 처리
- **ItemGrantHandler**: 아이템 지급 독립 처리
- **LogRecordHandler**: 로그 기록 독립 처리
- **NotificationHandler**: 알림 발송 독립 처리
- **CompensationHandler**: 보상 트랜잭션 독립 처리

#### 🚌 **이벤트 레이어**  
- **EventBus**: 통합 이벤트 발행/구독 시스템
- **PurchaseEventHandler**: 구매 관련 이벤트 모니터링
- **14개 이벤트 타입**: 각 단계별 성공/실패 이벤트

#### 🏢 **도메인 서비스 레이어**
- **UserService**: 사용자 잔액 관리 및 검증 + 보상
- **ItemService**: 아이템 재고 관리 및 지급 + 보상
- **LogService**: 구매 로그 기록 및 조회
- **NotificationService**: 다채널 알림 발송

#### 💾 **데이터 레이어**
- **SagaRepository**: Saga 상태 저장 및 조회
- **패턴 무관 공유**: 두 패턴 모두 동일한 상태 저장소 사용

## 🔄 Saga 상태 전환

```
[시작] → PENDING → IN_PROGRESS → COMPLETED [성공]
                        ↓
                      FAILED → COMPENSATING → COMPENSATED [실패후보상]
```

## 📊 이벤트 플로우

### 🎭 Orchestration 패턴 플로우
**중앙집중식**: 오케스트레이터가 각 단계를 순차적으로 실행

```
[Controller] → [Orchestrator] → [UserService] → [ItemService] → [LogService] → [NotificationService]
     ↓               ↓              ↓             ↓              ↓               ↓
   Request         Direct          Success       Success        Success         Success
     ↓            Calls             ↓             ↓              ↓               ↓
   Response      PurchaseCompleted Event      Event          Event           Event
```

### 🎪 Choreography 패턴 플로우
**분산 이벤트 기반**: 독립 핸들러들이 이벤트 체인으로 연결

```
PurchaseInitiated → UserValidationHandler → UserValidated
                                                ↓
LogRecorded ← LogRecordHandler ← ItemGranted ← ItemGrantHandler
    ↓
NotificationHandler → NotificationSent → PurchaseCompleted
```

### 🔄 보상 플로우 (두 패턴 공통)
**실패 시 자동 보상**: 성공한 단계들을 역순으로 롤백

```
ItemGrantFailed → CompensationHandler → [UserService.compensate] 
                        ↓                      ↓
              CompensationCompleted ← User Balance Restored
                        ↓
                  PurchaseFailed
```

## 🛠️ 기술 스택

- **Framework**: NestJS 11.x
- **Language**: TypeScript 5.x
- **Testing**: Jest 30.x
- **Architecture**: Dual Saga Pattern (Orchestration & Choreography)
- **Event System**: Custom EventBus Implementation
- **Pattern Control**: Environment-based Configuration

## 📁 프로젝트 구조

```
src/
├── config/                # 패턴 설정
│   └── saga-pattern.config.ts  # 런타임 패턴 전환 설정
├── orchestrator/           # Saga 오케스트레이터 (중앙집중식)
│   ├── interfaces/        # Saga 상태 및 인터페이스 정의
│   ├── event-handlers/    # 오케스트레이션 이벤트 핸들러
│   └── *.service.ts       # 오케스트레이터 서비스들
├── choreography/          # 독립 이벤트 핸들러 (분산 방식)
│   ├── handlers/          # 각 단계별 독립 핸들러
│   │   ├── user-validation.handler.ts
│   │   ├── item-grant.handler.ts
│   │   ├── log-record.handler.ts
│   │   ├── notification.handler.ts
│   │   └── compensation.handler.ts
│   ├── purchase-coordinator.service.ts
│   └── choreography.module.ts
├── events/                # 이벤트 시스템
│   ├── interfaces/        # 이벤트 인터페이스
│   ├── event-bus.service.ts
│   └── purchase-events.ts
├── services/              # 도메인 서비스 (공통)
│   ├── user.service.ts    # 검증 + 보상 로직
│   ├── item.service.ts    # 지급 + 보상 로직
│   ├── log.service.ts
│   └── notification.service.ts
├── dtos/                  # 데이터 전송 객체
└── interfaces/            # 도메인 인터페이스
```

## ⚙️ 패턴 전환 설정

### 🔄 환경 변수 설정
```bash
# Orchestration 모드 (기본값)
SAGA_PATTERN_MODE=orchestration npm run start:dev

# Choreography 모드  
SAGA_PATTERN_MODE=choreography npm run start:dev
```

### 🎯 런타임 패턴 확인
```bash
# 현재 패턴 모드 확인
curl http://localhost:3000/config/saga-mode

# 패턴 비교 정보 확인  
curl http://localhost:3000/patterns/comparison
```

### ⚠️ 주요 특징
- **상호 배타적**: 한 번에 하나의 패턴만 활성화
- **이벤트 충돌 방지**: 비활성 패턴의 핸들러는 완전히 비활성화
- **공유 저장소**: 두 패턴 모두 동일한 SagaRepository 사용
- **일관된 API**: 동일한 도메인 서비스와 이벤트 시스템 활용

## 🚀 빠른 시작

자세한 내용은 각 섹션별 가이드를 참조하세요:

- [설치 및 실행 가이드](./INSTALLATION.md)
- [API 사용 가이드](./API_GUIDE.md) - **업데이트됨**: 코레오그래피 API 추가
- [**Choreography 패턴 가이드**](./CHOREOGRAPHY_GUIDE.md) - **신규**: 분산 이벤트 기반 구현 상세
- [EventBus 시스템 가이드](./EVENTBUS_GUIDE.md)
- [도메인 서비스 가이드](./DOMAIN_SERVICES_GUIDE.md)
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
**문서 버전**: 2.0.0
**최종 업데이트**: 2025년 8월 (Choreography Pattern 추가, 무한 루프 해결)