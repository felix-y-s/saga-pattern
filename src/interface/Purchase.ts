// WORD: Purchase: 구매
export interface PurchaseItemRequest {
  userId: string;
  itemId: string;
  itemName: string;
  price: number;
  quantity: number;
}

// WORD: compensation: 보상
export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  message: string;
  error?: string;
  compensations?: string[]; // 실행된 보상 트랜잭션들
}

export interface CompensationAction {
  name: string;
  execute: () => Promise<void>;
}