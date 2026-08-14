'use strict';

/**
 * ============================================================
 * src/future/AccountSystem.js — 【预留】账号/云存档接口骨架 (T-030)
 * 契约: 仅提供方法签名，等待 v2 实现（AGENTS.md 8.4）
 * ============================================================
 */

class AccountSystem {
  /**
   * 登录
   * @returns {Promise<boolean>} 占位：恒 false
   */
  async login() {
    // TODO: 等待 v2 实现
    return false;
  }

  /**
   * 登出
   * @returns {Promise<void>} 占位：无操作
   */
  async logout() {
    // TODO: 等待 v2 实现
  }

  /**
   * 同步存档
   * @returns {Promise<boolean>} 占位：恒 false
   */
  async syncSave() {
    // TODO: 等待 v2 实现
    return false;
  }
}

export { AccountSystem };
