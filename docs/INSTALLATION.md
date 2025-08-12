# 설치 및 실행 가이드

Saga 패턴 기반 아이템 구매 시스템의 설치 및 실행 방법을 안내합니다.

## 📋 목차

- [시스템 요구사항](#시스템-요구사항)
- [설치](#설치)
- [실행](#실행)
- [테스트](#테스트)
- [개발 환경](#개발-환경)
- [문제 해결](#문제-해결)

## 💻 시스템 요구사항

### 필수 소프트웨어
- **Node.js**: 18.x 이상
- **npm**: 9.x 이상 (또는 yarn 3.x 이상)
- **Git**: 2.x 이상

### 권장 개발 환경
- **OS**: macOS, Linux, Windows 10+
- **IDE**: VS Code, WebStorm, 또는 선호하는 에디터
- **메모리**: 4GB RAM 이상
- **저장공간**: 1GB 이상 여유 공간

### 선택사항
- **Docker**: 컨테이너 환경 실행 시
- **Postman**: API 테스트용

## 🚀 설치

### 1️⃣ **프로젝트 클론**

```bash
# HTTPS로 클론
git clone https://github.com/your-username/nestjs-saga-pattern.git

# 또는 SSH로 클론  
git clone git@github.com:your-username/nestjs-saga-pattern.git

# 프로젝트 디렉토리로 이동
cd nestjs-saga-pattern
```

### 2️⃣ **의존성 설치**

```bash
# npm 사용
npm install

# 또는 yarn 사용
yarn install

# 또는 pnpm 사용 (권장)
pnpm install
```

### 3️⃣ **설치 확인**

```bash
# TypeScript 컴파일 확인
npm run build

# 출력 예시:
# > saga-pattern@0.0.1 build
# > nest build
# ✓ 빌드 완료
```

## ▶️ 실행

### 1️⃣ **개발 모드 실행**

```bash
# 개발 서버 시작 (핫 리로드 지원)
npm run start:dev

# 출력 예시:
# [Nest] 12345  - 2024/12/12, 2:20:00 PM   LOG [NestFactory] Starting Nest application...
# [Nest] 12345  - 2024/12/12, 2:20:00 PM   LOG [InstanceLoader] EventBusModule dependencies initialized
# [Nest] 12345  - 2024/12/12, 2:20:00 PM   LOG [InstanceLoader] ServicesModule dependencies initialized  
# [Nest] 12345  - 2024/12/12, 2:20:00 PM   LOG [InstanceLoader] OrchestratorModule dependencies initialized
# ✅ Registered 14 purchase event handlers
# [Nest] 12345  - 2024/12/12, 2:20:01 PM   LOG [NestApplication] Nest application successfully started
```

### 2️⃣ **프로덕션 모드 실행**

```bash
# 프로덕션 빌드
npm run build

# 프로덕션 서버 시작
npm run start:prod

# 출력 예시:
# [Nest] 12345  - 2024/12/12, 2:20:01 PM   LOG [NestApplication] Nest application successfully started
```

### 3️⃣ **디버그 모드 실행**

```bash
# 디버거 연결 가능한 모드로 시작
npm run start:debug

# 디버거는 포트 9229에서 대기
# Chrome DevTools 또는 VS Code에서 연결 가능
```

### 4️⃣ **실행 확인**

```bash
# 헬스 체크
curl http://localhost:3000

# 응답:
# "Hello World!"

# API 문서 확인 (브라우저)
open http://localhost:3000
```

## 🧪 테스트

### 1️⃣ **전체 테스트 실행**

```bash
# 모든 테스트 실행
npm test

# 출력 예시:
# PASS src/events/event-bus.service.spec.ts (10 tests)
# PASS src/services/user.service.spec.ts (7 tests)
# PASS src/services/item.service.spec.ts (7 tests) 
# PASS src/orchestrator/item-purchase-orchestrator.service.spec.ts (9 tests)
#
# Test Suites: 4 passed, 4 total
# Tests:       33 passed, 33 total
# Snapshots:   0 total
# Time:        5.234 s
```

### 2️⃣ **특정 테스트 실행**

```bash
# EventBus 테스트만 실행
npm test src/events

# 오케스트레이터 테스트만 실행  
npm test src/orchestrator

# 서비스 테스트만 실행
npm test src/services
```

### 3️⃣ **테스트 커버리지 확인**

```bash
# 커버리지 리포트 생성
npm run test:cov

# 출력 예시:
# ----------------------|---------|----------|---------|---------|-------------------
# File                  | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
# ----------------------|---------|----------|---------|---------|-------------------
# All files             |   94.23 |    89.12 |   96.87 |   94.01 |                  
#  events               |   96.15 |    91.66 |     100 |   95.83 |                  
#  services             |   93.75 |    87.50 |   95.23 |   93.42 |                  
#  orchestrator         |   92.85 |    88.23 |   96.15 |   92.59 |                  
# ----------------------|---------|----------|---------|---------|-------------------
```

### 4️⃣ **E2E 테스트 실행**

```bash
# End-to-End 테스트 실행
npm run test:e2e

# 출력 예시:
# PASS test/app.e2e-spec.ts
#   AppController (e2e)
#     ✓ / (GET)
#     ✓ /purchase (POST) - success
#     ✓ /purchase (POST) - failure
#     ✓ /saga/:id (GET)
```

## 🛠️ 개발 환경

### 1️⃣ **VS Code 설정**

추천 확장 프로그램:
- **TypeScript Importer**: 자동 import 관리
- **Prettier**: 코드 포매팅
- **ESLint**: 코드 품질 검사
- **Jest**: 테스트 지원
- **GitLens**: Git 히스토리 추적

### 2️⃣ **환경 변수 설정**

개발용 환경 변수 (선택사항):
```bash
# .env 파일 생성
cat > .env << EOF
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
EOF
```

### 3️⃣ **디버깅 설정**

VS Code 디버깅 설정 (`.vscode/launch.json`):
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug NestJS",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/src/main.ts",
      "args": [],
      "runtimeArgs": [
        "-r", "ts-node/register",
        "-r", "tsconfig-paths/register"
      ],
      "sourceMaps": true,
      "envFile": "${workspaceFolder}/.env",
      "cwd": "${workspaceRoot}",
      "console": "integratedTerminal",
      "restart": true
    }
  ]
}
```

### 4️⃣ **코드 포매팅**

```bash
# 코드 포매팅 실행
npm run format

# ESLint 검사 및 자동 수정
npm run lint
```

## 🐳 Docker 실행 (선택사항)

### Dockerfile 생성

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
```

### Docker 실행

```bash
# Docker 이미지 빌드
docker build -t nestjs-saga-pattern .

# 컨테이너 실행
docker run -p 3000:3000 nestjs-saga-pattern

# 백그라운드 실행
docker run -d -p 3000:3000 --name saga-app nestjs-saga-pattern
```

## 🔧 문제 해결

### 1️⃣ **일반적인 설치 문제**

#### Node.js 버전 문제
```bash
# 현재 Node.js 버전 확인
node --version

# 18.x 이상이 아닌 경우 업데이트 필요
# nvm 사용 (권장)
nvm install 18
nvm use 18
```

#### 의존성 설치 실패
```bash
# npm 캐시 클리어
npm cache clean --force

# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

#### 포트 충돌 문제
```bash
# 포트 3000이 사용 중인 경우
lsof -ti:3000 | xargs kill -9

# 또는 다른 포트 사용
PORT=3001 npm run start:dev
```

### 2️⃣ **빌드 문제**

#### TypeScript 컴파일 에러
```bash
# TypeScript 의존성 확인
npm ls typescript

# tsconfig.json 유효성 검사
npx tsc --noEmit
```

#### 메모리 부족 에러
```bash
# Node.js 메모리 한도 증가
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### 3️⃣ **테스트 문제**

#### Jest 실행 실패
```bash
# Jest 캐시 클리어
npm test -- --clearCache

# 단일 테스트 파일 실행으로 디버깅
npm test src/events/event-bus.service.spec.ts
```

#### 테스트 타임아웃
```bash
# 타임아웃 시간 증가
npm test -- --testTimeout=10000
```

### 4️⃣ **런타임 문제**

#### 애플리케이션 시작 실패
로그를 확인하여 구체적인 오류 파악:
```bash
# 상세 로그와 함께 실행
DEBUG=* npm run start:dev

# 또는 로그 레벨 조정
LOG_LEVEL=debug npm run start:dev
```

#### 메모리 누수
개발 환경에서 메모리 사용량 모니터링:
```bash
# 메모리 사용량 확인
node --expose-gc --inspect src/main.ts

# 또는 heapdump 모듈 사용
npm install --save-dev heapdump
```

### 5️⃣ **성능 문제**

#### 느린 응답 시간
```bash
# 프로파일링 실행
node --prof src/main.ts

# 프로파일 분석  
node --prof-process isolate-*.log > processed.txt
```

#### 높은 CPU 사용률
```bash
# CPU 프로파일링
npm install --save-dev clinic
npx clinic doctor -- node dist/main.js
```

## 📞 지원

### 문서
- [API 가이드](./API_GUIDE.md)
- [EventBus 가이드](./EVENTBUS_GUIDE.md)
- [도메인 서비스 가이드](./DOMAIN_SERVICES_GUIDE.md)
- [Saga 오케스트레이터 가이드](./ORCHESTRATOR_GUIDE.md)

### 문의
- **이슈 리포트**: [GitHub Issues](https://github.com/your-username/nestjs-saga-pattern/issues)
- **기능 요청**: [GitHub Discussions](https://github.com/your-username/nestjs-saga-pattern/discussions)
- **이메일**: [개발팀 이메일]

### 기여
프로젝트 기여를 환영합니다! [CONTRIBUTING.md](../CONTRIBUTING.md) 파일을 참조해주세요.

---

**다음 가이드**: [테스트 시나리오 가이드](./TESTING_GUIDE.md)