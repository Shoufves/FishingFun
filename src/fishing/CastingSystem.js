'use strict';

/**
 * ============================================================
 * src/fishing/CastingSystem.js — 抛竿蓄力条逻辑系统
 * 版本: 1.1
 * 职责: 蓄力条状态管理、光标运动、判定逻辑
 * 约定: 纯逻辑，不依赖 UI 或渲染代码
 * ============================================================
 */

/* ============================================================
   常量
   ============================================================ */

/** @type {number} 光标虚拟宽度（占蓄力条总宽的百分比） */
const CURSOR_WIDTH = 4;

/** @type {number} 最大往返次数（超过后自动失败） */
const MAX_ROUND_TRIPS = 3;

/** @type {number} 最大边界触及次数（往返次数 × 2） */
const MAX_BOUNCES = MAX_ROUND_TRIPS * 2;

/** @type {number} 完美区间宽度（占总条长百分比） */
const PERFECT_ZONE_WIDTH = 8;

/** @type {number} 良好区间宽度（占总条长百分比） */
const GOOD_ZONE_WIDTH = 30;

/** @type {boolean} 调试模式 */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/* ============================================================
   CastingSystem 类
   ============================================================ */

class CastingSystem {
  constructor() {
    /** @type {number} 当前光标位置 0-100 */
    this._progress = 0;

    /** @type {number} 移动方向: 1=向右, -1=向左 */
    this._direction = 1;

    /** @type {number} 光标移动速度（百分比/秒） */
    this._speed = 83;

    /** @type {{start: number, end: number}} 完美判定区间（绿色） */
    this._perfectZone = {
      start: 50 - PERFECT_ZONE_WIDTH / 2,
      end: 50 + PERFECT_ZONE_WIDTH / 2,
    };

    /** @type {{start: number, end: number}} 良好判定区间（蓝色，含完美区间） */
    this._goodZone = {
      start: 50 - GOOD_ZONE_WIDTH / 2,
      end: 50 + GOOD_ZONE_WIDTH / 2,
    };

    /** @type {boolean} 是否正在抛竿流程中 */
    this._isCasting = false;

    /** @type {number} 已完成的半程次数（每触及一次边界累加） */
    this._bounceCount = 0;
  }

  /**
   * 开始抛竿流程，重置所有状态
   */
  start() {
    this._progress = 0;
    this._direction = 1;
    this._isCasting = true;
    this._bounceCount = 0;

    if (DEBUG) console.log('[Casting] 抛竿开始');
  }

  /**
   * 每帧更新光标位置，处理边界反弹与往返计数
   * @param {number} deltaTime - 距上一帧的毫秒数（ms）
   */
  update(deltaTime) {
    if (!this._isCasting) return;

    const seconds = deltaTime / 1000;
    this._progress += this._direction * this._speed * seconds;

    // 边界反弹
    if (this._progress >= 100) {
      this._progress = 100;
      this._bounceCount++;
      this._direction = -1;
      if (DEBUG) {
        console.log('[Casting] 触及右边界, 反弹 #' + this._bounceCount);
      }
    } else if (this._progress <= 0) {
      this._progress = 0;
      this._bounceCount++;
      this._direction = 1;
      if (DEBUG) {
        console.log('[Casting] 触及左边界, 反弹 #' + this._bounceCount);
      }
    }

    // 超出最大往返次数 → 自动失败
    if (this._bounceCount >= MAX_BOUNCES) {
      this._isCasting = false;
      if (DEBUG) console.log('[Casting] 超出最大往返次数，自动失败');
    }
  }

  /**
   * 玩家点击停止，返回判定结果
   * 若已不在抛竿状态则返回 fail
   * @returns {{ grade: 'perfect'|'good'|'poor'|'fail', progress: number }}
   */
  stop() {
    if (!this._isCasting) {
      return { grade: 'fail', progress: this._progress };
    }

    this._isCasting = false;
    const grade = this._judge();

    if (DEBUG) {
      console.log(
        '[Casting] 停止抛竿, progress=' + this._progress.toFixed(1) +
        ', perfectZone=[' + this._perfectZone.start + ',' + this._perfectZone.end + ']' +
        ', goodZone=[' + this._goodZone.start + ',' + this._goodZone.end + ']' +
        ', grade=' + grade
      );
    }

    return { grade, progress: this._progress };
  }

  /**
   * 获取当前进度百分比
   * @returns {number} 0-100
   */
  getProgress() {
    return this._progress;
  }

  /**
   * 获取完美判定区间（绿色）
   * @returns {{ start: number, end: number }}
   */
  getPerfectZone() {
    return { start: this._perfectZone.start, end: this._perfectZone.end };
  }

  /**
   * 获取良好判定区间（蓝色）
   * @returns {{ start: number, end: number }}
   */
  getGoodZone() {
    return { start: this._goodZone.start, end: this._goodZone.end };
  }

  /**
   * 返回是否正在抛竿流程中
   * @returns {boolean}
   */
  isActive() {
    return this._isCasting;
  }

  /**
   * 根据光标位置判定等级
   * 判定逻辑（spec.md 2.1.2 + 用户反馈优化）：
   * - 光标在窄完美区间内 → perfect（绿色）
   * - 光标在宽良好区间内 → good（蓝色）
   * - 光标在良好区间外 → poor（红色）
   * @returns {'perfect'|'good'|'poor'}
   */
  _judge() {
    const p = this._progress;
    const halfCursor = CURSOR_WIDTH / 2;
    const cursorStart = p - halfCursor;
    const cursorEnd = p + halfCursor;

    const perf = this._perfectZone;
    const good = this._goodZone;

    // 光标中心点落在完美区间内 → perfect
    if (p >= perf.start && p <= perf.end) {
      return 'perfect';
    }

    // 光标与良好区间有 ≥50% 重叠 → good
    const overlapStart = Math.max(cursorStart, good.start);
    const overlapEnd = Math.min(cursorEnd, good.end);
    const overlapLength = Math.max(0, overlapEnd - overlapStart);
    const overlapRatio = overlapLength / CURSOR_WIDTH;

    if (overlapRatio >= 0.5) {
      return 'good';
    }

    return 'poor';
  }
}

export { CastingSystem, CURSOR_WIDTH, MAX_ROUND_TRIPS, PERFECT_ZONE_WIDTH, GOOD_ZONE_WIDTH };
