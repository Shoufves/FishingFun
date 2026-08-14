'use strict';

/**
 * ============================================================
 * src/ui/screens/EquipmentScreen.js — 装备管理界面 (T-017 UI)
 * 版本: 1.0
 * 职责: 四槽装备栏展示、背包列表、点击装备/卸下、总属性展示
 * 来源: task.md T-017, spec.md 第3章
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';
import { QUALITY_CONFIG, TYPE_STATS } from '../../data/EquipmentDef.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** 槽位定义 */
const SLOTS = [
  { key: 'rod',  label: '鱼竿' },
  { key: 'reel', label: '渔轮' },
  { key: 'line', label: '鱼线' },
  { key: 'hook', label: '鱼钩' },
];

/** 行高与间距 */
const ROW_H = 44;
const ROW_GAP = 6;
const SLOT_Y = 66;
const SLOT_H = 64;
const SLOT_GAP = 10;

/**
 * 背包装备首行 Y（渲染与点击区域共用，保证一致）
 * = SLOT_Y + SLOT_H + 12(总属性行) + 24(间距) + 26(背包标题)
 * @returns {number}
 */
function getRowStartY() {
  return SLOT_Y + SLOT_H + 62;
}

/** 属性中文名 */
const STAT_NAMES = {
  strength: '强度', precision: '精度', toughness: '韧性', length: '长度', elasticity: '弹性',
  gearRatio: '速比', dragPower: '刹车', lineCapacity: '容线', durability: '耐用',
  tensile: '拉力', sensitivity: '灵敏', stealth: '隐蔽', abrasion: '耐磨',
  sharpness: '锋利', size: '大小', barb: '倒刺',
};

class EquipmentScreen extends Screen {
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
    if (DEBUG) console.log('[EquipmentUI] 进入装备界面');
  }

  /** @override */
  onExit() {
    if (this._statusTimer) {
      clearTimeout(this._statusTimer);
      this._statusTimer = null;
    }
    super.onExit();
  }

  /** @returns {number} 最大滚动量 */
  _getScrollMax() {
    const h = window.innerHeight;
    const avail = h - 70 - SLOT_H - 40 - 60; // 标题+槽位+总属性+底部留白
    const count = window._equipmentManager ? window._equipmentManager.getBackpack().length : 0;
    const content = count * (ROW_H + ROW_GAP);
    return Math.max(0, content - avail);
  }

  /** 限制滚动范围 */
  _clampScroll() {
    this._scrollY = Math.max(0, Math.min(this._getScrollMax(), this._scrollY));
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;
    const mgr = window._equipmentManager;

    ctx.fillStyle = 'rgba(10, 20, 35, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // 标题
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText('装 备', cx, 30);

    // 四槽位
    const slotY = SLOT_Y;
    const slotW = Math.min(140, (w - 40 - SLOT_GAP * 3) / 4);
    const totalW = slotW * 4 + SLOT_GAP * 3;
    const slotX0 = cx - totalW / 2;
    SLOTS.forEach((slot, i) => {
      const x = slotX0 + i * (slotW + SLOT_GAP);
      this._drawSlot(ctx, mgr, slot, x, slotY, slotW, SLOT_H);
    });

    // 总属性
    const statsY = slotY + SLOT_H + 12;
    const total = mgr ? mgr.getTotalStats() : {};
    const statLines = this._formatTotalStats(total);
    ctx.textAlign = 'left';
    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#7a9aaa';
    ctx.fillText('总属性: ' + (statLines.length ? statLines.join('  ') : '（未装备）'), 16, statsY);

    // 背包列表
    const listStartY = statsY + 24;
    const listEndY = h - 44;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listStartY - 4, w, listEndY - listStartY + 8);
    ctx.clip();

    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#8ab0c0';
    ctx.fillText('背包（点击装备 / 点击已装备槽位卸下）', cx, listStartY + 12);

    const backpack = mgr ? mgr.getBackpack() : [];
    const listW = Math.min(620, w * 0.86);
    const rowStart = getRowStartY();
    backpack.forEach((eq, index) => {
      const y = rowStart - this._scrollY + index * (ROW_H + ROW_GAP);
      if (y + ROW_H < listStartY || y > listEndY) return;
      this._drawBackpackRow(ctx, eq, y, cx, listW);
    });
    if (backpack.length === 0) {
      ctx.textAlign = 'center';
      ctx.font = '13px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#5a7a8a';
      ctx.fillText('背包为空 — 前往商店购买装备', cx, rowStart + 20);
    }
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
   * 绘制一个装备槽位
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} mgr - EquipmentManager
   * @param {Object} slot - 槽位定义
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @private
   */
  _drawSlot(ctx, mgr, slot, x, y, w, h) {
    const eq = mgr ? mgr.getEquipped()[slot.key] : null;
    ctx.fillStyle = eq ? '#1a3a4a' : '#141f2c';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = eq ? '#3a8a6a' : '#2a3a4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#5a7a8a';
    ctx.fillText(slot.label, x + w / 2, y + 12);

    if (eq) {
      const qCfg = QUALITY_CONFIG[eq.quality] || QUALITY_CONFIG.COMMON;
      ctx.font = 'bold 13px Consolas, "Courier New", monospace';
      ctx.fillStyle = qCfg.color;
      ctx.fillText(eq.name, x + w / 2, y + 32);
      ctx.font = '10px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#6a8a9a';
      ctx.fillText(qCfg.label + ' ★' + this._qualityStars(eq.quality), x + w / 2, y + 50);
    } else {
      ctx.font = '12px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#3a5a6a';
      ctx.fillText('空', x + w / 2, y + 34);
    }
  }

  /**
   * 品质星级（1-5）
   * @param {string} quality
   * @returns {string}
   * @private
   */
  _qualityStars(quality) {
    const map = { COMMON: 1, UNCOMMON: 2, RARE: 3, EPIC: 4, LEGENDARY: 5 };
    return map[quality] || 1;
  }

  /**
   * 格式化总属性为一行文本
   * @param {Object} total
   * @returns {string[]}
   * @private
   */
  _formatTotalStats(total) {
    const parts = [];
    for (const slot of SLOTS) {
      const stats = total[slot.key] || {};
      const keys = Object.keys(stats);
      if (keys.length === 0) continue;
      const line = keys.map(k => (STAT_NAMES[k] || k) + ':' + stats[k]).join(' ');
      parts.push('[' + slot.label + '] ' + line);
    }
    return parts;
  }

  /**
   * 绘制一行背包装备
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} eq
   * @param {number} y
   * @param {number} cx
   * @param {number} listW
   * @private
   */
  _drawBackpackRow(ctx, eq, y, cx, listW) {
    const qCfg = QUALITY_CONFIG[eq.quality] || QUALITY_CONFIG.COMMON;
    ctx.fillStyle = '#1a3a4a';
    ctx.fillRect(cx - listW / 2, y, listW, ROW_H);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px Consolas, "Courier New", monospace';
    ctx.fillStyle = qCfg.color;
    ctx.fillText(eq.name, cx - listW / 2 + 12, y + ROW_H / 2 - 5);

    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#5a7a8a';
    const brief = TYPE_STATS[eq.type] ? TYPE_STATS[eq.type].slice(0, 3).map(k => (STAT_NAMES[k] || k) + ' ' + eq.baseStats[k]).join('  ') : '';
    ctx.fillText(brief, cx - listW / 2 + 12, y + ROW_H / 2 + 12);

    ctx.textAlign = 'right';
    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#6a9a8a';
    ctx.fillText('点击装备', cx + listW / 2 - 12, y + ROW_H / 2);
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

  /* ============================================================
     交互
     ============================================================ */

  /** @override */
  _setupRegions() {
    super._setupRegions();
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    this._addClickRegion(16, 12, 90, 36, () => { this.router.pop(); });

    // 槽位点击 → 卸下
    const mgr = window._equipmentManager;
    const slotY = SLOT_Y;
    const slotW = Math.min(140, (w - 40 - SLOT_GAP * 3) / 4);
    const totalW = slotW * 4 + SLOT_GAP * 3;
    const slotX0 = cx - totalW / 2;
    SLOTS.forEach((slot, i) => {
      const x = slotX0 + i * (slotW + SLOT_GAP);
      this._addClickRegion(x, slotY, slotW, SLOT_H, () => this._unequipSlot(mgr, slot));
    });

    // 背包行点击 → 装备
    const rowStart = getRowStartY();
    const listW = Math.min(620, w * 0.86);
    const backpack = mgr ? mgr.getBackpack() : [];
    backpack.forEach((eq, index) => {
      const y = rowStart - this._scrollY + index * (ROW_H + ROW_GAP);
      if (y + ROW_H < slotY || y > h - 44) return;
      this._addClickRegion(cx - listW / 2, y, listW, ROW_H, () => this._equipItem(mgr, eq));
    });
  }

  /**
   * 卸下槽位装备
   * @param {Object} mgr
   * @param {Object} slot
   * @private
   */
  _unequipSlot(mgr, slot) {
    if (!mgr) return;
    if (!mgr.getEquipped()[slot.key]) {
      this._setStatus(slot.label + ' 槽位为空');
      return;
    }
    const ok = mgr.unequip(slot.key);
    if (!ok) {
      this._setStatus('背包已满，无法卸下');
      return;
    }
    this._setStatus('已卸下 ' + slot.label);
  }

  /**
   * 装备背包物品
   * @param {Object} mgr
   * @param {Object} eq
   * @private
   */
  _equipItem(mgr, eq) {
    if (!mgr) return;
    const ok = mgr.equip(eq.id);
    if (!ok) {
      this._setStatus('装备失败');
      return;
    }
    this._setStatus('已装备 ' + eq.name);
  }

  /**
   * 显示状态提示
   * @param {string} text
   * @private
   */
  _setStatus(text) {
    this._statusText = text;
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      this._statusText = null;
      this._statusTimer = null;
    }, 1800);
  }
}

export { EquipmentScreen };
