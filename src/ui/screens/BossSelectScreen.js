'use strict';

/**
 * ============================================================
 * src/ui/screens/BossSelectScreen.js — Boss 挑战选择界面（需求2）
 * 版本: 1.0
 * 职责: 展示 Boss 列表（血量/体型/奖励/特性/技能/已击败标识），选择挑战
 * 说明: Boss 全部信息写入介绍；可重复挑战（奖励照发）
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';
import { BOSS_DATA } from '../../data/BossData.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** 卡片行高与间距 */
const CARD_H = 118;
const CARD_GAP = 10;

class BossSelectScreen extends Screen {
  constructor(router) {
    super(router);
    this._scrollY = 0;
    this._statusText = null;
    this._statusTimer = null;
  }

  /** @override */
  onEnter() {
    super.onEnter();
    this._scrollY = 0;
    this._statusText = null;
    this._wheelHandler = (e) => {
      e.preventDefault();
      this._scrollY += e.deltaY;
      this._clampScroll();
    };
    this._addListener(document, 'wheel', this._wheelHandler);
    if (DEBUG) console.log('[BossSelect] 进入 Boss 挑战');
  }

  /** @override */
  onExit() {
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    super.onExit();
  }

  /** 已击败的 Boss ID 列表 */
  _defeated() {
    try {
      const s = window.GameState;
      return (s && Array.isArray(s.bossDefeated)) ? s.bossDefeated : [];
    } catch (e) {
      return [];
    }
  }

  /** @returns {number} 最大滚动量 */
  _getScrollMax() {
    const h = window.innerHeight;
    const avail = h - 96 - 60;
    const content = BOSS_DATA.length * (CARD_H + CARD_GAP);
    return Math.max(0, content - avail);
  }

  /** 限制滚动范围 */
  _clampScroll() {
    this._scrollY = Math.max(0, Math.min(this._getScrollMax(), this._scrollY));
  }

  /**
   * 触摸拖动滚动（移动端）
   * @param {number} deltaY
   * @override
   */
  scrollBy(deltaY) {
    this._scrollY += deltaY;
    this._clampScroll();
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    ctx.fillStyle = 'rgba(20, 10, 20, 0.35)';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0c040';
    ctx.fillText('\u2694 BOSS \u6311\u6218', cx, 34);

    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#8a9aaa';
    ctx.fillText('\u51FB\u8D25 Boss \u83B7\u5F97\u91D1\u5E01\u5956\u52B1\uFF0C\u53EF\u91CD\u590D\u6311\u6218', cx, 56);

    // Boss 卡片列表
    const listStartY = 74;
    const listEndY = h - 48;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listStartY - 4, w, listEndY - listStartY + 8);
    ctx.clip();

    const listW = Math.min(560, w * 0.9);
    const defeated = this._defeated();
    BOSS_DATA.forEach((boss, index) => {
      const y = listStartY - this._scrollY + index * (CARD_H + CARD_GAP);
      if (y + CARD_H < listStartY || y > listEndY) return;
      this._drawBossCard(ctx, boss, y, cx, listW, defeated.indexOf(boss.id) !== -1);
    });
    ctx.restore();

    // 状态提示
    if (this._statusText) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#e0a040';
      ctx.fillText(this._statusText, cx, listEndY + 8);
    }

    this._drawBackButton(ctx);
  }

  /**
   * 绘制一张 Boss 卡片（全部信息写入介绍）
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} boss
   * @param {number} y
   * @param {number} cx
   * @param {number} listW
   * @param {boolean} defeated
   * @private
   */
  _drawBossCard(ctx, boss, y, cx, listW, defeated) {
    ctx.fillStyle = defeated ? '#1a2a2a' : '#241a2a';
    ctx.fillRect(cx - listW / 2, y, listW, CARD_H);
    ctx.strokeStyle = defeated ? '#4a6a4a' : '#c08030';
    ctx.lineWidth = defeated ? 1 : 2;
    ctx.strokeRect(cx - listW / 2, y, listW, CARD_H);

    // 第一行：名称 + 已击败标识
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 17px Consolas, "Courier New", monospace';
    ctx.fillStyle = defeated ? '#7a9a7a' : '#f0c040';
    ctx.fillText(boss.name, cx - listW / 2 + 14, y + 16);
    ctx.font = '10px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#6a7a8a';
    ctx.fillText(boss.enName, cx - listW / 2 + 14 + ctx.measureText(boss.name).width + 14, y + 16);

    if (defeated) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 14px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#40d080';
      ctx.fillText('\u2705 \u5DF2\u51FB\u8D25\uFF01', cx + listW / 2 - 14, y + 16);
      ctx.textAlign = 'left';
    }

    // 数值行（自适应截断，窄屏不超界）
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#c8b090';
    const numText = '\u8840\u91CF ' + boss.baseStamina +
      '  |  \u4F53\u957F ' + boss.minLengthCm + '~' + boss.maxLengthCm + 'cm' +
      '  |  \u91CD\u91CF ' + boss.minWeightKg + '~' + boss.maxWeightKg + 'kg' +
      '  |  \u5956\u52B1 ' + boss.reward + ' \u91D1\u5E01';
    ctx.fillText(this._truncate(ctx, numText, listW - 28), cx - listW / 2 + 14, y + 38);

    // 特性（自适应截断）
    ctx.fillStyle = '#e08060';
    ctx.fillText(this._truncate(ctx, '\u7279\u6027[' + boss.trait.name + '] ' + boss.trait.desc, listW - 28),
      cx - listW / 2 + 14, y + 58);

    // 技能（自适应截断）
    ctx.fillStyle = '#60a0e0';
    ctx.fillText(this._truncate(ctx, '\u6280\u80FD[' + boss.skill.name + '] ' + boss.skill.desc, listW - 28),
      cx - listW / 2 + 14, y + 76);

    // 描述（截断）
    ctx.font = '10px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#8a9aaa';
    const desc = this._truncate(ctx, boss.description, listW - 40);
    ctx.fillText(desc, cx - listW / 2 + 14, y + 96);

    // 右侧挑战提示
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#c08030';
    ctx.fillText(defeated ? '\u70B9\u51FB\u518D\u6218' : '\u70B9\u51FB\u6311\u6218', cx + listW / 2 - 14, y + 96);
  }

  /**
   * 截断文本
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} maxWidth
   * @returns {string}
   * @private
   */
  _truncate(ctx, text, maxWidth) {
    const str = String(text || '');
    if (ctx.measureText(str).width <= maxWidth) return str;
    let out = '';
    for (const ch of str) {
      if (ctx.measureText(out + ch + '\u2026').width > maxWidth) break;
      out += ch;
    }
    return out + '\u2026';
  }

  /**
   * 绘制返回按钮
   * @param {CanvasRenderingContext2D} ctx
   * @private
   */
  _drawBackButton(ctx) {
    const bw = 90, bh = 36, bx = 16, by = 12;
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(bx + 2, by + 2, bw - 4, bh - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#a0c4e0';
    ctx.fillText('\u2190 \u8FD4\u56DE', bx + bw / 2, by + bh / 2);
  }

  /** @override */
  _setupRegions() {
    super._setupRegions();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    this._addClickRegion(16, 12, 90, 36, () => { this.router.pop(); });

    const listStartY = 74;
    const listW = Math.min(560, w * 0.9);
    BOSS_DATA.forEach((boss, index) => {
      const y = listStartY - this._scrollY + index * (CARD_H + CARD_GAP);
      if (y + CARD_H < 70 || y > h - 48) return;
      this._addClickRegion(cx - listW / 2, y, listW, CARD_H, () => {
        this.router.push('BOSS_BATTLE', { bossId: boss.id });
      });
    });
  }
}

export { BossSelectScreen };
