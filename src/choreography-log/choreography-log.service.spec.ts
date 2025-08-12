import { Test, TestingModule } from '@nestjs/testing';
import { ChoreographyLogService } from './choreography-log.service';

describe('ChoreographyLogService', () => {
  let service: ChoreographyLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChoreographyLogService],
    }).compile();

    service = module.get<ChoreographyLogService>(ChoreographyLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
