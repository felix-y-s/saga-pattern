import { Injectable, Logger } from '@nestjs/common';
import { BaseEvent } from './interfaces/base-event';
import { EventHandler } from './interfaces/event-handler.interface';
import { IEventBus } from './interfaces/event-bus.interface';

@Injectable()
export class EventBusService implements IEventBus {
  private readonly logger = new Logger(EventBusService.name);
  private readonly eventHandlers = new Map<string, Set<EventHandler>>();

  async publish<T extends BaseEvent>(event: T): Promise<void> {
    this.logger.debug(`Publishing event: ${event.eventType}`, {
      eventId: event.eventId,
      aggregateId: event.aggregateId,
      timestamp: event.timestamp,
    });

    const handlers = this.eventHandlers.get(event.eventType) || new Set();
    
    if (handlers.size === 0) {
      this.logger.warn(`No handlers found for event type: ${event.eventType}`);
      return;
    }

    const publishPromises = Array.from(handlers).map(async (handler) => {
      try {
        await handler.handle(event);
        this.logger.debug(`Event ${event.eventType} handled successfully by ${handler.constructor.name}`);
      } catch (error) {
        this.logger.error(
          `Error handling event ${event.eventType} with ${handler.constructor.name}:`,
          error.stack,
        );
        throw error;
      }
    });

    await Promise.all(publishPromises);
  }

  subscribe<T extends BaseEvent>(eventType: string, handler: EventHandler<T>): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }

    this.eventHandlers.get(eventType)?.add(handler);
    this.logger.debug(`Subscribed ${handler.constructor.name} to ${eventType}`);
  }

  unsubscribe(eventType: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      this.logger.debug(`Unsubscribed ${handler.constructor.name} from ${eventType}`);
      
      if (handlers.size === 0) {
        this.eventHandlers.delete(eventType);
      }
    }
  }

  getSubscribers(eventType: string): EventHandler[] {
    const handlers = this.eventHandlers.get(eventType);
    return handlers ? Array.from(handlers) : [];
  }

  getAllEventTypes(): string[] {
    return Array.from(this.eventHandlers.keys());
  }

  getSubscriberCount(eventType: string): number {
    return this.eventHandlers.get(eventType)?.size || 0;
  }

  clear(): void {
    this.eventHandlers.clear();
    this.logger.debug('EventBus cleared all handlers');
  }
}