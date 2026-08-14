'use strict';

/**
 * ============================================================
 * src/ui/screens/EquipmentScreen.js — 装备管理界面 (T-017 UI + 鱼饵集成)
 * 版本: 2.0
 * 职责: 五槽装备栏（竿/轮/线/钩/饵）、分类筛选、点击替换、基础饵兜底
 * 设计:
 *   - 未选中槽位 → 下方按顺序显示全部装备（含饵料）
 *   - 选中某槽位（如鱼竿）→ 下方只显示该类型装备，点击替换
 *   - 装备栏不允许为空（初始/基础装备兜底，含无限基础饵）
 * 来源: task.md T-017, 用户需求（鱼饵集成 + 分类 + 槽位不空）
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';
import { QUALITY_CONFIG, TYPE_STATS } from '../../data/EquipmentDef.js';
import { BASE_BAIT_ID } from '../../systems/BaitSystem.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** 槽位定义（含鱼饵） */
const SLOTS = [
  { key: 'rod',  label: '鱼竿' },
  { key: 'reel', label: '渔轮' },
  { key: 'line', label: '鱼线' },
  { key: 'hook', label: '鱼钩' },
  { key: 'bait', label: '鱼饵' },
];

/** 行高与间距 */
const ROW_H = 44;
const ROW_GAP = 6;
const SLOT_Y = 66;
const SLOT_H = 64;
const SLOT_GAP = 8;

/** 属性中文名 */
const STAT_NAMES = {
  strength: '强度', precision: '精度', toughness: '韧性', length: '长度', elasticity: '弹性',
  gearRatio: '速比', dragPower: '刹车', lineCapacity: '容线', durability: '耐用',
  tensile: '拉力', sensitivity: '灵敏', stealth: '隐蔽', abrasion: '耐磨',
  sharpness: '锋利', size: '大小', barb: '倒刺',
};

/**
 * 列表首行 Y（渲染与点击区域共用）
 * = SLOT_Y + SLOT_H + 10(筛选提示) + 16(总属性行) + 12(列表标题)
 * @returns {number}
 */
function getRowStartY() {
  return SLOT_Y + SLOT_H + 38;
}

class EquipmentScreen extends Screen {
  constructor(router) {
    super(router);
    this._selectedSlot = null;
    this._scrollY = 0;
    this._statusText = null;
    this._statusTimer = null;
  }

  /** @override */
  onEnter() {
    super.onEnter();
    this._selectedSlot = null;
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

  /* ============================================================
     数据
     ============================================================ */

  /**
   * 生成列表项：未选中→全部；选中→对应类型（含已装备项置顶）
   * @returns {Array<{kind:string, item:Object, isEquipped:boolean}>}
   * @private
   */
  _getListItems() {
    const mgr = window._equipmentManager;
    const bs = window._baitSystem;
    const items = [];
    const slot = this._selectedSlot;

    for (const s of SLOTS) {
      if (s.key === 'bait') continue; // 饵料单独处理
      if (slot && slot !== s.key) continue;
      const equipped = mgr ? mgr.getEquipped()[s.key] : null;
      const list = mgr ? mgr.getBackpack().filter(e => e.type === s.key) : [];
      if (equipped) {
        items.push({ kind: 'equip', item: equipped, isEquipped: true });
      }
      for (const eq of list) {
        items.push({ kind: 'equip', item: eq, isEquipped: false });
      }
    }

    // 饵料：基础饵（无限）置顶 + 库存饵料
    if (!slot || slot === 'bait') {
      items.push({
        kind: 'bait',
        item: {
          baitId: BASE_BAIT_ID,
          baitName: '基础饵',
          attractiveness: 40,
          count: Infinity,
          baitType: '基础',
        },
        isEquipped: bs ? bs.getEquippedBait() === BASE_BAIT_ID : false,
      });
      if (bs) {
        for (const b of bs.getOwnedBaits()) {
          items.push({ kind: 'bait', item: b, isEquipped: bs.getEquippedBait() === b.baitId });
        }
      }
    }
    return items;
  }

  /** @returns {number} 最大滚动量 */
  _getScrollMax() {
    const h = window.innerHeight;
    const avail = h - getRowStartY() - 44;
    const content = this._getListItems().length * (ROW_H + ROW_GAP);
    return Math.max(0, content - avail);
  }

  /** 限制滚动范围 */
  _clampScroll() {
    this._scrollY = Math.max(0, Math.min(this._getScrollMax(), this._scrollY));
  }

  /* ============================================================
     渲染
     ============================================================ */

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

    // 五槽位
    const slotW = Math.min(120, (w - 40 - SLOT_GAP * 4) / 5);
    const totalW = slotW * 5 + SLOT_GAP * 4;
    const slotX0 = cx - totalW / 2;
    SLOTS.forEach((slot, i) => {
      const x = slotX0 + i * (slotW + SLOT_GAP);
      this._drawSlot(ctx, mgr, slot, x, SLOT_Y, slotW, SLOT_H);
    });

    // 筛选提示 + 总属性
    const hintY = SLOT_Y + SLOT_H + 10;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#5a7a8a';
    ctx.fillText(this._selectedSlot
      ? ('已筛选: ' + this._slotLabel(this._selectedSlot) + '（点击槽位取消筛选）')
      : '点击槽位筛选对应装备 · 点击下方装备替换', 16, hintY);

    const statsY = hintY + 16;
    const total = mgr ? mgr.getTotalStats() : {};
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#4a6a7a';
    ctx.fillText(this._formatTotalStats(total), 16, statsY);

    // 列表
    const listStartY = getRowStartY();
    const listEndY = h - 44;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listStartY - 4, w, listEndY - listStartY + 8);
    ctx.clip();

    const items = this._getListItems();
    const listW = Math.min(620, w * 0.86);
    items.forEach((entry, index) => {
      const y = listStartY - this._scrollY + index * (ROW_H + ROW_GAP);
      if (y + ROW_H < listStartY || y > listEndY) return;
      this._drawListItem(ctx, entry, y, cx, listW);
    });
    if (items.length === 0) {
      ctx.textAlign = 'center';
      ctx.font = '13px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#5a7a8a';
      ctx.fillText('没有可显示的装备', cx, listStartY + 20);
    }
    ctx.restore();

    // 状态提示
    if (this._statusText) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 13px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#e0a040';
      ctx.fillText(this._statusText, cx, listEndY + 8);
    }

    this._drawBackButton(ctx);
  }

  /**
   * 槽位中文名
   * @param {string} key
   * @returns {string}
   * @private
   */
  _slotLabel(key) {
    const s = SLOTS.find(x => x.key === key);
    return s ? s.label : key;
  }

  /**
   * 绘制一个装备槽位（选中高亮）
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
    const selected = this._selectedSlot === slot.key;
    ctx.fillStyle = '#1a3a4a';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = selected ? '#f0d060' : '#2a4a5a';
    ctx.lineWidth = selected ? 2 : 1;
    ctx.strokeRect(x, y, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = selected ? '#f0d060' : '#5a7a8a';
    ctx.fillText(slot.label, x + w / 2, y + 12);

    if (slot.key === 'bait') {
      this._drawBaitSlot(ctx, x, y, w, h);
      return;
    }
    const eq = mgr ? mgr.getEquipped()[slot.key] : null;
    if (eq) {
      const qCfg = QUALITY_CONFIG[eq.quality] || QUALITY_CONFIG.COMMON;
      ctx.font = 'bold 11px Consolas, "Courier New", monospace';
      ctx.fillStyle = qCfg.color;
      ctx.fillText(this._short(eq.name, w), x + w / 2, y + 34);
      ctx.font = '9px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#6a8a9a';
      ctx.fillText(qCfg.label, x + w / 2, y + 50);
    } else {
      ctx.font = '11px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#3a5a6a';
      ctx.fillText('空', x + w / 2, y + 34);
    }
  }

  /**
   * 绘制鱼饵槽位内容
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @private
   */
  _drawBaitSlot(ctx, x, y, w, h) {
    const bs = window._baitSystem;
    if (!bs) return;
    const label = bs.getEquippedLabel();
    const attr = bs.getCurrentAttractiveness();
    ctx.font = 'bold 11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#a0e0c0';
    ctx.fillText(this._short(label, w), x + w / 2, y + 30);
    ctx.font = '9px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#6a8a9a';
    ctx.fillText('ATTR ' + attr, x + w / 2, y + 48);
  }

  /**
   * 按槽位宽度截断文本
   * @param {string} text
   * @param {number} w
   * @returns {string}
   * @private
   */
  _short(text, w) {
    const max = Math.max(2, Math.floor((w - 6) / 11));
    if (!text) return '?';
    return text.length > max ? text.slice(0, max - 1) + '…' : text;
  }

  /**
   * 格式化总属性为一行文本
   * @param {Object} total
   * @returns {string}
   * @private
   */
  _formatTotalStats(total) {
    const parts = [];
    for (const slot of SLOTS) {
      if (slot.key === 'bait') continue;
      const stats = total[slot.key] || {};
      const keys = Object.keys(stats);
      if (keys.length === 0) continue;
      const line = keys.slice(0, 3).map(k => (STAT_NAMES[k] || k) + ':' + stats[k]).join(' ');
      parts.push('[' + slot.label + '] ' + line);
    }
    return parts.join('  ') || '（未装备）';
  }

  /**
   * 绘制一行列表项
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} entry - { kind, item, isEquipped }
   * @param {number} y
   * @param {number} cx
   * @param {number} listW
   * @private
   */
  _drawListItem(ctx, entry, y, cx, listW) {
    const { kind, item, isEquipped } = entry;
    ctx.fillStyle = isEquipped ? '#1a3a4a' : '#162a38';
    ctx.fillRect(cx - listW / 2, y, listW, ROW_H);

    if (kind === 'bait') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = 'bold 13px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#a0e0c0';
      ctx.fillText(item.baitName, cx - listW / 2 + 12, y + ROW_H / 2 - 6);
      ctx.font = '11px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#5a7a8a';
      const countStr = item.count === Infinity ? '∞' : 'x' + item.count;
      ctx.fillText((item.baitType || '') + ' · 吸引 ' + (item.attractiveness || 0) + ' · ' + countStr,
        cx - listW / 2 + 12, y + ROW_H / 2 + 12);
      ctx.textAlign = 'right';
      ctx.font = '12px Consolas, "Courier New", monospace';
      ctx.fillStyle = isEquipped ? '#6a9a8a' : '#4a6a7a';
      ctx.fillText(isEquipped ? '已装备' : '点击装备', cx + listW / 2 - 12, y + ROW_H / 2);
      return;
    }

    const qCfg = QUALITY_CONFIG[item.quality] || QUALITY_CONFIG.COMMON;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 13px Consolas, "Courier New", monospace';
    ctx.fillStyle = qCfg.color;
    ctx.fillText(item.name, cx - listW / 2 + 12, y + ROW_H / 2 - 6);

    ctx.font = '10px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#5a7a8a';
    const brief = TYPE_STATS[item.type] ? TYPE_STATS[item.type].slice(0, 3)
      .map(k => (STAT_NAMES[k] || k) + ' ' + item.baseStats[k]).join('  ') : '';
    ctx.fillText(brief, cx - listW / 2 + 12, y + ROW_H / 2 + 12);

    ctx.textAlign = 'right';
    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillStyle = isEquipped ? '#6a9a8a' : '#4a6a7a';
    ctx.fillText(isEquipped ? '已装备' : '点击替换', cx + listW / 2 - 12, y + ROW_H / 2);
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

    // 槽位点击 → 切换筛选（再点取消）
    const slotW = Math.min(120, (w - 40 - SLOT_GAP * 4) / 5);
    const totalW = slotW * 5 + SLOT_GAP * 4;
    const slotX0 = cx - totalW / 2;
    SLOTS.forEach((slot, i) => {
      const x = slotX0 + i * (slotW + SLOT_GAP);
      this._addClickRegion(x, SLOT_Y, slotW, SLOT_H, () => {
        this._selectedSlot = (this._selectedSlot === slot.key) ? null : slot.key;
        this._scrollY = 0;
      });
    });

    // 列表行点击 → 装备/替换
    const listStartY = getRowStartY();
    const listW = Math.min(620, w * 0.86);
    const items = this._getListItems();
    items.forEach((entry, index) => {
      const y = listStartY - this._scrollY + index * (ROW_H + ROW_GAP);
      if (y + ROW_H < SLOT_Y || y > h - 44) return;
      this._addClickRegion(cx - listW / 2, y, listW, ROW_H, () => this._applyItem(entry));
    });
  }

  /**
   * 应用列表项：装备替换 / 饵料装备
   * @param {Object} entry
   * @private
   */
  _applyItem(entry) {
    const { kind, item } = entry;
    if (kind === 'bait') {
      if (!window._baitSystem) return;
      const ok = window._baitSystem.equipBait(item.baitId);
      this._setStatus(ok
        ? (item.baitId === BASE_BAIT_ID ? '已装备 基础饵（无限）' : '已装备 ' + item.baitName)
        : '饵料库存不足');
      return;
    }
    if (!window._equipmentManager) return;
    const ok = window._equipmentManager.equip(item.id);
    this._setStatus(ok ? '已装备 ' + item.name : '装备失败（背包已满？）');
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
