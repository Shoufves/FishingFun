'use strict';

/**
 * ============================================================
 * src/ui/screens/ShopScreen.js — 商店系统 (T-016)
 * 版本: 1.0
 * 职责: 装备/饵料 购买（等级校验、金币扣款、禁售状态、滚动列表）
 * 来源: spec.md 3.4, task.md T-016
 * ============================================================
 */

import { Screen, ScreenType } from '../../core/ScreenRouter.js';
import { EQUIPMENT_LIBRARY } from '../../data/EquipmentData.js';
import { QUALITY_CONFIG } from '../../data/EquipmentDef.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** 装备品质 → 最低购买等级（spec.md 3.4: 每 5 级解锁更高级装备） */
const QUALITY_MIN_LEVEL = Object.freeze({
  COMMON: 1,
  UNCOMMON: 5,
  RARE: 12,
  EPIC: 22,
  LEGENDARY: 35,
});

/** 行高与间距 */
const ROW_H = 46;
const ROW_GAP = 6;
const TAB_H = 40;

/** 装备类型中文名 */
const TYPE_NAMES = { rod: '鱼竿', reel: '渔轮', line: '鱼线', hook: '鱼钩' };

class ShopScreen extends Screen {
  constructor(router) {
    super(router);
    this._tab = 'equipment';
    this._scrollY = 0;
    this._statusText = null;
    this._statusTimer = null;
    this._equipItems = [];
    this._baitItems = [];
  }

  /** @override */
  onEnter() {
    super.onEnter();
    this._tab = 'equipment';
    this._scrollY = 0;
    this._statusText = null;
    this._refreshLists();
    this._wheelHandler = (e) => {
      e.preventDefault();
      this._scrollY += e.deltaY;
      this._clampScroll();
    };
    this._addListener(document, 'wheel', this._wheelHandler);
    if (DEBUG) console.log('[Shop] 进入商店');
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
     数据准备
     ============================================================ */

  /** 刷新商品列表（进入/切页签时调用） */
  _refreshLists() {
    this._equipItems = EQUIPMENT_LIBRARY.map(e => ({
      ...e,
      price: e.price || 0,
      minLevel: QUALITY_MIN_LEVEL[e.quality] || 1,
    }));
    this._baitItems = this._loadBaits();
  }

  /**
   * 从 BaitTable 加载饵料商品
   * @returns {Array}
   * @private
   */
  _loadBaits() {
    try {
      const rows = window.GameData ? window.GameData.BaitTable : null;
      if (!rows) return [];
      return rows.map(b => ({
        ...b,
        price: b.basePriceGold || 10,
        // 基础饵料（Rarity 1）1 级即可购买，保证新手经济闭环
        minLevel: Math.max(1, Math.min(40, b.rarity || 1)),
      }));
    } catch (e) {
      return [];
    }
  }

  /** @returns {Array} 当前页签商品列表 */
  _getItems() {
    return this._tab === 'equipment' ? this._equipItems : this._baitItems;
  }

  /** @returns {number} 当前页签行数 */
  _getRowCount() {
    return this._getItems().length;
  }

  /** @returns {number} 最大滚动量 */
  _getScrollMax() {
    const h = window.innerHeight;
    const avail = h - 70 - TAB_H - 40;
    const content = this._getRowCount() * (ROW_H + ROW_GAP);
    return Math.max(0, content - avail);
  }

  /** 限制滚动范围 */
  _clampScroll() {
    const max = this._getScrollMax();
    this._scrollY = Math.max(0, Math.min(max, this._scrollY));
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

  /* ============================================================
     渲染
     ============================================================ */

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    ctx.fillStyle = 'rgba(10, 20, 35, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // 标题与金币
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText('商 店', cx, 30);

    ctx.textAlign = 'right';
    ctx.font = 'bold 15px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0d060';
    ctx.fillText('💰 ' + (window._economy ? window._economy.getGold() : 0), w - 16, 30);

    // 页签
    const tabW = 150;
    const tabY = 56;
    this._drawTab(ctx, cx - tabW - 8, tabY, tabW, TAB_H, '装 备', this._tab === 'equipment');
    this._drawTab(ctx, cx + 8, tabY, tabW, TAB_H, '饵 料', this._tab === 'bait');

    // 列表
    const listStartY = tabY + TAB_H + 8;
    const listEndY = h - 44;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, listStartY - 4, w, listEndY - listStartY + 8);
    ctx.clip();

    const listW = Math.min(620, w * 0.86);
    const items = this._getItems();
    items.forEach((item, index) => {
      const y = listStartY - this._scrollY + index * (ROW_H + ROW_GAP);
      if (y + ROW_H < listStartY || y > listEndY) return;
      this._drawItemRow(ctx, item, y, cx, listW);
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
   * 绘制页签
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} label
   * @param {boolean} active
   * @private
   */
  _drawTab(ctx, x, y, w, h, label, active) {
    ctx.fillStyle = active ? '#2a5a6a' : '#1a3a4a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = active ? '#3a7a8a' : '#224a5a';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px Consolas, "Courier New", monospace';
    ctx.fillStyle = active ? '#f0e6c0' : '#7a9aaa';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  /**
   * 绘制一行商品
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} item - 商品对象
   * @param {number} y
   * @param {number} cx
   * @param {number} listW
   * @private
   */
  _drawItemRow(ctx, item, y, cx, listW) {
    const isEquip = this._tab === 'equipment';
    const state = this._getItemState(item);
    const canBuy = state === 'buyable';
    const level = window._economy ? window._economy.getLevel() : 1;
    const gold = window._economy ? window._economy.getGold() : 0;

    ctx.fillStyle = (canBuy) ? '#1a3a4a' : '#162a38';
    ctx.fillRect(cx - listW / 2, y, listW, ROW_H);

    // 名称（品质色）
    const qCfg = isEquip ? (QUALITY_CONFIG[item.quality] || QUALITY_CONFIG.COMMON) : null;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 15px Consolas, "Courier New", monospace';
    ctx.fillStyle = canBuy ? '#e0d8c0' : '#5a6a7a';
    ctx.fillText(item.baitName || item.name, cx - listW / 2 + 12, y + ROW_H / 2 - 6);

    // 副信息
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#5a7a8a';
    let sub;
    if (isEquip) {
      sub = (TYPE_NAMES[item.type] || item.type) + ' · ' + (qCfg ? qCfg.label : item.quality);
    } else {
      const sizePct = ((item.rarity || 1) - 1) * 6;
      sub = (item.baitType || '') + ' · 吸引 ' + (item.attractiveness || 0) +
        (sizePct > 0 ? ' · 体型+' + sizePct + '%' : '');
    }
    ctx.fillText(sub, cx - listW / 2 + 12, y + ROW_H / 2 + 12);

    // 右侧：状态/价格/购买按钮
    const btnX = cx + listW / 2 - 86;
    const btnW = 78;
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px Consolas, "Courier New", monospace';

    if (!canBuy) {
      const label = state === 'owned'
        ? '\u5DF2\u62E5\u6709'
        : state === 'equipped'
          ? '\u5DF2\u88C5\u5907'
          : state === 'level'
            ? 'Lv.' + item.minLevel + ' \u89E3\u9501'
            : '\u91D1\u5E01\u4E0D\u8DB3';
      ctx.fillStyle = state === 'level' ? '#8a7a40' : '#6a8a7a';
      ctx.fillText(label, btnX - 6, y + ROW_H / 2);
      return;
    }

    const afford = gold >= item.price;
    ctx.fillStyle = afford ? '#f0d060' : '#a06050';
    ctx.fillText(item.price + ' \u91D1', btnX - 6, y + ROW_H / 2 - 8);

    // 购买按钮
    ctx.fillStyle = afford ? '#2a5a4a' : '#3a3a3a';
    ctx.fillRect(btnX, y + ROW_H / 2 - 14, btnW, 28);
    ctx.fillStyle = afford ? '#3a8a5a' : '#4a4a4a';
    ctx.fillRect(btnX + 2, y + ROW_H / 2 - 12, btnW - 4, 24);
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText('\u8D2D\u4E70', btnX + btnW / 2, y + ROW_H / 2);
  }

  /**
   * 计算商品状态
   * @param {Object} item
   * @returns {'buyable'|'owned'|'equipped'|'level'|'poor'}
   * @private
   */
  _getItemState(item) {
    const level = window._economy ? window._economy.getLevel() : 1;
    if (level < item.minLevel) return 'level';
    if (this._tab === 'bait') {
      return (window._economy && window._economy.getGold() >= item.price) ? 'buyable' : 'poor';
    }
    const mgr = window._equipmentManager;
    if (!mgr) return 'buyable';
    if (mgr.getEquipped()[item.type] && mgr.getEquipped()[item.type].id === item.id) return 'equipped';
    if (mgr.hasEquipment(item.id)) return 'owned';
    return (window._economy && window._economy.getGold() >= item.price) ? 'buyable' : 'poor';
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

    // 页签
    const tabW = 150;
    const tabY = 56;
    this._addClickRegion(cx - tabW - 8, tabY, tabW, TAB_H, () => this._switchTab('equipment'));
    this._addClickRegion(cx + 8, tabY, tabW, TAB_H, () => this._switchTab('bait'));

    // 商品行：整行可点（购买按钮区域单独判定）
    const listW = Math.min(620, w * 0.86);
    const listStartY = tabY + TAB_H + 8;
    const btnX = cx + listW / 2 - 86;
    const items = this._getItems();
    items.forEach((item, index) => {
      const y = listStartY - this._scrollY + index * (ROW_H + ROW_GAP);
      if (y + ROW_H < 90 || y > h - 44) return;
      this._addClickRegion(btnX, y + ROW_H / 2 - 14, 78, 28, () => this._buy(item));
    });
  }

  /**
   * 切换页签
   * @param {string} tab - 'equipment' | 'bait'
   * @private
   */
  _switchTab(tab) {
    this._tab = tab;
    this._scrollY = 0;
    this._statusText = null;
  }

  /**
   * 购买商品
   * @param {Object} item
   * @private
   */
  _buy(item) {
    const eco = window._economy;
    if (!eco) return;
    const state = this._getItemState(item);
    if (state === 'level') {
      this._setStatus('\u7B49\u7EA7\u4E0D\u8DB3\uFF0C\u9700\u8981 Lv.' + item.minLevel);
      return;
    }
    if (state === 'owned' || state === 'equipped') {
      this._setStatus('\u5DF2\u62E5\u6709\u8BE5\u7269\u54C1');
      return;
    }
    if (!eco.spendGold(item.price)) {
      this._setStatus('\u91D1\u5E01\u4E0D\u8DB3\uFF01');
      return;
    }
    const name = item.baitName || item.name;
    if (this._tab === 'bait') {
      window._baitSystem.addBait(item.baitId, 1);
    } else {
      const ok = window._equipmentManager.addEquipment(item);
      if (!ok.ok) {
        eco.addGold(item.price); // 背包满则退款
        this._setStatus(ok.error || '\u80CC\u5305\u5DF2\u6EE1');
        return;
      }
    }
    this._setStatus('\u8D2D\u4E70\u6210\u529F: ' + name);
    if (DEBUG) console.log('[Shop] 购买 ' + name + ' 花费 ' + item.price);
  }

  /**
   * 显示状态提示（2 秒后消失）
   * @param {string} text
   * @private
   */
  _setStatus(text) {
    this._statusText = text;
    if (this._statusTimer) clearTimeout(this._statusTimer);
    this._statusTimer = setTimeout(() => {
      this._statusText = null;
      this._statusTimer = null;
    }, 2000);
  }
}

export { ShopScreen };
