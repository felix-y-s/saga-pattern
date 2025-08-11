import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ItemPurchaseOrchestratorService } from './item-purchase-orchestrator/item-purchase-orchestrator.service';
import { ItemService } from './item/item.service';
import { UserService } from './user/user.service';
import { LogService } from './log/log.service';
import { NotificationService } from './notification/notification.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, ItemPurchaseOrchestratorService, ItemService, UserService, LogService, NotificationService],
})
export class AppModule {}
