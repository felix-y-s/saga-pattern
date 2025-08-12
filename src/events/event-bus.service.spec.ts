import { Test, TestingModule } from '@nestjs/testing';
import { EventBusService } from './event-bus.service';
import { EventHandler } from './interfaces/event-handler.interface';
import { PurchaseInitiatedEvent } from './purchase-events';

class MockEventHandler implements EventHandler<PurchaseInitiatedEvent> {
  public handledEvents: PurchaseInitiatedEvent[] = [];
  
  async handle(event: PurchaseInitiatedEvent): Promise<void> {
    this.handledEvents.push(event);
  }
}

class FailingEventHandler implements EventHandler<PurchaseInitiatedEvent> {
  async handle(): Promise<void> {
    throw new Error('Handler failed');
  }
}

describe('EventBusService', () => {
  let service: EventBusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventBusService],
    }).compile();

    service = module.get<EventBusService>(EventBusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribe', () => {
    it('should subscribe handler to event type', () => {
      const handler = new MockEventHandler();
      
      service.subscribe('PurchaseInitiated', handler);
      
      expect(service.getSubscriberCount('PurchaseInitiated')).toBe(1);
      expect(service.getSubscribers('PurchaseInitiated')).toContain(handler);
    });

    it('should allow multiple handlers for same event type', () => {
      const handler1 = new MockEventHandler();
      const handler2 = new MockEventHandler();
      
      service.subscribe('PurchaseInitiated', handler1);
      service.subscribe('PurchaseInitiated', handler2);
      
      expect(service.getSubscriberCount('PurchaseInitiated')).toBe(2);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe handler from event type', () => {
      const handler = new MockEventHandler();
      
      service.subscribe('PurchaseInitiated', handler);
      service.unsubscribe('PurchaseInitiated', handler);
      
      expect(service.getSubscriberCount('PurchaseInitiated')).toBe(0);
    });

    it('should remove event type when no handlers remain', () => {
      const handler = new MockEventHandler();
      
      service.subscribe('PurchaseInitiated', handler);
      service.unsubscribe('PurchaseInitiated', handler);
      
      expect(service.getAllEventTypes()).not.toContain('PurchaseInitiated');
    });
  });

  describe('publish', () => {
    it('should publish event to subscribed handlers', async () => {
      const handler = new MockEventHandler();
      const event = new PurchaseInitiatedEvent(
        'evt-1',
        new Date(),
        'agg-1',
        1,
        'user-1',
        'item-1',
        1,
        100,
        'txn-1',
      );
      
      service.subscribe('PurchaseInitiated', handler);
      await service.publish(event);
      
      expect(handler.handledEvents).toHaveLength(1);
      expect(handler.handledEvents[0]).toBe(event);
    });

    it('should handle multiple handlers for same event', async () => {
      const handler1 = new MockEventHandler();
      const handler2 = new MockEventHandler();
      const event = new PurchaseInitiatedEvent(
        'evt-1',
        new Date(),
        'agg-1',
        1,
        'user-1',
        'item-1',
        1,
        100,
        'txn-1',
      );
      
      service.subscribe('PurchaseInitiated', handler1);
      service.subscribe('PurchaseInitiated', handler2);
      await service.publish(event);
      
      expect(handler1.handledEvents).toHaveLength(1);
      expect(handler2.handledEvents).toHaveLength(1);
    });

    it('should not throw when no handlers subscribed', async () => {
      const event = new PurchaseInitiatedEvent(
        'evt-1',
        new Date(),
        'agg-1',
        1,
        'user-1',
        'item-1',
        1,
        100,
        'txn-1',
      );
      
      await expect(service.publish(event)).resolves.not.toThrow();
    });

    it('should throw when handler fails', async () => {
      const failingHandler = new FailingEventHandler();
      const event = new PurchaseInitiatedEvent(
        'evt-1',
        new Date(),
        'agg-1',
        1,
        'user-1',
        'item-1',
        1,
        100,
        'txn-1',
      );
      
      service.subscribe('PurchaseInitiated', failingHandler);
      
      await expect(service.publish(event)).rejects.toThrow('Handler failed');
    });
  });

  describe('clear', () => {
    it('should clear all handlers', () => {
      const handler = new MockEventHandler();
      
      service.subscribe('PurchaseInitiated', handler);
      service.clear();
      
      expect(service.getAllEventTypes()).toHaveLength(0);
      expect(service.getSubscriberCount('PurchaseInitiated')).toBe(0);
    });
  });
});