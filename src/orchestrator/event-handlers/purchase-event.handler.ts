import { Injectable, Logger } from '@nestjs/common';
import { EventHandler } from '../../events/interfaces/event-handler.interface';
import {
  PurchaseInitiatedEvent,
  UserValidatedEvent,
  UserValidationFailedEvent,
  ItemGrantedEvent,
  ItemGrantFailedEvent,
  LogRecordedEvent,
  LogFailedEvent,
  NotificationSentEvent,
  NotificationFailedEvent,
  PurchaseCompletedEvent,
  PurchaseFailedEvent,
  CompensationInitiatedEvent,
  CompensationCompletedEvent,
  CompensationFailedEvent,
} from '../../events/purchase-events';

@Injectable()
export class PurchaseEventHandler implements EventHandler<any> {
  private readonly logger = new Logger(PurchaseEventHandler.name);

  async handle(event: any): Promise<void> {
    switch (event.eventType) {
      // case 'PurchaseInitiated':
      //   await this.handlePurchaseInitiated(event as PurchaseInitiatedEvent);
      //   break;
      case 'UserValidated':
        await this.handleUserValidated(event as UserValidatedEvent);
        break;
      case 'UserValidationFailed':
        await this.handleUserValidationFailed(
          event as UserValidationFailedEvent,
        );
        break;
      case 'ItemGranted':
        await this.handleItemGranted(event as ItemGrantedEvent);
        break;
      case 'ItemGrantFailed':
        await this.handleItemGrantFailed(event as ItemGrantFailedEvent);
        break;
      case 'LogRecorded':
        await this.handleLogRecorded(event as LogRecordedEvent);
        break;
      case 'LogFailed':
        await this.handleLogFailed(event as LogFailedEvent);
        break;
      case 'NotificationSent':
        await this.handleNotificationSent(event as NotificationSentEvent);
        break;
      case 'NotificationFailed':
        await this.handleNotificationFailed(event as NotificationFailedEvent);
        break;
      case 'PurchaseCompleted':
        await this.handlePurchaseCompleted(event as PurchaseCompletedEvent);
        break;
      case 'PurchaseFailed':
        await this.handlePurchaseFailed(event as PurchaseFailedEvent);
        break;
      case 'CompensationInitiated':
        await this.handleCompensationInitiated(
          event as CompensationInitiatedEvent,
        );
        break;
      case 'CompensationCompleted':
        await this.handleCompensationCompleted(
          event as CompensationCompletedEvent,
        );
        break;
      case 'CompensationFailed':
        await this.handleCompensationFailed(event as CompensationFailedEvent);
        break;
      default:
        this.logger.warn(`Unhandled event type: ${event.eventType}`);
    }
  }

  // private async handlePurchaseInitiated(event: PurchaseInitiatedEvent): Promise<void> {
  //   this.logger.log(`Purchase initiated: ${event.transactionId} for user ${event.userId}`);
  //   // 추가적인 로직 (예: 메트릭 수집, 외부 시스템 알림 등)
  // }

  private async handleUserValidated(event: UserValidatedEvent): Promise<void> {
    this.logger.log(
      `User validated successfully: ${event.userId} (Transaction: ${event.transactionId})`,
    );
    this.logger.debug(`User balance after validation: ${event.userBalance}`);
  }

  private async handleUserValidationFailed(
    event: UserValidationFailedEvent,
  ): Promise<void> {
    this.logger.warn(
      `User validation failed: ${event.userId} (Transaction: ${event.transactionId})`,
    );
    this.logger.debug(
      `Failure reason: ${event.reason} (Code: ${event.errorCode})`,
    );
  }

  private async handleItemGranted(event: ItemGrantedEvent): Promise<void> {
    this.logger.log(
      `Item granted: ${event.itemId} x${event.quantity} to user ${event.userId} (Transaction: ${event.transactionId})`,
    );
  }

  private async handleItemGrantFailed(
    event: ItemGrantFailedEvent,
  ): Promise<void> {
    this.logger.warn(
      `Item grant failed: ${event.itemId} for user ${event.userId} (Transaction: ${event.transactionId})`,
    );
    this.logger.debug(
      `Failure reason: ${event.reason} (Code: ${event.errorCode})`,
    );
  }

  private async handleLogRecorded(event: LogRecordedEvent): Promise<void> {
    this.logger.log(
      `Log recorded: ${event.logId} (Transaction: ${event.transactionId})`,
    );
    this.logger.debug(`Log data: ${JSON.stringify(event.logData)}`);
  }

  private async handleLogFailed(event: LogFailedEvent): Promise<void> {
    this.logger.error(
      `Log recording failed (Transaction: ${event.transactionId})`,
    );
    this.logger.debug(
      `Failure reason: ${event.reason} (Code: ${event.errorCode})`,
    );
  }

  private async handleNotificationSent(
    event: NotificationSentEvent,
  ): Promise<void> {
    this.logger.log(
      `Notification sent: ${event.notificationId} to user ${event.userId} (Transaction: ${event.transactionId})`,
    );
    this.logger.debug(`Notification type: ${event.notificationType}`);
  }

  private async handleNotificationFailed(
    event: NotificationFailedEvent,
  ): Promise<void> {
    this.logger.warn(
      `Notification failed for user ${event.userId} (Transaction: ${event.transactionId})`,
    );
    this.logger.debug(
      `Failure reason: ${event.reason} (Code: ${event.errorCode})`,
    );
  }

  private async handlePurchaseCompleted(
    event: PurchaseCompletedEvent,
  ): Promise<void> {
    this.logger.log(
      `🎉 Purchase completed successfully: ${event.transactionId}`,
    );
    this.logger.log(
      `User ${event.userId} received ${event.quantity} x ${event.itemId} for ${event.totalPrice}`,
    );
    this.logger.debug(`Completed at: ${event.completedAt}`);

    // 성공 메트릭 수집
    this.collectSuccessMetrics(event);
  }

  private async handlePurchaseFailed(
    event: PurchaseFailedEvent,
  ): Promise<void> {
    this.logger.error(`❌ Purchase failed: ${event.transactionId}`);
    this.logger.error(
      `User: ${event.userId}, Item: ${event.itemId}, Failed at: ${event.failedStep}`,
    );
    this.logger.error(
      `Failure reason: ${event.failureReason} (Code: ${event.errorCode})`,
    );

    // 실패 메트릭 수집
    this.collectFailureMetrics(event);
  }

  private async handleCompensationInitiated(
    event: CompensationInitiatedEvent,
  ): Promise<void> {
    this.logger.log(`🔄 Compensation initiated: ${event.transactionId}`);
    this.logger.debug(
      `Compensation type: ${event.compensationType}, Original failed step: ${event.originalFailedStep}`,
    );
  }

  private async handleCompensationCompleted(
    event: CompensationCompletedEvent,
  ): Promise<void> {
    this.logger.log(`✅ Compensation completed: ${event.transactionId}`);
    this.logger.debug(
      `Compensation details: ${JSON.stringify(event.compensationDetails)}`,
    );
  }

  private async handleCompensationFailed(
    event: CompensationFailedEvent,
  ): Promise<void> {
    this.logger.error(`💥 Compensation failed: ${event.transactionId}`);
    this.logger.error(`Compensation type: ${event.compensationType}`);
    this.logger.error(
      `Failure reason: ${event.reason} (Code: ${event.errorCode})`,
    );

    // 보상 실패는 심각한 문제이므로 별도 알림이 필요할 수 있음
    this.handleCriticalCompensationFailure(event);
  }

  private collectSuccessMetrics(event: PurchaseCompletedEvent): void {
    // 실제 환경에서는 메트릭 수집 시스템 (Prometheus, DataDog 등)으로 전송
    this.logger.debug(
      `Metrics: Purchase success - User: ${event.userId}, Item: ${event.itemId}, Price: ${event.totalPrice}`,
    );
  }

  private collectFailureMetrics(event: PurchaseFailedEvent): void {
    // 실제 환경에서는 메트릭 수집 시스템으로 전송
    this.logger.debug(
      `Metrics: Purchase failure - Step: ${event.failedStep}, Error: ${event.errorCode}`,
    );
  }

  private async handleCriticalCompensationFailure(
    event: CompensationFailedEvent,
  ): Promise<void> {
    // 보상 실패는 데이터 정합성에 심각한 영향을 미칠 수 있음
    // 실제 환경에서는 다음과 같은 조치를 취할 수 있음:
    // 1. 즉시 운영팀에 알림 전송
    // 2. Dead Letter Queue에 이벤트 저장
    // 3. 수동 보상을 위한 작업 큐에 추가

    this.logger.error(
      `🚨 CRITICAL: Manual intervention required for compensation failure`,
    );
    this.logger.error(
      `Transaction: ${event.transactionId}, Type: ${event.compensationType}`,
    );

    // 실제로는 외부 알림 시스템 호출
    // await this.alertingService.sendCriticalAlert(event);
  }
}
