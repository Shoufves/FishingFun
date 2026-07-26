'use strict';

/**
 * ============================================================
 * src/fishing/CastingSystem.js — 抛竿蓄力条逻辑系统
 * 版本: 1.2
 * 职责: 蓄力条状态管理、光标运动、判定逻辑
 * 约定: 纯逻辑，不依赖 UI 或渲染代码；装备参数从 start() 注入
 * ============================================================
 */

import { calcPerfectZoneWidth, calcCastSpeed } from './FormulaSheet.js';

const CURSOR_WIDTH = 4;
const MAX_ROUND_TRIPS = 3;
const MAX_BOUNCES = MAX_ROUND_TRIPS * 2;
const DEFAULT_PERFECT = 8;
const DEFAULT_GOOD = 30;
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

class CastingSystem {
  constructor() {
    this._progress = 0;
    this._direction = 1;
    this._speed = 83;
    this._perfectZone = {
      start: 50 - DEFAULT_PERFECT / 2,
      end: 50 + DEFAULT_PERFECT / 2,
    };
    this._goodZone = {
      start: 50 - DEFAULT_GOOD / 2,
      end: 50 + DEFAULT_GOOD / 2,
    };
    this._isCasting = false;
    this._bounceCount = 0;
  }

  /**
   * 开始抛竿
   * @param {Object} [equipment] - 装备属性
   */
  start(equipment) {
    this._progress = 0;
    this._direction = 1;
    this._isCasting = true;
    this._bounceCount = 0;

    const eq = equipment || {};
    const rod = eq.rod || {};
    const line = eq.line || {};
    const hook = eq.hook || {};

    // 动态目标区宽度（从 FormulaSheet）
    const perfWidth = calcPerfectZoneWidth(DEFAULT_PERFECT,
      rod.precision, line.sensitivity, hook.sharpness);
    const goodWidth = DEFAULT_GOOD + (perfWidth - DEFAULT_PERFECT) * 0.3;

    this._perfectZone = {
      start: 50 - perfWidth / 2,
      end: 50 + perfWidth / 2,
    };
    this._goodZone = {
      start: 50 - Math.max(perfWidth + 10, goodWidth) / 2,
      end: 50 + Math.max(perfWidth + 10, goodWidth) / 2,
    };

    // 光标速度受装备影响
    this._speed = calcCastSpeed(rod.precision);

    if (DEBUG) {
      console.log('[Casting] 抛竿开始 perfect=' + perfWidth.toFixed(1) +
        '%, speed=' + this._speed.toFixed(1) + '%/s');
    }
  }

  /** @param {number} deltaTime - ms */
  update(deltaTime) {
    if (!this._isCasting) return;
    const seconds = deltaTime / 1000;
    this._progress += this._direction * this._speed * seconds;

    if (this._progress >= 100) {
      this._progress = 100;
      this._bounceCount++;
      this._direction = -1;
      if (DEBUG) console.log('[Casting] 反弹 #' + this._bounceCount);
    } else if (this._progress <= 0) {
      this._progress = 0;
      this._bounceCount++;
      this._direction = 1;
      if (DEBUG) console.log('[Casting] 反弹 #' + this._bounceCount);
    }

    if (this._bounceCount >= MAX_BOUNCES) {
      this._isCasting = false;
      if (DEBUG) console.log('[Casting] 自动失败');
    }
  }

  /**
   * 玩家点击停止
   * @returns {{ grade: 'perfect'|'good'|'poor'|'fail', progress: number }}
   */
  stop() {
    if (!this._isCasting) {
      return { grade: 'fail', progress: this._progress };
    }
    this._isCasting = false;
    const grade = this._judge();
    if (DEBUG) {
      console.log('[Casting] progress=' + this._progress.toFixed(1) +
        ', grade=' + grade);
    }
    return { grade, progress: this._progress };
  }

  /** @returns {number} */
  getProgress() { return this._progress; }

  /** @returns {{ start: number, end: number }} */
  getPerfectZone() { return { ...this._perfectZone }; }

  /** @returns {{ start: number, end: number }} */
  getGoodZone() { return { ...this._goodZone }; }

  /** @returns {boolean} */
  isActive() { return this._isCasting; }

  /**
   * 判定等级
   * @returns {'perfect'|'good'|'poor'}
   */
  _judge() {
    const p = this._progress;
    const hc = CURSOR_WIDTH / 2;
    const cs = p - hc;
    const ce = p + hc;
    const perf = this._perfectZone;
    const good = this._goodZone;

    if (p >= perf.start && p <= perf.end) return 'perfect';

    const os = Math.max(cs, good.start);
    const oe = Math.min(ce, good.end);
    const ol = Math.max(0, oe - os);
    const ratio = ol / CURSOR_WIDTH;

    return ratio >= 0.5 ? 'good' : 'poor';
  }
}

export { CastingSystem, CURSOR_WIDTH, MAX_ROUND_TRIPS };
