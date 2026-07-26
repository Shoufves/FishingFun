'use strict';

/**
 * ============================================================
 * src/systems/EquipmentManager.js — 装备管理器
 * 版本: 1.0
 * 职责: 管理背包、已装备槽位、属性计算
 * 约定: 数据通过深拷贝传递，防止外部修改内部状态
 * ============================================================
 */

import { QUALITY_CONFIG, BACKPACK_LIMIT } from '../data/EquipmentDef.js';

const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

class EquipmentManager {
  constructor() {
    /** @type {Array} 背包装备列表 */
    this._backpack = [];

    /** @type {Object<string, Object|null>} 已装备四件 */
    this._equipped = { rod: null, reel: null, line: null, hook: null };

    /** @type {Function|null} 装备变更回调 */
    this._onChangeCallback = null;
  }

  /**
   * 从存档恢复
   * @param {{ backpack: Array, equipped: Object }} state
   */
  restoreState(state) {
    if (!state) return;
    this._backpack = (state.backpack || []).map(eq => this._deepClone(eq));
    const eqd = state.equipped || {};
    this._equipped = {
      rod: eqd.rod ? this._deepClone(eqd.rod) : null,
      reel: eqd.reel ? this._deepClone(eqd.reel) : null,
      line: eqd.line ? this._deepClone(eqd.line) : null,
      hook: eqd.hook ? this._deepClone(eqd.hook) : null,
    };
    if (DEBUG) console.log('[Equipment] 状态恢复, 背包=' + this._backpack.length + '件');
  }

  /**
   * 导出可序列化的状态
   * @returns {{ backpack: Array, equipped: Object }}
   */
  exportState() {
    return {
      backpack: this._backpack.map(eq => this._deepClone(eq)),
      equipped: {
        rod: this._equipped.rod ? this._deepClone(this._equipped.rod) : null,
        reel: this._equipped.reel ? this._deepClone(this._equipped.reel) : null,
        line: this._equipped.line ? this._deepClone(this._equipped.line) : null,
        hook: this._equipped.hook ? this._deepClone(this._equipped.hook) : null,
      },
    };
  }

  /**
   * 将装备加入背包
   * @param {Object} eq - 装备对象（含 id, type, quality, baseStats）
   * @returns {{ ok: boolean, error?: string }}
   */
  addEquipment(eq) {
    if (this._backpack.length >= BACKPACK_LIMIT) {
      return { ok: false, error: '\u80CC\u5305\u5DF2\u6EE1' };
    }
    this._backpack.push(this._deepClone(eq));
    this._notify();
    if (DEBUG) console.log('[Equipment] +', eq.id, eq.name, '背包:', this._backpack.length);
    return { ok: true };
  }

  /**
   * 从背包移除装备
   * @param {string} eqId
   * @returns {boolean}
   */
  removeEquipment(eqId) {
    // 检查是否已装备
    for (const slot of Object.keys(this._equipped)) {
      if (this._equipped[slot] && this._equipped[slot].id === eqId) {
        this._equipped[slot] = null;
      }
    }
    const idx = this._backpack.findIndex(e => e.id === eqId);
    if (idx === -1) return false;
    this._backpack.splice(idx, 1);
    this._notify();
    if (DEBUG) console.log('[Equipment] -', eqId);
    return true;
  }

  /**
   * 装备到对应槽位
   * @param {string} eqId
   * @returns {boolean}
   */
  equip(eqId) {
    const idx = this._backpack.findIndex(e => e.id === eqId);
    if (idx === -1) return false;

    const eq = this._backpack[idx];
    const slot = eq.type;

    // 若该槽位已有装备 → 先卸下到背包
    if (this._equipped[slot]) {
      this._backpack.push(this._equipped[slot]);
    }

    this._equipped[slot] = this._deepClone(eq);
    this._backpack.splice(idx, 1);
    this._notify();
    if (DEBUG) console.log('[Equipment] 装备 ' + eqId + ' -> ' + slot);
    return true;
  }

  /**
   * 卸下指定槽位装备
   * @param {string} slotType - 'rod'|'reel'|'line'|'hook'
   * @returns {boolean}
   */
  unequip(slotType) {
    if (!this._equipped[slotType]) return false;
    if (this._backpack.length >= BACKPACK_LIMIT) return false;
    this._backpack.push(this._equipped[slotType]);
    this._equipped[slotType] = null;
    this._notify();
    if (DEBUG) console.log('[Equipment] 卸下 ' + slotType);
    return true;
  }

  /**
   * 获取已装备的四件装备（深拷贝）
   * @returns {{ rod: Object|null, reel: Object|null, line: Object|null, hook: Object|null }}
   */
  getEquipped() {
    return {
      rod: this._equipped.rod ? this._deepClone(this._equipped.rod) : null,
      reel: this._equipped.reel ? this._deepClone(this._equipped.reel) : null,
      line: this._equipped.line ? this._deepClone(this._equipped.line) : null,
      hook: this._equipped.hook ? this._deepClone(this._equipped.hook) : null,
    };
  }

  /**
   * 计算总属性（所有已装备装备品质缩放后属性之和）
   * 输出格式兼容 T-012 的 PlaceholderEquipment
   * @returns {{ rod: Object, reel: Object, line: Object, hook: Object }}
   */
  getTotalStats() {
    const result = {
      rod: {}, reel: {}, line: {}, hook: {},
    };
    const slots = ['rod', 'reel', 'line', 'hook'];
    for (const slot of slots) {
      const eq = this._equipped[slot];
      if (!eq) continue;
      const mult = QUALITY_CONFIG[eq.quality] ? QUALITY_CONFIG[eq.quality].statMult : 1.0;
      const stats = eq.baseStats || {};
      for (const [key, val] of Object.entries(stats)) {
        result[slot][key] = key === 'gearRatio' ? +(val * mult).toFixed(2) : Math.floor(val * mult);
      }
    }
    return result;
  }

  /**
   * 获取背包列表（深拷贝）
   * @returns {Array}
   */
  getBackpack() {
    return this._backpack.map(e => this._deepClone(e));
  }

  /**
   * 检查是否拥有某装备
   * @param {string} eqId
   * @returns {boolean}
   */
  hasEquipment(eqId) {
    if (this._backpack.some(e => e.id === eqId)) return true;
    for (const slot of Object.keys(this._equipped)) {
      if (this._equipped[slot] && this._equipped[slot].id === eqId) return true;
    }
    return false;
  }

  /**
   * 注册装备变更回调
   * @param {Function} cb - () => void
   */
  onChange(cb) {
    this._onChangeCallback = cb;
  }

  /** 触发变更通知 */
  _notify() {
    if (this._onChangeCallback) this._onChangeCallback();
  }

  /** @private */
  _deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

export { EquipmentManager };
