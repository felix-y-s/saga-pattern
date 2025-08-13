import { Module, Global } from '@nestjs/common';
import { UserService } from './user.service';
import { ItemService } from './item.service';
import { LogService } from './log.service';
import { NotificationService } from './notification.service';

@Global()
@Module({
  providers: [UserService, ItemService, LogService, NotificationService],
  exports: [UserService, ItemService, LogService, NotificationService],
})
export class ServicesModule {}
