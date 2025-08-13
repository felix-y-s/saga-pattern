import { BaseEvent } from './interfaces/base-event';

export class PurchaseInitiatedEvent implements BaseEvent {
  readonly eventType = 'PurchaseInitiated';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly itemId: string,
    public readonly quantity: number,
    public readonly price: number,
    public readonly transactionId: string,
  ) {}
}

export class UserValidatedEvent implements BaseEvent {
  readonly eventType = 'UserValidated';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly transactionId: string,
    public readonly userBalance: number,
  ) {}
}

export class UserValidationFailedEvent implements BaseEvent {
  readonly eventType = 'UserValidationFailed';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly transactionId: string,
    public readonly reason: string,
    public readonly errorCode: string,
  ) {}
}

export class ItemGrantedEvent implements BaseEvent {
  readonly eventType = 'ItemGranted';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly itemId: string,
    public readonly quantity: number,
    public readonly transactionId: string,
  ) {}
}

export class ItemGrantFailedEvent implements BaseEvent {
  readonly eventType = 'ItemGrantFailed';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly itemId: string,
    public readonly transactionId: string,
    public readonly reason: string,
    public readonly errorCode: string,
  ) {}
}

export class LogRecordedEvent implements BaseEvent {
  readonly eventType = 'LogRecorded';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly transactionId: string,
    public readonly logId: string,
    public readonly logData: Record<string, any>,
  ) {}
}

export class LogFailedEvent implements BaseEvent {
  readonly eventType = 'LogFailed';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly transactionId: string,
    public readonly reason: string,
    public readonly errorCode: string,
    public readonly logData: Record<string, any>,
  ) {}
}

export class NotificationSentEvent implements BaseEvent {
  readonly eventType = 'NotificationSent';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly transactionId: string,
    public readonly notificationId: string,
    public readonly notificationType: string,
  ) {}
}

export class NotificationFailedEvent implements BaseEvent {
  readonly eventType = 'NotificationFailed';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly transactionId: string,
    public readonly reason: string,
    public readonly errorCode: string,
    public readonly notificationType: string,
  ) {}
}

export class PurchaseCompletedEvent implements BaseEvent {
  readonly eventType = 'PurchaseCompleted';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly itemId: string,
    public readonly quantity: number,
    public readonly transactionId: string,
    public readonly totalPrice: number,
    public readonly completedAt: Date,
  ) {}
}

export class PurchaseFailedEvent implements BaseEvent {
  readonly eventType = 'PurchaseFailed';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly userId: string,
    public readonly itemId: string,
    public readonly transactionId: string,
    public readonly failureReason: string,
    public readonly failedStep: string,
    public readonly errorCode: string,
  ) {}
}

export class CompensationInitiatedEvent implements BaseEvent {
  readonly eventType = 'CompensationInitiated';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly transactionId: string,
    public readonly compensationType: string,
    public readonly originalFailedStep: string,
  ) {}
}

export class CompensationCompletedEvent implements BaseEvent {
  readonly eventType = 'CompensationCompleted';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly transactionId: string,
    public readonly compensationType: string,
    public readonly compensationDetails: Record<string, any>,
  ) {}
}

export class CompensationFailedEvent implements BaseEvent {
  readonly eventType = 'CompensationFailed';

  constructor(
    public readonly eventId: string,
    public readonly timestamp: Date,
    public readonly aggregateId: string,
    public readonly version: number,
    public readonly transactionId: string,
    public readonly compensationType: string,
    public readonly reason: string,
    public readonly errorCode: string,
  ) {}
}
