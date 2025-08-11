import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationService {
  private failureRate = 0.3;
  async sendPurchaseNotification(userId: string, itemName: string) {
    Logger.log(`[NotificationService] ${userId}에게 구매 완료 알림 발송`);

    if (Math.random() < this.failureRate) {
      throw new Error('알림 서버 장애');
    }

    Logger.log(`[NotificationService] 알림 발송 완료: "${itemName} 구매가 완료되었습니다!"`);
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}
