'use strict';

/**
 * ============================================================
 * src/ui/screens/FishingScreen.js — 钓鱼场景画面
 * 版本: 1.3 (T-008: 集成等待咬钩)
 * 职责: 整合适配引擎、等待系统，管理完整钓鱼三段阶段流
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';
import { CastingSystem } from '../../fishing/CastingSystem.js';
import { CastingUI } from '../CastingUI.js';
import { WaitSystem } from '../../fishing/WaitSystem.js';
import { WaitingUI } from '../WaitingUI.js';

/* ============================================================
   常量
   ============================================================ */

/** @type {boolean} 调试模式 */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** @type {number} 判定结果反馈显示时长（ms） */
const RESULT_DISPLAY_TIME = 1500;

/** @type {number} 失败后重置延迟（ms） */
const FAIL_RESET_DELAY = 2000;

/** @type {number} 超时后显示消息的时长（ms） */
const TIMEOUT_DISPLAY_TIME = 2000;

/**
 * 画面阶段枚举
 * @readonly @enum {string}
 */
const Phase = Object.freeze({
  READY:   'ready',    // 等待玩家开始抛竿
  CASTING: 'casting',  // 蓄力条运动中
  RESULT:  'result',   // 判定结果展示
  WAITING: 'waiting',  // 等待咬钩（T-008）
});

/* ============================================================
   FishingScreen 类
   ============================================================ */

class FishingScreen extends Screen {
  /**
   * @param {import('../../core/ScreenRouter.js').ScreenRouter} router
   */
  constructor(router) {
    super(router);

    /** @type {CastingSystem|null} */
    this._castingSystem = null;

    /** @type {CastingUI|null} */
    this._castingUI = null;

    /** @type {WaitSystem|null} */
    this._waitSystem = null;

    /** @type {WaitingUI|null} */
    this._waitingUI = null;

    /** @type {string} 当前画面阶段 */
    this._phase = Phase.READY;

    /** @type {string|null} 当前判定反馈文字 */
    this._statusText = null;

    /** @type {number|null} 状态切换延时器 ID */
    this._statusTimer = null;

    /** @type {Function|null} 绑定的键盘处理器引用 */
    this._keyHandler = null;

    /** @type {Object|null} 传入的参数 */
    this._params = null;

    /** @type {string|null} 抛竿判定等级（传入等待系统） */
    this._lastCastGrade = null;
  }

  /* ============================================================
     生命周期
     ============================================================ */

  /** @override */
  onEnter(params) {
    super.onEnter(params);
    console.log('[FishingScreen] 进入钓鱼场景, params:', params);

    this._params = params || {};
    this._castingSystem = new CastingSystem();
    this._castingUI = new CastingUI();
    this._waitSystem = null;
    this._waitingUI = null;
    this._phase = Phase.READY;
    this._statusText = null;
    this._statusTimer = null;
    this._lastCastGrade = null;

    this._keyHandler = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        this._handleSpace();
      }
    };
    this._addListener(document, 'keydown', this._keyHandler);
  }

  /** @override */
  onExit() {
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    this._keyHandler = null;
    super.onExit();
    if (DEBUG) console.log('[FishingScreen] 离开钓鱼场景');
  }

  /* ============================================================
     更新
     ============================================================ */

  /** @override */
  update(dt) {
    // CASTING 阶段：更新蓄力条
    if (this._phase === Phase.CASTING && this._castingSystem) {
      this._castingSystem.update(dt);
      if (!this._castingSystem.isActive() && !this._statusText) {
        this._onCastingResult({ grade: 'fail', progress: this._castingSystem.getProgress() });
      }
    }

    // WAITING 阶段：更新等待系统
    if (this._phase === Phase.WAITING && this._waitSystem) {
      this._waitSystem.update(dt);
    }
  }

  /* ============================================================
     渲染
     ============================================================ */

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    ctx.fillStyle = 'rgba(5, 15, 25, 0.25)';
    ctx.fillRect(0, 0, w, h);

    this._drawBackButton(ctx);

    // READY / CASTING / RESULT 阶段：蓄力条
    if (this._phase === Phase.READY ||
        this._phase === Phase.CASTING ||
        this._phase === Phase.RESULT) {
      this._renderCasting(ctx, w, h);
      return;
    }

    // WAITING 阶段：浮漂
    if (this._phase === Phase.WAITING) {
      this._renderWaiting(ctx, w, h);
    }
  }

  /**
   * 渲染蓄力条相关
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  _renderCasting(ctx, w, h) {
    if (!this._castingSystem || !this._castingUI) return;

    const barW = Math.min(320, w * 0.65);
    const barH = 28;
    const barX = (w - barW) / 2;
    const barY = h * 0.6;

    if (this._phase === Phase.READY) {
      this._castingUI.render(ctx, barX, barY, barW, barH,
        this._castingSystem, '', true);
      this._drawCenteredText(ctx, 'Press SPACE / Click to cast',
        w / 2, barY + barH + 28, 'bold 18px Consolas, "Courier New", monospace', '#8ab0c0');
      return;
    }

    this._castingUI.render(ctx, barX, barY, barW, barH,
      this._castingSystem, this._statusText);

    if (this._phase === Phase.CASTING) {
      this._drawCenteredText(ctx, 'Press SPACE / Click to cast',
        w / 2, barY + barH + 28, '13px Consolas, "Courier New", monospace', '#4a6a7a');
    }
  }

  /**
   * 渲染等待浮漂
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   */
  _renderWaiting(ctx, w, h) {
    if (!this._waitSystem || !this._waitingUI) return;

    const floaterState = this._waitSystem.getFloaterState();
    const cx = w / 2;
    const cy = h * 0.4;

    this._waitingUI.render(ctx, cx, cy, floaterState, this._statusText);

    // 鱼名提示
    const fish = this._waitSystem.getSelectedFish();
    if (fish && this._phase === Phase.WAITING && floaterState.state !== 'sinking') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.font = '11px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#3a5a6a';
      ctx.fillText('???', cx, cy - 60);
    }
  }

  /* ============================================================
     输入处理
     ============================================================ */

  /** @override */
  handleClick(mx, my) {
    if (super.handleClick(mx, my)) return true;
    this._handleSpace();
    return true;
  }

  /** @override */
  _setupRegions() {
    super._setupRegions();
    this._addClickRegion(16, 12, 90, 36, () => { this.router.pop(); });
  }

  /* ============================================================
     阶段流转
     ============================================================ */

  /**
   * 处理空格/点击：不同阶段行为不同
   * - READY → 开始抛竿
   * - CASTING → 停止抛竿并判定
   * - RESULT/WAITING → 无操作
   */
  _handleSpace() {
    if (this._phase === Phase.READY) {
      this._startCasting();
      return;
    }
    if (this._phase === Phase.CASTING) {
      this._stopCasting();
      return;
    }
  }

  /** 开始抛竿 */
  _startCasting() {
    if (!this._castingSystem) return;
    this._phase = Phase.CASTING;
    this._statusText = null;
    this._castingSystem.start();
    this._playSound('cast');
    if (DEBUG) console.log('[Fishing] 开始抛竿');
  }

  /** 停止抛竿并判定 */
  _stopCasting() {
    if (!this._castingSystem || !this._castingSystem.isActive()) return;
    const result = this._castingSystem.stop();
    this._onCastingResult(result);
  }

  /**
   * 处理抛竿判定结果
   * @param {{ grade: string, progress: number }} result
   */
  _onCastingResult(result) {
    this._phase = Phase.RESULT;
    this._lastCastGrade = result.grade;
    const { grade } = result;

    switch (grade) {
      case 'perfect':
        this._statusText = 'Perfect!';
        this._playSound('perfect');
        this._scheduleNext(RESULT_DISPLAY_TIME, true);
        break;
      case 'good':
        this._statusText = 'Good!';
        this._playSound('click');
        this._scheduleNext(RESULT_DISPLAY_TIME, true);
        break;
      case 'poor':
        this._statusText = 'Poor!';
        this._playSound('click');
        this._scheduleNext(RESULT_DISPLAY_TIME, true);
        break;
      case 'fail':
        this._statusText = 'Fail!';
        this._scheduleNext(FAIL_RESET_DELAY, false);
        break;
    }

    console.log('[Fishing] grade=' + grade +
      ', progress=' + result.progress.toFixed(1) +
      ' — ' + this._statusText);
  }

  /**
   * 安排下一个阶段
   * @param {number} delay - 延迟（ms）
   * @param {boolean} enterWaiting - true=进入等待, false=回到就绪
   */
  _scheduleNext(delay, enterWaiting) {
    this._statusTimer = setTimeout(() => {
      if (enterWaiting) {
        this._startWaiting();
      } else {
        this._resetToReady();
      }
    }, delay);
  }

  /** 进入等待咬钩阶段 */
  _startWaiting() {
    const mapId = (this._params && this._params.mapId) ? this._params.mapId : 1;
    const baitId = 1; // 占位，后续 T-012 接入真实装备系统

    this._waitSystem = new WaitSystem();
    this._waitingUI = new WaitingUI();
    this._statusText = null;

    // 注册回调
    this._waitSystem.onBite((fish) => {
      this._onFishBite(fish);
    });
    this._waitSystem.onTimeout(() => {
      this._onWaitTimeout();
    });

    this._waitSystem.start(mapId, baitId, this._lastCastGrade);
    this._phase = Phase.WAITING;

    if (DEBUG) console.log('[Fishing] 进入等待阶段');
  }

  /**
   * 鱼咬钩回调
   * @param {Object} fish
   */
  _onFishBite(fish) {
    this._statusText = 'Bite!';
    this._playSound('bite');
    console.log('[Fishing] 鱼咬钩！ fish=' + (fish ? fish.fishName : '?') +
      ' (T-009 Catch 阶段待实现)');

    // T-009 将在此处切换至搏鱼阶段
    // 当前：展示咬钩文字 2 秒后回到就绪
    this._statusTimer = setTimeout(() => {
      this._resetToReady();
    }, TIMEOUT_DISPLAY_TIME);
  }

  /** 等待超时回调 */
  _onWaitTimeout() {
    this._statusText = 'Fish Gone!';
    console.log('[Fishing] 等待超时，鱼跑了');
    this._statusTimer = setTimeout(() => {
      this._resetToReady();
    }, TIMEOUT_DISPLAY_TIME);
  }

  /** 重置到就绪阶段 */
  _resetToReady() {
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    this._phase = Phase.READY;
    this._statusText = null;
    this._waitSystem = null;
    this._waitingUI = null;
    this._castingSystem = new CastingSystem();
    this._lastCastGrade = null;
    if (DEBUG) console.log('[Fishing] 回到就绪阶段');
  }

  /* ============================================================
     通用 UI 工具
     ============================================================ */

  /**
   * 绘制返回按钮
   * @param {CanvasRenderingContext2D} ctx
   */
  _drawBackButton(ctx) {
    const bx = 16, by = 12, bw = 90, bh = 36;
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#a0c4e0';
    ctx.fillText('\u2190 Back', bx + bw / 2, by + bh / 2);
  }

  /**
   * 绘制居中文字
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} x
   * @param {number} y
   * @param {string} font
   * @param {string} color
   */
  _drawCenteredText(ctx, text, x, y, font, color) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
  }

  /**
   * 播放音效（安全调用）
   * @param {string} type
   */
  _playSound(type) {
    try {
      const audio = window._audio;
      if (audio && typeof audio.playSFX === 'function') {
        audio.playSFX(type, 0.5);
      }
    } catch (e) {
      // 静默降级
    }
  }
}

export { FishingScreen };
