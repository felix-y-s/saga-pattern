import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { UserValidationDto } from '../dtos/purchase-request.dto';

describe('UserService', () => {
  let service: UserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateUser', () => {
    it('should validate user successfully with sufficient balance', async () => {
      const dto: UserValidationDto = {
        userId: 'user-123',
        transactionId: 'txn-1',
        requiredBalance: 100,
      };

      const result = await service.validateUser(dto);

      expect(result.isValid).toBe(true);
      expect(result.userId).toBe('user-123');
      expect(result.currentBalance).toBe(900); // 1000 - 100
    });

    it('should fail validation for insufficient balance', async () => {
      const dto: UserValidationDto = {
        userId: 'user-456',
        transactionId: 'txn-2',
        requiredBalance: 100,
      };

      const result = await service.validateUser(dto);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('INSUFFICIENT_BALANCE');
      expect(result.currentBalance).toBe(50);
    });

    it('should fail validation for non-existent user', async () => {
      const dto: UserValidationDto = {
        userId: 'non-existent',
        transactionId: 'txn-3',
        requiredBalance: 100,
      };

      const result = await service.validateUser(dto);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('USER_NOT_FOUND');
    });

    it('should fail validation for suspended user', async () => {
      const dto: UserValidationDto = {
        userId: 'user-suspended',
        transactionId: 'txn-4',
        requiredBalance: 100,
      };

      const result = await service.validateUser(dto);

      expect(result.isValid).toBe(false);
      expect(result.errorCode).toBe('USER_NOT_ACTIVE');
    });
  });

  describe('compensateUserValidation', () => {
    it('should compensate user validation successfully', async () => {
      // First validate to deduct balance
      await service.validateUser({
        userId: 'user-123',
        transactionId: 'txn-5',
        requiredBalance: 100,
      });

      const result = await service.compensateUserValidation(
        'user-123',
        100,
        'txn-5',
      );
      expect(result).toBe(true);

      const profile = await service.getUserProfile('user-123');
      expect(profile?.balance).toBe(1000); // Balance restored
    });

    it('should fail to compensate for non-existent user', async () => {
      const result = await service.compensateUserValidation(
        'non-existent',
        100,
        'txn-6',
      );
      expect(result).toBe(false);
    });
  });
});
