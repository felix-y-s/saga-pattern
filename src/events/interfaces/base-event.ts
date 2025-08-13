export interface BaseEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly aggregateId: string;
  readonly version: number;
}
