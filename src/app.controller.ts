import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { ItemPurchaseOrchestratorService } from './item-purchase-orchestrator/item-purchase-orchestrator.service';
import { PurchaseItemRequest } from './interface/Purchase';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly itemPurchaseOrchestratorService: ItemPurchaseOrchestratorService,
  ) {}

  @Get()
  getHello(): string {
    const request: PurchaseItemRequest = {
      userId: 'user1',
      itemId: 'item1',
      itemName: '전설 검',
      price: 2000,
      quantity: 1,
    };
    this.itemPurchaseOrchestratorService.purchaseItem(request);
    return this.appService.getHello();
  }
}
