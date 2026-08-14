'use strict';

/**
 * 启动引导冒烟测试（Boot Smoke Test）
 * 验证: main.js bootGame 在模拟浏览器环境中完整启动，
 *       数据加载、存档创建、管理器初始化、路由进入标题画面均无异常；
 *       并模拟一次"捕获→结算→存档"闭环。
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** 无操作 Canvas 2D 上下文代理 */
function makeCtxMock() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (typeof prop === 'string') {
        // 所有方法返回 noop，属性可读写
        return (...args) => undefined;
      }
      return undefined;
    },
    set() { return true; },
  });
}

/** 元素 mock（覆盖 classList/style/innerHTML/addEventListener） */
function makeElementMock() {
  return {
    classList: { add() {}, remove() {} },
    style: {},
    innerHTML: '',
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    removeChild() {},
    select() {},
  };
}

/** 本地存储 mock */
function makeLocalStorageMock() {
  const store = {};
  return {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    _store: store,
  };
}

/** 建立完整浏览器环境 mock */
function setupBrowserMock() {
  const ctxMock = makeCtxMock();
  const elementMock = makeElementMock();
  const localStorageMock = makeLocalStorageMock();
  const canvasMock = {
    getContext: () => ctxMock,
    addEventListener() {},
    style: {},
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };
  const offscreenMock = {
    getContext: () => ctxMock,
    addEventListener() {},
    style: {},
    width: 0,
    height: 0,
  };

  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    location: { protocol: 'http:' },
    addEventListener() {},
    __DEBUG__: false,
    GameData: null,
    GameState: null,
  };
  globalThis.document = {
    getElementById: (id) => (id === 'game-canvas' ? canvasMock : makeElementMock()),
    createElement: () => offscreenMock,
    body: makeElementMock(),
    addEventListener() {},
    removeEventListener() {},
  };
  globalThis.localStorage = localStorageMock;
  globalThis.requestAnimationFrame = () => 0; // 不启动帧循环，避免渲染
  globalThis.cancelAnimationFrame = () => {};

  // fetch mock：从项目目录读取 CSV 文件
  globalThis.fetch = async (url) => {
    const filePath = join(process.cwd(), String(url));
    const text = await readFile(filePath, 'utf8');
    return { ok: true, status: 200, text: async () => text };
  };

  return { localStorageMock };
}

/** 等待 boot 完成 */
async function waitForBoot(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (globalThis.window && globalThis.window._router) return true;
    await new Promise(r => setTimeout(r, 50));
  }
  return false;
}

test('bootGame 完整启动：数据/存档/管理器/路由', async () => {
  const { localStorageMock } = setupBrowserMock();

  // 动态导入 main.js（顶层会执行 bootGame）
  await import('../src/main.js');
  const booted = await waitForBoot();
  assert.equal(booted, true, 'bootGame 应在超时前完成');

  const w = globalThis.window;
  // 数据加载
  assert.equal(w.GameData.FishTable.length, 305, 'FishTable 应为 305 种');
  assert.equal(w.GameData.BaitTable.length, 35, 'BaitTable 应为 35 种');
  assert.equal(w.GameData.MapDefinition.length, 15, 'MapDefinition 应为 15 张');
  assert.equal(w.GameData.MapFishSpawn.length, 809, 'MapFishSpawn 应为 809 条');

  // 存档
  assert.ok(localStorageMock.getItem('AnglerSave_v1'), '应已创建默认存档');
  assert.equal(w.GameState.player.level, 1);

  // 管理器
  assert.equal(w._economy.getLevel(), 1);
  assert.ok(w._equipmentManager.getEquipped().rod, '应自动装备初始鱼竿');
  assert.ok(w._baitSystem.getBaitCount(1) >= 10, '应有初始红蚯蚓');
  assert.equal(w._router.getCurrentScreen()._type, 'TITLE', '应进入标题画面');

  // 模拟一次捕获 → 结算 → 存档
  const { FishGenerator } = await import('../src/fishing/FishGenerator.js');
  const def = w.GameData.FishTable[0];
  const fish = new FishGenerator().generate(def);

  const goldBefore = w._economy.getGold();
  w._router.push('RESULT', { fish, mapId: 1 });
  assert.ok(w._economy.getGold() > goldBefore, '结算后金币应增加');
  assert.equal(w._fishDex.isCaught(def.fishId), true, '图鉴应登记该鱼');
  assert.equal(w._fishDex.getTotalCaughtOf(def.fishId), 1);

  // 存档应已持久化金币与图鉴
  const saved = JSON.parse(localStorageMock.getItem('AnglerSave_v1'));
  assert.equal(saved.player.gold, w._economy.getGold());
  assert.ok(saved.fishdex.records[def.fishId], '存档应包含鱼获纪录');
});

test('地图选择加载 15 张地图并正确解锁', async () => {
  const w = globalThis.window;
  assert.ok(w && w._router, '需先完成 boot');
  w._router.push('MAP_SELECT');
  const screen = w._router.getCurrentScreen();
  assert.equal(screen._maps.length, 15);
  const level = w._economy.getLevel();
  for (const map of screen._maps) {
    const unlocked = level >= (map.minLevel || 1);
    assert.equal(screen._isUnlocked(map), unlocked, map.mapName + ' 解锁状态错误');
  }
  // 1 级应只解锁 乡村池塘(1)/城市运河(6)
  const unlockedCount = screen._maps.filter(m => screen._isUnlocked(m)).length;
  assert.equal(unlockedCount, 2);
});

test('全部画面 onEnter 可正常进入（商店/装备/图鉴/设置/钓鱼/结算）', async () => {
  const w = globalThis.window;
  assert.ok(w && w._router, '需先完成 boot');

  const screens = ['SHOP', 'EQUIPMENT', 'FISH_DEX', 'SETTINGS', 'FISHING'];
  for (const type of screens) {
    w._router.push(type, type === 'FISHING' ? { mapId: 1 } : undefined);
    assert.equal(w._router.getCurrentScreen()._type, type, type + ' 进入失败');
    w._router.pop();
  }

  // 商店应有 21 件装备（6竿+5轮+5线+5钩） + 35 种饵料商品
  w._router.push('SHOP');
  const shop = w._router.getCurrentScreen();
  assert.equal(shop._equipItems.length, 21);
  assert.equal(shop._baitItems.length, 35);
  w._router.pop();

  // 图鉴应有 305 鱼种
  w._router.push('FISH_DEX');
  const dexScreen = w._router.getCurrentScreen();
  assert.equal(dexScreen._fishList.length, 305);
  w._router.pop();
});
