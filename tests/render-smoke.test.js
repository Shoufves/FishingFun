'use strict';

/**
 * 渲染冒烟测试（Render Smoke Test）
 * 验证: 所有 UI 组件与屏幕的 render() 在模拟 Canvas 上下文中不抛异常
 * 背景: 修复 CatchUI._drawTrack 的 TDZ bug（barPad 在 hold 分支后声明）后补充，
 *       防止渲染路径错误再次漏网
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CsvLoader } from '../src/data/CsvLoader.js';
import { EconomyManager } from '../src/systems/EconomyManager.js';
import { EquipmentManager } from '../src/systems/EquipmentManager.js';
import { EQUIPMENT_LIBRARY } from '../src/data/EquipmentData.js';
import { BaitSystem } from '../src/systems/BaitSystem.js';
import { FishDex } from '../src/systems/FishDex.js';
import { CatchSystem } from '../src/fishing/CatchSystem.js';
import { CastingSystem } from '../src/fishing/CastingSystem.js';
import { FishGenerator } from '../src/fishing/FishGenerator.js';
import { CastingUI } from '../src/ui/CastingUI.js';
import { WaitingUI } from '../src/ui/WaitingUI.js';
import { CatchUI } from '../src/ui/CatchUI.js';
import { FishingScreen } from '../src/ui/screens/FishingScreen.js';
import { ResultScreen } from '../src/ui/screens/ResultScreen.js';
import { ShopScreen } from '../src/ui/screens/ShopScreen.js';
import { EquipmentScreen } from '../src/ui/screens/EquipmentScreen.js';
import { FishDexScreen } from '../src/ui/screens/FishDexScreen.js';
import { SettingsScreen } from '../src/ui/screens/SettingsScreen.js';
import { ScreenRouter, TitleScreen, MapSelectScreen } from '../src/core/ScreenRouter.js';

/** 无操作 Canvas 2D 上下文代理 */
function makeCtxMock() {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (typeof prop === 'string') return () => undefined;
      return undefined;
    },
    set() { return true; },
  });
}

/** 元素 mock */
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

/** 读取 CSV 并解析 */
async function loadCsv(name) {
  const text = await readFile(join(process.cwd(), 'table', name), 'utf8');
  return CsvLoader.parseCSV(text);
}

/** 建立渲染所需全局环境 */
async function setup() {
  const ctx = makeCtxMock();
  const elementMock = makeElementMock();
  const canvasMock = {
    getContext: () => ctx,
    addEventListener() {},
    style: {},
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
  };

  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    location: { protocol: 'http:' },
    addEventListener() {},
    __DEBUG__: false,
  };
  globalThis.document = {
    getElementById: () => elementMock,
    createElement: () => ({ getContext: () => ctx, style: {}, width: 0, height: 0 }),
    body: elementMock,
    addEventListener() {},
    removeEventListener() {},
  };

  // 完整数据（来自真实 CSV）
  window.GameData = {
    FishTable: await loadCsv('FishTable.csv'),
    BaitTable: await loadCsv('BaitTable.csv'),
    MapDefinition: await loadCsv('MapDefinition.csv'),
    MapFishSpawn: await loadCsv('MapFishSpawn.csv'),
  };

  // 管理器
  window.GameState = {
    player: { level: 1, xp: 0, gold: 100 },
    fishdex: { caught: [], totalPerSpecies: {}, records: {} },
    settings: { musicVolume: 0.7, sfxVolume: 1.0 },
  };
  window._economy = new EconomyManager();
  window._economy.restoreState(window.GameState.player);
  window._equipmentManager = new EquipmentManager();
  for (const id of ['rod_001', 'reel_001', 'line_001', 'hook_001']) {
    const eq = EQUIPMENT_LIBRARY.find(e => e.id === id);
    if (eq) window._equipmentManager.addEquipment(eq);
    if (eq) window._equipmentManager.equip(id);
  }
  window._baitSystem = new BaitSystem();
  window._baitSystem.addBait(1, 5);
  window._baitSystem.equipBait(1);
  window._fishDex = new FishDex();

  // 路由（注册全部屏幕）
  const router = new ScreenRouter(ctx);
  router.register('TITLE', () => new TitleScreen(router));
  router.register('MAP_SELECT', () => new MapSelectScreen(router));
  router.register('FISHING', () => new FishingScreen(router));
  router.register('RESULT', () => new ResultScreen(router));
  router.register('SHOP', () => new ShopScreen(router));
  router.register('EQUIPMENT', () => new EquipmentScreen(router));
  router.register('FISH_DEX', () => new FishDexScreen(router));
  router.register('SETTINGS', () => new SettingsScreen(router));
  window._router = router;

  return { ctx };
}

test('CatchUI 渲染含 hold 键与狂暴状态的轨道不抛错', async () => {
  const { ctx } = await setup();

  // 固定随机 → 生成全是 hold 的键序列（覆盖 hold 渲染路径）
  const origRandom = Math.random;
  Math.random = () => 0.05;
  const cs = new CatchSystem();
  try {
    cs.start({ fishId: 9, fishName: '金枪鱼', rarity: 8, fightPower: 9 });
  } finally {
    Math.random = origRandom;
  }
  assert.ok(cs.getState().notes.some(n => n.type === 'hold'), '应存在 hold 键');

  const ui = new CatchUI();
  // 竖屏 + 横屏各渲染一次
  ui.render(ctx, 1280, 720, cs.getState());
  ui.render(ctx, 400, 800, cs.getState());
  assert.ok(true);
});

test('CastingUI / WaitingUI 各状态渲染不抛错', async () => {
  const { ctx } = await setup();
  const casting = new CastingUI();
  const cs = new CastingSystem();
  cs.start({});
  casting.render(ctx, 100, 100, 400, 30, cs, 'Perfect!', true);
  casting.render(ctx, 100, 100, 400, 30, cs, 'Good!', false);

  const waiting = new WaitingUI();
  waiting.render(ctx, 200, 200, { state: 'idle', phase: 1, offset: 0, progress: 0.5 }, 'Waiting...');
  waiting.render(ctx, 200, 200, { state: 'bobbing', phase: 2, offset: 1, progress: 0.6 }, 'Fish is near!');
  waiting.render(ctx, 200, 200, { state: 'sinking', phase: 3, offset: 0, progress: 0.9 }, 'Bite!');
  assert.ok(true);
});

test('全部屏幕 render 不抛错（含各阶段）', async () => {
  const { ctx } = await setup();
  const router = window._router;

  // 标题 / 地图选择 / 钓鱼（READY）/ 结果 / 商店 / 装备 / 图鉴 / 设置
  const title = new TitleScreen(router);
  title.render(ctx);

  const mapSel = new MapSelectScreen(router);
  mapSel.onEnter();
  mapSel.render(ctx);
  mapSel.onExit();

  const fishing = new FishingScreen(router);
  fishing.onEnter({ mapId: 1 });
  fishing.render(ctx);
  // 强制进入搏鱼阶段渲染（走 CatchUI 全链路）
  fishing._startWaiting();
  fishing.render(ctx);
  fishing.onExit();

  const gen = new FishGenerator();
  const fish = gen.generate(window.GameData.FishTable[0]);
  const result = new ResultScreen(router);
  result.onEnter({ fish, mapId: 1 });
  result.render(ctx);
  result.onExit();

  const shop = new ShopScreen(router);
  shop.onEnter();
  shop.render(ctx);
  shop.onExit();

  const equip = new EquipmentScreen(router);
  equip.onEnter();
  equip.render(ctx);
  equip.onExit();

  const dex = new FishDexScreen(router);
  dex.onEnter();
  dex.render(ctx);
  dex.onExit();

  const settings = new SettingsScreen(router);
  settings.onEnter();
  settings.render(ctx);
  settings.onExit();

  assert.ok(true);
});
