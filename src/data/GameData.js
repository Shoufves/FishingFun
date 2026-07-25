'use strict';

/**
 * ============================================================
 * src/data/GameData.js — 游戏数据统一加载与缓存
 * 版本: 1.0
 * 职责: Promise.all 并行加载 CSV、模块级缓存、全局挂载
 * ============================================================
 */

import { CsvLoader } from './CsvLoader.js';

/* ============================================================
   常量
   ============================================================ */

/** CSV 文件定义：键名 → 文件路径 */
const CSV_FILES = [
  { key: 'FishTable',       path: 'table/FishTable.csv' },
  { key: 'BaitTable',       path: 'table/BaitTable.csv' },
  { key: 'MapDefinition',   path: 'table/MapDefinition.csv' },
  { key: 'MapFishSpawn',    path: 'table/MapFishSpawn.csv' },
];

/* ============================================================
   模块级缓存（单例）
   ============================================================ */

/** @type {Object|null} 运行时数据缓存 */
let _dataCache = null;

/* ============================================================
   字段后处理映射
   ============================================================ */

/**
 * FishTable 后处理: 将 preferredBait 字段从 "1;3;6" 解析为数字数组
 * @param {Object[]} rows - 解析后的 FishTable 行
 * @returns {Object[]} 处理后的行
 */
function _postProcessFishTable(rows) {
  return rows.map(row => {
    if (typeof row.preferredBait === 'string' && row.preferredBait) {
      row.preferredBait = row.preferredBait
        .split(';')
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id));
    } else {
      row.preferredBait = [];
    }
    return row;
  });
}

/* ============================================================
   公开 API
   ============================================================ */

/**
 * 并行加载所有游戏数据 CSV，解析并缓存
 * @returns {Promise<Object>} 包含所有数据表的对象
 * @throws {Error} 任一 CSV 加载失败时抛出
 */
async function loadAllGameData() {
  // 如果缓存已存在，直接返回
  if (_dataCache) {
    return _dataCache;
  }

  // 构建并行 fetch + parse 任务
  const tasks = CSV_FILES.map(async ({ key, path }) => {
    const rows = await CsvLoader.fetchAndParse(path);
    return { key, rows };
  });

  // 等待所有 CSV 加载完成
  const results = await Promise.all(tasks);

  // 组装数据对象
  const data = {};
  for (const { key, rows } of results) {
    data[key] = rows;
  }

  // --- 字段后处理 ---
  data.FishTable = _postProcessFishTable(data.FishTable);

  // 缓存到模块级变量
  _dataCache = data;

  // 挂载到全局对象，方便控制台调试和后续模块调用
  if (typeof window !== 'undefined') {
    window.GameData = data;
  }

  return data;
}

/**
 * 获取已缓存的数据（需先调用 loadAllGameData）
 * @returns {Object|null} 数据缓存对象，未加载时返回 null
 */
function getGameData() {
  return _dataCache;
}

/**
 * 获取数据加载状态
 * @returns {boolean} 数据是否已加载完成
 */
function isDataLoaded() {
  return _dataCache !== null;
}

export { loadAllGameData, getGameData, isDataLoaded };
