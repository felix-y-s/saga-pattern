import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsPositive, IsUUID } from 'class-validator';

export class PurchaseRequestDto {
  @ApiProperty({
    description: '사용자 ID',
    example: 'user-123',
  })
  @IsString()
  userId: string;

  @ApiProperty({
    description: '아이템 ID',
    example: 'item-456',
  })
  @IsString()
  itemId: string;

  @ApiProperty({
    description: '구매 수량',
    example: 2,
    minimum: 1,
  })
  @IsNumber()
  @IsPositive()
  quantity: number;
}

export class TransactionStatusResponseDto {
  @ApiProperty({
    description: '트랜잭션 발견 여부',
    example: true,
  })
  found: boolean;

  @ApiProperty({
    description: '사용된 패턴',
    example: 'orchestration',
    enum: ['orchestration', 'choreography'],
    required: false,
  })
  patternUsed?: string;

  @ApiProperty({
    description: '트랜잭션 상태',
    example: {
      transactionId: 'tx-789',
      status: 'completed',
      steps: [],
    },
    required: false,
  })
  transaction?: any;

  @ApiProperty({
    description: '사가 상태 정보',
    required: false,
  })
  saga?: any;

  @ApiProperty({
    description: '에러 메시지',
    example: 'Transaction not found',
    required: false,
  })
  error?: string;

  @ApiProperty({
    description: '상태 메시지',
    example: 'Saga not found',
    required: false,
  })
  message?: string;
}

export class SagaPatternConfigDto {
  @ApiProperty({
    description: '성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '현재 활성화된 사가 패턴',
    example: 'orchestration',
    enum: ['orchestration', 'choreography'],
    required: false,
  })
  currentPattern?: string;

  @ApiProperty({
    description: '설정 변경 시간',
    example: '2024-01-01T00:00:00Z',
    required: false,
  })
  timestamp?: string;

  @ApiProperty({
    description: '설정 정보',
    required: false,
  })
  config?: any;

  @ApiProperty({
    description: '활성 핸들러 정보',
    required: false,
  })
  activeHandlers?: any;

  @ApiProperty({
    description: '경고 메시지',
    required: false,
  })
  warning?: string;
}