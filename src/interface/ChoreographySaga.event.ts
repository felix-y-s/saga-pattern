import { PurchaseItemRequest } from './Purchase';

export const PurchaseEvent = {
  PURCHASE_STARTED: 'PURCHASE_STARTED',
  POINTS_DEDUCTED: 'POINTS_DEDUCTED',
  ITEM_ADDED: 'ITEM_ADDED',
  LOG_CREATED: 'LOG_CREATED',
  NOTIFICATION: 'NOTIFICATION',
  PURCHASE_FAILED: 'PURCHASE_FAILED',
} as const;

export const FailedStep = {
  POINTS_DEDUCTION: 'POINTS_DEDUCTION',
  ITEM_ADDITION: 'ITEM_ADDITION',
  LOG_ADDITION: 'LOG_ADDITION',
  NOTIFICATION: 'NOTIFICATION',
} as const;

export interface DomainEvent {
  eventId: string;
  eventType: string;
  timestamp: Date;
  data: any;
}

export interface PurchaseStartedEvent extends DomainEvent {
  eventType: typeof PurchaseEvent.PURCHASE_STARTED;
  data: {
    transactionId: string;
    request: PurchaseItemRequest;
  };
}

export interface PointsDeductedEvent extends DomainEvent {
  eventType: typeof PurchaseEvent.POINTS_DEDUCTED;
  data: {
    transactionId: string;
    userId: string;
    amount: number;
    request: PurchaseItemRequest;
  };
}

export interface ItemAddedEvent extends DomainEvent {
  eventType: typeof PurchaseEvent.ITEM_ADDED;
  data: {
    transactionId: string;
    userId: string;
    itemName: string;
    request: PurchaseItemRequest;
  };
}

export interface LogCreatedEvent extends DomainEvent {
  eventType: typeof PurchaseEvent.LOG_CREATED;
  data: {
    transactionId: string;
  };
}

export interface PurchaseFailedEvent extends DomainEvent {
  eventType: typeof PurchaseEvent.PURCHASE_FAILED;
  data: {
    transactionId: string;
    reason: string;
    failedStep: string;
    request: PurchaseItemRequest;
  };
}