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
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  executedAt: Date;
  duration?: number;
}

export interface CompensationAction {
  step: SagaStep;
  action: 'compensate';
  data: any;
  executedAt?: Date;
  status?: 'pending' | 'success' | 'failed';
}

export interface SagaState {
  transactionId: string;
  status: SagaStatus;
  currentStep?: SagaStep;
  purchaseData: {
    userId: string;
    itemId: string;
    quantity: number;
    price: number;
  };
  steps: SagaStepResult[];
  compensations: CompensationAction[];
  startedAt: Date;
  completedAt?: Date;
  failedAt?: Date;
  error?: {
    step: SagaStep;
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