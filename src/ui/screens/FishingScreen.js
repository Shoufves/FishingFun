'use strict';

/**
 * ============================================================
 * src/ui/screens/FishingScreen.js — 钓鱼场景画面
 * 版本: 1.4 (T-009: 集成搏鱼小游戏)
 * 职责: 管理完整四段阶段流（抛竿→等待→搏鱼→结果）
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';
import { CastingSystem } from '../../fishing/CastingSystem.js';
import { CastingUI } from '../CastingUI.js';
import { WaitSystem } from '../../fishing/WaitSystem.js';
import { WaitingUI } from '../WaitingUI.js';
import { CatchSystem } from '../../fishing/CatchSystem.js';
import { CatchUI } from '../CatchUI.js';
import { FishGenerator } from '../../fishing/FishGenerator.js';
import { getDefaultEquipment } from '../../data/PlaceholderEquipment.js';
import { EquipmentManager } from '../../systems/EquipmentManager.js';

/* ============================================================
   常量
   ============================================================ */

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;
const RESULT_DISPLAY_TIME = 1500;
const FAIL_RESET_DELAY = 2000;
const TIMEOUT_DISPLAY_TIME = 2000;
const CATCH_END_DISPLAY_TIME = 2000;

/** @readonly @enum {string} */
const Phase = Object.freeze({
  READY:   'ready',
  CASTING: 'casting',
  RESULT:  'result',
  WAITING: 'waiting',
  HOOKING: 'hooking',
  CATCHING: 'catching',
});

/* ============================================================
   FishingScreen 类
   ============================================================ */

class FishingScreen extends Screen {
  constructor(router) {
    super(router);
    this._castingSystem = null;
    this._castingUI = null;
    this._waitSystem = null;
    this._waitingUI = null;
    this._catchSystem = null;
    this._catchUI = null;
    this._phase = Phase.READY;
    this._statusText = null;
    this._statusTimer = null;
    this._keyHandler = null;
    this._params = null;
    this._lastCastGrade = null;
    this._equipment = (window._equipmentManager
      ? window._equipmentManager.getTotalStats() : getDefaultEquipment());

    /** @type {number} 当前饵料 ID（0=基础饵） */
    this._currentBaitId = (window._baitSystem && window._baitSystem.getEquippedBait()) || 0;

    this._hooking = { remaining: 0, total: 2000, fish: null };

    /** @type {string} 地图名缓存（避免每帧查表） */
    this._mapName = '';
  }

  /** @override */
  onEnter(params) {
    super.onEnter(params);
    console.log('[FishingScreen] 进入钓鱼场景, params:', params);

    this._params = params || {};
    this._mapName = this._lookupMapName(this._params.mapId);
    this._castingSystem = new CastingSystem(this._equipment);
    this._castingUI = new CastingUI();
    this._waitSystem = null;
    this._waitingUI = null;
    this._catchSystem = null;
    this._catchUI = null;
    this._phase = Phase.READY;
    this._statusText = null;
    this._statusTimer = null;
    this._lastCastGrade = null;

    this._keyHandler = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (e.type === 'keydown') {
          if (e.repeat) {
            // 长按自动重复：仅转发给 hold 长按保活（刷新活动时间戳，
            // 防止卡顿帧下超时保护误杀），不触发普通判定避免误打键
            if (this._phase === Phase.CATCHING && this._catchSystem &&
                !this._catchSystem.isFinished()) {
              this._catchSystem.handleHoldKeepAlive();
            }
            return;
          }
          // 传入事件时间戳 → 判定精度与帧率无关（参考 osu）
          this._handleSpace(e.timeStamp);
        } else if (e.type === 'keyup' && this._phase === Phase.CATCHING &&
                   this._catchSystem && !this._catchSystem.isFinished()) {
          const r = this._catchSystem.handleHoldRelease(e.timeStamp);
          if (r && r.hold) {
            const sound = r.grade === 'perfect' ? 'perfect'
              : r.grade === 'miss' ? 'miss' : 'click';
            this._playSound(sound);
          }
        }
        return;
      }
      // 数字键 1-9 切换饵料（按 BaitTable ID）
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9 && this._phase === Phase.READY) {
        if (!this._switchBait(n)) {
          this._statusText = 'Bait #' + n + ' not available';
        }
      }
      // B 键循环切换饵料
      if ((e.key === 'b' || e.key === 'B') && this._phase === Phase.READY) {
        if (window._baitSystem) window._baitSystem.cycleBait();
        this._refreshBaitId();
      }
    };
    this._addListener(document, 'keydown', this._keyHandler);
    this._addListener(document, 'keyup', this._keyHandler);
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
    if (this._phase === Phase.CASTING && this._castingSystem) {
      this._castingSystem.update(dt);
      if (!this._castingSystem.isActive() && !this._statusText) {
        this._onCastingResult({ grade: 'fail', progress: this._castingSystem.getProgress() });
      }
    }

    if (this._phase === Phase.WAITING && this._waitSystem) {
      this._waitSystem.update(dt);
    }

    if (this._phase === Phase.CATCHING && this._catchSystem) {
      this._catchSystem.update(dt);
      if (this._catchSystem.isFinished()) {
        this._onCatchEnd();
      }
    }

    if (this._phase === Phase.HOOKING) {
      this._hooking.remaining -= dt;
      if (this._hooking.remaining <= 0) {
        this._onHookTimeout();
      }
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

    this._drawHud(ctx, w);

    if (this._phase === Phase.CATCHING) {
      this._renderCatching(ctx, w, h);
      return;
    }

    if (this._phase === Phase.HOOKING) {
      this._renderHooking(ctx, w, h);
      return;
    }

    this._drawBackButton(ctx);

    if (this._phase === Phase.READY || this._phase === Phase.CASTING ||
        this._phase === Phase.RESULT) {
      this._renderCasting(ctx, w, h);
      return;
    }

    if (this._phase === Phase.WAITING) {
      this._renderWaiting(ctx, w, h);
    }
  }

  /**
   * 绘制 HUD：地图名 / 等级 / 经验条 / 金币
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w - 窗口宽
   * @private
   */
  _drawHud(ctx, w) {
    const eco = window._economy;
    if (!eco) return;
    const mapName = this._mapName;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 14px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#a0c4e0';
    ctx.fillText(mapName, 16, 58);

    ctx.font = '12px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#7a9aaa';
    ctx.fillText('\u7B49\u7EA7 Lv.' + eco.getLevel() + ' ' + eco.getTitle(), 16, 80);

    // 经验条
    const xpW = 150, xpH = 10, xpX = 16, xpY = 100;
    const prog = eco.getLevelProgress();
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(xpX, xpY, xpW, xpH);
    ctx.fillStyle = '#3a8ad0';
    ctx.fillRect(xpX + 1, xpY + 1, (xpW - 2) * prog.ratio, xpH - 2);
    ctx.strokeStyle = '#3a5a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(xpX, xpY, xpW, xpH);

    ctx.font = 'bold 14px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#f0d060';
    ctx.fillText('\u91D1\u5E01 ' + eco.getGold(), 16, 116);

    // 右侧快捷入口提示（商店/图鉴由其他画面进入）
    ctx.textAlign = 'right';
    ctx.font = '11px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#3a5a6a';
    ctx.fillText('ESC/Back \u8FD4\u56DE\u5730\u56FE', w - 16, 12);
  }

  /**
   * 查询地图名称
   * @param {number|undefined} mapId
   * @returns {string}
   * @private
   */
  _lookupMapName(mapId) {
    try {
      const maps = window.GameData ? window.GameData.MapDefinition : null;
      if (!maps) return '\u672A\u77E5\u5730\u56FE';
      const entry = maps.find(m => m.mapId === (mapId || 1));
      return entry ? entry.mapName : '\u672A\u77E5\u5730\u56FE';
    } catch (e) {
      return '\u672A\u77E5\u5730\u56FE';
    }
  }

  /** @private */
  _renderCasting(ctx, w, h) {
    if (!this._castingSystem || !this._castingUI) return;
    const barW = Math.min(320, w * 0.65);
    const barH = 28;
    const barX = (w - barW) / 2;
    const barY = h * 0.6;

    if (this._phase === Phase.READY) {
      this._castingUI.render(ctx, barX, barY, barW, barH, this._castingSystem, '', true);
      // 饵料信息
      this._drawBaitInfo(ctx, barX, barY + barH + 4, barW);
      this._drawCenteredText(ctx, 'Press SPACE / Click to cast',
        w / 2, barY + barH + 56, 'bold 18px Consolas,"Courier New",monospace', '#8ab0c0');
      return;
    }

    this._castingUI.render(ctx, barX, barY, barW, barH, this._castingSystem, this._statusText);
    if (this._phase === Phase.CASTING) {
      this._drawCenteredText(ctx, 'Press SPACE / Click to cast',
        w / 2, barY + barH + 28, '13px Consolas,"Courier New",monospace', '#4a6a7a');
    }
  }

  /** @private */
  _renderWaiting(ctx, w, h) {
    if (!this._waitSystem || !this._waitingUI) return;
    const floaterState = this._waitSystem.getFloaterState();
    this._waitingUI.render(ctx, w / 2, h * 0.4, floaterState, this._statusText);
  }

  /** @private */
  _renderCatching(ctx, w, h) {
    if (!this._catchSystem || !this._catchUI) return;
    const state = this._catchSystem.getState();

    // 绘制结果文字覆盖
    if (this._statusText && state.isFinished) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 32px Consolas,"Courier New",monospace';
      ctx.fillStyle = this._statusText === 'Caught!' ? '#40d080' : '#e06050';
      ctx.fillText(this._statusText, w / 2 + 2, h / 2 + 2); // 阴影（双层文字）
      ctx.fillStyle = this._statusText === 'Caught!' ? '#40d080' : '#e06050';
      ctx.fillText(this._statusText, w / 2, h / 2);

      ctx.font = '18px Consolas,"Courier New",monospace';
      ctx.fillStyle = '#8ab0c0';
      const fish = this._catchSystem.getFish();
      if (fish) {
        ctx.fillText(fish.fishName + ' (' + Math.floor(state.fishStamina.max) + 'HP)',
          w / 2, h / 2 + 40);
      }
      ctx.shadowBlur = 0;
      return;
    }

    // 正常渲染搏鱼界面
    this._catchUI.render(ctx, w, h, state);

    // 提示
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '12px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#3a5a6a';
    ctx.fillText('Press SPACE when note hits the green zone', w / 2, h - 20);
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
    this._addClickRegion(16, 12, 90, 36, () => { this.router.popTo('MAP_SELECT'); });
  }

  /* ============================================================
     阶段流转
     ============================================================ */

  /**
   * 空格/点击统一入口
   * @param {number} [eventStamp] - 输入事件时间戳（键盘传入，判定精度与帧率无关）
   */
  _handleSpace(eventStamp) {
    if (this._phase === Phase.READY) {
      this._startCasting();
      return;
    }
    if (this._phase === Phase.CASTING) {
      this._stopCasting();
      return;
    }
    if (this._phase === Phase.CATCHING && this._catchSystem && !this._catchSystem.isFinished()) {
      const result = this._catchSystem.handleInput(eventStamp);
      if (result) {
        const soundMap = { perfect: 'perfect', great: 'click', good: 'click', miss: 'miss', hold: 'click' };
        const sound = soundMap[result.grade] || 'click';
        this._playSound(sound);
      }
      return;
    }
    if (this._phase === Phase.HOOKING) {
      this._startCatchAfterHook();
    }
  }

  _startCasting() {
    if (!this._castingSystem) return;
    this._phase = Phase.CASTING;
    this._statusText = null;
    this._castingSystem.start(this._equipment);

    this._playSound('cast');
    if (DEBUG) console.log('[Fishing] 开始抛竿');
  }

  _stopCasting() {
    if (!this._castingSystem || !this._castingSystem.isActive()) return;
    const result = this._castingSystem.stop();
    this._onCastingResult(result);
  }

  _onCastingResult(result) {
    this._phase = Phase.RESULT;
    this._lastCastGrade = result.grade;
    const { grade } = result;

    // 抛竿判定成功（Perfect/Good/Poor）才消耗饵料；Cast Fail 不消耗（spec 2.1.2）
    if (grade !== 'fail') {
      this._consumeBaitOnce();
    }

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

  _scheduleNext(delay, enterWaiting) {
    this._statusTimer = setTimeout(() => {
      if (enterWaiting) {
        this._startWaiting();
      } else {
        this._resetToReady();
      }
    }, delay);
  }

  _startWaiting() {
    const mapId = (this._params && this._params.mapId) ? this._params.mapId : 1;
    // 无饵料时传 0 → WaitSystem 使用基础吸引力，与 UI 提示一致
    const baitId = this._currentBaitId || 0;

    this._waitSystem = new WaitSystem();
    this._waitingUI = new WaitingUI();
    this._statusText = null;

    this._waitSystem.onBite((fish) => { this._onFishBite(fish); });
    this._waitSystem.onTimeout(() => { this._onWaitTimeout(); });
    this._waitSystem.start(mapId, baitId, this._lastCastGrade, this._equipment);
    this._phase = Phase.WAITING;

    if (DEBUG) console.log('[Fishing] 进入等待阶段');
  }

  _onFishBite(fish) {
    this._playSound('bite');
    this._phase = Phase.HOOKING;
    this._statusText = 'Hit!';

    const hookTime = Math.max(1000, 2000 - (fish.rarity || 1) * 50);
    this._hooking = { remaining: hookTime, total: hookTime, fish };

    console.log('[Fishing] 鱼咬钩！ fish=' + fish.fishName +
      ' 刺鱼窗口 ' + hookTime + 'ms');
  }

  _renderHooking(ctx, w, h) {
    // 屏幕边缘红色闪烁（剩余≤1s时）
    if (this._hooking.remaining <= 1000 && Math.floor(Date.now() / 250) % 2 === 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(220, 40, 40, 0.25)';
      ctx.fillRect(0, 0, w, 6);
      ctx.fillRect(0, h - 6, w, 6);
      ctx.fillRect(0, 0, 6, h);
      ctx.fillRect(w - 6, 0, 6, h);
      ctx.restore();
    }

    // 浮漂保持等待时的位置（覆盖 sinking 下沉偏移）
    if (this._waitSystem && this._waitingUI) {
      const raw = this._waitSystem.getFloaterState();
      const floaterState = { ...raw, state: 'idle', progress: 0, offset: 0 };
      this._waitingUI.render(ctx, w / 2, h * 0.4, floaterState, '',
        'rgba(200, 40, 40, 0.25)');

      // 抖动的 Hit! 在浮漂正下方（与原 Waiting... 同位置）
      ctx.save();
      const sx = Math.sin(Date.now() / 60) * 2;
      ctx.translate(sx, 0);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = 'bold 20px Consolas,"Courier New",monospace';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillText('Hit!', w / 2 + 2, h * 0.4 + 34);
      ctx.fillStyle = '#e04040';
      ctx.fillText('Hit!', w / 2, h * 0.4 + 32);
      ctx.restore();
    }

    // 刺鱼进度条
    const barW = Math.min(260, w * 0.45);
    const barH = 14;
    const barX = (w - barW) / 2;
    const barY = h * 0.68;
    const pct = Math.max(0, this._hooking.remaining / this._hooking.total);

    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = pct > 0.3 ? '#c06030' : '#e04040';
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * pct, barH - 4);
    ctx.strokeStyle = '#3a5a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.font = 'bold 14px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText(Math.floor(pct * 100) + '%', w / 2, barY - 4);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '15px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#6a8a9a';
    ctx.fillText('Press SPACE!', w / 2, barY + barH + 10);
  }

  _startCatchAfterHook() {
    if (this._hooking.remaining <= 0) return;
    this._phase = Phase.CATCHING;
    this._statusText = null;

    // 通过 FishGenerator 生成完整鱼实例
    const generator = new FishGenerator();
    const fishInstance = generator.generate(this._hooking.fish);

    this._catchSystem = new CatchSystem();
    this._catchUI = new CatchUI();
    this._catchSystem.start(fishInstance, this._equipment);

    console.log('[Fishing] 刺鱼成功 ' + fishInstance.name +
      ' (' + fishInstance.quality + ')' +
      ' L=' + fishInstance.length.toFixed(1) + 'cm' +
      ' HP=' + this._catchSystem.getState().fishStamina.max);
  }

  _onHookTimeout() {
    this._statusText = 'Fish Gone!';
    this._playSound('miss');
    console.log('[Fishing] 刺鱼超时，鱼跑了');
    this._statusTimer = setTimeout(() => { this._resetToReady(); }, TIMEOUT_DISPLAY_TIME);
  }

  _onWaitTimeout() {
    this._statusText = 'Fish Gone!';
    this._statusTimer = setTimeout(() => { this._resetToReady(); }, TIMEOUT_DISPLAY_TIME);
  }

  _onCatchEnd() {
    if (!this._catchSystem) return;
    const result = this._catchSystem.getResult();
    this._phase = Phase.RESULT;

    if (result === 'win') {
      const fi = this._catchSystem.getFish();
      this._statusTimer = setTimeout(() => {
        this.router.push('RESULT', { fish: fi, mapId: this._params.mapId || 1 });
      }, 500);
      this._playSound('perfect');
      console.log('[Catch] 成功钓获！');
      return;
    } else {
      this._statusText = 'Lost!';
      this._playSound('miss');
      console.log('[Catch] 鱼逃脱！');
    }

    this._statusTimer = setTimeout(() => { this._resetToReady(); }, CATCH_END_DISPLAY_TIME);
  }

  _resetToReady() {
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    this._phase = Phase.READY;
    this._statusText = null;
    this._waitSystem = null;
    this._waitingUI = null;
    this._catchSystem = null;
    this._catchUI = null;
    this._hooking = { remaining: 0, total: 2000, fish: null };
    this._castingSystem = new CastingSystem(this._equipment);
    this._lastCastGrade = null;
    if (DEBUG) console.log('[Fishing] 回到就绪阶段');
  }

  /**
   * 抛竿判定成功后消耗 1 个饵料（基础饵无限；库存耗尽自动回基础饵）
   * @private
   */
  _consumeBaitOnce() {
    if (!window._baitSystem) return;
    // 基础饵（ID 0）恒可用：consumeBait 不消耗数量，且永不出现"无饵料"
    window._baitSystem.consumeBait();
    this._refreshBaitId();
  }

  /* ============================================================
     饵料管理
     ============================================================ */

  /**
   * 绘制饵料状态
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   */
  _drawBaitInfo(ctx, x, y, w) {
    const bs = window._baitSystem;
    if (!bs) return;
    const label = bs.getEquippedLabel();
    const attr = bs.getCurrentAttractiveness();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '12px Consolas,"Courier New",monospace';
    ctx.fillStyle = bs.getEquippedBait() !== null ? '#6a8a9a' : '#8a5650';
    ctx.fillText('\u9975\u6599: ' + label + ' (ATTR:' + attr + ')', x + w / 2, y);
    ctx.font = '10px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#3a5a6a';
    ctx.fillText('[1-9] switch  [B] cycle', x + w / 2, y + 16);
  }

  /** 从全局 BaitSystem 同步当前饵料 ID */
  _refreshBaitId() {
    if (window._baitSystem) {
      this._currentBaitId = window._baitSystem.getEquippedBait() || 0;
    }
  }

  /**
   * 按数字键直接切换饵料
   * @param {number} baitId
   */
  _switchBait(baitId) {
    const bs = window._baitSystem;
    if (!bs || bs.getBaitCount(baitId) <= 0) return false;
    bs.equipBait(baitId);
    this._refreshBaitId();
    return true;
  }

  /* ============================================================
     通用工具
     ============================================================ */

  _drawBackButton(ctx) {
    const bx = 16, by = 12, bw = 90, bh = 36;
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Consolas,"Courier New",monospace';
    ctx.fillStyle = '#a0c4e0';
    ctx.fillText('\u2190 Back', bx + bw / 2, by + bh / 2);
  }

  _drawCenteredText(ctx, text, x, y, font, color) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = font;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillText(text, x + 1, y + 1);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  _playSound(type) {
    try {
      const audio = window._audio;
      if (audio && typeof audio.playSFX === 'function') {
        audio.playSFX(type, 0.5);
      }
    } catch (e) { /* 静默降级 */ }
  }
}

export { FishingScreen };
