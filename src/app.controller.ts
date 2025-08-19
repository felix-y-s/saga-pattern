import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { AppService } from './app.service';
import { EventBusService } from './events/event-bus.service';
import { EventFactory } from './events/event-factory';
import { PurchaseInitiatedEvent } from './events/purchase-events';
import { UserService } from './services/user.service';
import { ItemService } from './services/item.service';
import { LogService } from './services/log.service';
import { NotificationService } from './services/notification.service';
import { ItemPurchaseOrchestratorService } from './orchestrator/item-purchase-orchestrator.service';
import { SagaRepositoryService } from './orchestrator/saga-repository.service';
import { PurchaseCoordinatorService } from './choreography/purchase-coordinator.service';
import {
  getSagaPatternConfig,
  setSagaPatternMode,
  SagaPatternMode,
  isOrchestrationMode,
  isChoreographyMode,
} from './config/saga-pattern.config';
import { PurchaseLogEntry } from './interfaces/domain-services.interface';
import { PurchaseRequestDto, TransactionStatusResponseDto, SagaPatternConfigDto } from './dto/purchase-request.dto';

@ApiTags('saga')
@Controller()
export class AppController {
  private readonly logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly eventBus: EventBusService,
    private readonly eventFactory: EventFactory,
    private readonly userService: UserService,
    private readonly itemService: ItemService,
    private readonly logService: LogService,
    private readonly notificationService: NotificationService,
    private readonly orchestrator: ItemPurchaseOrchestratorService,
    private readonly sagaRepository: SagaRepositoryService,
    private readonly purchaseCoordinator: PurchaseCoordinatorService, // 새로운 코레오그래피 서비스
  ) {}

  @ApiOperation({ summary: 'Health Check' })
  @ApiResponse({ status: 200, description: '서비스 상태 확인' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiOperation({ summary: 'EventBus 테스트' })
  @ApiBody({ type: PurchaseRequestDto })
  @ApiResponse({ status: 201, description: '구매 이벤트 발행 성공' })
  @ApiResponse({ status: 400, description: '잘못된 요청 데이터' })
  @Post('test-eventbus')
  async testEventBus(
    @Body() body: PurchaseRequestDto & { price: number },
  ) {
    try {
      const transactionId = this.eventFactory.generateTransactionId();
      const eventId = this.eventFactory.generateEventId();

      const event = new PurchaseInitiatedEvent(
        eventId,
        this.eventFactory.getCurrentTimestamp(),
        transactionId,
        this.eventFactory.generateVersion(),
        body.userId,
        body.itemId,
        body.quantity,
        body.price,
        transactionId,
      );

      this.logger.log(`Publishing test event: ${event.eventType}`);
      await this.eventBus.publish(event);

      return {
        success: true,
        eventId,
        transactionId,
        message: 'Purchase initiated via EventBus (processing asynchronously)',
        processingInfo: {
          type: 'async',
          description: 'The purchase process is now running in the background',
          statusCheck: {
            url: `/saga/${transactionId}`,
            method: 'GET',
            polling: 'Check status every 1-2 seconds until completion',
          },
        },
        eventPublished: event.eventType,
      };
    } catch (error) {
      this.logger.error('Failed to publish test event:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Post('test-services')
  async testServices(
    @Body()
    body: {
      userId: string;
      itemId: string;
      quantity: number;
      price: number;
    },
  ) {
    const results = {
      user: null as any,
      item: null as any,
      log: null as any,
      notification: null as any,
    };

    try {
      // Test User Service
      const userResult = await this.userService.validateUser({
        userId: body.userId,
        transactionId: 'test-txn',
        requiredBalance: body.price,
      });
      results.user = userResult;

      // Test Item Service
      const itemResult = await this.itemService.grantItem({
        userId: body.userId,
        itemId: body.itemId,
        quantity: body.quantity,
        transactionId: 'test-txn',
      });
      results.item = itemResult;

      // Test Log Service
      const logResult = await this.logService.recordLog({
        transactionId: 'test-txn',
        userId: body.userId,
        itemId: body.itemId,
        quantity: body.quantity,
        price: body.price,
        status: 'success',
        step: 'test',
      });
      results.log = logResult;

      // Test Notification Service
      const notificationResult =
        await this.notificationService.sendNotification({
          userId: body.userId,
          transactionId: 'test-txn',
          type: 'purchase_success',
          message: 'Test purchase completed successfully',
        });
      results.notification = notificationResult;

      return {
        success: true,
        results,
      };
    } catch (error) {
      this.logger.error('Failed to test services:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
        results,
      };
    }
  }

  @Post('purchase')
  async purchase(
    @Body()
    body: {
      userId: string;
      itemId: string;
      quantity: number;
      price: number;
    },
  ) {
    try {
      this.logger.log(`Saga purchase request: ${JSON.stringify(body)}`);

      const result = await this.orchestrator.executePurchase({
        userId: body.userId,
        itemId: body.itemId,
        quantity: body.quantity,
        price: body.price,
      });

      this.logger.log(
        `Purchase result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.transactionId}`,
      );

      return result;
    } catch (error) {
      this.logger.error('Purchase failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @ApiOperation({ summary: '사가 트랜잭션 상태 조회' })
  @ApiParam({ name: 'transactionId', description: '트랜잭션 ID' })
  @ApiResponse({ 
    status: 200, 
    description: '트랜잭션 상태 조회 성공',
    type: TransactionStatusResponseDto,
  })
  @Get('saga/:transactionId')
  async getSagaState(@Param('transactionId') transactionId: string): Promise<TransactionStatusResponseDto> {
    console.log(
      `🚀 | AppController | getSagaState | transactionId:`,
      transactionId,
    );
    try {
      const sagaState = await this.orchestrator.getSagaState(transactionId);

      if (!sagaState) {
        return {
          found: false,
          message: `Saga not found: ${transactionId}`,
        };
      }

      return {
        found: true,
        saga: sagaState,
      };
    } catch (error) {
      this.logger.error(`Failed to get saga state: ${transactionId}`, error);
      return {
        found: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Get('sagas/stats')
  async getSagaStats() {
    try {
      const stats = await this.sagaRepository.getStatistics();
      return {
        success: true,
        statistics: stats,
      };
    } catch (error) {
      this.logger.error('Failed to get saga statistics:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Post('compensate/:transactionId')
  async compensateSaga(@Body('transactionId') transactionId: string) {
    try {
      this.logger.log(`Manual compensation request: ${transactionId}`);

      const result = await this.orchestrator.compensateSaga(transactionId);

      return {
        success: result,
        transactionId,
        message: result ? 'Compensation completed' : 'Compensation failed',
      };
    } catch (error) {
      this.logger.error(`Failed to compensate saga: ${transactionId}`, error);
      return {
        success: false,
        transactionId,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // 🎭 새로운 코레오그래피 패턴 엔드포인트들

  @Post('purchase/choreography')
  async purchaseWithChoreography(
    @Body()
    body: {
      userId: string;
      itemId: string;
      quantity: number;
      price: number;
    },
  ) {
    try {
      // 현재 모드 확인
      if (!isChoreographyMode()) {
        return {
          success: false,
          error:
            'Choreography mode is not active. Current mode: ' +
            getSagaPatternConfig().mode,
          hint: 'Use POST /config/saga-mode to switch to choreography mode, or restart app with SAGA_PATTERN_MODE=choreography',
        };
      }

      this.logger.log(
        `🎭 Choreography-based purchase request: ${JSON.stringify(body)}`,
      );

      const result = await this.purchaseCoordinator.initiatePurchase({
        userId: body.userId,
        itemId: body.itemId,
        quantity: body.quantity,
        price: body.price,
      });

      this.logger.log(`🎭 Purchase initiated: ${result.transactionId}`);

      return {
        success: true,
        transactionId: result.transactionId,
        status: result.status,
        message:
          'Purchase initiated via Choreography pattern (processing asynchronously)',
        processingInfo: {
          type: 'choreography',
          description: 'Independent event handlers will process each step',
          statusCheck: {
            url: `/choreography/transaction/${result.transactionId}`,
            method: 'GET',
            polling: 'Check status every 1-2 seconds until completion',
          },
          eventChain: [
            'PurchaseInitiated → UserValidationHandler',
            'UserValidated → ItemGrantHandler',
            'ItemGranted → LogRecordHandler',
            'LogRecorded → NotificationHandler',
            'Failures → CompensationHandler',
          ],
        },
      };
    } catch (error) {
      this.logger.error('🎭 Choreography purchase failed:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Get('choreography/transaction/:transactionId')
  async getChoreographyTransactionStatus(
    @Param('transactionId') transactionId: string,
  ) {
    console.log(
      '🚀 ~ AppController ~ getChoreographyTransactionStatus ~ transactionId:',
      transactionId,
    );
    try {
      const sagaState =
        await this.purchaseCoordinator.getTransactionStatus(transactionId);

      if (!sagaState) {
        return {
          found: false,
          message: `Transaction not found: ${transactionId}`,
        };
      }

      return {
        found: true,
        transaction: sagaState,
        patternUsed: 'choreography',
        eventHandlers: {
          completed: sagaState.steps.map((step) => ({
            step: step.step,
            status: step.status,
            executedAt: step.executedAt,
            duration: step.duration,
          })),
          compensations: sagaState.compensations || [],
        },
      };
    } catch (error) {
      this.logger.error(
        `🎭 Failed to get choreography transaction status: ${transactionId}`,
        error,
      );
      return {
        found: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Get('choreography/user/:userId/history')
  async getUserChoreographyHistory(@Param('userId') userId: string) {
    try {
      const history =
        await this.purchaseCoordinator.getUserPurchaseHistory(userId);

      return {
        success: true,
        userId,
        transactionCount: history.length,
        transactions: history.map((saga) => ({
          transactionId: saga.transactionId,
          status: saga.status,
          purchaseData: saga.purchaseData,
          startedAt: saga.startedAt,
          completedAt: saga.completedAt,
          failedAt: saga.failedAt,
          stepsCompleted: saga.steps.length,
          compensationsExecuted: saga.compensations?.length || 0,
        })),
        patternUsed: 'choreography',
      };
    } catch (error) {
      this.logger.error(
        `🎭 Failed to get choreography user history: ${userId}`,
        error,
      );
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Get('choreography/stats')
  async getChoreographyStats() {
    try {
      const stats = await this.purchaseCoordinator.getSystemStatistics();

      return {
        success: true,
        patternUsed: 'choreography',
        statistics: stats,
        description: {
          pattern: 'Event-driven choreography',
          characteristics: [
            'Decentralized control',
            'Event-based communication',
            'Independent handler services',
            'Loose coupling between components',
            'Self-contained compensation logic',
          ],
        },
      };
    } catch (error) {
      this.logger.error('🎭 Failed to get choreography statistics:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Post('choreography/clear')
  async clearChoreographyTransactions() {
    try {
      await this.purchaseCoordinator.clearAllTransactions();

      return {
        success: true,
        message: 'All choreography transactions cleared',
        warning: 'This operation should only be used in development/testing',
      };
    } catch (error) {
      this.logger.error('🎭 Failed to clear choreography transactions:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  // 🔍 패턴 비교 엔드포인트
  @Get('patterns/comparison')
  getPatternsComparison() {
    const currentConfig = getSagaPatternConfig();

    return {
      currentMode: currentConfig.mode,
      currentModeActive: {
        orchestration: isOrchestrationMode(),
        choreography: isChoreographyMode(),
      },
      patterns: {
        orchestration: {
          endpoint: '/purchase',
          description: 'Centralized control with direct service calls',
          characteristics: [
            'Central orchestrator manages all steps',
            'Direct service dependencies',
            'Sequential execution with error handling',
            'Tight coupling between orchestrator and services',
          ],
          advantages: [
            'Easy to understand',
            'Clear control flow',
            'Simple debugging',
          ],
          disadvantages: [
            'Single point of failure',
            'Tight coupling',
            'Hard to extend',
          ],
          active: isOrchestrationMode(),
        },
        choreography: {
          endpoint: '/purchase/choreography',
          description: 'Event-driven decentralized processing',
          characteristics: [
            'Independent event handlers per domain',
            'Event-based communication only',
            'Asynchronous processing chain',
            'Loose coupling between components',
          ],
          advantages: [
            'Loose coupling',
            'High scalability',
            'Independent deployment',
          ],
          disadvantages: [
            'Complex debugging',
            'Eventual consistency',
            'Event ordering complexity',
          ],
          active: isChoreographyMode(),
        },
      },
      statusEndpoints: {
        orchestration: '/saga/{transactionId}',
        choreography: '/choreography/transaction/{transactionId}',
      },
      statisticsEndpoints: {
        orchestration: '/sagas/stats',
        choreography: '/choreography/stats',
      },
      configEndpoints: {
        getCurrentConfig: 'GET /config/saga-mode',
        switchMode: 'POST /config/saga-mode',
        note: 'Mode switching requires application restart to take full effect',
      },
    };
  }

  // ⚙️ 설정 관리 엔드포인트들

  @ApiOperation({ summary: '사가 패턴 설정 조회' })
  @ApiResponse({ 
    status: 200, 
    description: '현재 사가 패턴 설정',
    type: SagaPatternConfigDto,
  })
  @Get('config/saga-mode')
  getSagaPatternConfig(): SagaPatternConfigDto {
    const config = getSagaPatternConfig();

    return {
      success: true,
      config,
      activeHandlers: {
        orchestration: isOrchestrationMode(),
        choreography: isChoreographyMode(),
      },
      warning:
        'Handler registration happens at module initialization. Mode changes may require restart.',
    };
  }

  @Post('config/saga-mode')
  setSagaPatternMode(@Body() body: { mode: string }) {
    try {
      const { mode } = body;

      if (!Object.values(SagaPatternMode).includes(mode as SagaPatternMode)) {
        return {
          success: false,
          error: `Invalid mode: ${mode}`,
          validModes: Object.values(SagaPatternMode),
        };
      }

      const oldConfig = getSagaPatternConfig();
      setSagaPatternMode(mode as SagaPatternMode);
      const newConfig = getSagaPatternConfig();

      this.logger.log(
        `🔧 Saga pattern mode changed: ${oldConfig.mode} → ${newConfig.mode}`,
      );

      return {
        success: true,
        previousMode: oldConfig.mode,
        newMode: newConfig.mode,
        warning:
          'Event handlers were registered at startup. Full mode change requires application restart.',
        recommendation: `Restart the application with SAGA_PATTERN_MODE=${mode} environment variable for complete activation.`,
        currentlyActive: {
          orchestration: isOrchestrationMode(),
          choreography: isChoreographyMode(),
        },
      };
    } catch (error) {
      this.logger.error('Failed to change saga pattern mode:', error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  @Get('logs/:userId')
  async getLogWithUserId(
    @Param('userId') userId: string,
  ): Promise<PurchaseLogEntry[]> {
    return this.logService.getLogsByUser(userId);
  }
}
