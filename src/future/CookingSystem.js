'use strict';

/**
 * ============================================================
 * src/future/CookingSystem.js — 【预留】烹饪系统接口骨架 (T-027)
 * 契约: 仅提供方法签名，等待 v2 实现（AGENTS.md 8.4）
 * ============================================================
 */

class CookingSystem {
  /**
   * 检查能否烹饪
   * @param {number} fishId - 鱼种 ID
   * @param {number} recipeId - 配方 ID
   * @returns {boolean} 占位：恒 false
   */
  canCook(fishId, recipeId) {
    // TODO: 等待 v2 实现
    return false;
  }

  /**
   * 执行烹饪
   * @param {number} fishId - 鱼种 ID
   * @param {number} recipeId - 配方 ID
   * @returns {null} 占位：恒 null
   */
  cook(fishId, recipeId) {
    // TODO: 等待 v2 实现
    return null;
  }
}

export { CookingSystem };
