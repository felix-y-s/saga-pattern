import { UserInventory } from 'src/services/item.service';

export enum SagaStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  COMPENSATING = 'compensating',
  COMPENSATED = 'compensated',
}

export enum SagaStep {
  USER_VALIDATION = 'user_validation',
  ITEM_GRANT = 'item_grant',
  LOG_RECORD = 'log_record',
  NOTIFICATION = 'notification',
}

export interface StateSnapshot {
  // 변경 전 사용자 상태
  before: {
    balance?: number;
    items?: UserInventory[];
    [key: string]: any;
  };
  // 변경 후 사용자 상태
  after: {
    balance?: number;
    items?: UserInventory[];
    [key: string]: any;
  };
  // 실제 변경된 필드만
  changes: {
    field: string;
    from: any;
    to: any;
  }[];
}

export interface SagaStepResult {
  step: SagaStep;
  status: 'success' | 'failed';
  stateSnapshot?: StateSnapshot;
  data?: any;
  executedAt: Date;
  duration?: number;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface CompensationResult {
  step: SagaStep;
  status?: 'pending' | 'success' | 'failed'; // pending 상태는 보상 로직 실행 전에 상태를 등록 후 실행을 위해 사용
  stateSnapshot?: StateSnapshot;
  data: any;
  action: 'compensate';
  executedAt?: Date;
}

export interface SagaState {
  /** 분산 트랜잭션을 추적하기 위한 고유 식별자 */
  transactionId: string;

  /** 현재 Saga 트랜잭션의 상태 (대기/진행중/완료/실패/보상중/보상완료) */
  status: SagaStatus;

  /** 현재 실행 중인 단계 (실행 완료 시 undefined) */
  currentStep?: SagaStep;

  /** 구매 요청 관련 비즈니스 데이터 */
  purchaseData: {
    userId: string;
    itemId: string;
    quantity: number;
    price: number;
  };

  /** 실행된 모든 단계들의 결과 기록 (성공/실패 모두 포함) */
  steps: SagaStepResult[];

  /** 실패 시 실행될 보상 액션들의 기록 */
  compensations: CompensationResult[];

  startedAt: Date;

  completedAt?: Date;
  failedAt?: Date;

  error?: {
    /** 오류가 발생한 단계 */
    step: SagaStep;
    /** 오류 코드 */
    code: string;
    message: string;
    details?: any;
  };
}

export interface SagaContext {
  state: SagaState;
  updateState(updates: Partial<SagaState>): void;
  addStepResult(result: SagaStepResult): void;
  addCompensation(compensation: CompensationResult): void;
  markCompleted(): void;
  markFailed(step: SagaStep, error: any): void;
}
