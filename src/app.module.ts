import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventBusModule } from './events/event-bus.module';
import { ServicesModule } from './services/services.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';

@Module({
  imports: [EventBusModule, ServicesModule, OrchestratorModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
