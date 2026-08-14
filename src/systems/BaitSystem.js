'use strict';

/**
 * ============================================================
 * src/systems/BaitSystem.js — 饵料管理系统
 * 版本: 1.0
 * 职责: 管理饵料库存、装备、消耗、效果查询
 * 约定: 饵料数据从 window.GameData.BaitTable 读取
 * ============================================================
 */

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** 基础饵 ID：恒可装备、数量无限（兜底，保证任何时候都能钓鱼） */
const BASE_BAIT_ID = 0;

/** 基础饵吸引力（与 WaitSystem.NO_BAIT_ATTRACTIVENESS 一致） */
const BASE_BAIT_ATTRACTIVENESS = 40;

class BaitSystem {
  constructor() {
    /** @type {Object<number, number>} 库存 { baitId: count } */
    this._inventory = {};

    /** @type {number} 当前装备的饵料 ID（0=基础饵，恒可装备） */
    this._equipped = BASE_BAIT_ID;

    /** @type {Function|null} 变更回调 */
    this._onChangeCallback = null;
  }

  /**
   * 从存档恢复状态
   * @param {Object<number, number>} inventory
   * @param {number|null} equipped
   */
  restoreState(inventory, equipped) {
    this._inventory = inventory || {};
    // 装备位回退到基础饵（旧档无饵料或已耗尽时兜底，保证槽位不空）
    this._equipped = (equipped === BASE_BAIT_ID ||
      (equipped && this._inventory[equipped] > 0))
      ? equipped
      : BASE_BAIT_ID;
    if (DEBUG) console.log('[Bait] 状态恢复, 库存=' + this._totalCount() + '件, 已装备=' + this._equipped);
  }

  /**
   * 导出可序列化状态
   * @returns {{ inventory: Object, equipped: number|null }}
   */
  exportState() {
    return {
      inventory: { ...this._inventory },
      equipped: this._equipped,
    };
  }

  /**
   * @param {number} baitId
   * @returns {number} 库存数量（基础饵返回 Infinity）
   */
  getBaitCount(baitId) {
    if (baitId === BASE_BAIT_ID) return Infinity;
    return this._inventory[baitId] || 0;
  }

  /** @returns {number} 当前装备饵料 ID（0=基础饵） */
  getEquippedBait() {
    return this._equipped;
  }

  /**
   * 装备指定饵料（支持基础饵 ID 0）
   * @param {number} baitId
   * @returns {boolean}
   */
  equipBait(baitId) {
    if (baitId === BASE_BAIT_ID) {
      this._equipped = BASE_BAIT_ID;
      this._notify();
      return true;
    }
    if (this._inventory[baitId] > 0) {
      this._equipped = baitId;
      this._notify();
      if (DEBUG) console.log('[Bait] 装备 ' + this._baitName(baitId) + ' (ID:' + baitId + ')');
      return true;
    }
    if (DEBUG) console.log('[Bait] 装备失败，库存不足 (ID:' + baitId + ')');
    return false;
  }

  /**
   * 卸下当前饵料（回到基础饵）
   */
  unequipBait() {
    this._equipped = BASE_BAIT_ID;
    this._notify();
    if (DEBUG) console.log('[Bait] 卸下饵料，回到基础饵');
  }

  /**
   * 消耗 1 个当前饵料（基础饵无限，不消耗；库存耗尽自动回基础饵）
   * @returns {boolean} 是否有饵料可用（基础饵恒为 true）
   */
  consumeBait() {
    // 基础饵：无限使用，不消耗数量
    if (this._equipped === BASE_BAIT_ID) return true;
    const id = this._equipped;
    if (!this._inventory[id] || this._inventory[id] <= 0) {
      this._equipped = BASE_BAIT_ID;
      this._notify();
      return true; // 兜底：回到基础饵仍可钓
    }
    this._inventory[id]--;
    if (this._inventory[id] <= 0) {
      if (DEBUG) console.log('[Bait] ' + this._baitName(id) + ' 已耗尽，自动回到基础饵');
      this._equipped = BASE_BAIT_ID;
      delete this._inventory[id];
    }
    this._notify();
    if (DEBUG) console.log('[Bait] 消耗 1 ' + this._baitName(id) + '，剩余=' + (this._inventory[id] || 0));
    return true;
  }

  /**
   * 增加饵料库存
   * @param {number} baitId
   * @param {number} amount
   */
  addBait(baitId, amount) {
    if (!this._inventory[baitId]) this._inventory[baitId] = 0;
    this._inventory[baitId] += amount;
    this._notify();
    if (DEBUG) console.log('[Bait] +' + amount + ' ' + this._baitName(baitId) +
      '，库存=' + this._inventory[baitId]);
    return this._inventory[baitId];
  }

  /**
   * 获取饵料吸引力（基础饵返回基础吸引力）
   * @param {number} baitId
   * @returns {number}
   */
  getBaitEffect(baitId) {
    if (baitId === BASE_BAIT_ID || !baitId) return BASE_BAIT_ATTRACTIVENESS;
    const bait = this._findBait(baitId);
    return bait ? (bait.attractiveness || 0) : 0;
  }

  /**
   * 获取当前饵料提供的体型加成（需求4：高级饵料钓更大鱼）
   * 基础饵/无饵料返回 0；Rarity N 饵 → (N-1)×6%
   * @returns {number} 0~0.5
   */
  getBaitSizeBonus() {
    if (!this._equipped || this._equipped === BASE_BAIT_ID) return 0;
    const bait = this._findBait(this._equipped);
    if (!bait || !bait.rarity) return 0;
    return Math.min(0.5, (bait.rarity - 1) * 0.06);
  }

  /**
   * 获取当前装备饵料的完整属性
   * @returns {Object|null}
   */
  getBaitStats() {
    if (this._equipped === BASE_BAIT_ID) {
      return {
        baitId: BASE_BAIT_ID,
        name: '\u57FA\u7840\u9975',
        type: '\u57FA\u7840',
        rarity: 0,
        attractiveness: BASE_BAIT_ATTRACTIVENESS,
        durability: Infinity,
        targetCategory: '',
        targetLayer: '',
      };
    }
    const bait = this._findBait(this._equipped);
    if (!bait) return null;
    return {
      baitId: bait.baitId,
      name: bait.baitName,
      type: bait.baitType,
      rarity: bait.rarity,
      attractiveness: bait.attractiveness,
      durability: bait.durability,
      targetCategory: bait.targetCategory,
      targetLayer: bait.targetLayer,
    };
  }

  /**
   * 获取当前装备饵料的吸引力（快捷）
   * @returns {number}
   */
  getCurrentAttractiveness() {
    if (this._equipped === BASE_BAIT_ID) return BASE_BAIT_ATTRACTIVENESS;
    return this.getBaitEffect(this._equipped);
  }

  /**
   * 获取当前装备饵料显示文本
   * @returns {string}
   */
  getEquippedLabel() {
    if (this._equipped === BASE_BAIT_ID) return '\u57FA\u7840\u9975 \u221E';
    const bait = this._findBait(this._equipped);
    if (!bait) return '\u57FA\u7840\u9975 \u221E';
    const count = this._inventory[this._equipped] || 0;
    return bait.baitName + ' x' + count;
  }

  /**
   * 注册变更回调
   * @param {Function} cb
   */
  onChange(cb) { this._onChangeCallback = cb; }

  /** 切换饵料（按顺序循环：基础饵 → 库存饵料） */
  cycleBait() {
    const owned = [BASE_BAIT_ID];
    const baitData = window.GameData ? window.GameData.BaitTable : [];
    if (baitData.length > 0) {
      const ownedIds = Object.keys(this._inventory)
        .map(id => parseInt(id, 10))
        .filter(id => this._inventory[id] > 0)
        .sort((a, b) => a - b);
      for (const id of ownedIds) owned.push(id);
    }
    const idx = owned.indexOf(this._equipped);
    this._equipped = owned[(idx + 1) % owned.length];
    this._notify();
    if (DEBUG) console.log('[Bait] 切换到 ' + this._baitName(this._equipped));
  }

  /** @param {number} id @returns {Object|undefined} */
  _findBait(id) {
    if (id === BASE_BAIT_ID) return undefined;
    try {
      const data = window.GameData;
      return data && data.BaitTable ? data.BaitTable.find(b => b.baitId === id) : undefined;
    } catch (e) { return undefined; }
  }

  /** @param {number} id @returns {string} */
  _baitName(id) {
    if (id === BASE_BAIT_ID) return '\u57FA\u7840\u9975';
    const b = this._findBait(id);
    return b ? b.baitName : 'ID:' + id;
  }

  /** @returns {number} 当前库存总数（不含基础饵） */
  _totalCount() {
    return Object.values(this._inventory).reduce((s, v) => s + v, 0);
  }

  /**
   * 获取拥有的饵料列表（库存 > 0，按 ID 排序；不含基础饵）
   * @returns {Array<{baitId:number, baitName:string, attractiveness:number, count:number, baitType:string}>}
   */
  getOwnedBaits() {
    const result = [];
    const baitData = window.GameData ? window.GameData.BaitTable : [];
    const ids = Object.keys(this._inventory)
      .map(Number)
      .filter(id => this._inventory[id] > 0)
      .sort((a, b) => a - b);
    for (const id of ids) {
      const b = baitData.find(x => x.baitId === id);
      result.push({
        baitId: id,
        baitName: b ? b.baitName : 'ID:' + id,
        attractiveness: b ? b.attractiveness : 0,
        count: this._inventory[id],
        baitType: b ? b.baitType : '',
      });
    }
    return result;
  }

  _notify() {
    if (this._onChangeCallback) this._onChangeCallback();
  }
}

export { BaitSystem, BASE_BAIT_ID, BASE_BAIT_ATTRACTIVENESS };
