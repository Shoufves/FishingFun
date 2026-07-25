'use strict';

/**
 * ============================================================
 * src/ui/screens/FishingScreen.js — 钓鱼场景画面
 * 版本: 1.2 (T-007: 集成抛竿蓄力条)
 * 职责: 整合 CastingSystem + CastingUI，管理输入与状态切换
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';
import { CastingSystem } from '../../fishing/CastingSystem.js';
import { CastingUI } from '../CastingUI.js';

/* ============================================================
   常量
   ============================================================ */

/** @type {boolean} 调试模式 */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** @type {number} 判定结果反馈显示时长（ms） */
const RESULT_DISPLAY_TIME = 1500;

/** @type {number} 失败后重置延迟（ms） */
const FAIL_RESET_DELAY = 2000;

/**
 * 画面阶段枚举
 * @readonly @enum {string}
 */
const Phase = Object.freeze({
  READY:   'ready',    // 等待玩家开始抛竿
  CASTING: 'casting',  // 蓄力条运动中
  RESULT:  'result',   // 判定结果展示
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

    /** @type {string} 当前画面阶段 */
    this._phase = Phase.READY;

    /** @type {string|null} 当前判定反馈文字 */
    this._statusText = null;

    /** @type {number|null} 状态切换延时器 ID */
    this._statusTimer = null;

    /** @type {Function|null} 绑定的键盘处理器引用 */
    this._keyHandler = null;
  }

  /* ============================================================
     生命周期
     ============================================================ */

  /** @override */
  onEnter(params) {
    super.onEnter(params);
    console.log('[FishingScreen] 进入钓鱼场景, params:', params);

    this._castingSystem = new CastingSystem();
    this._castingUI = new CastingUI();
    this._phase = Phase.READY;
    this._statusText = null;
    this._statusTimer = null;

    // 绑定键盘事件：READY 阶段开始抛竿，CASTING 阶段停止抛竿
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
    }

    // 自动检测系统级失败（3次往返后 CastingSystem 已设 isActive=false）
    if (this._phase === Phase.CASTING &&
        this._castingSystem &&
        !this._castingSystem.isActive() &&
        !this._statusText) {
      this._onCastingResult({ grade: 'fail', progress: this._castingSystem.getProgress() });
    }
  }

  /* ============================================================
     渲染
     ============================================================ */

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 半透明覆盖层
    ctx.fillStyle = 'rgba(5, 15, 25, 0.25)';
    ctx.fillRect(0, 0, w, h);

    // 返回按钮
    this._drawBackButton(ctx);

    if (this._castingSystem && this._castingUI) {
      const barW = Math.min(320, w * 0.65);
      const barH = 28;
      const barX = (w - barW) / 2;
      const barY = h * 0.6;

      // READY 阶段：显示静态蓄力条（无发光、光标停在起点）
      if (this._phase === Phase.READY) {
        this._castingUI.render(ctx, barX, barY, barW, barH,
          this._castingSystem, '', true);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 18px Consolas, "Courier New", monospace';
        ctx.fillStyle = '#8ab0c0';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 4;
        ctx.fillText('Press SPACE / Click to cast', w / 2, barY + barH + 28);
        ctx.shadowBlur = 0;

        return;
      }

      // CASTING / RESULT 阶段
      this._castingUI.render(ctx, barX, barY, barW, barH,
        this._castingSystem, this._statusText);

      if (this._phase === Phase.CASTING) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '13px Consolas, "Courier New", monospace';
        ctx.fillStyle = '#4a6a7a';
        ctx.fillText('Press SPACE / Click to cast', w / 2, barY + barH + 28);
      }
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
     内部方法
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
   * 处理空格/点击：不同阶段行为不同
   * - READY → 开始抛竿
   * - CASTING → 停止抛竿并判定
   * - RESULT → 无操作
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

    // RESULT 阶段：忽略输入
  }

  /**
   * 开始抛竿
   */
  _startCasting() {
    if (!this._castingSystem) return;

    this._phase = Phase.CASTING;
    this._statusText = null;
    this._castingSystem.start();
    this._playSound('cast');

    if (DEBUG) console.log('[Fishing] 开始抛竿');
  }

  /**
   * 停止抛竿并判定
   */
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
    const { grade } = result;

    switch (grade) {
      case 'perfect':
        this._statusText = 'Perfect!';
        this._playSound('perfect');
        this._scheduleReset(RESULT_DISPLAY_TIME);
        break;
      case 'good':
        this._statusText = 'Good!';
        this._playSound('click');
        this._scheduleReset(RESULT_DISPLAY_TIME);
        break;
      case 'poor':
        this._statusText = 'Poor!';
        this._playSound('click');
        this._scheduleReset(RESULT_DISPLAY_TIME);
        break;
      case 'fail':
        this._statusText = 'Fail!';
        this._scheduleReset(FAIL_RESET_DELAY);
        break;
    }

    console.log('[Fishing] grade=' + grade +
      ', progress=' + result.progress.toFixed(1) +
      ' — ' + this._statusText);
  }

  /**
   * 安排重置回 READY 阶段
   * @param {number} delay - 延迟时间（ms）
   */
  _scheduleReset(delay) {
    this._statusTimer = setTimeout(() => {
      this._resetToReady();
    }, delay);
  }

  /**
   * 重置到就绪阶段，等待下次抛竿
   */
  _resetToReady() {
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    this._phase = Phase.READY;
    this._statusText = null;
    if (this._castingSystem) {
      // 创建一个新的 CastingSystem 以确保完全重置
      this._castingSystem = new CastingSystem();
    }
    if (DEBUG) console.log('[Fishing] 回到就绪阶段');
  }

  /**
   * 播放音效（安全调用，静默降级）
   * @param {string} type - 音效名称
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
