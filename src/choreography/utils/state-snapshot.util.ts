import { StateSnapshot } from '../../orchestrator/interfaces/saga-state.interface';

/**
 * 두 객체를 비교하여 변경된 속성만 추출해서 StateSnapshot을 생성하는 유틸리티
 */
export class StateSnapshotUtil {
  /**
   * 변경된 속성들을 자동으로 감지하여 StateSnapshot을 생성
   * @param before 변경 전 상태
   * @param after 변경 후 상태
   * @returns StateSnapshot 객체 또는 변경사항이 없으면 undefined
   */
  static createSnapshot(
    before: Record<string, any>,
    after: Record<string, any>,
  ): StateSnapshot | undefined {
    const changes = this.extractChanges(before, after);

    if (changes.length === 0) {
      return undefined; // 변경사항이 없으면 undefined 반환
    }

    return {
      before,
      after,
      changes,
    };
  }

  /**
   * 두 객체를 비교하여 변경된 필드들을 추출
   * @param before 변경 전 객체
   * @param after 변경 후 객체
   * @param prefix 중첩된 객체의 경우 필드명 접두사
   * @returns 변경된 필드들의 배열
   */
  private static extractChanges(
    before: Record<string, any>,
    after: Record<string, any>,
    prefix = '',
  ): Array<{ field: string; from: any; to: any }> {
    const changes: Array<{ field: string; from: any; to: any }> = [];

    // 모든 키를 합쳐서 확인 (before에만 있는 키, after에만 있는 키 모두 포함)
    const allKeys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);

    for (const key of allKeys) {
      const beforeValue = before?.[key];
      const afterValue = after?.[key];
      const fieldName = prefix ? `${prefix}.${key}` : key;

      // 값이 동일하면 스킵
      if (this.isEqual(beforeValue, afterValue)) {
        continue;
      }

      // 둘 다 객체이고 null이 아닌 경우 재귀적으로 비교
      if (
        this.isObject(beforeValue) &&
        this.isObject(afterValue) &&
        beforeValue !== null &&
        afterValue !== null
      ) {
        const nestedChanges = this.extractChanges(
          beforeValue,
          afterValue,
          fieldName,
        );
        changes.push(...nestedChanges);
      } else {
        // 값이 다르면 변경사항으로 추가
        changes.push({
          field: fieldName,
          from: beforeValue,
          to: afterValue,
        });
      }
    }

    return changes;
  }

  /**
   * 두 값이 동일한지 확인 (깊은 비교)
   */
  private static isEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a == null || b == null) return a === b;

    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((item, index) => this.isEqual(item, b[index]));
    }

    if (this.isObject(a) && this.isObject(b)) {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every((key) => this.isEqual(a[key], b[key]));
    }

    return false;
  }

  /**
   * 값이 객체인지 확인 (배열 제외)
   */
  private static isObject(value: any): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * 특정 필드들만 비교하여 StateSnapshot 생성
   * @param before 변경 전 상태
   * @param after 변경 후 상태
   * @param fields 비교할 필드명 배열
   * @returns StateSnapshot 객체 또는 변경사항이 없으면 undefined
   */
  static createSnapshotForFields(
    before: Record<string, any>,
    after: Record<string, any>,
    fields: string[],
  ): StateSnapshot | undefined {
    const filteredBefore: Record<string, any> = {};
    const filteredAfter: Record<string, any> = {};

    // 지정된 필드들만 추출
    for (const field of fields) {
      if (field.includes('.')) {
        // 중첩된 필드 처리 (예: "items.sword")
        const [parent, child] = field.split('.', 2);
        if (before?.[parent]) {
          if (!filteredBefore[parent]) filteredBefore[parent] = {};
          filteredBefore[parent][child] = before[parent][child];
        }
        if (after?.[parent]) {
          if (!filteredAfter[parent]) filteredAfter[parent] = {};
          filteredAfter[parent][child] = after[parent][child];
        }
      } else {
        // 단순 필드
        filteredBefore[field] = before?.[field];
        filteredAfter[field] = after?.[field];
      }
    }

    return this.createSnapshot(filteredBefore, filteredAfter);
  }
}
