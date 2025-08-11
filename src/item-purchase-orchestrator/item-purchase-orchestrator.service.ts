import { Injectable, Logger } from '@nestjs/common';
import {
  CompensationAction,
  PurchaseItemRequest,
} from 'src/interface/Purchase';
import { ItemService } from 'src/item/item.service';
import { LogService } from 'src/log/log.service';
import { NotificationService } from 'src/notification/notification.service';
import { UserService } from 'src/user/user.service';

@Injectable()
export class ItemPurchaseOrchestratorService {
  constructor(
    private readonly userService: UserService,
    private readonly itemService: ItemService,
    private readonly logService: LogService,
    private readonly notificationService: NotificationService,
  ) {}
  async purchaseItem(request: PurchaseItemRequest) {
    const compensations: string[] = [];
    const compensationActions: CompensationAction[] = [];
    const transactionId = this.generateTransactionId();

    try {
      // step 1: 포인트 차감
      await this.userService.deductPoints(request.userId, request.price);
      compensationActions.push({
        name: '포인트 환불',
        execute: () =>
          this.userService.addPoints(request.userId, request.price),
      });

      // step 2: 아이템 지급
      await this.itemService.addItemToInventory(
        request.userId,
        request.itemId,
        request.itemName,
      );
      compensationActions.push({
        name: '아이템 지급 취소',
        execute: () =>
          this.itemService.removeItemFromInventory(
            request.userId,
            request.itemName,
          ),
      });

      // step 3: 로그 기록
      await this.logService.createPurchaseLog(transactionId, request);
      compensationActions.push({
        name: '로그 취소',
        execute: () => this.logService.deletePurchaseLog(transactionId),
      });

      // step 4: 알림 발송
      try {
        await this.notificationService.sendPurchaseNotification(
          request.userId,
          request.itemName,
        );
      } catch (notificationError) {
        Logger.error(`notificationError: ${notificationError.message}`);
      }

      Logger.log(
        `[ItemPurchaseOrchestratorService] 아이템 구매가 완료되었습니다.(transactionId:${transactionId}`,
      );
    } catch (error) {
      Logger.error(`아이템 구매 중 오류 발생: ${error.message}`);
      Logger.log(`아이템 구매 복구 프로세스 진행(transactionId:${transactionId})`);
      try {
        for (const compensation of compensationActions.reverse()) {
          compensations.push(compensation.name);
          await compensation.execute();
        }
      } catch (error) {
        Logger.error(`아이템 구매 복구 프로세스 진행 중 오류 발생`);
      }
      Logger.log(
        `아이템 구매 복구 프로세스 진행 완료(transactionId:${transactionId}, 진행된 복구 프로세스:${compensations.join(', ')})`,
      );
    }
  }

  private generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
