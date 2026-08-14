'use strict';

/**
 * ============================================================
 * src/future/CraftingSystem.js — 【预留】制作系统接口骨架 (T-028)
 * 契约: 仅提供方法签名，等待 v2 实现（AGENTS.md 8.4）
 * ============================================================
 */

class CraftingSystem {
  /**
   * 检查能否制作
   * @param {string} itemId - 物品 ID
   * @returns {boolean} 占位：恒 false
   */
  canCraft(itemId) {
    // TODO: 等待 v2 实现
    return false;
  }

  /**
   * 执行制作
   * @param {string} itemId - 物品 ID
   * @returns {null} 占位：恒 null
   */
  craft(itemId) {
    // TODO: 等待 v2 实现
    return null;
  }
}

export { CraftingSystem };
