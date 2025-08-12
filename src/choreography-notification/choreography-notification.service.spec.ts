import { Test, TestingModule } from '@nestjs/testing';
import { ChoreographyNotificationService } from './choreography-notification.service';

describe('ChoreographyNotificationService', () => {
  let service: ChoreographyNotificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChoreographyNotificationService],
    }).compile();

    service = module.get<ChoreographyNotificationService>(ChoreographyNotificationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
