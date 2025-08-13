import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { EventBusModule } from './events/event-bus.module';
import { ServicesModule } from './services/services.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { ChoreographyModule } from './choreography/choreography.module';

@Module({
  imports: [
    EventBusModule,
    ServicesModule,
    OrchestratorModule,
    ChoreographyModule, // 새로운 코레오그래피 모듈 추가
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
