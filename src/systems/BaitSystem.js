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

class BaitSystem {
  constructor() {
    /** @type {Object<number, number>} 库存 { baitId: count } */
    this._inventory = {};

    /** @type {number|null} 当前装备的饵料 ID */
    this._equipped = null;

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
    this._equipped = (equipped && this._inventory[equipped] > 0) ? equipped : null;
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

  /** @param {number} baitId @returns {number} */
  getBaitCount(baitId) {
    return this._inventory[baitId] || 0;
  }

  /** @returns {number|null} */
  getEquippedBait() {
    return this._equipped;
  }

  /**
   * 装备指定饵料
   * @param {number} baitId
   * @returns {boolean}
   */
  equipBait(baitId) {
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
   * 卸下当前饵料
   */
  unequipBait() {
    this._equipped = null;
    this._notify();
    if (DEBUG) console.log('[Bait] 卸下饵料');
  }

  /**
   * 消耗 1 个当前饵料，归零时自动卸下
   * @returns {boolean} 是否有饵料被消耗
   */
  consumeBait() {
    if (!this._equipped) return false;
    const id = this._equipped;
    if (!this._inventory[id] || this._inventory[id] <= 0) {
      this._equipped = null;
      this._notify();
      return false;
    }
    this._inventory[id]--;
    if (this._inventory[id] <= 0) {
      if (DEBUG) console.log('[Bait] ' + this._baitName(id) + ' 已耗尽，自动卸下');
      this._equipped = null;
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
   * 获取饵料吸引力
   * @param {number} baitId
   * @returns {number}
   */
  getBaitEffect(baitId) {
    if (!baitId) return 0;
    const bait = this._findBait(baitId);
    return bait ? (bait.attractiveness || 0) : 0;
  }

  /**
   * 获取当前装备饵料的完整属性
   * @returns {Object|null}
   */
  getBaitStats() {
    if (!this._equipped) return null;
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
    if (!this._equipped) return 0;
    return this.getBaitEffect(this._equipped);
  }

  /**
   * 获取当前装备饵料显示文本
   * @returns {string}
   */
  getEquippedLabel() {
    if (!this._equipped) return '\u65E0\u9975\u6599';
    const bait = this._findBait(this._equipped);
    if (!bait) return '\u672A\u77E5\u9975\u6599';
    const count = this._inventory[this._equipped] || 0;
    return bait.baitName + ' x' + count;
  }

  /**
   * 注册变更回调
   * @param {Function} cb
   */
  onChange(cb) { this._onChangeCallback = cb; }

  /** 切换饵料（按顺序循环） */
  cycleBait() {
    const baitData = window.GameData ? window.GameData.BaitTable : [];
    if (baitData.length === 0) return;

    const owned = Object.keys(this._inventory)
      .map(id => parseInt(id, 10))
      .filter(id => this._inventory[id] > 0)
      .sort((a, b) => a - b);

    if (owned.length === 0) {
      this._equipped = null;
      this._notify();
      return;
    }

    const idx = this._equipped ? owned.indexOf(this._equipped) : -1;
    this._equipped = owned[(idx + 1) % owned.length];
    this._notify();
    if (DEBUG) console.log('[Bait] 切换到 ' + this._baitName(this._equipped));
  }

  /** @param {number} id @returns {Object|undefined} */
  _findBait(id) {
    try {
      const data = window.GameData;
      return data && data.BaitTable ? data.BaitTable.find(b => b.baitId === id) : undefined;
    } catch (e) { return undefined; }
  }

  /** @param {number} id @returns {string} */
  _baitName(id) {
    const b = this._findBait(id);
    return b ? b.baitName : 'ID:' + id;
  }

  /** @returns {number} */
  _totalCount() {
    return Object.values(this._inventory).reduce((s, v) => s + v, 0);
  }

  _notify() {
    if (this._onChangeCallback) this._onChangeCallback();
  }
}

export { BaitSystem };
