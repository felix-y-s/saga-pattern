import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ItemPurchaseOrchestratorService } from './item-purchase-orchestrator/item-purchase-orchestrator.service';
import { ItemService } from './item/item.service';
import { UserService } from './user/user.service';
import { LogService } from './log/log.service';
import { NotificationService } from './notification/notification.service';
import { ChoreographyUserService } from './choreography-user/choreography-user.service';
import { EventBus } from './event/eventBus';
import { ChoreographyItemService } from './choreography-item/choreography-item.service';
import { ChoreographyLogService } from './choreography-log/choreography-log.service';
import { ChoreographyNotificationService } from './choreography-notification/choreography-notification.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ItemPurchaseOrchestratorService, ItemService, UserService, LogService, NotificationService, ChoreographyUserService, EventBus, ChoreographyItemService, ChoreographyLogService, ChoreographyNotificationService],
})
export class AppModule {}
