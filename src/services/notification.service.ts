import { Injectable, Logger } from '@nestjs/common';
import { NotificationDto } from '../dtos/purchase-request.dto';
import { NotificationResult } from '../interfaces/domain-services.interface';

interface NotificationRecord {
  notificationId: string;
  userId: string;
  transactionId: string;
  type: string;
  message: string;
  sentAt: Date;
  status: 'sent' | 'failed' | 'pending';
  retryCount: number;
  metadata: Record<string, any>;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  
  // 모의 알림 저장소 (실제로는 데이터베이스 및 외부 알림 서비스)
  private readonly notifications = new Map<string, NotificationRecord>();
  
  // 실패율 시뮬레이션을 위한 설정
  private readonly failureRate = 0.1; // 10% 실패율
  
  async sendNotification(dto: NotificationDto): Promise<NotificationResult> {
    this.logger.debug(`Sending notification: ${dto.type} to user: ${dto.userId}`);
    
    try {
      const notificationId = this.generateNotificationId();
      const sentAt = new Date();
      
      // 실패 시뮬레이션
      const shouldFail = Math.random() < this.failureRate;
      
      if (shouldFail) {
        this.logger.warn(`Notification delivery failed (simulated): ${notificationId}`);
        
        // 실패 기록
        this.notifications.set(notificationId, {
          notificationId,
          userId: dto.userId,
          transactionId: dto.transactionId,
          type: dto.type,
          message: dto.message,
          sentAt,
          status: 'failed',
          retryCount: 0,
          metadata: dto.metadata || {},
        });
        
        return {
          success: false,
          notificationId,
          sentAt,
          reason: 'Notification delivery failed',
          errorCode: 'DELIVERY_FAILED',
        };
      }
      
      // 성공 기록
      this.notifications.set(notificationId, {
        notificationId,
        userId: dto.userId,
        transactionId: dto.transactionId,
        type: dto.type,
        message: dto.message,
        sentAt,
        status: 'sent',
        retryCount: 0,
        metadata: dto.metadata || {},
      });
      
      this.logger.log(`Notification sent successfully: ${notificationId} to ${dto.userId}`);
      
      // 실제 환경에서는 여기서 Push, Email, SMS 등의 서비스 호출
      this.simulateNotificationDelivery(dto);
      
      return {
        success: true,
        notificationId,
        sentAt,
      };
      
    } catch (error) {
      this.logger.error(`Error sending notification to ${dto.userId}:`, error);
      return {
        success: false,
        notificationId: '',
        sentAt: new Date(),
        reason: 'Internal notification error',
        errorCode: 'NOTIFICATION_ERROR',
      };
    }
  }

  async retryNotification(notificationId: string): Promise<NotificationResult> {
    this.logger.debug(`Retrying notification: ${notificationId}`);
    
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      return {
        success: false,
        notificationId,
        sentAt: new Date(),
        reason: 'Notification record not found',
        errorCode: 'NOTIFICATION_NOT_FOUND',
      };
    }

    if (notification.status === 'sent') {
      return {
        success: true,
        notificationId,
        sentAt: notification.sentAt,
      };
    }

    // 재시도 제한 (3회)
    if (notification.retryCount >= 3) {
      this.logger.warn(`Max retry attempts reached for notification: ${notificationId}`);
      return {
        success: false,
        notificationId,
        sentAt: new Date(),
        reason: 'Max retry attempts exceeded',
        errorCode: 'MAX_RETRIES_EXCEEDED',
      };
    }

    // 재시도 실행
    notification.retryCount++;
    
    // 재시도 성공률 높임 (80%)
    const shouldSucceed = Math.random() < 0.8;
    
    if (shouldSucceed) {
      notification.status = 'sent';
      notification.sentAt = new Date();
      
      this.logger.log(`Notification retry successful: ${notificationId} (attempt: ${notification.retryCount})`);
      
      return {
        success: true,
        notificationId,
        sentAt: notification.sentAt,
      };
    } else {
      this.logger.warn(`Notification retry failed: ${notificationId} (attempt: ${notification.retryCount})`);
      
      return {
        success: false,
        notificationId,
        sentAt: new Date(),
        reason: `Retry failed (attempt: ${notification.retryCount})`,
        errorCode: 'RETRY_FAILED',
      };
    }
  }

  async getNotificationsByUser(userId: string): Promise<NotificationRecord[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }

  async getNotificationsByTransaction(transactionId: string): Promise<NotificationRecord[]> {
    return Array.from(this.notifications.values())
      .filter(notification => notification.transactionId === transactionId)
      .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  }

  async getNotificationStats(): Promise<{
    total: number;
    sent: number;
    failed: number;
    pending: number;
  }> {
    const notifications = Array.from(this.notifications.values());
    
    return {
      total: notifications.length,
      sent: notifications.filter(n => n.status === 'sent').length,
      failed: notifications.filter(n => n.status === 'failed').length,
      pending: notifications.filter(n => n.status === 'pending').length,
    };
  }

  private generateNotificationId(): string {
    return `NOTIF_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private simulateNotificationDelivery(dto: NotificationDto): void {
    // 실제 환경에서는 여기서 다양한 알림 채널로 메시지 전송
    const channels = this.getNotificationChannels(dto.type);
    
    this.logger.debug(`Simulating notification delivery via channels: ${channels.join(', ')}`);
    this.logger.debug(`Message: ${dto.message}`);
    this.logger.debug(`Metadata: ${JSON.stringify(dto.metadata)}`);
  }

  private getNotificationChannels(notificationType: string): string[] {
    switch (notificationType) {
      case 'purchase_success':
        return ['push', 'email'];
      case 'purchase_failed':
        return ['push'];
      case 'item_granted':
        return ['push', 'in-app'];
      case 'refund':
        return ['push', 'email', 'sms'];
      default:
        return ['push'];
    }
  }

  // 테스트를 위한 메소드
  async setFailureRate(rate: number): Promise<void> {
    if (rate >= 0 && rate <= 1) {
      (this as any).failureRate = rate;
      this.logger.debug(`Notification failure rate set to: ${rate * 100}%`);
    }
  }

  async clearNotifications(): Promise<void> {
    this.notifications.clear();
    this.logger.debug('All notifications cleared');
  }

  async getAllNotifications(): Promise<NotificationRecord[]> {
    return Array.from(this.notifications.values()).sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime());
  }
}