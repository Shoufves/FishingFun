'use strict';

/**
 * ============================================================
 * src/future/LeaderboardSystem.js — 【预留】排行榜接口骨架 (T-029)
 * 契约: 仅提供方法签名，等待 v2 实现（AGENTS.md 8.4）
 * 数据结构: { fishId, length, weight, playerName, timestamp }
 * ============================================================
 */

class LeaderboardSystem {
  /**
   * 提交纪录
   * @param {Object} entry - { fishId, length, weight, playerName, timestamp }
   * @returns {Promise<boolean>} 占位：恒 false
   */
  async submitScore(entry) {
    // TODO: 等待 v2 实现
    return false;
  }

  /**
   * 获取排行榜
   * @param {number} fishId - 鱼种 ID
   * @returns {Promise<Array>} 占位：恒空数组
   */
  async getLeaderboard(fishId) {
    // TODO: 等待 v2 实现
    return [];
  }
}

export { LeaderboardSystem };
