# Saga pattern
Saga Pattern은 마이크로서비스 아키텍처에서 분산 트랜잭션을 관리하는 디자인 패턴입니다. 전통적인 ACID 트랜잭션을 단일 데이터베이스가 아닌 여러 서비스에 걸쳐 구현할 때 사용합니다.
간단히 말해, 여러 개의 작은 트랜잭션들을 순차적으로 실행하고, 실패 시 이미 완료된 작업들을 되돌리는 방식입니다.

**트랜잭션이란?**
트랜잭션은 **"모두 성공하거나, 모두 실패하거나"**의 원칙을 따르는 작업 **단위입니다**.
```ts
// 은행 계좌 이체 예시
async transferMoney(fromAccount: string, toAccount: string, amount: number) {
  // 이 모든 작업이 하나의 트랜잭션
  await this.deductBalance(fromAccount, amount);    // A계좌에서 차감
  await this.addBalance(toAccount, amount);         // B계좌에 추가
  await this.createTransferRecord(fromAccount, toAccount, amount); // 기록 생성
  
  // 중간에 하나라도 실패하면? 모든 작업이 취소되어야 함!
}
```

**ACID 속성**
- Atomicity (원자성): 모두 성공 또는 모두 실패
- Consistency (일관성): 데이터 무결성 유지
- Isolation (격리성): 동시 실행되는 트랜잭션끼리 간섭 없음
- Durability (지속성): 성공한 트랜잭션은 영구 저장
```ts
typescript// 단일 데이터베이스에서는 쉽게 보장됨
@Transactional() // 이 어노테이션 하나로 ACID 보장!
async updateUserProfile(userId: string, profileData: any) {
  await this.userRepository.update(userId, profileData);
  await this.auditRepository.insert({ userId, action: 'profile_updated' });
  // 실패하면 자동으로 롤백됨
}
```

## 문제되는 사항
- 문제 1: 부분 실패(partial Failure)
```ts
  // 실패 시나리오 시뮬레이션
async demonstratePartialFailure() {
  console.log('🚀 주문 처리 시작...');
  
  try {
    // Step 1: 성공
    console.log('✅ 1단계: 주문 생성 완료');
    await this.createOrder();
    
    // Step 2: 성공  
    console.log('✅ 2단계: 재고 차감 완료');
    await this.decreaseInventory();
    
    // Step 3: 성공
    console.log('✅ 3단계: 포인트 차감 완료');
    await this.deductPoints();
    
    // Step 4: 실패! 💥
    console.log('❌ 4단계: 결제 처리 실패!');
    throw new Error('결제 서버 다운');
    
  } catch (error) {
    console.log('😱 문제 발생! 하지만 1,2,3단계는 이미 완료됨...');
    console.log('🤔 어떻게 되돌릴까?');
    
    // 수동으로 롤백? 😰
    // await this.cancelOrder();     // 주문 취소
    // await this.restoreInventory(); // 재고 복구  
    // await this.refundPoints();     // 포인트 복구
    // 하지만 이것도 실패할 수 있음!
  }
}
```
- 문제 2: 네트워크 지연과 타임아웃
```ts
// 네트워크 문제 시뮬레이션
async demonstrateNetworkIssues() {
  const timeout = 3000; // 3초 타임아웃
  
  try {
    console.log('📡 결제 서비스 호출 중...');
    
    const paymentResult = await Promise.race([
      this.paymentService.processPayment(), // 실제 결제 호출
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('타임아웃')), timeout)
      )
    ]);
    
  } catch (error) {
    console.log('⏰ 타임아웃 발생!');
    console.log('🤔 결제가 실제로 처리됐을까? 안 됐을까?'); // 불확실한 상태!
  }
}
```
## 해결책: Saga 패턴