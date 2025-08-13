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

export interface SagaStepResult {
  step: SagaStep;
  status: 'success' | 'failed';
  data?: any;
  executedAt: Date;
  duration?: number;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface CompensationAction {
  step: SagaStep;
  action: 'compensate';
  data: any;
  executedAt?: Date;
  status?: 'pending' | 'success' | 'failed';
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
  compensations: CompensationAction[];

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
  addCompensation(compensation: CompensationAction): void;
  markCompleted(): void;
  markFailed(step: SagaStep, error: any): void;
}