'use strict';

/**
 * SaveManager 单元测试（导入/导出/校验）
 * 覆盖: importSave 合法/非法 JSON/缺字段、exportSave 输出、导入后 load 恢复
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { save, load, importSave, exportSave, deleteSave } from '../../src/core/SaveManager.js';

/** Node 环境 mock localStorage */
function mockLocalStorage() {
  const store = {};
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _store: store,
  };
  return store;
}

/** 构造一份合法存档 */
function makeValidSave() {
  return {
    version: 1,
    player: { level: 5, xp: 320, gold: 1250 },
    inventory: { equipment: [], baits: [], items: [] },
    equipped: { rod: null, reel: null, line: null, hook: null },
    fishdex: { caught: [1, 2], totalPerSpecies: { 1: 3 } },
    aquarium: { slots: [], capacity: 10 },
    settings: { musicVolume: 0.5, sfxVolume: 0.8, language: 'zh' },
    unlockedMaps: [1, 2],
    timestamp: 0,
  };
}

test('importSave: 合法 JSON 导入成功并写入 localStorage', () => {
  const store = mockLocalStorage();
  const valid = makeValidSave();
  const r = importSave(JSON.stringify(valid));
  assert.equal(r.ok, true);
  assert.ok(store['AnglerSave_v1'], '应写入 localStorage');
  const loaded = load();
  assert.equal(loaded.player.level, 5);
  assert.equal(loaded.player.gold, 1250);
});

test('importSave: 非法 JSON 返回错误且不写入', () => {
  const store = mockLocalStorage();
  const r = importSave('{invalid json');
  assert.equal(r.ok, false);
  assert.ok(r.error, '应返回错误信息');
  assert.ok(!store['AnglerSave_v1'], '不应写入 localStorage');
});

test('importSave: 缺关键字段的存档被拒绝', () => {
  mockLocalStorage();
  const bad = { version: 1, player: { level: 5 } }; // 缺 settings
  const r = importSave(JSON.stringify(bad));
  assert.equal(r.ok, false);
});

test('importSave: 兼容格式化（多行）JSON', () => {
  mockLocalStorage();
  const valid = makeValidSave();
  const pretty = JSON.stringify(valid, null, 2); // 多行缩进（导出格式）
  const r = importSave(pretty);
  assert.equal(r.ok, true);
  assert.equal(load().player.gold, 1250);
});

test('导出-导入往返一致（备份恢复流程）', () => {
  mockLocalStorage();
  save(makeValidSave());
  const exported = exportSave();
  deleteSave();
  assert.equal(load(), null, '删除后应为空');
  const r = importSave(exported);
  assert.equal(r.ok, true);
  const restored = load();
  assert.equal(restored.player.level, 5);
  assert.equal(restored.player.xp, 320);
  assert.equal(restored.fishdex.totalPerSpecies['1'], 3);
});
