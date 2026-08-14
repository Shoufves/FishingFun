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
import { BossSelectScreen } from '../src/ui/screens/BossSelectScreen.js';
import { BossBattleScreen } from '../src/ui/screens/BossBattleScreen.js';
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

/** 记录 fillRect 调用的 Canvas 上下文代理 */
function makeRecCtx(rects) {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (prop === 'fillRect') return (x, y, w, h) => { rects.push({ x, y, w, h }); };
      if (typeof prop === 'string') return () => undefined;
      return undefined;
    },
    set() { return true; },
  });
}

/** 记录 fillText 调用的 Canvas 上下文代理 */
function makeTextCtx(texts) {
  const gradient = { addColorStop() {} };
  return new Proxy({}, {
    get(target, prop) {
      if (prop === 'measureText') return () => ({ width: 10 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => gradient;
      }
      if (prop === 'fillText') return (text) => { texts.push({ text }); };
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
  // 横屏 + 竖屏各渲染一次
  ui.render(ctx, 1280, 720, cs.getState());
  ui.render(ctx, 400, 800, cs.getState());
  // 竖版模式（轨道旋转 90°，键从上往下落）
  ui.render(ctx, 400, 800, cs.getState(), 'portrait');
  // 竖版 + hold 头判后（长条垂直渲染）
  const n = cs._notes[0];
  n.type = 'hold';
  n.duration = 800;
  cs._elapsed = n.expectedTime;
  cs.handleInput();
  cs._elapsed = n.expectedTime + 300;
  ui.render(ctx, 400, 800, cs.getState(), 'portrait');
  assert.ok(true);
});

test('hold 头判后长条持续渲染（不断变短）直到尾判/松开', async () => {
  const { ctx } = await setup();
  const ui = new CatchUI();
  const cs = new CatchSystem();
  cs.start({ fishId: 9, fishName: '金枪鱼', rarity: 8, fightPower: 9 });
  const n = cs._notes[0];
  n.type = 'hold';
  n.duration = 800;

  // 头判命中（perfect）
  cs._elapsed = n.expectedTime;
  const head = cs.handleInput();
  assert.equal(head.grade, 'perfect');
  assert.equal(head.holdActive, true);

  // 头判后未尾判前：hit 必须为 false，UI 不应跳过
  assert.equal(cs.getState().notes[0].hit, false);
  assert.equal(uiSkip(ui, cs.getState().notes[0]), false);

  // 长按中段（尾部未到，长条显示中）
  cs._elapsed = n.expectedTime + n.duration * 0.5;
  ui.render(ctx, 1280, 720, cs.getState());

  // 关键回归：推进到系统虚拟轨道判定"不可见"（offset < -100）
  // 旧 bug 在此处跳过渲染导致 hold 长条提前消失
  const speed = cs.getNoteSpeed();
  cs._elapsed = n.expectedTime + Math.ceil(100 * 1000 / speed) + 50;
  const farNote = cs.getState().notes[0];
  assert.equal(farNote.visible, false, '系统判定不可见（复现旧 bug 条件）');
  assert.equal(uiSkip(ui, farNote), false, 'UI 仍不应跳过头判后的 hold 键');
  ui.render(ctx, 1280, 720, cs.getState());

  // 尾部接近目标区（长条接近收拢完成）
  cs._elapsed = n.expectedTime + n.duration - 10;
  ui.render(ctx, 1280, 720, cs.getState());

  // 尾判完成 → hit=true → 不再渲染
  cs._elapsed = n.expectedTime + n.duration;
  cs.handleHoldRelease();
  const doneNote = cs.getState().notes[0];
  assert.equal(doneNote.hit, true);
  assert.equal(uiSkip(ui, doneNote), true, '尾判后键应不再渲染');
});

test('hold 头判后长条确实被绘制（fillRect 宽 > 20px，排除静默不画）', async () => {
  const { } = await setup();
  const rects = [];
  const gradient = { addColorStop() {} };
  const recCtx = new Proxy({}, {
    get(t, p) {
      if (p === 'measureText') return () => ({ width: 10 });
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => gradient;
      if (p === 'fillRect') return (x, y, w, h) => { rects.push({ x, y, w, h }); };
      if (typeof p === 'string') return () => undefined;
      return undefined;
    },
    set() { return true; },
  });

  const cs = new CatchSystem();
  cs.start({ fishId: 9, fishName: '金枪鱼', rarity: 8, fightPower: 9 });
  const n = cs._notes[0];
  n.type = 'hold';
  n.duration = 800;

  // 头判 → 长按中段（尾部未到）
  cs._elapsed = n.expectedTime;
  cs.handleInput();
  assert.equal(cs.getState().notes[0].holdActive, true);
  cs._elapsed = n.expectedTime + 300;

  const ui = new CatchUI();
  ui.render(recCtx, 1280, 720, cs.getState());

  // 头判后的 hold 长条应产生宽度 > 20px 的填充矩形（长条本身）
  const longRects = rects.filter(r => r.w > 20 && r.h > 10);
  assert.ok(longRects.length >= 1,
    '头判后应绘制 hold 长条，实际填充矩形: ' + JSON.stringify(rects.slice(0, 8)));
});

/** 复刻 CatchUI 跳过判定（锁定回归：不得使用 note.visible） */
function uiSkip(ui, note) {
  return ui._shouldSkipNote(note);
}

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

  // 分类筛选：未选中显示全部（含饵料）；选中 rod 只显示鱼竿；选中 bait 只显示饵料
  const allItems = equip._getListItems();
  assert.ok(allItems.some(e => e.kind === 'equip' && e.item.type === 'rod'), '应包含鱼竿');
  assert.ok(allItems.some(e => e.kind === 'bait'), '应包含饵料（基础饵+库存）');
  equip._selectedSlot = 'rod';
  const rodItems = equip._getListItems();
  assert.ok(rodItems.length > 0 && rodItems.every(e => e.kind === 'equip' && e.item.type === 'rod'),
    '选中鱼竿只显示鱼竿');
  equip._selectedSlot = 'bait';
  const baitItems = equip._getListItems();
  assert.ok(baitItems.every(e => e.kind === 'bait'), '选中鱼饵只显示饵料');
  equip._selectedSlot = null;
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

  // Boss 选择 / Boss 战斗
  const bossSel = new BossSelectScreen(router);
  bossSel.onEnter();
  bossSel.render(ctx);
  assert.equal(bossSel._getScrollMax() >= 0, true);
  bossSel.onExit();

  const bossBat = new BossBattleScreen(router);
  bossBat.onEnter({ bossId: 'boss_001' });
  bossBat.render(ctx);
  bossBat.update(16);
  bossBat.render(ctx);
  bossBat.onExit();

  // 竖屏窄窗：设置页渲染不抛错，音量行元素不超出行边界
  const origW = window.innerWidth;
  const origH = window.innerHeight;
  window.innerWidth = 400;
  window.innerHeight = 800;
  try {
    const settingsV = new SettingsScreen(router);
    settingsV.onEnter();
    settingsV.render(ctx);
    const lay = settingsV._volumeLayout(400, 200);
    assert.ok(lay.barW >= 60, '竖屏音量条宽度不应过窄');
    assert.ok(lay.btnPlusX + 26 <= lay.rowX + lay.rowW,
      '加号按钮不应超出音量行右边界');
    settingsV.onExit();
  } finally {
    window.innerWidth = origW;
    window.innerHeight = origH;
  }

  assert.ok(true);
});

/* ============================================================
   竖版渲染修复回归（用户反馈 bug 1/2/3）
   ============================================================ */

test('竖版与横板: 轨道长度一致（同一窗口两模式等长，不撑满屏幕）', async () => {
  const { } = await setup();
  const rects = [];
  const recCtx = makeRecCtx(rects);
  const cs = new CatchSystem();
  cs.start({ fishId: 9, fishName: '金枪鱼', rarity: 8, fightPower: 9 });
  const ui = new CatchUI();

  // 400×800（竖屏比例）: 横板轨道 = max(220, 400×0.86) = 344 宽 × 28 高
  const expectLen = Math.max(220, 400 * 0.86); // 344
  const origCreate = globalThis.document.createElement;
  globalThis.document.createElement = () => ({ getContext: () => recCtx, style: {}, width: 0, height: 0 });
  try {
    ui.render(recCtx, 400, 800, cs.getState());
  } finally {
    globalThis.document.createElement = origCreate;
  }
  const landTrack = rects.find(r => r.w === expectLen && r.h === 28);
  assert.ok(landTrack, '横板轨道应为 ' + expectLen + '×28，实际: ' + JSON.stringify(rects.slice(0, 8)));

  // 竖版：轨道 = 28 × 344（与横板同长，不撑满 h-114=686）
  rects.length = 0;
  ui.render(recCtx, 400, 800, cs.getState(), 'portrait');
  const portTrack = rects.find(r => r.w === 28 && r.h === expectLen);
  assert.ok(portTrack, '竖版轨道应为 28×' + expectLen + '（与横板同长）');
  assert.ok(!rects.some(r => r.w === 28 && r.h >= 680),
    '竖版轨道不应撑满屏幕高度（旧值 h-114=686）');
  // 竖版耐力条与轨道同长
  assert.ok(rects.some(r => r.w === 26 && r.h === expectLen),
    '竖版耐力条长度应与轨道一致（' + expectLen + 'px）');
});

test('竖版模式渲染浮动伤害数字（旧版漏画）', async () => {
  const { } = await setup();
  const texts = [];
  const recCtx = makeTextCtx(texts);
  const cs = new CatchSystem();
  cs.start({ fishId: 9, fishName: '金枪鱼', rarity: 8, fightPower: 9 });
  cs._floatingTexts.push({ text: '-999', color: '#40d080', timer: 500, y: 0 });
  const ui = new CatchUI();
  ui.render(recCtx, 400, 800, cs.getState(), 'portrait');
  assert.ok(texts.some(t => t.text === '-999'), '竖版应绘制浮动伤害数字');
});

test('竖版 hold 头判前长条可见（旧版高度为 0 不显示）', async () => {
  const { } = await setup();
  const rects = [];
  const recCtx = makeRecCtx(rects);
  const cs = new CatchSystem();
  cs.start({ fishId: 9, fishName: '金枪鱼', rarity: 8, fightPower: 9 });
  // 第一个键改造成 hold（头判前、飞行中段：头部 400ms 后到目标区）
  const n = cs._notes[0];
  n.type = 'hold';
  n.duration = 800;
  cs._elapsed = n.expectedTime - 400;
  const ui = new CatchUI();
  ui.render(recCtx, 400, 800, cs.getState(), 'portrait');
  // hold 长条宽 = trackW-6 = 22，高度应明显大于头部亮块(4px)
  const holdBars = rects.filter(r => r.w === 22 && r.h > 40);
  assert.ok(holdBars.length >= 1,
    '头判前 hold 长条应被绘制，实际: ' + JSON.stringify(rects.slice(0, 12)));
});
