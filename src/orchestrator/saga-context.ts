import {
  SagaContext,
  SagaState,
  SagaStepResult,
  CompensationAction,
  SagaStatus,
  SagaStep,
} from './interfaces/saga-state.interface';

export class SagaContextImpl implements SagaContext {
  constructor(public state: SagaState) {}

  updateState(updates: Partial<SagaState>): void {
    Object.assign(this.state, updates);
  }

  addStepResult(result: SagaStepResult): void {
    this.state.steps.push(result);
    this.state.currentStep = result.step;

    if (result.status === 'failed') {
      this.state.status = SagaStatus.FAILED;
      this.state.failedAt = new Date();
      this.state.error = {
        step: result.step,
        code: result.error?.code || 'UNKNOWN_ERROR',
        message: result.error?.message || 'Step execution failed',
        details: result.error?.details,
      };
    }
  }

  addCompensation(compensation: CompensationAction): void {
    this.state.compensations.push(compensation);

    if (this.state.status !== SagaStatus.COMPENSATING) {
      this.state.status = SagaStatus.COMPENSATING;
    }
  }

  markCompleted(): void {
    this.state.status = SagaStatus.COMPLETED;
    this.state.completedAt = new Date();
    this.state.currentStep = undefined;
  }

  markFailed(step: SagaStep, error: any): void {
    this.state.status = SagaStatus.FAILED;
    this.state.failedAt = new Date();
    this.state.currentStep = step;
    this.state.error = {
      step,
      code: error?.code || error?.errorCode || 'UNKNOWN_ERROR',
      message: error?.message || error?.reason || 'Unknown error occurred',
      details: error,
    };
  }

  getExecutedSteps(): SagaStep[] {
    return this.state.steps
      .filter((step) => step.status === 'success')
      .map((step) => step.step);
  }

  getFailedStep(): SagaStep | null {
    const failedStep = this.state.steps.find(
      (step) => step.status === 'failed',
    );
    return failedStep ? failedStep.step : null;
  }

  shouldCompensate(): boolean {
    return (
      this.state.status === SagaStatus.FAILED &&
      this.getExecutedSteps().length > 0
    );
  }

  isCompleted(): boolean {
    return this.state.status === SagaStatus.COMPLETED;
  }

  isFailed(): boolean {
    return this.state.status === SagaStatus.FAILED;
  }

  isCompensating(): boolean {
    return this.state.status === SagaStatus.COMPENSATING;
  }

  getDuration(): number {
    const endTime = this.state.completedAt || this.state.failedAt || new Date();
    return endTime.getTime() - this.state.startedAt.getTime();
  }

  toJSON(): any {
    return {
      ...this.state,
      duration: this.getDuration(),
      executedSteps: this.getExecutedSteps(),
      failedStep: this.getFailedStep(),
    };
  }
}
