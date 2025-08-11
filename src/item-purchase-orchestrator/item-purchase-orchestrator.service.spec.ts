import { Test, TestingModule } from '@nestjs/testing';
import { ItemPurchaseOrchestratorService } from './item-purchase-orchestrator.service';

describe('ItemPurchaseOrchestratorService', () => {
  let service: ItemPurchaseOrchestratorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ItemPurchaseOrchestratorService],
    }).compile();

    service = module.get<ItemPurchaseOrchestratorService>(ItemPurchaseOrchestratorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
