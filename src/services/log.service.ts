import { Injectable, Logger } from '@nestjs/common';
import { LogRecordDto } from '../dtos/purchase-request.dto';
import { LogRecordResult, PurchaseLogEntry } from '../interfaces/domain-services.interface';

@Injectable()
export class LogService {
  private readonly logger = new Logger(LogService.name);
  
  // 모의 로그 저장소 (실제로는 데이터베이스)
  private readonly logs = new Map<string, PurchaseLogEntry>();

  async recordLog(dto: LogRecordDto): Promise<LogRecordResult> {
    this.logger.debug(`Recording log for transaction: ${dto.transactionId}, step: ${dto.step}`);
    
    try {
      // 로그 ID 생성
      const logId = this.generateLogId();
      const recordedAt = new Date();
      
      const logEntry: PurchaseLogEntry = {
        logId,
        transactionId: dto.transactionId,
        userId: dto.userId,
        itemId: dto.itemId,
        quantity: dto.quantity,
        price: dto.price,
        status: dto.status,
        step: dto.step,
        createdAt: recordedAt,
        metadata: dto.metadata || {},
      };
      
      // 로그 저장
      this.logs.set(logId, logEntry);
      
      this.logger.log(`Log recorded successfully: ${logId} for transaction ${dto.transactionId}`);
      
      return {
        success: true,
        logId,
        recordedAt,
      };
      
    } catch (error) {
      this.logger.error(`Error recording log for transaction ${dto.transactionId}:`, error);
      return {
        success: false,
        logId: '',
        recordedAt: new Date(),
        reason: 'Failed to record log',
        errorCode: 'LOG_RECORD_ERROR',
      };
    }
  }

  async getLogsByTransaction(transactionId: string): Promise<PurchaseLogEntry[]> {
    const transactionLogs = Array.from(this.logs.values())
      .filter(log => log.transactionId === transactionId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    
    return transactionLogs;
  }

  async getLogsByUser(userId: string): Promise<PurchaseLogEntry[]> {
    const userLogs = Array.from(this.logs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return userLogs;
  }

  async getLogById(logId: string): Promise<PurchaseLogEntry | null> {
    return this.logs.get(logId) || null;
  }

  async updateLogStatus(logId: string, status: 'success' | 'failed' | 'compensated', metadata?: Record<string, any>): Promise<boolean> {
    try {
      const log = this.logs.get(logId);
      if (!log) {
        this.logger.warn(`Log not found for update: ${logId}`);
        return false;
      }
      
      log.status = status;
      if (metadata) {
        log.metadata = { ...log.metadata, ...metadata };
      }
      
      this.logger.debug(`Log status updated: ${logId} -> ${status}`);
      return true;
      
    } catch (error) {
      this.logger.error(`Error updating log status ${logId}:`, error);
      return false;
    }
  }

  async getLogStatistics(userId?: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    compensated: number;
  }> {
    let logsToAnalyze = Array.from(this.logs.values());
    
    if (userId) {
      logsToAnalyze = logsToAnalyze.filter(log => log.userId === userId);
    }
    
    return {
      total: logsToAnalyze.length,
      successful: logsToAnalyze.filter(log => log.status === 'success').length,
      failed: logsToAnalyze.filter(log => log.status === 'failed').length,
      compensated: logsToAnalyze.filter(log => log.status === 'compensated').length,
    };
  }

  private generateLogId(): string {
    return `LOG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 테스트를 위한 메소드
  async clearLogs(): Promise<void> {
    this.logs.clear();
    this.logger.debug('All logs cleared');
  }

  async getAllLogs(): Promise<PurchaseLogEntry[]> {
    return Array.from(this.logs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}