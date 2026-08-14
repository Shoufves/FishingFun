'use strict';

/**
 * ============================================================
 * src/core/SaveManager.js — localStorage 存档管理器
 * 版本: 1.0
 * 职责: 存档/读档/迁移/自动保存节流，纯原生 localStorage API
 * ============================================================
 */

/* ============================================================
   常量
   ============================================================ */

/** @type {string} localStorage 键名 */
const SAVE_KEY = 'AnglerSave_v1';

/** @type {number} 当前存档版本号 */
const CURRENT_VERSION = 1;

/** @type {number} 默认存档容量上限 */
const DEFAULT_AQUARIUM_CAPACITY = 10;

/** @type {number} 初始解锁地图（乡村池塘 = MapId 1） */
const INITIAL_UNLOCKED_MAPS = [1];

/* ============================================================
   默认存档数据
   ============================================================ */

/**
 * 默认存档数据 — 首次启动时使用
 * @type {Object}
 */
const DEFAULT_SAVE_DATA = Object.freeze({
  version: CURRENT_VERSION,
  player: {
    level: 1,
    xp: 0,
    gold: 0,
  },
  inventory: {
    equipment: [],
    baits: [],
    items: [],
  },
  equipped: {
    rod: null,
    reel: null,
    line: null,
    hook: null,
  },
  fishdex: {
    caught: [],
    totalPerSpecies: {},
  },
  aquarium: {
    slots: [],
    capacity: DEFAULT_AQUARIUM_CAPACITY,
  },
  settings: {
    musicVolume: 0.7,
    sfxVolume: 1.0,
    language: 'zh',
    difficulty: 'easy',
    orientation: 'landscape',
  },
  unlockedMaps: [...INITIAL_UNLOCKED_MAPS],
  // FUTURE: 烹饪/制作/排行/账号 预留数据槽（Phase 6）
  cookingRecipes: [],
  craftingRecipes: {},
  craftingMaterials: {},
  timestamp: 0,
});

/* ============================================================
   内部状态
   ============================================================ */

/** @type {number|null} 自动保存节流定时器 */
let _throttleTimer = null;

/* ============================================================
   辅助函数
   ============================================================ */

/**
 * 深拷贝一个值（JSON 安全的简单对象克隆）
 * @param {*} value - 要克隆的值
 * @returns {*} 深拷贝副本
 */
function _deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * 检测存档数据是否包含关键字段
 * @param {*} data - 要校验的数据
 * @returns {boolean} 是否为有效的存档结构
 */
function _isValidSaveData(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.version !== 'number') return false;
  if (!data.player || typeof data.player.level !== 'number') return false;
  if (!data.settings || typeof data.settings !== 'object') return false;
  return true;
}

/* ============================================================
   版本迁移
   ============================================================ */

/**
 * 运行版本迁移 — 从旧版本逐步迁移至当前版本
 * 迁移函数表：索引为源版本号，值为 (data) => migratedData
 * @param {Object} data - 旧版本存档数据
 * @returns {Object} 迁移至最新版本后的数据
 */
function _migrate(data) {
  let migrated = _deepClone(data);

  // 示例：v1 到 v1 无需迁移（占位）
  // 未来 v1 → v2 时在此添加：
  // if (migrated.version < 2) { migrated = _migrateV1ToV2(migrated); }

  // 更新版本号
  migrated.version = CURRENT_VERSION;
  return migrated;
}

/* ============================================================
   公开 API
   ============================================================ */

/**
 * 获取 localStorage 存档键名
 * @returns {string} 存档键名
 */
function getSaveKey() {
  return SAVE_KEY;
}

/**
 * 保存存档数据到 localStorage
 * @param {Object} data - 要保存的存档对象
 * @returns {boolean} 是否写入成功
 */
function save(data) {
  // 自动更新时间戳
  const saveData = _deepClone(data);
  saveData.timestamp = Date.now();

  try {
    const json = JSON.stringify(saveData);
    localStorage.setItem(SAVE_KEY, json);
    return true;
  } catch (err) {
    console.warn('[SaveManager] 写入失败:', err.message);
    return false;
  }
}

/**
 * 从 localStorage 读取存档
 * - 无存档时返回 null（由调用方决定首次启动行为）
 * - JSON 解析失败或关键字段缺失时自动重置，保留设置项
 * - 返回深拷贝副本，防止外部修改内部缓存
 * @returns {Object|null} 存档数据，或 null
 */
function load() {
  let raw;

  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch (err) {
    console.warn('[SaveManager] 读取失败:', err.message);
    return null;
  }

  // 无存档
  if (raw === null || raw === undefined) {
    return null;
  }

  // 尝试解析 JSON
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    console.warn('[SaveManager] JSON 解析失败（' + err.message + '），已重置为新档');
    return _createResetData(null);
  }

  // 关键字段校验
  if (!_isValidSaveData(data)) {
    console.warn('[SaveManager] 存档损坏（关键字段缺失），已重置为新档');
    return _createResetData(data);
  }

  // 版本迁移
  if (data.version < CURRENT_VERSION) {
    console.log('[SaveManager] 存档版本 v' + data.version + ' → v' + CURRENT_VERSION + '，正在迁移');
    data = _migrate(data);
    // 迁移后立即保存
    save(data);
  }

  return _deepClone(data);
}

/**
 * 重置数据 — 从旧数据保留设置项，其余使用默认值
 * @param {Object|null} oldData - 旧的损坏数据（可能为 null）
 * @returns {Object} 重置后的完整存档
 */
function _createResetData(oldData) {
  const fresh = _deepClone(DEFAULT_SAVE_DATA);

  // 保留旧数据的设置项（如果存在）
  if (oldData && oldData.settings && typeof oldData.settings === 'object') {
    fresh.settings = {
      ...fresh.settings,
      ...oldData.settings,
    };
  }

  // 立即保存重置后的数据
  save(fresh);

  return fresh;
}

/**
 * 删除存档
 * @returns {boolean} 是否删除成功
 */
function deleteSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
    return true;
  } catch (err) {
    console.warn('[SaveManager] 删除失败:', err.message);
    return false;
  }
}

/**
 * 导出存档为可读 JSON 字符串
 * @returns {string} 格式化后的 JSON 字符串
 */
function exportSave() {
  const data = load();
  if (!data) {
    return JSON.stringify(_deepClone(DEFAULT_SAVE_DATA), null, 2);
  }
  return JSON.stringify(data, null, 2);
}

/**
 * 自动保存节流 — 高频操作下防抖写入
 * 每次调用重置计时器，确保 delay 毫秒内只写入一次
 * @param {Object} data - 要保存的存档对象
 * @param {number} [delay=2000] - 防抖延迟（毫秒）
 */
function saveWithThrottle(data, delay = 2000) {
  if (_throttleTimer) {
    clearTimeout(_throttleTimer);
  }

  _throttleTimer = setTimeout(() => {
    _throttleTimer = null;
    save(data);
  }, delay);
}

/**
 * 导入存档（从 JSON 字符串恢复）
 * 校验: JSON 可解析 + 关键字段完整（同 load 的校验规则）
 * @param {string} jsonString - 存档 JSON 文本（兼容格式化/单行）
 * @returns {{ok:boolean, error?:string}} 导入结果
 */
function importSave(jsonString) {
  let data;
  try {
    data = JSON.parse(jsonString);
  } catch (err) {
    return { ok: false, error: 'JSON 解析失败：' + err.message };
  }
  if (!_isValidSaveData(data)) {
    return { ok: false, error: '存档格式不正确（缺少关键字段）' };
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: '写入失败：' + err.message };
  }
}

/* ============================================================
   FUTURE: 云存档桩（Phase 6 T-030，等待 v2 实现）
   ============================================================ */

/**
 * 上传存档到云端（桩）
 * @returns {Promise<boolean>} 占位：恒 false
 */
async function syncToCloud() {
  // TODO: 等待 v2 实现
  return false;
}

/**
 * 从云端拉取存档（桩）
 * @returns {Promise<Object|null>} 占位：恒 null
 */
async function syncFromCloud() {
  // TODO: 等待 v2 实现
  return null;
}

export {
  getSaveKey,
  save,
  load,
  deleteSave,
  exportSave,
  importSave,
  saveWithThrottle,
  syncToCloud,
  syncFromCloud,
};
