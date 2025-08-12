import { Injectable } from '@nestjs/common';

@Injectable()
export class EventFactory {
  generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getCurrentTimestamp(): Date {
    return new Date();
  }

  generateVersion(): number {
    return 1;
  }
}