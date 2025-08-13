/**
 * Saga Pattern Configuration
 * 
 * 오케스트레이션과 코레오그래피 패턴 간의 충돌을 방지하기 위한 설정
 * 동시에 두 패턴이 같은 이벤트를 처리하는 것을 방지
 */

export enum SagaPatternMode {
  ORCHESTRATION = 'orchestration',
  CHOREOGRAPHY = 'choreography',
}

export interface SagaPatternConfig {
  mode: SagaPatternMode;
  enableEventLogging: boolean;
  enableMetrics: boolean;
}

/**
 * 현재 활성화된 Saga 패턴 모드
 * 환경 변수 SAGA_PATTERN_MODE로 설정 가능 (기본값: orchestration)
 */
export const SAGA_PATTERN_CONFIG: SagaPatternConfig = {
  mode: (process.env.SAGA_PATTERN_MODE as SagaPatternMode) || SagaPatternMode.ORCHESTRATION,
  enableEventLogging: process.env.ENABLE_EVENT_LOGGING !== 'false',
  enableMetrics: process.env.ENABLE_SAGA_METRICS !== 'false',
};

/**
 * 현재 모드가 오케스트레이션인지 확인
 */
export function isOrchestrationMode(): boolean {
  return SAGA_PATTERN_CONFIG.mode === SagaPatternMode.ORCHESTRATION;
}

/**
 * 현재 모드가 코레오그래피인지 확인
 */
export function isChoreographyMode(): boolean {
  return SAGA_PATTERN_CONFIG.mode === SagaPatternMode.CHOREOGRAPHY;
}

/**
 * 런타임에 모드 변경 (테스트 및 개발 환경에서 사용)
 */
export function setSagaPatternMode(mode: SagaPatternMode): void {
  SAGA_PATTERN_CONFIG.mode = mode;
  console.log(`🔧 Saga pattern mode changed to: ${mode}`);
}

/**
 * 현재 설정 정보 반환
 */
export function getSagaPatternConfig(): SagaPatternConfig {
  return { ...SAGA_PATTERN_CONFIG };
}