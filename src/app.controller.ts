import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
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
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('test-eventbus')
  async testEventBus(@Body() body: { userId: string; itemId: string; quantity: number; price: number }) {
    try {
      const transactionId = this.generateTransactionId();
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
        message: 'Event published successfully',
      };
    } catch (error) {
      this.logger.error('Failed to publish test event:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Post('test-services')
  async testServices(@Body() body: { userId: string; itemId: string; quantity: number; price: number }) {
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
      const notificationResult = await this.notificationService.sendNotification({
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
        error: error.message,
        results,
      };
    }
  }

  @Post('purchase')
  async purchase(@Body() body: { userId: string; itemId: string; quantity: number; price: number }) {
    try {
      this.logger.log(`Saga purchase request: ${JSON.stringify(body)}`);
      
      const result = await this.orchestrator.executePurchase({
        userId: body.userId,
        itemId: body.itemId,
        quantity: body.quantity,
        price: body.price,
      });
      
      this.logger.log(`Purchase result: ${result.success ? 'SUCCESS' : 'FAILED'} - ${result.transactionId}`);
      
      return result;
    } catch (error) {
      this.logger.error('Purchase failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  @Get('saga/:transactionId')
  async getSagaState(@Param('transactionId') transactionId: string) {
    console.log(`🚀 | AppController | getSagaState | transactionId:`, transactionId);
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
        error: error.message,
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
        error: error.message,
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
        error: error.message,
      };
    }
  }

  private generateTransactionId(): string {
    return `TXN_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `EVT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
