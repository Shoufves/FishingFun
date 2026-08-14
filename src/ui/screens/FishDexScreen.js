'use strict';

/**
 * ============================================================
 * src/ui/screens/FishDexScreen.js — 鱼种图鉴界面 (T-019)
 * 版本: 1.0
 * 职责: 分页网格浏览 305 种鱼、未捕获剪影、详情面板、完成度
 * 来源: spec.md 第6章, task.md T-019
 * ============================================================
 */

import { Screen } from '../../core/ScreenRouter.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** 每页格子数（8 列 × 6 行） */
const COLS = 8;
const ROWS = 6;
const PAGE_SIZE = COLS * ROWS;

/** 底部详情面板高度 */
const DETAIL_H = 96;

class FishDexScreen extends Screen {
  constructor(router) {
    super(router);
    this._page = 0;
    this._selectedId = null;
    this._fishList = [];
  }

  /** @override */
  onEnter() {
    super.onEnter();
    this._page = 0;
    this._selectedId = null;
    this._fishList = this._loadFishList();
    if (DEBUG) console.log('[FishDex] 进入图鉴, 鱼种数=' + this._fishList.length);
  }

  /**
   * 从数据缓存加载鱼种列表
   * @returns {Array}
   * @private
   */
  _loadFishList() {
    try {
      const rows = window.GameData ? window.GameData.FishTable : null;
      return rows || [];
    } catch (e) {
      return [];
    }
  }

  /** @returns {number} 总页数 */
  _getPageCount() {
    return Math.max(1, Math.ceil(this._fishList.length / PAGE_SIZE));
  }

  /** @returns {Array} 当前页鱼种 */
  _getPageFish() {
    const start = this._page * PAGE_SIZE;
    return this._fishList.slice(start, start + PAGE_SIZE);
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cx = w / 2;

    ctx.fillStyle = 'rgba(10, 20, 35, 0.3)';
    ctx.fillRect(0, 0, w, h);

    // 标题 + 完成度
    const dex = window._fishDex;
    const caughtCount = dex ? dex.getCaughtCount() : 0;
    const total = this._fishList.length;
    const ratio = total > 0 ? caughtCount / total : 0;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 26px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText('\u56FE \u9274', cx, 30);

    ctx.font = '13px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#8ab0c0';
    ctx.fillText('\u5DF2\u6355\u83B7 ' + caughtCount + ' / ' + total +
      ' (' + (ratio * 100).toFixed(1) + '%)', cx, 56);

    // 完成度进度条
    const barW = Math.min(360, w * 0.5);
    const barH = 8;
    const barX = cx - barW / 2;
    const barY = 70;
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = ratio >= 1 ? '#f0d060' : '#3a8ad0';
    ctx.fillRect(barX + 1, barY + 1, (barW - 2) * ratio, barH - 2);
    ctx.strokeStyle = '#3a5a6a';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    // 网格区域
    const gridTop = 92;
    const gridBottom = h - DETAIL_H - 36;
    const gridW = Math.min(880, w * 0.92);
    const cellW = gridW / COLS;
    const cellH = Math.min(64, (gridBottom - gridTop) / ROWS);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, gridTop - 4, w, gridBottom - gridTop + 8);
    ctx.clip();

    const pageFish = this._getPageFish();
    pageFish.forEach((fish, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = cx - gridW / 2 + col * cellW + 2;
      const y = gridTop + row * cellH + 2;
      this._drawCell(ctx, fish, x, y, cellW - 4, cellH - 4);
    });
    ctx.restore();

    // 翻页控件
    const navY = gridBottom + 14;
    const pc = this._getPageCount();
    this._drawPageBtn(ctx, cx - 110, navY, 44, 28, '\u25C0');
    ctx.textAlign = 'center';
    ctx.font = 'bold 13px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#8ab0c0';
    ctx.fillText((this._page + 1) + ' / ' + pc, cx, navY + 15);
    this._drawPageBtn(ctx, cx + 66, navY, 44, 28, '\u25B6');

    // 详情面板
    this._drawDetail(ctx, w, h);

    this._drawBackButton(ctx);
  }

  /**
   * 绘制一个鱼种格子
   * @param {CanvasRenderingContext2D} ctx
   * @param {Object} fish
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @private
   */
  _drawCell(ctx, fish, x, y, w, h) {
    const dex = window._fishDex;
    const caught = dex ? dex.isCaught(fish.fishId) : false;
    const selected = this._selectedId === fish.fishId;

    ctx.fillStyle = selected ? '#2a4a5a' : (caught ? '#1a3a4a' : '#141f2c');
    ctx.fillRect(x, y, w, h);
    if (selected) {
      ctx.strokeStyle = '#f0d060';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
    }

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (caught) {
      ctx.font = 'bold 11px Consolas, "Courier New", monospace';
      ctx.fillStyle = this._rarityColor(fish.rarity);
      ctx.fillText('\u25C9', x + w / 2, y + h / 2 - 8);
      ctx.font = '10px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#c8d8d8';
      ctx.fillText(this._shortName(fish.fishName), x + w / 2, y + h / 2 + 10);
    } else {
      ctx.font = '16px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#3a4a5a';
      ctx.fillText('?', x + w / 2, y + h / 2 - 6);
      ctx.font = '10px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#3a4a5a';
      ctx.fillText('\u672A\u53D1\u73B0', x + w / 2, y + h / 2 + 12);
    }
  }

  /**
   * 稀有度颜色（1-10 星）
   * @param {number} rarity
   * @returns {string}
   * @private
   */
  _rarityColor(rarity) {
    if (rarity >= 9) return '#f0c040';
    if (rarity >= 7) return '#e07050';
    if (rarity >= 5) return '#a060e0';
    if (rarity >= 3) return '#40a0e0';
    return '#40c060';
  }

  /**
   * 截短鱼名（最多 5 字）
   * @param {string} name
   * @returns {string}
   * @private
   */
  _shortName(name) {
    if (!name) return '?';
    return name.length > 5 ? name.slice(0, 5) + '…' : name;
  }

  /**
   * 绘制翻页按钮
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {string} label
   * @private
   */
  _drawPageBtn(ctx, x, y, w, h, label) {
    ctx.fillStyle = '#2a5a6a';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#3a7a8a';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 14px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#f0e6c0';
    ctx.fillText(label, x + w / 2, y + h / 2);
  }

  /**
   * 绘制详情面板
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} w
   * @param {number} h
   * @private
   */
  _drawDetail(ctx, w, h) {
    const panelY = h - DETAIL_H - 26;
    ctx.fillStyle = 'rgba(16, 30, 42, 0.9)';
    ctx.fillRect(0, panelY, w, DETAIL_H);

    const fish = this._fishList.find(f => f.fishId === this._selectedId);
    if (!fish) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '12px Consolas, "Courier New", monospace';
      ctx.fillStyle = '#5a7a8a';
      ctx.fillText('\u70B9\u51FB\u9C7C\u79CD\u67E5\u770B\u8BE6\u60C5', w / 2, panelY + DETAIL_H / 2);
      return;
    }

    const dex = window._fishDex;
    const caught = dex ? dex.isCaught(fish.fishId) : false;
    const rec = caught && dex ? dex.getRecords(fish.fishId) : null;
    const count = caught && dex ? dex.getTotalCaughtOf(fish.fishId) : 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // 第一行：名称 + 学名
    ctx.font = 'bold 16px Consolas, "Courier New", monospace';
    ctx.fillStyle = caught ? this._rarityColor(fish.rarity) : '#5a6a7a';
    ctx.fillText(caught ? fish.fishName : '???', 16, panelY + 16);
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#5a7a8a';
    ctx.fillText(caught ? (fish.scientificName || '') : '\u672A\u53D1\u73B0\u7684\u9C7C\u79CD', 16 + (caught ? (fish.fishName.length + 1) * 16 : 40), panelY + 16);

    // 第二行：属性
    ctx.font = '12px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#7a9aaa';
    const stars = '\u2605'.repeat(Math.min(10, fish.rarity || 1));
    const base = '稀有度 ' + stars + '  |  ' +
      (fish.category || '') + '  |  ' + (fish.habitatLayer || '') + '  |  ' +
      (fish.minLengthCm || '?') + '~' + (fish.maxLengthCm || '?') + ' cm';
    ctx.fillText(base, 16, panelY + 40);

    // 第三行：纪录 + 描述
    ctx.font = '11px Consolas, "Courier New", monospace';
    ctx.fillStyle = '#6a9a8a';
    if (caught && rec) {
      ctx.fillText('个人纪录: 最长 ' + rec.maxLength.toFixed(1) + 'cm · 最重 ' +
        rec.maxWeight.toFixed(2) + 'kg · 捕获 ' + count + ' 次', 16, panelY + 64);
    } else {
      ctx.fillText('捕获后解锁纪录与描述', 16, panelY + 64);
    }

    // 右侧描述
    if (caught && fish.description) {
      ctx.textAlign = 'right';
      ctx.fillStyle = '#8a9aaa';
      this._wrapText(ctx, fish.description, w - 16, panelY + 16, w * 0.55, 13);
    }
  }

  /**
   * 简易多行文本（右侧）
   * @param {CanvasRenderingContext2D} ctx
   * @param {string} text
   * @param {number} rightX
   * @param {number} y
   * @param {number} maxW
   * @param {number} lineH
   * @private
   */
  _wrapText(ctx, text, rightX, y, maxW, lineH) {
    const chars = String(text).split('');
    let line = '';
    let yy = y;
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, rightX, yy);
        line = ch;
        yy += lineH;
        if (yy > y + 60) return;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, rightX, yy);
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

    // 网格格子
    const gridTop = 92;
    const gridBottom = h - DETAIL_H - 36;
    const gridW = Math.min(880, w * 0.92);
    const cellW = gridW / COLS;
    const cellH = Math.min(64, (gridBottom - gridTop) / ROWS);

    this._getPageFish().forEach((fish, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const x = cx - gridW / 2 + col * cellW + 2;
      const y = gridTop + row * cellH + 2;
      this._addClickRegion(x, y, cellW - 4, cellH - 4, () => {
        this._selectedId = fish.fishId;
      });
    });

    // 翻页
    const navY = gridBottom + 14;
    this._addClickRegion(cx - 110, navY, 44, 28, () => {
      if (this._page > 0) this._page--;
      this._selectedId = null;
    });
    this._addClickRegion(cx + 66, navY, 44, 28, () => {
      if (this._page < this._getPageCount() - 1) this._page++;
      this._selectedId = null;
    });
  }
}

export { FishDexScreen };
