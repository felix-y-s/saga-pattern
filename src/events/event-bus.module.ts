import { Module, Global } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { EventFactory } from './event-factory';

@Global()
@Module({
  providers: [EventBusService, EventFactory],
  exports: [EventBusService, EventFactory],
})
export class EventBusModule {}