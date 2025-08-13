# 🗃️ NestJS Saga Pattern - 데이터베이스 통합 워크플로우

## 📋 프로젝트 개요

### 현재 상태 분석
- **기존 아키텍처**: 완전한 이중 Saga Pattern (Orchestration + Choreography)
- **데이터 저장소**: 인메모리 Map 기반 저장소 (개발/테스트용)
- **핵심 강점**: 패턴 충돌 해결, 620+ 라인 API, 완전한 문서화
- **개선 필요**: 프로덕션 환경을 위한 영구 데이터 저장소 필요

### 목표 및 가치 제안
- **주요 목표**: 인메모리 저장소를 PostgreSQL + TypeORM으로 전환
- **비즈니스 가치**: 프로덕션 준비 완료, 데이터 영속성, 확장성 확보
- **기술적 가치**: ACID 트랜잭션, 고성능 쿼리, 백업/복구, 모니터링

## 🎯 구현 전략: 체계적 접근법 (Systematic)

### Phase 1: 기초 설계 및 설정 (Week 1-2)
**🎭 주도 Persona**: Architect + Backend
**⏱️ 예상 소요시간**: 16-20 시간
**🔗 의존성**: 없음 (독립적 시작 가능)

#### 🏗️ 아키텍처 설계
```
┌─────────────────────────────────────────┐
│          기존 아키텍처 유지              │
├─────────────────────────────────────────┤
│  🎭 Pattern Control (변경 없음)         │  
│  🚌 EventBus System (변경 없음)         │
├─────────────────────────────────────────┤
│  🔄 Data Layer 교체                    │
│  ├─ InMemory Maps → PostgreSQL         │
│  ├─ Simple Objects → TypeORM Entities  │
│  └─ Direct Access → Repository Pattern │
├─────────────────────────────────────────┤
│  🏢 Service Layer (인터페이스 유지)     │
│  └─ 구현체만 변경, API 호환성 보장      │
└─────────────────────────────────────────┘
```

#### 주요 작업 항목

##### 1.1 데이터베이스 스키마 설계 (4시간)
```sql
-- 사용자 테이블
CREATE TABLE users (
    user_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    purchase_limit DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 아이템 테이블
CREATE TABLE items (
    item_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saga 상태 테이블
CREATE TABLE saga_states (
    transaction_id VARCHAR(100) PRIMARY KEY,
    status VARCHAR(20) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    error_message TEXT NULL
);

-- Saga 단계 결과 테이블
CREATE TABLE saga_step_results (
    id SERIAL PRIMARY KEY,
    transaction_id VARCHAR(100) NOT NULL,
    step VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    data JSONB NULL,
    error_code VARCHAR(50) NULL,
    error_message TEXT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transaction_id) REFERENCES saga_states(transaction_id)
);

-- 트랜잭션 로그 테이블
CREATE TABLE transaction_logs (
    log_id VARCHAR(100) PRIMARY KEY,
    transaction_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    item_id VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    log_data JSONB NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 알림 테이블
CREATE TABLE notifications (
    notification_id VARCHAR(100) PRIMARY KEY,
    transaction_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    channels JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

##### 1.2 TypeORM 설정 및 연결 (3시간)
```typescript
// src/config/database.config.ts
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'saga_pattern',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  migrationsRun: true,
};
```

##### 1.3 Entity 클래스 정의 (6시간)
```typescript
// src/entities/user.entity.ts
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryColumn({ name: 'user_id' })
  userId: string;

  @Column({ length: 100 })
  name: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  balance: number;

  @Column({ length: 20, default: 'active' })
  status: string;

  @Column('decimal', { precision: 10, scale: 2, name: 'purchase_limit', default: 0 })
  purchaseLimit: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

// src/entities/saga-state.entity.ts
@Entity('saga_states')
export class SagaState {
  @PrimaryColumn({ name: 'transaction_id' })
  transactionId: string;

  @Column({ length: 20 })
  status: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column()
  quantity: number;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', nullable: true })
  completedAt?: Date;

  @Column({ name: 'error_message', nullable: true })
  errorMessage?: string;

  @OneToMany(() => SagaStepResult, stepResult => stepResult.sagaState)
  steps: SagaStepResult[];
}
```

##### 1.4 마이그레이션 전략 수립 (3시간)
- **점진적 교체**: 서비스별 단계적 전환
- **호환성 유지**: 기존 인터페이스 변경 없음
- **롤백 계획**: 문제 발생시 인메모리로 복원
- **데이터 검증**: 마이그레이션 후 데이터 무결성 확인

### Phase 2: 핵심 구현 (Week 3-5)
**🎭 주도 Persona**: Backend + Architect
**⏱️ 예상 소요시간**: 32-40 시간
**🔗 의존성**: Phase 1 완료 필수

#### 2.1 Repository Pattern 구현 (12시간)

##### 기본 Repository 인터페이스
```typescript
// src/repositories/interfaces/base-repository.interface.ts
export interface BaseRepository<T> {
  save(entity: T): Promise<T>;
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  update(id: string, updates: Partial<T>): Promise<T>;
  delete(id: string): Promise<boolean>;
}

// src/repositories/interfaces/saga-repository.interface.ts
export interface SagaRepositoryInterface extends BaseRepository<SagaState> {
  findByStatus(status: string): Promise<SagaState[]>;
  findByUser(userId: string): Promise<SagaState[]>;
  updateStatus(transactionId: string, status: string): Promise<void>;
  addStepResult(transactionId: string, stepResult: SagaStepResult): Promise<void>;
  findWithSteps(transactionId: string): Promise<SagaState | null>;
}
```

##### Repository 구현체
```typescript
// src/repositories/saga.repository.ts
@Injectable()
export class SagaRepository implements SagaRepositoryInterface {
  constructor(
    @InjectRepository(SagaState)
    private readonly sagaStateRepository: Repository<SagaState>,
    @InjectRepository(SagaStepResult)
    private readonly stepResultRepository: Repository<SagaStepResult>,
  ) {}

  async save(sagaState: SagaState): Promise<SagaState> {
    return await this.sagaStateRepository.save(sagaState);
  }

  async findById(transactionId: string): Promise<SagaState | null> {
    return await this.sagaStateRepository.findOne({
      where: { transactionId }
    });
  }

  async findWithSteps(transactionId: string): Promise<SagaState | null> {
    return await this.sagaStateRepository.findOne({
      where: { transactionId },
      relations: ['steps'],
    });
  }

  async findByStatus(status: string): Promise<SagaState[]> {
    return await this.sagaStateRepository.find({
      where: { status }
    });
  }

  async updateStatus(transactionId: string, status: string): Promise<void> {
    await this.sagaStateRepository.update(
      { transactionId }, 
      { 
        status, 
        updatedAt: new Date(),
        ...(status === 'completed' && { completedAt: new Date() })
      }
    );
  }

  async addStepResult(transactionId: string, stepResult: SagaStepResult): Promise<void> {
    stepResult.transactionId = transactionId;
    await this.stepResultRepository.save(stepResult);
  }
}
```

#### 2.2 서비스 레이어 리팩토링 (15시간)

##### UserService 데이터베이스 통합
```typescript
// src/services/user.service.ts (리팩토링)
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly logger: Logger,
  ) {}

  async validateUser(dto: UserValidationDto): Promise<UserValidationResult> {
    const queryRunner = this.userRepository.manager.connection.createQueryRunner();
    
    try {
      await queryRunner.startTransaction();
      
      // 사용자 조회 (FOR UPDATE로 락)
      const user = await queryRunner.manager.findOne(User, {
        where: { userId: dto.userId },
        lock: { mode: 'pessimistic_write' }
      });

      if (!user) {
        return {
          isValid: false,
          userId: dto.userId,
          reason: 'User not found',
          errorCode: 'USER_NOT_FOUND'
        };
      }

      if (user.status !== 'active') {
        return {
          isValid: false,
          userId: dto.userId,
          reason: 'User not active',
          errorCode: 'USER_NOT_ACTIVE'
        };
      }

      if (user.balance < dto.requiredBalance) {
        return {
          isValid: false,
          userId: dto.userId,
          currentBalance: user.balance,
          reason: 'Insufficient balance',
          errorCode: 'INSUFFICIENT_BALANCE'
        };
      }

      // 잔액 차감
      await queryRunner.manager.update(User, 
        { userId: dto.userId }, 
        { 
          balance: () => `balance - ${dto.requiredBalance}`,
          updatedAt: new Date()
        }
      );

      await queryRunner.commitTransaction();

      return {
        isValid: true,
        userId: dto.userId,
        currentBalance: user.balance - dto.requiredBalance
      };

    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`User validation failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async compensateUserValidation(
    userId: string, 
    amount: number, 
    transactionId: string
  ): Promise<boolean> {
    try {
      const result = await this.userRepository.update(
        { userId },
        { 
          balance: () => `balance + ${amount}`,
          updatedAt: new Date()
        }
      );

      this.logger.log(`User balance compensated: ${userId}, amount: ${amount}, transaction: ${transactionId}`);
      return result.affected > 0;
    } catch (error) {
      this.logger.error(`User compensation failed: ${error.message}`, error.stack);
      return false;
    }
  }
}
```

#### 2.3 트랜잭션 관리 구현 (8시간)

##### 분산 트랜잭션 코디네이터
```typescript
// src/database/transaction-coordinator.service.ts
@Injectable()
export class TransactionCoordinator {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  async executeInTransaction<T>(
    operation: (manager: EntityManager) => Promise<T>
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    
    try {
      await queryRunner.startTransaction();
      const result = await operation(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transaction failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async executeCompensatingTransaction(
    compensationSteps: CompensationStep[]
  ): Promise<CompensationResult> {
    const results: CompensationStepResult[] = [];
    
    for (const step of compensationSteps.reverse()) {
      try {
        const result = await this.executeInTransaction(async (manager) => {
          return await step.execute(manager);
        });
        
        results.push({
          step: step.name,
          status: 'success',
          result
        });
      } catch (error) {
        results.push({
          step: step.name,
          status: 'failed',
          error: error.message
        });
        
        this.logger.error(`Compensation step ${step.name} failed: ${error.message}`);
        // Continue with other compensation steps
      }
    }

    return {
      overallSuccess: results.every(r => r.status === 'success'),
      stepResults: results
    };
  }
}
```

### Phase 3: 고급 기능 및 최적화 (Week 6-7)
**🎭 주도 Persona**: Performance + Backend
**⏱️ 예상 소요시간**: 24-30 시간
**🔗 의존성**: Phase 2 완료 필수

#### 3.1 성능 최적화 (12시간)

##### 데이터베이스 인덱스 전략
```sql
-- 주요 쿼리 최적화 인덱스
CREATE INDEX CONCURRENTLY idx_saga_states_status ON saga_states(status);
CREATE INDEX CONCURRENTLY idx_saga_states_user_id ON saga_states(user_id);
CREATE INDEX CONCURRENTLY idx_saga_states_created_at ON saga_states(created_at);
CREATE INDEX CONCURRENTLY idx_saga_step_results_transaction_id ON saga_step_results(transaction_id);
CREATE INDEX CONCURRENTLY idx_transaction_logs_user_id ON transaction_logs(user_id);
CREATE INDEX CONCURRENTLY idx_notifications_user_id_status ON notifications(user_id, status);

-- 복합 인덱스 (자주 사용되는 쿼리 조합)
CREATE INDEX CONCURRENTLY idx_saga_states_status_created_at ON saga_states(status, created_at);
```

##### 쿼리 최적화
```typescript
// src/repositories/optimized-saga.repository.ts
@Injectable()
export class OptimizedSagaRepository extends SagaRepository {
  
  // 대시보드용 통계 쿼리 최적화
  async getStatistics(): Promise<SagaStatistics> {
    const result = await this.sagaStateRepository
      .createQueryBuilder('saga')
      .select([
        'COUNT(*) as total',
        'COUNT(CASE WHEN status = \'pending\' THEN 1 END) as pending',
        'COUNT(CASE WHEN status = \'in_progress\' THEN 1 END) as inProgress',
        'COUNT(CASE WHEN status = \'completed\' THEN 1 END) as completed',
        'COUNT(CASE WHEN status = \'failed\' THEN 1 END) as failed',
        'COUNT(CASE WHEN status = \'compensating\' THEN 1 END) as compensating',
        'COUNT(CASE WHEN status = \'compensated\' THEN 1 END) as compensated'
      ])
      .getRawOne();

    return {
      total: parseInt(result.total),
      pending: parseInt(result.pending),
      inProgress: parseInt(result.in_progress),
      completed: parseInt(result.completed),
      failed: parseInt(result.failed),
      compensating: parseInt(result.compensating),
      compensated: parseInt(result.compensated)
    };
  }

  // 페이징 처리된 조회
  async findPaginated(
    page: number, 
    limit: number, 
    filters?: SagaFilters
  ): Promise<PaginatedResult<SagaState>> {
    const queryBuilder = this.sagaStateRepository
      .createQueryBuilder('saga')
      .orderBy('saga.createdAt', 'DESC')
      .take(limit)
      .skip((page - 1) * limit);

    if (filters?.status) {
      queryBuilder.andWhere('saga.status = :status', { status: filters.status });
    }

    if (filters?.userId) {
      queryBuilder.andWhere('saga.userId = :userId', { userId: filters.userId });
    }

    if (filters?.dateFrom) {
      queryBuilder.andWhere('saga.createdAt >= :dateFrom', { dateFrom: filters.dateFrom });
    }

    const [data, total] = await queryBuilder.getManyAndCount();

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
}
```

#### 3.2 캐싱 전략 구현 (8시간)

##### Redis 통합
```typescript
// src/cache/redis-cache.service.ts
@Injectable()
export class RedisCacheService {
  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redisClient: Redis,
    private readonly logger: Logger,
  ) {}

  async getCachedSagaState(transactionId: string): Promise<SagaState | null> {
    try {
      const cached = await this.redisClient.get(`saga:${transactionId}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.warn(`Cache get failed for ${transactionId}: ${error.message}`);
      return null;
    }
  }

  async setCachedSagaState(sagaState: SagaState, ttlSeconds = 3600): Promise<void> {
    try {
      await this.redisClient.setex(
        `saga:${sagaState.transactionId}`,
        ttlSeconds,
        JSON.stringify(sagaState)
      );
    } catch (error) {
      this.logger.warn(`Cache set failed for ${sagaState.transactionId}: ${error.message}`);
    }
  }

  async invalidateSagaCache(transactionId: string): Promise<void> {
    try {
      await this.redisClient.del(`saga:${transactionId}`);
    } catch (error) {
      this.logger.warn(`Cache invalidation failed for ${transactionId}: ${error.message}`);
    }
  }
}

// 캐시 통합 Repository
@Injectable()
export class CachedSagaRepository extends OptimizedSagaRepository {
  constructor(
    @InjectRepository(SagaState) sagaRepository: Repository<SagaState>,
    @InjectRepository(SagaStepResult) stepRepository: Repository<SagaStepResult>,
    private readonly cacheService: RedisCacheService,
  ) {
    super(sagaRepository, stepRepository);
  }

  async findById(transactionId: string): Promise<SagaState | null> {
    // 캐시에서 먼저 조회
    const cached = await this.cacheService.getCachedSagaState(transactionId);
    if (cached) {
      return cached;
    }

    // 데이터베이스에서 조회
    const sagaState = await super.findById(transactionId);
    if (sagaState) {
      // 캐시에 저장 (1시간 TTL)
      await this.cacheService.setCachedSagaState(sagaState, 3600);
    }

    return sagaState;
  }

  async save(sagaState: SagaState): Promise<SagaState> {
    const result = await super.save(sagaState);
    // 캐시 무효화
    await this.cacheService.invalidateSagaCache(sagaState.transactionId);
    return result;
  }
}
```

#### 3.3 모니터링 및 로깅 (4시간)

##### 데이터베이스 성능 모니터링
```typescript
// src/monitoring/db-performance.service.ts
@Injectable()
export class DatabasePerformanceService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly logger: Logger,
  ) {}

  @Cron('*/5 * * * *') // 5분마다 실행
  async monitorPerformance(): Promise<void> {
    try {
      // 활성 연결 수 모니터링
      const activeConnections = await this.getActiveConnectionsCount();
      
      // 느린 쿼리 모니터링
      const slowQueries = await this.getSlowQueries();
      
      // 테이블 크기 모니터링
      const tableSizes = await this.getTableSizes();

      this.logger.log(`DB Monitoring: Active Connections: ${activeConnections}`);
      
      if (slowQueries.length > 0) {
        this.logger.warn(`Found ${slowQueries.length} slow queries`);
      }

      // 메트릭 전송 (Prometheus/Grafana)
      await this.sendMetrics({
        activeConnections,
        slowQueriesCount: slowQueries.length,
        tableSizes
      });

    } catch (error) {
      this.logger.error(`DB monitoring failed: ${error.message}`, error.stack);
    }
  }

  private async getActiveConnectionsCount(): Promise<number> {
    const result = await this.dataSource.query(
      'SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = \'active\''
    );
    return parseInt(result[0].active_connections);
  }

  private async getSlowQueries(): Promise<any[]> {
    return await this.dataSource.query(`
      SELECT query, mean_time, calls, total_time
      FROM pg_stat_statements 
      WHERE mean_time > 1000 
      ORDER BY mean_time DESC 
      LIMIT 10
    `);
  }
}
```

### Phase 4: 테스트 및 배포 (Week 8)
**🎭 주도 Persona**: QA + DevOps
**⏱️ 예상 소요시간**: 20-25 시간
**🔗 의존성**: Phase 3 완료 필수

#### 4.1 통합 테스트 (10시간)

##### 데이터베이스 통합 테스트
```typescript
// src/tests/integration/database-integration.spec.ts
describe('Database Integration', () => {
  let app: INestApplication;
  let sagaRepository: SagaRepository;
  let userService: UserService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          ...databaseConfig,
          database: 'saga_pattern_test',
          dropSchema: true,
          synchronize: true,
        }),
        // ... other modules
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    sagaRepository = moduleRef.get<SagaRepository>(SagaRepository);
    userService = moduleRef.get<UserService>(UserService);
    
    await app.init();
  });

  describe('Saga State Persistence', () => {
    it('should persist saga state correctly', async () => {
      const sagaState = new SagaState();
      sagaState.transactionId = 'test-tx-001';
      sagaState.status = 'pending';
      sagaState.userId = 'user-123';
      sagaState.itemId = 'item-sword';
      sagaState.quantity = 1;
      sagaState.price = 100;

      const saved = await sagaRepository.save(sagaState);
      expect(saved.transactionId).toBe('test-tx-001');

      const retrieved = await sagaRepository.findById('test-tx-001');
      expect(retrieved).toBeDefined();
      expect(retrieved.status).toBe('pending');
    });

    it('should handle concurrent saga state updates', async () => {
      // 동시성 테스트 구현
      const promises = Array.from({ length: 10 }, (_, i) => 
        sagaRepository.updateStatus('test-tx-001', `status-${i}`)
      );

      const results = await Promise.allSettled(promises);
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      
      expect(successCount).toBe(10);
    });
  });

  describe('Transaction Management', () => {
    it('should rollback on user validation failure', async () => {
      const initialBalance = 1000;
      
      // 사용자 초기 설정
      await setupTestUser('user-123', initialBalance);

      try {
        // 잔액 부족 시나리오
        await userService.validateUser({
          userId: 'user-123',
          transactionId: 'test-tx-002',
          requiredBalance: 2000 // 잔액보다 많음
        });
      } catch (error) {
        // 예외 발생 예상
      }

      // 잔액이 변경되지 않았는지 확인
      const user = await userService.getUserProfile('user-123');
      expect(user.balance).toBe(initialBalance);
    });
  });
});
```

#### 4.2 성능 테스트 (6시간)

##### 부하 테스트 스크립트
```typescript
// src/tests/performance/load-test.spec.ts
describe('Database Performance Tests', () => {
  
  it('should handle 1000 concurrent purchase requests', async () => {
    const startTime = Date.now();
    
    const promises = Array.from({ length: 1000 }, (_, i) => 
      request(app.getHttpServer())
        .post('/purchase')
        .send({
          userId: `user-${i % 100}`, // 100명 사용자 반복
          itemId: 'item-sword',
          quantity: 1,
          price: 100
        })
    );

    const results = await Promise.allSettled(promises);
    const endTime = Date.now();
    
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.status === 200
    ).length;

    expect(successCount).toBeGreaterThan(950); // 95% 성공률
    expect(endTime - startTime).toBeLessThan(30000); // 30초 이내
  });

  it('should maintain response time under 200ms for 95th percentile', async () => {
    const responseTimes: number[] = [];
    
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      
      await request(app.getHttpServer())
        .get('/saga/test-tx-001')
        .expect(200);
        
      responseTimes.push(Date.now() - start);
    }

    responseTimes.sort((a, b) => a - b);
    const p95 = responseTimes[Math.floor(responseTimes.length * 0.95)];
    
    expect(p95).toBeLessThan(200);
  });
});
```

#### 4.3 데이터 마이그레이션 (4시간)

##### 마이그레이션 스크립트
```typescript
// src/migrations/001-initial-data.ts
export class InitialData1640000000000 implements MigrationInterface {
    
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 테스트 사용자 생성
    await queryRunner.query(`
      INSERT INTO users (user_id, name, balance, status, purchase_limit) VALUES
      ('user-123', 'Test User 123', 1000.00, 'active', 500.00),
      ('user-456', 'Test User 456', 50.00, 'active', 100.00),
      ('user-suspended', 'Suspended User', 1000.00, 'suspended', 0.00)
    `);

    // 테스트 아이템 생성
    await queryRunner.query(`
      INSERT INTO items (item_id, name, price, stock, is_available) VALUES
      ('item-sword', 'Magic Sword', 100.00, 50, true),
      ('item-potion', 'Health Potion', 20.00, 100, true),
      ('item-out-of-stock', 'Rare Gem', 500.00, 0, true),
      ('item-disabled', 'Disabled Item', 50.00, 10, false)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DELETE FROM users WHERE user_id IN (\'user-123\', \'user-456\', \'user-suspended\')');
    await queryRunner.query('DELETE FROM items WHERE item_id IN (\'item-sword\', \'item-potion\', \'item-out-of-stock\', \'item-disabled\')');
  }
}
```

## 🔄 병렬 작업 스트림

### Stream A: Backend Development (주 스트림)
- **Week 1-2**: 스키마 설계, Entity 정의
- **Week 3-5**: Repository 구현, 서비스 리팩토링  
- **Week 6-7**: 성능 최적화, 캐싱
- **Week 8**: 통합 테스트

### Stream B: Infrastructure & DevOps
- **Week 1**: Docker Compose 환경 설정
- **Week 2**: CI/CD 파이프라인 업데이트
- **Week 3**: 스테이징 환경 구축
- **Week 6**: 프로덕션 환경 준비
- **Week 8**: 배포 및 모니터링 설정

### Stream C: Testing & Quality Assurance
- **Week 2**: 테스트 전략 수립
- **Week 4**: 테스트 케이스 작성 시작
- **Week 6**: 성능 테스트 스크립트 개발
- **Week 8**: 전체 테스트 실행 및 검증

### Stream D: Documentation & Training
- **Week 2**: 데이터베이스 스키마 문서 작성
- **Week 4**: API 변경사항 문서 업데이트
- **Week 6**: 운영 가이드 작성
- **Week 8**: 최종 문서 리뷰 및 배포

## 📊 주요 마일스톤

### 🎯 M1: 설계 완료 (Week 2 말)
- **검증 기준**:
  - ✅ ERD 설계 완료 및 리뷰 승인
  - ✅ TypeORM Entity 정의 완료
  - ✅ 로컬 개발환경 데이터베이스 연결 성공
  - ✅ 첫 번째 마이그레이션 실행 성공

### 🎯 M2: 핵심 구현 완료 (Week 4 말)
- **검증 기준**:
  - ✅ 모든 Repository 구현 완료
  - ✅ UserService 데이터베이스 통합 완료
  - ✅ 기본 CRUD 연산 테스트 통과
  - ✅ 트랜잭션 관리 구현 완료

### 🎯 M3: 통합 테스트 통과 (Week 6 말)
- **검증 기준**:
  - ✅ 기존 API 모든 엔드포인트 정상 작동
  - ✅ Orchestration 패턴 완전 호환
  - ✅ Choreography 패턴 완전 호환
  - ✅ 성능 기준 달성 (응답시간 < 200ms)

### 🎯 M4: 프로덕션 준비 완료 (Week 8 말)
- **검증 기준**:
  - ✅ 모든 테스트 통과 (단위, 통합, 성능)
  - ✅ 프로덕션 환경 배포 성공
  - ✅ 모니터링 및 로깅 시스템 작동
  - ✅ 백업/복구 프로세스 검증 완료

## ⚠️ 리스크 평가 및 완화 전략

### 🔴 높은 리스크

#### 1. 데이터 일관성 문제 (확률: 중간, 영향: 높음)
**리스크**: Choreography 패턴에서 분산 트랜잭션 일관성 보장 어려움
**완화 전략**:
- Saga Pattern의 보상 트랜잭션 강화
- 이벤트 소싱 기반 상태 복원 기능 구현
- 데이터베이스 제약조건 및 트리거 활용
- 정기적 데이터 무결성 검증 스크립트 실행

#### 2. 성능 저하 (확률: 중간, 영향: 높음)
**리스크**: 인메모리 → 디스크 기반으로 전환 시 성능 저하
**완화 전략**:
- Redis 캐싱 레이어 구현
- 데이터베이스 인덱스 최적화
- 연결 풀 크기 조정
- 정기적 성능 벤치마킹 및 모니터링

### 🟡 중간 리스크

#### 3. 마이그레이션 복잡도 (확률: 높음, 영향: 중간)
**리스크**: 기존 인메모리 데이터 구조와 데이터베이스 스키마 간 불일치
**완화 전략**:
- 점진적 마이그레이션 (서비스별 단계적 교체)
- 호환성 레이어 구현 (임시 어댑터)
- 포괄적인 회귀 테스트
- 롤백 시나리오 준비

#### 4. 개발 일정 지연 (확률: 중간, 영향: 중간)
**리스크**: 예상보다 복잡한 통합 작업으로 인한 일정 지연
**완화 전략**:
- 버퍼 시간 포함 (20% 여유분)
- 병렬 작업 스트림 최대화
- 주간 진행상황 체크포인트
- MVP 범위 조정 가능성 준비

## 📈 성공 지표 및 검증

### 기능적 성공 지표
- **API 호환성**: 기존 API 응답 100% 일치
- **데이터 무결성**: 트랜잭션 일관성 99.9% 보장
- **패턴 호환성**: Orchestration/Choreography 모두 정상 작동

### 성능 지표
- **응답 시간**: 평균 < 150ms, 95th percentile < 200ms
- **처리량**: 최소 1,000 TPS (Transactions Per Second)
- **가용성**: 99.9% 업타임 유지

### 운영 지표
- **배포 성공률**: 100% (롤백 없음)
- **테스트 커버리지**: > 90%
- **문서 완성도**: 모든 변경사항 문서화 완료

## 🔧 다음 단계 권장사항

### 즉시 실행 가능한 작업
1. **PostgreSQL 개발 환경 설정**: Docker Compose 파일 작성
2. **TypeORM 의존성 추가**: package.json 업데이트
3. **기본 Entity 클래스 생성**: User, Item, SagaState 엔터티

### 준비 작업
1. **데이터베이스 서버 준비**: 개발/스테이징/프로덕션 환경
2. **팀 역할 분담**: Backend, DevOps, QA 담당자 지정
3. **테스트 계획 수립**: 테스트 시나리오 및 성능 기준 정의

---

**📍 관련 명령어**: 이 워크플로우를 실행하려면 `/sc:implement database-integration` 명령어를 사용하여 구체적인 구현을 시작할 수 있습니다.

**📋 프로젝트 상태**: [🗂️ 프로젝트 인덱스](./PROJECT_INDEX.md) | [🗺️ 컴포넌트 맵](./COMPONENT_MAP.md) | [🌐 API 가이드](./API_GUIDE.md)

**최종 업데이트**: 2024년 12월 | **예상 완료**: 8주 | **복잡도**: 높음 | **ROI**: 높음