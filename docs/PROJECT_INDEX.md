# 🗂️ NestJS Saga Pattern - 프로젝트 인덱스 & 내비게이션

## 📖 빠른 시작

| 리소스 | 설명 | 링크 |
|--------|------|------|
| **메인 README** | 프로젝트 개요 및 이중 패턴 아키텍처 | [README.md](./README.md) |
| **설치 가이드** | 설정 및 설치 안내 | [INSTALLATION.md](./INSTALLATION.md) |
| **API 가이드** | 완전한 API 문서 및 예제 | [API_GUIDE.md](./API_GUIDE.md) |
| **아키텍처 맵** | 시스템 구조 및 컴포넌트 다이어그램 | [#아키텍처-개요](#아키텍처-개요) |

## 🎯 문서 카테고리

### 📚 **핵심 가이드**
- [📋 **README.md**](./README.md) - 이중 패턴 개요가 포함된 메인 프로젝트 문서
- [🚀 **INSTALLATION.md**](./INSTALLATION.md) - 설정, 구성 및 실행 가이드
- [🌐 **API_GUIDE.md**](./API_GUIDE.md) - REST API 엔드포인트 및 사용 예제

### 🎭 **패턴별 가이드**
- [🎪 **CHOREOGRAPHY_GUIDE.md**](./CHOREOGRAPHY_GUIDE.md) - 이벤트 기반 코레오그래피 패턴 심화 학습
- [🚌 **EVENTBUS_GUIDE.md**](./EVENTBUS_GUIDE.md) - 이벤트 시스템 아키텍처 및 사용법
- [🏢 **DOMAIN_SERVICES_GUIDE.md**](./DOMAIN_SERVICES_GUIDE.md) - 비즈니스 로직 서비스 문서

### 🧪 **개발 & 테스트**
- [🧪 **TESTING_GUIDE.md**](./TESTING_GUIDE.md) - 테스트 시나리오 및 품질 보증
- [📊 **코드 메트릭**](#코드-메트릭) - 프로젝트 통계 및 분석
- [🔧 **개발자 가이드**](#개발자-가이드) - 개발 워크플로우 및 규칙

## 🏗️ 아키텍처 개요

### 시스템 구조
```
┌─────────────────────────────────────┐
│           NestJS 애플리케이션        │
├─────────────────────────────────────┤
│  🎭 이중 패턴 아키텍처              │
│  ├─ Orchestration (중앙집중식)      │
│  └─ Choreography (분산처리)         │
├─────────────────────────────────────┤
│  🚌 EventBus 시스템                │
│  ├─ 이벤트 발행                     │
│  └─ 이벤트 구독                     │
├─────────────────────────────────────┤
│  🏢 도메인 서비스                   │
│  ├─ UserService                    │
│  ├─ ItemService                    │
│  ├─ LogService                     │
│  └─ NotificationService            │
├─────────────────────────────────────┤
│  💾 상태 관리                       │
│  └─ SagaRepository                 │
└─────────────────────────────────────┘
```

### 핵심 컴포넌트 맵

#### 🎭 **패턴 제어**
| 컴포넌트 | 위치 | 목적 |
|----------|------|------|
| **SagaPatternConfig** | `src/config/saga-pattern.config.ts` | 런타임 패턴 전환 |
| **OrchestrationMode** | `src/orchestrator/` | 중앙 제어 패턴 |
| **ChoreographyMode** | `src/choreography/` | 이벤트 기반 패턴 |

#### 🚌 **이벤트 시스템**
| 컴포넌트 | 위치 | 목적 |
|----------|------|------|
| **EventBus** | `src/events/event-bus.service.ts` | 핵심 이벤트 발행/구독 |
| **EventFactory** | `src/events/event-factory.ts` | 이벤트 생성 유틸리티 |
| **PurchaseEvents** | `src/events/purchase-events.ts` | 도메인별 이벤트 정의 |

#### 🏢 **비즈니스 로직**
| 컴포넌트 | 위치 | 목적 |
|----------|------|------|
| **UserService** | `src/services/user.service.ts` | 사용자 검증 및 잔액 관리 |
| **ItemService** | `src/services/item.service.ts` | 아이템 관리 및 인벤토리 |
| **LogService** | `src/services/log.service.ts` | 거래 로깅 |
| **NotificationService** | `src/services/notification.service.ts` | 사용자 알림 |

## 📁 파일 구조 심화 분석

### 소스코드 구성
```
src/
├── 🎮 app.controller.ts          # 메인 API 엔드포인트 (620+ 라인)
├── 🏗️ app.module.ts             # 루트 모듈 구성
├── ⚙️ config/
│   └── saga-pattern.config.ts   # 패턴 전환 로직
├── 🎪 choreography/              # 이벤트 기반 패턴
│   ├── handlers/                # 독립 이벤트 핸들러
│   │   ├── user-validation.handler.ts
│   │   ├── item-grant.handler.ts
│   │   ├── log-record.handler.ts
│   │   ├── notification.handler.ts
│   │   └── compensation.handler.ts
│   ├── purchase-coordinator.service.ts
│   └── choreography.module.ts
├── 📦 dtos/                     # 데이터 전송 객체
│   └── purchase-request.dto.ts
├── 🚌 events/                   # 이벤트 시스템
│   ├── interfaces/              # 이벤트 계약
│   ├── event-bus.service.ts
│   ├── event-factory.ts
│   └── purchase-events.ts
├── 🔗 interfaces/               # 도메인 인터페이스
│   └── domain-services.interface.ts
├── 🎭 orchestrator/             # 중앙집중식 패턴
│   ├── event-handlers/          # 오케스트레이션 핸들러
│   ├── interfaces/              # Saga 계약
│   ├── item-purchase-orchestrator.service.ts
│   ├── saga-repository.service.ts
│   └── orchestrator.module.ts
└── 🏢 services/                 # 도메인 서비스
    ├── user.service.ts
    ├── item.service.ts
    ├── log.service.ts
    ├── notification.service.ts
    └── services.module.ts
```

### 문서 구조
```
docs/
├── 📋 README.md                  # 메인 문서
├── 🚀 INSTALLATION.md           # 설치 가이드
├── 🌐 API_GUIDE.md              # API 문서
├── 🎪 CHOREOGRAPHY_GUIDE.md     # 패턴별 가이드
├── 🚌 EVENTBUS_GUIDE.md         # 이벤트 시스템 가이드
├── 🏢 DOMAIN_SERVICES_GUIDE.md  # 서비스 문서
├── 🧪 TESTING_GUIDE.md          # 테스트 시나리오
└── 🗂️ PROJECT_INDEX.md          # 이 내비게이션 파일
```

## 🔍 컴포넌트 직접 링크

### 카테고리별 API 엔드포인트
- **구매 API**
  - [Orchestration 구매](./API_GUIDE.md#orchestration-api) - `POST /purchase`
  - [Choreography 구매](./API_GUIDE.md#choreography-api) - `POST /purchase/choreography`
- **모니터링 API**
  - [Saga 상태](./API_GUIDE.md#orchestration-모니터링) - `GET /saga/{id}`
  - [트랜잭션 상태](./API_GUIDE.md#choreography-모니터링) - `GET /choreography/transaction/{id}`
- **설정 API**
  - [패턴 설정](./API_GUIDE.md#패턴-설정-api) - `GET/POST /config/saga-mode`

### 이벤트 플로우 문서
- [Orchestration 플로우](./README.md#orchestration-패턴-플로우)
- [Choreography 플로우](./CHOREOGRAPHY_GUIDE.md#이벤트-플로우)
- [보상 플로우](./CHOREOGRAPHY_GUIDE.md#보상-트랜잭션)

### 핸들러 문서
- [독립 핸들러](./CHOREOGRAPHY_GUIDE.md#독립-핸들러)
- [이벤트 구독](./EVENTBUS_GUIDE.md#이벤트-구독)
- [에러 처리](./CHOREOGRAPHY_GUIDE.md#디버깅-가이드)

## 📊 코드 메트릭

### 프로젝트 통계
- **전체 파일**: 39개 TypeScript 파일
- **소스 라인**: 약 8,000+ 라인
- **테스트 파일**: 7개 spec 파일  
- **문서**: 7개 종합 가이드

### 컴포넌트 분포
| 레이어 | 파일 수 | 예상 LOC | 커버리지 |
|--------|---------|----------|----------|
| **컨트롤러** | 1 | 620+ | 완전한 API 표면 |
| **서비스** | 4 | 800+ | 핵심 비즈니스 로직 |
| **오케스트레이터** | 8 | 1,200+ | 중앙집중식 패턴 |
| **코레오그래피** | 6 | 1,000+ | 이벤트 기반 패턴 |
| **이벤트** | 6 | 600+ | 이벤트 인프라 |
| **인터페이스** | 6 | 400+ | 타입 정의 |

### 패턴 구현 현황
- **Orchestration**: ✅ 보상 기능 포함 완전 구현
- **Choreography**: ✅ 이벤트 체인 독립 핸들러
- **패턴 전환**: ✅ 런타임 설정 지원
- **충돌 해결**: ✅ 상호 배제 강제 적용

## 🛠️ 개발자 가이드

### 개발 워크플로우
1. **설정**: [INSTALLATION.md](./INSTALLATION.md) 따르기
2. **패턴 선택**: `SAGA_PATTERN_MODE` 환경 변수로 설정
3. **테스트**: [TESTING_GUIDE.md](./TESTING_GUIDE.md) 시나리오 사용
4. **API 사용**: [API_GUIDE.md](./API_GUIDE.md) 예제 참조

### 주요 개발 명령어
```bash
# Orchestration 모드로 시작 (기본값)
SAGA_PATTERN_MODE=orchestration npm run start:dev

# Choreography 모드로 시작
SAGA_PATTERN_MODE=choreography npm run start:dev

# 테스트 실행
npm test

# 프로젝트 빌드
npm run build

# 코드 린트
npm run lint
```

### 확장 포인트
- **새 이벤트 핸들러**: `src/choreography/handlers/`에 추가
- **새 서비스**: `src/services/`에 추가
- **새 이벤트**: `src/events/purchase-events.ts`에 정의
- **새 패턴**: `src/config/saga-pattern.config.ts`에서 설정 확장

## 🚨 트러블슈팅 빠른 참조

### 일반적인 문제
| 문제 | 해결책 | 참조 |
|------|--------|------|
| **무한 루프** | ✅ **해결됨** - 패턴 충돌 감지 | [API_GUIDE.md](./API_GUIDE.md#트러블슈팅) |
| **이벤트 미처리** | 핸들러 등록 로그 확인 | [CHOREOGRAPHY_GUIDE.md](./CHOREOGRAPHY_GUIDE.md#디버깅-가이드) |
| **패턴 전환 안됨** | 완전 활성화를 위해 재시작 필요 | [API_GUIDE.md](./API_GUIDE.md#패턴-전환-설정) |

### 디버그 로그
- **패턴 감지**: 모듈 초기화 로그에서 활성 패턴 표시
- **이벤트 플로우**: 핸들러 로그에서 처리 체인 확인
- **에러 상세**: 컨텍스트 포함 종합 에러 메시지

## 📈 버전 히스토리

### 현재 버전: 2.0.0
- ✅ **이중 패턴 아키텍처** - Orchestration & Choreography 모두 구현
- ✅ **이벤트 충돌 해결** - 무한 루프 문제 완전 해결
- ✅ **종합 문서** - 완전한 API 및 패턴 가이드
- ✅ **패턴 전환** - 런타임 및 시작시 설정

### 향후 개선사항
- **데이터베이스 통합** - 인메모리 저장소 대체
- **분산 배포** - 마이크로서비스 아키텍처 지원
- **고급 모니터링** - 메트릭 및 관찰 기능
- **성능 최적화** - 캐싱 및 배치 처리

## 🤝 기여하기

### 문서 업데이트
1. **파일 변경**: `docs/` 디렉터리의 관련 가이드 업데이트
2. **새 기능**: 적절한 가이드에 문서 추가
3. **API 변경**: [API_GUIDE.md](./API_GUIDE.md) 업데이트
4. **인덱스 업데이트**: 내비게이션 변경시 이 파일 수정

### 코드 기여
1. 기존 패턴과 규칙 준수
2. 새 기능에 대한 종합 테스트 추가
3. API 변경시 문서 업데이트
4. 두 패턴 모두 계속 작동하는지 확인

---

**📍 내비게이션**: [🏠 홈](./README.md) | [🚀 시작하기](./INSTALLATION.md) | [🌐 API 문서](./API_GUIDE.md) | [🎪 코레오그래피](./CHOREOGRAPHY_GUIDE.md)

**최종 업데이트**: 2024년 12월 | **버전**: 2.0.0 | **상태**: ✅ 프로덕션 준비 완료