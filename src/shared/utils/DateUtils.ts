import {
  format,
  parse,
  parseISO,
  isValid,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
  differenceInYears,
  isBefore,
  isAfter,
  isEqual,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  isToday,
  isTomorrow,
  isYesterday,
  isWeekend,
  getDay,
  getMonth,
  getYear,
  setMonth,
  setYear,
  formatDistanceToNow,
  formatRelative,
  Locale,
} from 'date-fns';
import { ko } from 'date-fns/locale';

/**
 * date-fns 라이브러리를 기반으로 한 포괄적인 날짜 유틸리티 클래스
 *
 * 이 클래스는 다음 기능을 제공합니다:
 * - 날짜 포맷팅 및 파싱
 * - 날짜 계산 및 조작
 * - 날짜 비교 및 검증
 * - 한국어 로케일 지원
 * - 다양한 날짜 형식 변환
 */
export class DateUtils {
  private static readonly DEFAULT_LOCALE: Locale = ko;

  // 자주 사용되는 날짜 포맷들
  public static readonly FORMATS = {
    /** YYYY-MM-DD */
    DATE: 'yyyy-MM-dd',
    /** YYYY-MM-DD HH:mm:ss */
    DATETIME: 'yyyy-MM-dd HH:mm:ss',
    /** YYYY년 MM월 DD일 */
    KOREAN_DATE: 'yyyy년 MM월 dd일',
    /** YYYY년 MM월 DD일 HH시 mm분 */
    KOREAN_DATETIME: 'yyyy년 MM월 dd일 HH시 mm분',
    /** MM/DD/YYYY */
    US_DATE: 'MM/dd/yyyy',
    /** DD/MM/YYYY */
    EU_DATE: 'dd/MM/yyyy',
    /** HH:mm */
    TIME: 'HH:mm',
    /** HH:mm:ss */
    TIME_WITH_SECONDS: 'HH:mm:ss',
    /** ISO 8601 */
    ISO: "yyyy-MM-dd'T'HH:mm:ss.SSSxxx",
  } as const;

  /**
   * ## 로그용 날짜 함수
   *
   * 로그 출력에 최적화된 날짜 문자열을 생성합니다.
   * 다양한 로그 레벨과 용도에 맞는 형식을 제공합니다.
   *
   * @param options - 로그 날짜 옵션
   * @returns 로그용 날짜 문자열
   *
   * @example
   * ```typescript
   * // 기본 로그 (ISO + 밀리초)
   * DateUtils.date(); // "2024-03-15T14:30:45.123Z"
   *
   * // 간단한 로그
   * DateUtils.date({ format: 'simple' }); // "2024-03-15 14:30:45"
   *
   * // 상세 로그 (한국 시간대)
   * DateUtils.date({ format: 'detailed', timezone: 'KST' }); // "2024-03-15 23:30:45.123 KST"
   *
   * // 파일명용
   * DateUtils.date({ format: 'filename' }); // "20240315_143045"
   *
   * // 사용자 정의
   * DateUtils.date({ format: 'custom', pattern: 'yyyy/MM/dd HH:mm' }); // "2024/03/15 14:30"
   * ```
   */
  public static date(
    options: {
      /** 로그 형식 타입 */
      format?:
        | 'iso'
        | 'simple'
        | 'detailed'
        | 'compact'
        | 'filename'
        | 'korean'
        | 'custom';
      /** 타임존 표시 (KST, UTC 등) */
      timezone?: string;
      /** 밀리초 포함 여부 */
      includeMilliseconds?: boolean;
      /** custom 형식일 때 사용할 패턴 */
      pattern?: string;
      /** 특정 날짜 지정 (기본값: 현재 시간) */
      date?: Date;
    } = {},
  ): string {
    const {
      format = 'simple',
      timezone,
      includeMilliseconds = true,
      pattern,
      date: inputDate = new Date(),
    } = options;

    const targetDate = inputDate;

    // KST 변환이 필요한 경우
    const kstDate =
      timezone === 'KST'
        ? new Date(targetDate.getTime() + 9 * 60 * 60 * 1000)
        : targetDate;

    switch (format) {
      case 'iso':
        // ISO 8601 형식 (기본값)
        return targetDate.toISOString();

      case 'simple':
        // 간단한 형식: YYYY-MM-DD HH:mm:ss
        const baseFormat = includeMilliseconds
          ? 'yyyy-MM-dd HH:mm:ss.SSS'
          : 'yyyy-MM-dd HH:mm:ss';
        let result = this.formatDate(kstDate, baseFormat);
        if (timezone) {
          result += ` ${timezone}`;
        }
        return result;

      case 'detailed':
        // 상세 형식: YYYY-MM-DD HH:mm:ss.SSS [timezone]
        let detailedResult = this.formatDate(
          kstDate,
          'yyyy-MM-dd HH:mm:ss.SSS',
        );
        if (timezone) {
          detailedResult += ` ${timezone}`;
        }
        return detailedResult;

      case 'compact':
        // 압축 형식: YYYYMMDD_HHmmss
        const compactFormat = includeMilliseconds
          ? 'yyyyMMdd_HHmmss.SSS'
          : 'yyyyMMdd_HHmmss';
        return this.formatDate(kstDate, compactFormat);

      case 'filename':
        // 파일명 안전 형식: YYYYMMDD_HHmmss
        return this.formatDate(kstDate, 'yyyyMMdd_HHmmss');

      case 'korean':
        // 한국어 형식: YYYY년 MM월 DD일 HH시 mm분 ss초
        const koreanBase = includeMilliseconds
          ? 'yyyy년 MM월 dd일 HH시 mm분 ss초 SSS'
          : 'yyyy년 MM월 dd일 HH시 mm분 ss초';
        let koreanResult = this.formatDate(kstDate, koreanBase);
        if (includeMilliseconds) {
          koreanResult = koreanResult.replace(/(\d{3})$/, '$1밀리초');
        }
        if (timezone) {
          koreanResult += ` (${timezone})`;
        }
        return koreanResult;

      case 'custom':
        // 사용자 정의 형식
        if (!pattern) {
          throw new Error(
            'custom 형식을 사용할 때는 pattern을 지정해야 합니다.',
          );
        }
        let customResult = this.formatDate(kstDate, pattern);
        if (timezone) {
          customResult += ` ${timezone}`;
        }
        return customResult;

      default:
        return targetDate.toISOString();
    }
  }

  /**
   * ## 날짜 포맷팅
   *
   * Date 객체를 지정된 형식의 문자열로 변환합니다.
   *
   * @param date - 포맷팅할 날짜
   * @param formatString - 포맷 문자열 (기본값: YYYY-MM-DD)
   * @param locale - 로케일 설정 (기본값: 한국어)
   * @returns 포맷팅된 날짜 문자열
   *
   * @example
   * ```typescript
   * const date = new Date('2024-03-15T14:30:00');
   *
   * // 기본 포맷
   * DateUtils.formatDate(date); // "2024-03-15"
   *
   * // 한국어 포맷
   * DateUtils.formatDate(date, DateUtils.FORMATS.KOREAN_DATE); // "2024년 03월 15일"
   *
   * // 사용자 정의 포맷
   * DateUtils.formatDate(date, 'yyyy/MM/dd HH:mm'); // "2024/03/15 14:30"
   * ```
   */
  public static formatDate(
    date: Date,
    formatString: string = this.FORMATS.DATE,
    locale: Locale = this.DEFAULT_LOCALE,
  ): string {
    if (!this.isValidDate(date)) {
      throw new Error('유효하지 않은 날짜입니다.');
    }

    return format(date, formatString, { locale });
  }

  /**
   * ## 문자열을 날짜로 파싱
   *
   * 문자열을 지정된 형식에 따라 Date 객체로 변환합니다.
   *
   * @param dateString - 파싱할 날짜 문자열
   * @param formatString - 입력 문자열의 형식
   * @param referenceDate - 기준 날짜 (기본값: 현재 날짜)
   * @returns 파싱된 Date 객체
   *
   * @example
   * ```typescript
   * // 기본 날짜 파싱
   * DateUtils.parseDate('2024-03-15', 'yyyy-MM-dd');
   *
   * // 한국어 형식 파싱
   * DateUtils.parseDate('2024년 03월 15일', 'yyyy년 MM월 dd일');
   *
   * // 시간 포함 파싱
   * DateUtils.parseDate('2024/03/15 14:30', 'yyyy/MM/dd HH:mm');
   * ```
   */
  public static parseDate(
    dateString: string,
    formatString: string,
    referenceDate: Date = new Date(),
  ): Date {
    const parsedDate = parse(dateString, formatString, referenceDate);

    if (!this.isValidDate(parsedDate)) {
      throw new Error(`날짜 파싱에 실패했습니다: ${dateString}`);
    }

    return parsedDate;
  }

  /**
   * ## ISO 문자열 파싱
   *
   * ISO 8601 형식의 문자열을 Date 객체로 변환합니다.
   *
   * @param isoString - ISO 형식의 날짜 문자열
   * @returns 파싱된 Date 객체
   *
   * @example
   * ```typescript
   * DateUtils.parseISO('2024-03-15T14:30:00.000Z');
   * DateUtils.parseISO('2024-03-15T14:30:00+09:00');
   * ```
   */
  public static parseISO(isoString: string): Date {
    const parsedDate = parseISO(isoString);

    if (!this.isValidDate(parsedDate)) {
      throw new Error(`ISO 날짜 파싱에 실패했습니다: ${isoString}`);
    }

    return parsedDate;
  }

  /**
   * ## 날짜 유효성 검증
   *
   * Date 객체가 유효한 날짜인지 확인합니다.
   *
   * @param date - 검증할 날짜
   * @returns 유효한 날짜이면 true, 아니면 false
   *
   * @example
   * ```typescript
   * DateUtils.isValidDate(new Date('2024-03-15')); // true
   * DateUtils.isValidDate(new Date('invalid')); // false
   * ```
   */
  public static isValidDate(date: Date): boolean {
    return isValid(date);
  }

  // ==================== 날짜 계산 및 조작 ====================

  /**
   * ## 날짜에 일수 추가/제거
   *
   * 지정된 날짜에 일수를 추가하거나 제거합니다.
   *
   * @param date - 기준 날짜
   * @param days - 추가할 일수 (음수면 제거)
   * @returns 계산된 새로운 Date 객체
   */
  public static addDays(date: Date, days: number): Date {
    return days >= 0 ? addDays(date, days) : subDays(date, Math.abs(days));
  }

  /**
   * ## 날짜에 주수 추가/제거
   */
  public static addWeeks(date: Date, weeks: number): Date {
    return weeks >= 0 ? addWeeks(date, weeks) : subWeeks(date, Math.abs(weeks));
  }

  /**
   * ## 날짜에 월수 추가/제거
   */
  public static addMonths(date: Date, months: number): Date {
    return months >= 0
      ? addMonths(date, months)
      : subMonths(date, Math.abs(months));
  }

  /**
   * ## 날짜에 년수 추가/제거
   */
  public static addYears(date: Date, years: number): Date {
    return years >= 0 ? addYears(date, years) : subYears(date, Math.abs(years));
  }

  // ==================== 날짜 범위 생성 ====================

  /**
   * ## 날짜의 시작/끝 시점 구하기
   *
   * 특정 날짜의 하루 시작(00:00:00)과 끝(23:59:59.999) 시점을 구합니다.
   */
  public static getDayRange(date: Date): { start: Date; end: Date } {
    return {
      start: startOfDay(date),
      end: endOfDay(date),
    };
  }

  /**
   * ## 주의 시작/끝 날짜 구하기
   *
   * @param date - 기준 날짜
   * @param weekStartsOn - 주 시작 요일 (0: 일요일, 1: 월요일, 기본값: 1)
   */
  public static getWeekRange(
    date: Date,
    weekStartsOn: 0 | 1 | 2 | 3 | 4 | 5 | 6 = 1,
  ): { start: Date; end: Date } {
    return {
      start: startOfWeek(date, { weekStartsOn }),
      end: endOfWeek(date, { weekStartsOn }),
    };
  }

  /**
   * ## 월의 시작/끝 날짜 구하기
   */
  public static getMonthRange(date: Date): { start: Date; end: Date } {
    return {
      start: startOfMonth(date),
      end: endOfMonth(date),
    };
  }

  /**
   * ## 년의 시작/끝 날짜 구하기
   */
  public static getYearRange(date: Date): { start: Date; end: Date } {
    return {
      start: startOfYear(date),
      end: endOfYear(date),
    };
  }

  // ==================== 날짜 비교 ====================

  /**
   * ## 두 날짜 간의 차이 계산
   *
   * 두 날짜 사이의 차이를 다양한 단위로 계산합니다.
   */
  public static getDifference(laterDate: Date, earlierDate: Date) {
    return {
      days: differenceInDays(laterDate, earlierDate),
      weeks: differenceInWeeks(laterDate, earlierDate),
      months: differenceInMonths(laterDate, earlierDate),
      years: differenceInYears(laterDate, earlierDate),
    };
  }

  /**
   * ## 날짜 비교 메서드들
   */
  public static isBefore(date: Date, dateToCompare: Date): boolean {
    return isBefore(date, dateToCompare);
  }

  public static isAfter(date: Date, dateToCompare: Date): boolean {
    return isAfter(date, dateToCompare);
  }

  public static isEqual(date: Date, dateToCompare: Date): boolean {
    return isEqual(date, dateToCompare);
  }

  public static isSameDay(date: Date, dateToCompare: Date): boolean {
    return isSameDay(date, dateToCompare);
  }

  public static isSameWeek(date: Date, dateToCompare: Date): boolean {
    return isSameWeek(date, dateToCompare);
  }

  public static isSameMonth(date: Date, dateToCompare: Date): boolean {
    return isSameMonth(date, dateToCompare);
  }

  public static isSameYear(date: Date, dateToCompare: Date): boolean {
    return isSameYear(date, dateToCompare);
  }

  // ==================== 특수 날짜 검사 ====================

  /**
   * ## 특별한 날짜인지 확인
   */
  public static isToday(date: Date): boolean {
    return isToday(date);
  }

  public static isTomorrow(date: Date): boolean {
    return isTomorrow(date);
  }

  public static isYesterday(date: Date): boolean {
    return isYesterday(date);
  }

  public static isWeekend(date: Date): boolean {
    return isWeekend(date);
  }

  // ==================== 날짜 구성 요소 추출 ====================

  /**
   * ## 날짜 구성 요소 추출
   *
   * 날짜에서 년, 월, 일, 요일 등의 정보를 추출합니다.
   */
  public static getDateComponents(date: Date) {
    return {
      year: getYear(date),
      month: getMonth(date) + 1, // date-fns는 0부터 시작하므로 +1
      day: date.getDate(),
      dayOfWeek: getDay(date), // 0: 일요일, 1: 월요일, ...
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }

  /**
   * ## 날짜 구성 요소 설정
   *
   * 기존 날짜의 월이나 년도를 변경합니다.
   */
  public static setMonth(date: Date, month: number): Date {
    return setMonth(date, month - 1); // date-fns는 0부터 시작하므로 -1
  }

  public static setYear(date: Date, year: number): Date {
    return setYear(date, year);
  }

  // ==================== 상대적 시간 표현 ====================

  /**
   * ## 현재 시간으로부터의 상대적 거리 표현
   *
   * "3일 전", "2시간 후" 같은 형태로 표현합니다.
   *
   * @param date - 대상 날짜
   * @param options - 추가 옵션
   * @returns 상대적 시간 표현 문자열
   *
   * @example
   * ```typescript
   * const pastDate = DateUtils.addDays(new Date(), -3);
   * DateUtils.getRelativeTime(pastDate); // "3일 전"
   *
   * const futureDate = DateUtils.addHours(new Date(), 2);
   * DateUtils.getRelativeTime(futureDate); // "약 2시간 후"
   * ```
   */
  public static getRelativeTime(
    date: Date,
    options?: { addSuffix?: boolean; includeSeconds?: boolean },
  ): string {
    return formatDistanceToNow(date, {
      locale: this.DEFAULT_LOCALE,
      addSuffix: true,
      includeSeconds: false,
      ...options,
    });
  }

  /**
   * ## 상대적 날짜 표현
   *
   * "오늘", "어제", "지난 금요일" 같은 형태로 표현합니다.
   */
  public static getRelativeDate(
    date: Date,
    baseDate: Date = new Date(),
  ): string {
    return formatRelative(date, baseDate, { locale: this.DEFAULT_LOCALE });
  }

  // ==================== 유틸리티 메서드 ====================

  /**
   * ## 현재 날짜/시간 생성기
   */
  public static now(): Date {
    return new Date();
  }

  public static today(): Date {
    return startOfDay(new Date());
  }

  public static tomorrow(): Date {
    return addDays(this.today(), 1);
  }

  public static yesterday(): Date {
    return subDays(this.today(), 1);
  }

  /**
   * ## 날짜 범위 생성기
   *
   * 시작 날짜와 끝 날짜 사이의 모든 날짜를 배열로 반환합니다.
   *
   * @param startDate - 시작 날짜
   * @param endDate - 끝 날짜
   * @returns 날짜 배열
   *
   * @example
   * ```typescript
   * const start = new Date('2024-03-01');
   * const end = new Date('2024-03-05');
   * const dates = DateUtils.getDateRange(start, end);
   * // [2024-03-01, 2024-03-02, 2024-03-03, 2024-03-04, 2024-03-05]
   * ```
   */
  public static getDateRange(startDate: Date, endDate: Date): Date[] {
    const dates: Date[] = [];
    let currentDate = startOfDay(startDate);
    const end = startOfDay(endDate);

    while (currentDate <= end) {
      dates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    return dates;
  }

  /**
   * ## 날짜 복사
   *
   * Date 객체의 깊은 복사본을 생성합니다.
   */
  public static clone(date: Date): Date {
    return new Date(date.getTime());
  }

  /**
   * ## 여러 날짜 중 최대/최소값 찾기
   */
  public static max(...dates: Date[]): Date {
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  public static min(...dates: Date[]): Date {
    return new Date(Math.min(...dates.map((d) => d.getTime())));
  }

  /**
   * ## 날짜를 다양한 형식으로 변환
   *
   * 자주 사용하는 형식들로 빠르게 변환할 수 있는 헬퍼 메서드들입니다.
   */
  public static toISOString(date: Date): string {
    return date.toISOString();
  }

  public static toKoreanDate(date: Date): string {
    return this.formatDate(date, this.FORMATS.KOREAN_DATE);
  }

  public static toKoreanDateTime(date: Date): string {
    return this.formatDate(date, this.FORMATS.KOREAN_DATETIME);
  }

  public static toUSDate(date: Date): string {
    return this.formatDate(date, this.FORMATS.US_DATE);
  }

  public static toEUDate(date: Date): string {
    return this.formatDate(date, this.FORMATS.EU_DATE);
  }

  /**
   * ## 날짜 검증 및 안전한 변환
   *
   * 다양한 입력 타입을 안전하게 Date 객체로 변환합니다.
   *
   * @param input - 변환할 입력값 (Date, string, number)
   * @returns 변환된 Date 객체 또는 null
   */
  public static safeParseDate(
    input: Date | string | number | null | undefined,
  ): Date | null {
    if (!input) return null;

    let date: Date;

    if (input instanceof Date) {
      date = input;
    } else if (typeof input === 'string') {
      // ISO 형식 시도
      if (input.includes('T') || input.includes('Z')) {
        date = parseISO(input);
      } else {
        // 일반적인 날짜 형식들 시도
        date = new Date(input);
      }
    } else if (typeof input === 'number') {
      date = new Date(input);
    } else {
      return null;
    }

    return this.isValidDate(date) ? date : null;
  }

  /**
   * ## 날짜 디버깅 정보
   *
   * 개발 시 날짜 객체의 상세 정보를 확인할 수 있습니다.
   */
  public static debugDate(date: Date): object {
    if (!this.isValidDate(date)) {
      return { error: '유효하지 않은 날짜입니다.' };
    }

    const components = this.getDateComponents(date);

    return {
      original: date,
      iso: date.toISOString(),
      timestamp: date.getTime(),
      korean: this.toKoreanDateTime(date),
      components,
      relative: this.getRelativeTime(date),
      isToday: this.isToday(date),
      isWeekend: this.isWeekend(date),
      dayRanges: this.getDayRange(date),
      weekRanges: this.getWeekRange(date),
      monthRanges: this.getMonthRange(date),
    };
  }
}
