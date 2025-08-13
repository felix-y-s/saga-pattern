import { SagaState, SagaStep } from './saga-state.interface';
import { PurchaseRequestDto } from '../../dtos/purchase-request.dto';

export interface PurchaseResult {
  success: boolean;
  transactionId: string;
  status: string;
  completedSteps: SagaStep[];
  message?: string; // 코레오그래피 패턴을 위한 추가 메시지 필드
  error?: {
    step: SagaStep;
    code: string;
    message: string;
  };
  data?: {
    userId: string;
    itemId: string;
    quantity: number;
    price: number;
    grantedAt?: Date;
    logId?: string;
    notificationId?: string;
  };
}

export interface IOrchestratorService {
  executePurchase(request: PurchaseRequestDto): Promise<PurchaseResult>;
  getSagaState(transactionId: string): Promise<SagaState | null>;
  compensateSaga(transactionId: string): Promise<boolean>;
}

export interface SagaRepository {
  save(saga: SagaState): Promise<void>;
  findById(transactionId: string): Promise<SagaState | null>;
  update(transactionId: string, updates: Partial<SagaState>): Promise<void>;
  delete(transactionId: string): Promise<void>;
  findAll(): Promise<SagaState[]>;
}