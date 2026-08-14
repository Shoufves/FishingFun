'use strict';

/**
 * ============================================================
 * src/systems/FishDex.js — 图鉴收集系统 (T-019)
 * 版本: 1.0
 * 职责: 记录鱼种捕获状态、个人最佳纪录、完成度统计
 * 来源: spec.md 第6章, plan.md 2.8, task.md T-019
 * 约定: 状态通过 restoreState/exportState 与存档同步；纯逻辑，不依赖 UI
 * ============================================================ */

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

class FishDex {
  constructor() {
    /** @type {{caught:number[], totalPerSpecies:Object, records:Object}} */
    this._state = {
      caught: [],
      totalPerSpecies: {},
      records: {},
    };
  }

  /**
   * 从存档恢复
   * @param {Object|null} state - 存档中的 fishdex 对象
   */
  restoreState(state) {
    if (!state) return;
    this._state.caught = Array.isArray(state.caught) ? [...state.caught] : [];
    this._state.totalPerSpecies = state.totalPerSpecies ? { ...state.totalPerSpecies } : {};
    this._state.records = state.records ? { ...state.records } : {};
  }

  /**
   * 导出可序列化状态
   * @returns {Object}
   */
  exportState() {
    return {
      caught: [...this._state.caught],
      totalPerSpecies: { ...this._state.totalPerSpecies },
      records: { ...this._state.records },
    };
  }

  /**
   * 登记一条鱼获，更新捕获计数与个人纪录
   * @param {Object} fish - FishInstance（含 fishId/length/weight）
   * @returns {{isFirst:boolean, isNewRecord:boolean, lenRecord:Object, wgtRecord:Object}}
   */
  registerCatch(fish) {
    const id = fish.fishId;
    const len = fish.length || 0;
    const wgt = fish.weight || 0;
    const prev = this._state.records[id] || null;

    const lenRecord = prev
      ? { length: prev.maxLength || 0, weight: prev.maxLengthWeight || 0 }
      : { length: 0, weight: 0 };
    const wgtRecord = prev
      ? { length: prev.maxWeightLength || 0, weight: prev.maxWeight || 0 }
      : { length: 0, weight: 0 };

    const isFirst = !this._state.totalPerSpecies[id];
    const isNewRecord = isFirst || len > lenRecord.length || wgt > wgtRecord.weight;

    // 写入最新纪录
    this._state.records[id] = {
      maxLength: Math.max(prev ? prev.maxLength : 0, len),
      maxLengthWeight: (prev && prev.maxLength >= len) ? prev.maxLengthWeight : wgt,
      maxWeight: Math.max(prev ? prev.maxWeight : 0, wgt),
      maxWeightLength: (prev && prev.maxWeight >= wgt) ? prev.maxWeightLength : len,
      firstCaught: prev ? prev.firstCaught : Date.now(),
      lastCaught: Date.now(),
    };

    if (!this._state.totalPerSpecies[id]) this._state.totalPerSpecies[id] = 0;
    this._state.totalPerSpecies[id] += 1;
    if (this._state.caught.indexOf(id) === -1) this._state.caught.push(id);

    if (DEBUG) console.log('[FishDex] 登记 ' + fish.name + ' (ID:' + id + ') 首次=' + isFirst +
      ' 新纪录=' + isNewRecord);

    return {
      isFirst,
      isNewRecord,
      lenRecord,
      wgtRecord,
    };
  }

  /* ============================================================
     查询
     ============================================================ */

  /**
   * @param {number} fishId
   * @returns {boolean} 是否已捕获过
   */
  isCaught(fishId) {
    return !!this._state.totalPerSpecies[fishId];
  }

  /**
   * @param {number} fishId
   * @returns {number} 累计捕获次数
   */
  getTotalCaughtOf(fishId) {
    return this._state.totalPerSpecies[fishId] || 0;
  }

  /**
   * @param {number} fishId
   * @returns {Object|null} 该鱼种的个人纪录
   */
  getRecords(fishId) {
    const r = this._state.records[fishId];
    return r ? { ...r } : null;
  }

  /** @returns {number} 已捕获鱼种数 */
  getCaughtCount() { return this._state.caught.length; }

  /** @returns {number[]} 已捕获鱼种 ID 列表（副本） */
  getCaughtList() { return [...this._state.caught]; }

  /**
   * 完成度（按鱼种总数）
   * @param {number} totalSpecies - 鱼种总数（来自 FishTable）
   * @returns {number} 0~1
   */
  getCompletionRatio(totalSpecies) {
    if (!totalSpecies) return 0;
    return Math.min(1, this._state.caught.length / totalSpecies);
  }

  /** @returns {Object} 统计信息 */
  getStats() {
    return {
      caught: this._state.caught.length,
      totalCatchCount: Object.values(this._state.totalPerSpecies)
        .reduce((sum, v) => sum + v, 0),
    };
  }
}

export { FishDex };
