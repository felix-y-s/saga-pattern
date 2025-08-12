import { Injectable, Logger } from '@nestjs/common';
import { UserValidationDto } from '../dtos/purchase-request.dto';
import { UserValidationResult, UserProfile } from '../interfaces/domain-services.interface';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  // 모의 사용자 데이터베이스
  private readonly users = new Map<string, UserProfile>([
    ['user-123', { userId: 'user-123', balance: 1000, status: 'active', purchaseLimit: 500 }],
    ['user-456', { userId: 'user-456', balance: 50, status: 'active', purchaseLimit: 100 }],
    ['user-suspended', { userId: 'user-suspended', balance: 1000, status: 'suspended', purchaseLimit: 0 }],
  ]);

  async validateUser(dto: UserValidationDto): Promise<UserValidationResult> {
    this.logger.debug(`Validating user: ${dto.userId} for transaction: ${dto.transactionId}`);
    
    try {
      const user = this.users.get(dto.userId);
      
      if (!user) {
        this.logger.warn(`User not found: ${dto.userId}`);
        return {
          isValid: false,
          userId: dto.userId,
          currentBalance: 0,
          reason: 'User not found',
          errorCode: 'USER_NOT_FOUND',
        };
      }

      if (user.status !== 'active') {
        this.logger.warn(`User not active: ${dto.userId}, status: ${user.status}`);
        return {
          isValid: false,
          userId: dto.userId,
          currentBalance: user.balance,
          reason: `User status is ${user.status}`,
          errorCode: 'USER_NOT_ACTIVE',
        };
      }

      if (user.balance < dto.requiredBalance) {
        this.logger.warn(`Insufficient balance: ${dto.userId}, required: ${dto.requiredBalance}, current: ${user.balance}`);
        return {
          isValid: false,
          userId: dto.userId,
          currentBalance: user.balance,
          reason: 'Insufficient balance',
          errorCode: 'INSUFFICIENT_BALANCE',
        };
      }

      if (dto.requiredBalance > user.purchaseLimit) {
        this.logger.warn(`Purchase limit exceeded: ${dto.userId}, limit: ${user.purchaseLimit}, required: ${dto.requiredBalance}`);
        return {
          isValid: false,
          userId: dto.userId,
          currentBalance: user.balance,
          reason: 'Purchase limit exceeded',
          errorCode: 'PURCHASE_LIMIT_EXCEEDED',
        };
      }

      // 잔액 차감 (실제로는 트랜잭션으로 처리해야 함)
      user.balance -= dto.requiredBalance;
      this.logger.log(`User validation successful: ${dto.userId}, remaining balance: ${user.balance}`);
      
      return {
        isValid: true,
        userId: dto.userId,
        currentBalance: user.balance,
      };
      
    } catch (error) {
      this.logger.error(`Error validating user ${dto.userId}:`, error);
      return {
        isValid: false,
        userId: dto.userId,
        currentBalance: 0,
        reason: 'Internal validation error',
        errorCode: 'VALIDATION_ERROR',
      };
    }
  }

  async compensateUserValidation(userId: string, amount: number, transactionId: string): Promise<boolean> {
    this.logger.debug(`Compensating user validation: ${userId}, amount: ${amount}, transaction: ${transactionId}`);
    
    try {
      const user = this.users.get(userId);
      if (!user) {
        this.logger.error(`Cannot compensate - user not found: ${userId}`);
        return false;
      }

      // 잔액 복원
      user.balance += amount;
      this.logger.log(`User validation compensated: ${userId}, restored balance: ${user.balance}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Error compensating user validation ${userId}:`, error);
      return false;
    }
  }

  async getUserProfile(userId: string): Promise<UserProfile | null> {
    return this.users.get(userId) || null;
  }

  // 테스트를 위한 메소드
  async resetUserBalance(userId: string, balance: number): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.balance = balance;
      this.logger.debug(`Reset user balance: ${userId} -> ${balance}`);
    }
  }
}