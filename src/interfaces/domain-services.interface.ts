export interface UserValidationResult {
  isValid: boolean;
  userId: string;
  currentBalance: number;
  reason?: string;
  errorCode?: string;
}

export interface ItemGrantResult {
  success: boolean;
  userId: string;
  itemId: string;
  quantity: number;
  grantedAt: Date;
  reason?: string;
  errorCode?: string;
}

export interface AtomicItemGrantResult extends ItemGrantResult {
  /** 아이템 지급 전 재고 상태 */
  stockSnapshot: {
    before: number;
    after: number;
  };
  /** 사용자 아이템 변화 */
  userInventorySnapshot: {
    before: number; // 이전 보유 수량
    after: number; // 지급 후 수량
  };
}

export interface LogRecordResult {
  success: boolean;
  logId: string;
  recordedAt: Date;
  reason?: string;
  errorCode?: string;
}

export interface NotificationResult {
  success: boolean;
  notificationId: string;
  sentAt: Date;
  reason?: string;
  errorCode?: string;
}

export interface UserProfile {
  userId: string;
  balance: number;
  status: 'active' | 'inactive' | 'suspended';
  purchaseLimit: number;
}

export interface ItemInfo {
  itemId: string;
  name: string;
  price: number;
  stock: number;
  isAvailable: boolean;
}

export interface PurchaseLogEntry {
  logId: string;
  transactionId: string;
  userId: string;
  itemId: string;
  quantity: number;
  price: number;
  status: 'success' | 'failed' | 'compensated';
  step: string;
  createdAt: Date;
  metadata: Record<string, any>;
}
