import { Injectable, Logger } from '@nestjs/common';
import { PurchaseItemRequest } from 'src/interface/Purchase';

@Injectable()
export class LogService {
  private logs: any[] = [];
  private failureRate = 0.5;

  async createPurchaseLog(transactionId: string, request: PurchaseItemRequest): Promise<void> {
    Logger.log(`[LogService] 구매 로그 기록 시도 (${transactionId})`);

    if (Math.random() < this.failureRate) {
      throw new Error('로그 시스템 장애');
    }

    this.logs.push({
      transactionId,
      userId: request.userId,
      itemName: request.itemName,
      price: request.price,
      timestamp: new Date(),
    })

    Logger.log(`[LogService] 구매 로그 기록 완료`);
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  async deletePurchaseLog(transactionId: string): Promise<void> {
    Logger.log(`[LogService] 구매 로그 삭제 (${transactionId})`);

    this.logs = this.logs.filter((log) => log.transactionId !== transactionId);
    Logger.log(`[LogService] 로그 삭제 완료`);
  }
}
