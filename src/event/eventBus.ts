import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from 'src/interface/ChoreographySaga.event';

@Injectable()
export class EventBus {
  private eventHandlers = new Map<string, Array<(event: DomainEvent) => Promise<void>>>();

  subscribe(eventType: string, handler: (event: DomainEvent) => Promise<void>) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  async publish(event: DomainEvent): Promise<void> {
    Logger.log(`🚀 [EventBus] 이벤트 발생: ${event.eventType}`);

    const handlers = this.eventHandlers.get(event.eventType) || [];

    // 모든 핸들러를 병렬로 실행
    const results = await Promise.allSettled(
      handlers.map(handler => handler(event))
    )

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        Logger.log(`❌ [EventBus] 핸들러 ${index} 실행 실패:`, result.reason);
      }
    })
  }
}