import { Test, TestingModule } from '@nestjs/testing';
import { ChoreographyItemService } from './choreography-item.service';

describe('ChoreographyItemService', () => {
  let service: ChoreographyItemService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChoreographyItemService],
    }).compile();

    service = module.get<ChoreographyItemService>(ChoreographyItemService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
