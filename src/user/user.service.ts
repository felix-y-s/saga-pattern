import { Injectable, Logger } from '@nestjs/common';

// 사용자 서비스 - 포인트 관리
@Injectable()
export class UserService {
  private users = new Map<string, { points: number }>([
    ['user1', { points: 5000 }],
    ['user2', { points: 1000 }],
  ]);

  async getUserPoints(userId: string): Promise<number> {
    console.log(`💰 [UserService] ${userId}의 포인트 조회`);
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('사용자를 찾을 수 없습니다.');
    }

    return user.points;
  }

  // WORD: deduct: 빼다
  async deductPoints(userId: string, amount: number): Promise<void> {
    Logger.log(`[UserService] 포인트 차감 프로세스 진행`);
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`회원을 찾을 수 없습니다. 아이디: ${userId}`);
    }
    if (user.points < amount) {
      throw new Error(
        `포인트가 부족합니다. 아이디:${userId}, 보유 포인트:${user.points}, 필요한 포인트:${amount}`,
      );
    }

    // 실제 차감
    user.points -= amount;
    Logger.log(`[UserService] 포인트 차감 완료: [${userId}]사용자의 (잔액:${user.points})`);

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  async addPoints(userId: string, amount: number): Promise<void> {
    Logger.log(`[UserService] ${userId}에게 ${amount}포인트 환불`);

    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`[${userId}] 사용자를 찾을 수 없습니다.`);
    }

    user.points += amount;
    Logger.log(`[UserService] ${userId}에게 ${amount} 포인트 환뷸완료! (잔액: ${user.points})`);
  }
}
