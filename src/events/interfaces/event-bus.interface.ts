import { BaseEvent } from './base-event';
import { EventHandler } from './event-handler.interface';

export interface IEventBus {
  publish<T extends BaseEvent>(event: T): Promise<void>;
  subscribe<T extends BaseEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): void;
  unsubscribe(eventType: string, handler: EventHandler): void;
  getSubscribers(eventType: string): EventHandler[];
}
