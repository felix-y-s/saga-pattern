import { Injectable, Logger } from '@nestjs/common';
import { SagaState } from './interfaces/saga-state.interface';
import { SagaRepository } from './interfaces/orchestrator.interface';

@Injectable()
export class SagaRepositoryService implements SagaRepository {
  private readonly logger = new Logger(SagaRepositoryService.name);
  
  // 메모리 기반 저장소 (실제 환경에서는 데이터베이스 사용)
  private readonly sagas = new Map<string, SagaState>();

  async save(saga: SagaState): Promise<void> {
    this.sagas.set(saga.transactionId, { ...saga });
    this.logger.debug(`Saga saved: ${saga.transactionId}, status: ${saga.status}`);
  }

  async findById(transactionId: string): Promise<SagaState | null> {
    const saga = this.sagas.get(transactionId);
    return saga ? { ...saga } : null;
  }

  async update(transactionId: string, updates: Partial<SagaState>): Promise<void> {
    const existingSaga = this.sagas.get(transactionId);
    if (!existingSaga) {
      throw new Error(`Saga not found: ${transactionId}`);
    }

    const updatedSaga = { ...existingSaga, ...updates };
    this.sagas.set(transactionId, updatedSaga);
    this.logger.debug(`Saga updated: ${transactionId}, status: ${updatedSaga.status}`);
  }

  async delete(transactionId: string): Promise<void> {
    const deleted = this.sagas.delete(transactionId);
    if (deleted) {
      this.logger.debug(`Saga deleted: ${transactionId}`);
    }
  }

  async findAll(): Promise<SagaState[]> {
    return Array.from(this.sagas.values()).map(saga => ({ ...saga }));
  }

  // 편의 메소드들
  async countByStatus(status: string): Promise<number> {
    return Array.from(this.sagas.values()).filter(saga => saga.status === status).length;
  }

  async findByStatus(status: string): Promise<SagaState[]> {
    return Array.from(this.sagas.values())
      .filter(saga => saga.status === status)
      .map(saga => ({ ...saga }));
  }

  async findByUserId(userId: string): Promise<SagaState[]> {
    return Array.from(this.sagas.values())
      .filter(saga => saga.purchaseData.userId === userId)
      .map(saga => ({ ...saga }))
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
  }

  async clear(): Promise<void> {
    this.sagas.clear();
    this.logger.debug('All sagas cleared');
  }

  async getStatistics(): Promise<{
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    compensating: number;
    compensated: number;
  }> {
    const sagas = Array.from(this.sagas.values());
    
    return {
      total: sagas.length,
      pending: sagas.filter(s => s.status === 'pending').length,
      inProgress: sagas.filter(s => s.status === 'in_progress').length,
      completed: sagas.filter(s => s.status === 'completed').length,
      failed: sagas.filter(s => s.status === 'failed').length,
      compensating: sagas.filter(s => s.status === 'compensating').length,
      compensated: sagas.filter(s => s.status === 'compensated').length,
    };
  }
}