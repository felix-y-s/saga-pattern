import { Test, TestingModule } from '@nestjs/testing';
import { ChoreographyUserService } from './choreography-user.service';

describe('ChoreographyUserService', () => {
  let service: ChoreographyUserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChoreographyUserService],
    }).compile();

    service = module.get<ChoreographyUserService>(ChoreographyUserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
