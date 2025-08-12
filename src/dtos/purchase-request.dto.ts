export class PurchaseRequestDto {
  userId: string;
  itemId: string;
  quantity: number;
  price: number;
}

export class UserValidationDto {
  userId: string;
  transactionId: string;
  requiredBalance: number;
}

export class ItemGrantDto {
  userId: string;
  itemId: string;
  quantity: number;
  transactionId: string;
}

export class LogRecordDto {
  transactionId: string;
  userId: string;
  itemId: string;
  quantity: number;
  price: number;
  status: 'success' | 'failed';
  step: string;
  metadata?: Record<string, any>;
}

export class NotificationDto {
  userId: string;
  transactionId: string;
  type: 'purchase_success' | 'purchase_failed' | 'item_granted' | 'refund';
  message: string;
  metadata?: Record<string, any>;
}