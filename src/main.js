'use strict';

/**
 * ============================================================
 * src/main.js — 钓趣 (Fishing Fun) 游戏初始化入口
 * 版本: 1.1 (T-002: 集成 CSV 数据加载)
 * 职责: Canvas 上下文获取、窗口自适应、数据加载、rAF 主循环
 * ============================================================
 */

import { loadAllGameData } from './data/GameData.js';
import { load as loadSave, save as saveSave, getSaveKey } from './core/SaveManager.js';
import { ScreenRouter, ScreenType, TitleScreen, MapSelectScreen } from './core/ScreenRouter.js';
import { Renderer } from './render/Renderer.js';
import { BackgroundLayer } from './render/BackgroundLayer.js';
import { WaterAnimation } from './render/WaterAnimation.js';
import { Sprite } from './render/Sprite.js';
import { AudioManager } from './core/AudioManager.js';
import { FishingScreen } from './ui/screens/FishingScreen.js';
import { ResultScreen } from './ui/screens/ResultScreen.js';
import { ShopScreen } from './ui/screens/ShopScreen.js';
import { EquipmentScreen } from './ui/screens/EquipmentScreen.js';
import { FishDexScreen } from './ui/screens/FishDexScreen.js';
import { SettingsScreen } from './ui/screens/SettingsScreen.js';
import { EquipmentManager } from './systems/EquipmentManager.js';
import { EQUIPMENT_LIBRARY } from './data/EquipmentData.js';
import { BaitSystem } from './systems/BaitSystem.js';
import { EconomyManager } from './systems/EconomyManager.js';
import { FishDex } from './systems/FishDex.js';

/* ============================================================
   常量 & 状态
   ============================================================ */

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('game-canvas');

/** @type {CanvasRenderingContext2D} */
const ctx = canvas.getContext('2d');

/** @type {number} 上一帧时间戳（ms） */
let lastFrameTime = 0;

/** @type {number} 帧计数器 */
let frameCount = 0;

/** @type {number} FPS 更新计时器 */
let fpsTimer = 0;

/** @type {string} 当前帧率文本 */
let fpsDisplay = '-- FPS';

/** @type {boolean} 调试模式 */
const DEBUG = typeof window !== 'undefined' && window.__DEBUG__ === true;

/** @type {boolean} 游戏主循环是否已启动 */
let _gameRunning = false;

/** @type {ScreenRouter|null} 画面路由实例 */
let router = null;

/** @type {Renderer|null} 渲染管线 */
let renderer = null;

/** @type {BackgroundLayer|null} 背景层 */
let bgLayer = null;

/** @type {WaterAnimation|null} 水面动画 */
let waterAnim = null;

/** @type {AudioManager|null} 音频引擎 */
let audio = null;

/* ============================================================
   Canvas 尺寸自适应
   ============================================================ */

/**
 * 调整 Canvas 尺寸以匹配窗口大小
 * 维护 devicePixelRatio 以保证 Retina 屏清晰度；
 * DPR 上限 2：高分屏(3x/4x)下物理像素减少 2~4 倍，大幅降低全屏绘制/阴影开销
 */
function resizeCanvas() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  // 缩放上下文以匹配 DPR
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* ============================================================
   性能自适应（T-025 帧预算监控简化版）
   ============================================================ */

/** @type {number} 连续慢帧计数（帧耗时 > 40ms） */
let _slowFrameCount = 0;

/** @type {boolean} 是否已切换低质量渲染 */
let _lowQuality = false;

/** 帧耗时阈值（ms），超过则视为慢帧 */
const SLOW_FRAME_MS = 40;

/**
 * 每帧检测帧耗时，连续慢帧时自动降质（减少水面波层/光点）
 * @param {number} dt - 帧耗时（ms）
 */
function updateQualityBudget(dt) {
  if (dt > SLOW_FRAME_MS) {
    _slowFrameCount++;
  } else {
    _slowFrameCount = 0;
    if (_lowQuality && _slowFrameCount === 0 && waterAnim) {
      // 帧率恢复后升回高质量
      waterAnim.setQuality(1);
      _lowQuality = false;
    }
  }
  if (!_lowQuality && _slowFrameCount >= 15 && waterAnim) {
    waterAnim.setQuality(0);
    _lowQuality = true;
  }
}

/* ============================================================
   主循环
   ============================================================ */

/**
 * 游戏主循环 — 由 requestAnimationFrame 驱动
 * @param {number} timestamp - 当前帧时间戳（ms）
 */
function gameLoop(timestamp) {
  const dt = lastFrameTime ? timestamp - lastFrameTime : 0;
  lastFrameTime = timestamp;

  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 1000) { fpsDisplay = `${frameCount} FPS`; frameCount = 0; fpsTimer = 0; }

  // 0. 帧预算监控（连续慢帧自动降质）
  updateQualityBudget(dt);

  // 1. 更新
  if (waterAnim) waterAnim.update(dt);
  const screen = router ? router.getCurrentScreen() : null;
  if (screen) screen.update(dt);

  // 2. 像素风格背景（320×180 离屏 → 拉伸至主 Canvas）
  if (renderer) renderer.renderBackground(dt);

  // 3. UI 文字直接绘制在主 Canvas 上（原生分辨率，清晰锐利）
  if (screen) screen.render(ctx);

  // 4. 调试叠加层
  drawDebugOverlay(ctx);

  requestAnimationFrame(gameLoop);
}

/**
 * 绘制调试叠加层（直接在主 Canvas 上绘制，清晰）
 * @param {CanvasRenderingContext2D} mc - 主 Canvas 上下文
 */
function drawDebugOverlay(mc) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  mc.font = '14px Consolas, "Courier New", monospace';
  mc.fillStyle = '#f0e6c0';
  mc.textAlign = 'right';
  mc.textBaseline = 'top';
  mc.fillText(fpsDisplay, w - 12, 12);

  if (router) {
    mc.font = '12px Consolas, "Courier New", monospace';
    mc.fillStyle = '#5a7a8a';
    mc.fillText('栈深:' + router.getStackDepth(), w - 12, 30);
  }
}

/* ============================================================
   加载遮罩控制
   ============================================================ */

/**
 * 隐藏加载遮罩层（带渐隐动画）
 */
function hideLoadingOverlay() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  setTimeout(() => {
    overlay.style.display = 'none';
  }, 500);
}

/**
 * 显示加载错误信息（替换遮罩层内容）
 * @param {Error} err - 捕获的错误对象
 */
function showLoadingError(err) {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;

  // 替换遮罩内容为错误提示
  overlay.innerHTML = `
    <div class="loading-content" style="color: #e06060;">
      <p class="loading-title" style="color: #e06060;">⚠️ 数据加载失败</p>
      <p style="color: #c0d0e0; margin: 1.5rem 0; font-size: 1rem;">
        数据加载失败，请检查 table 目录下的 CSV 文件。
      </p>
      <p style="color: #6a8a9a; font-size: 0.8rem; max-width: 400px; margin: 0 auto;">
        ${err.message || '未知错误'}
      </p>
      <p style="color: #4a6a7a; font-size: 0.75rem; margin-top: 2rem;">
        请确认文件存在于 table/ 目录下，格式正确
      </p>
    </div>
  `;

  // 移除 spinner 动画（已替换 innerHTML 无需额外操作）
  console.error('[GameBoot] 数据加载失败:', err);
}

/**
 * 显示 file:// 协议错误提示（引导用户使用 HTTP 服务器）
 */
function showFileProtocolError() {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;

  overlay.innerHTML =
    '<div class="loading-content">' +
      '<p class="loading-title" style="color: #f0e6c0;">🌐 需要 HTTP 服务器</p>' +
      '<p style="color: #c0d0e0; margin: 1.5rem 0; font-size: 1rem;">' +
        '请使用本地 HTTP 服务器打开此页面，而非直接双击 HTML 文件。' +
      '</p>' +
      '<p style="color: #6a8a9a; font-size: 0.85rem; margin-top: 1rem;">在项目目录下运行：</p>' +
      '<code style="display: inline-block; background: #2a4a5a; color: #f0e6c0; ' +
            'padding: 6px 12px; margin-top: 6px; font-size: 0.9rem; border-radius: 2px;">' +
        'python -m http.server 8080' +
      '</code>' +
      '<p style="color: #4a6a7a; font-size: 0.75rem; margin-top: 1.5rem;">' +
        '然后访问 <span style="color: #8ab0c0;">http://localhost:8080/</span>' +
      '</p>' +
    '</div>';

  console.warn('[GameBoot] 检测到 file:// 协议，请使用 HTTP 服务器');
}

/* FishingScreen 已移至 src/ui/screens/FishingScreen.js */

/* ============================================================
   游戏启动引导
   ============================================================ */

/**
 * 启动游戏 — 数据加载成功后调用
 */
function startGame() {
  if (_gameRunning) return;
  _gameRunning = true;

  // 隐藏加载遮罩
  hideLoadingOverlay();

  // 启动主循环
  requestAnimationFrame(gameLoop);
}

/**
 * 游戏启动引导流程
 * 1. 初始化 Canvas 尺寸
 * 2. 并行加载所有 CSV 数据
 * 3. 成功 → 启动主循环；失败 → 显示错误
 */
async function bootGame() {
  // 先确保 Canvas 尺寸正确
  resizeCanvas();

  // 检测 file:// 协议（模块可能加载成功但 fetch 不可用）
  if (window.location.protocol === 'file:') {
    showFileProtocolError();
    return;
  }

  try {
    // 1. 并行加载所有 CSV 数据
    await loadAllGameData();

    // 2. 加载或创建存档
    let saveData = loadSave();

    if (!saveData) {
      // 首次启动：使用默认存档
      saveData = {
        version: 1,
        player: { level: 1, xp: 0, gold: 0 },
        inventory: { equipment: [], baits: [], items: [] },
        equipped: { rod: null, reel: null, line: null, hook: null },
        fishdex: { caught: [], totalPerSpecies: {} },
        aquarium: { slots: [], capacity: 10 },
        settings: { musicVolume: 0.7, sfxVolume: 1.0, language: 'zh' },
        unlockedMaps: [1],
        timestamp: Date.now(),
      };
      saveSave(saveData);
      console.log('[GameBoot] 首次启动，已创建默认存档');
    } else {
      console.log('[GameBoot] 存档已加载（' + getSaveKey() + '）');
    }

    // 3. 挂载到全局，供后续模块访问
    window.GameState = saveData;

    // 3a. 初始化装备管理器
    const equipMgr = new EquipmentManager();
    window._equipmentManager = equipMgr;
    const hasGear = (saveData.equipment && saveData.equipment.backpack && saveData.equipment.backpack.length > 0)
      || (saveData.inventory && saveData.inventory.equipment && saveData.inventory.equipment.length > 0);
    if (hasGear) {
      const equipState = saveData.equipment || {
        backpack: saveData.inventory.equipment || [],
        equipped: saveData.equipped || { rod: null, reel: null, line: null, hook: null },
      };
      equipMgr.restoreState(equipState);
    } else {
      // 首次启动：给玩家初始装备
      const starterIds = ['rod_001', 'reel_001', 'line_001', 'hook_001'];
      for (const id of starterIds) {
        const eq = EQUIPMENT_LIBRARY.find(e => e.id === id);
        if (eq) equipMgr.addEquipment(eq);
      }
      // 自动装备基础套件
      for (const id of starterIds) {
        equipMgr.equip(id);
      }
      if (DEBUG) {
      console.log('[GameBoot] 已发放初始装备并自动装备');
      console.log('[GameBoot] 装备状态:', JSON.stringify(equipMgr.getEquipped()));
    }
    }

    // 3b. 初始化饵料系统
    const baitMgr = new BaitSystem();
    window._baitSystem = baitMgr;
    if (saveData.bait && saveData.bait.inventory) {
      baitMgr.restoreState(saveData.bait.inventory, saveData.bait.equipped);
    } else if (saveData.inventory && saveData.inventory.baits && saveData.inventory.baits.length > 0) {
      // 兼容旧存档
      const oldInv = {};
      for (const id of saveData.inventory.baits) {
        oldInv[id] = (oldInv[id] || 0) + 1;
      }
      baitMgr.restoreState(oldInv, null);
    } else {
      // 首次启动：红蚯蚓 ×10
      baitMgr.addBait(1, 10);
      baitMgr.equipBait(1);
      if (DEBUG) console.log('[GameBoot] 已发放初始饵料 红蚯蚓 x10');
    }

    // 3c. 初始化经济管理器（等级/经验/金币）
    const economy = new EconomyManager();
    window._economy = economy;
    economy.restoreState(saveData.player || {});

    // 3d. 初始化图鉴管理器
    const fishDex = new FishDex();
    window._fishDex = fishDex;
    fishDex.restoreState(saveData.fishdex);

    // 3e. 统一持久化：把各管理器状态写回 GameState 并写入 localStorage
    window._persist = () => {
      const state = window.GameState;
      if (!state) return;
      if (window._economy) state.player = window._economy.exportState();
      if (window._equipmentManager) state.equipment = window._equipmentManager.exportState();
      if (window._baitSystem) state.bait = window._baitSystem.exportState();
      if (window._fishDex) state.fishdex = window._fishDex.exportState();
      saveSave(state);
    };

    // 3f. 管理器变更时自动持久化
    equipMgr.onChange(() => { if (window._persist) window._persist(); });
    baitMgr.onChange(() => { if (window._persist) window._persist(); });
    economy.onChange(() => { if (window._persist) window._persist(); });
    if (window._persist) window._persist();

    // 4. 初始化渲染管线
    renderer = new Renderer(canvas);
    window._renderer = renderer;

    // 4a. 创建背景层
    bgLayer = new BackgroundLayer();
    window._bgLayer = bgLayer;

    // 4b. 创建水面动画
    waterAnim = new WaterAnimation();

    // 4d. 初始化音频引擎（用户点击后才会真正激活）
    audio = new AudioManager();
    window._audio = audio;

    // 4e. 从存档恢复音量设置
    if (saveData && saveData.settings) {
      audio.restoreState({
        masterVolume: 1.0,
        sfxVolume: saveData.settings.sfxVolume || 1.0,
        bgmVolume: saveData.settings.musicVolume || 0.7,
      });
    }

    // 4c. 注册像素风格层（背景/水面走 320×180 管线）
    //     UI 层（screen/debug）直接在主 Canvas 上绘制，保证文字清晰
    renderer.addLayer('background', (oc, dt, elapsed) => {
      bgLayer.render(oc, dt, elapsed);
    });
    renderer.addLayer('water', (oc, dt, elapsed) => {
      waterAnim.render(oc, 0, 180 - 56, 320, 56);
    });
    // 层 3-8: 游戏对象/节奏游戏/UI/模态层（预留，未来可选择性加入）

    // 5. 初始化画面路由
    router = new ScreenRouter(ctx);
    window._router = router;

    // 注册屏幕
    router.register(ScreenType.TITLE, () => new TitleScreen(router));
    router.register(ScreenType.MAP_SELECT, () => new MapSelectScreen(router));
    router.register(ScreenType.FISHING, () => new FishingScreen(router));
    router.register(ScreenType.RESULT, () => new ResultScreen(router));
    router.register(ScreenType.SHOP, () => new ShopScreen(router));
    router.register(ScreenType.EQUIPMENT, () => new EquipmentScreen(router));
    router.register(ScreenType.FISH_DEX, () => new FishDexScreen(router));
    router.register(ScreenType.SETTINGS, () => new SettingsScreen(router));

    // BGM 路由：只在明确需要切换 BGM 的屏幕触发
    // 标题/地图选择共用 title，钓鱼/其他用各自 BGM
    router.onScreenEnter = (type) => {
      if (!audio) return;
      if (type === ScreenType.FISHING) {
        audio.playBGM('fishing');
      } else if (type === ScreenType.TITLE) {
        audio.playBGM('title');
      }
      // MAP_SELECT 等其他屏幕不触发 BGM 切换（沿用当前的）
    };

    // 进入标题画面
    console.log('[GameBoot] 准备进入标题画面...');
    router.push(ScreenType.TITLE);

    // 5. 启动游戏
    startGame();
  } catch (err) {
    // 加载失败，显示错误
    showLoadingError(err);
  }
}

/* ============================================================
   事件绑定
   ============================================================ */

// 窗口 resize → 自适应 Canvas
window.addEventListener('resize', () => {
  resizeCanvas();
});

// --- Canvas 点击事件（鼠标 + 触控） ---

/** 将页面坐标转为 Canvas CSS 像素坐标 */
function getCanvasCoords(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** @type {boolean} 是否已激活音频 */
let _audioResumed = false;

/** @type {number} 最近一次 touchstart 时间（用于忽略触屏合成 click） */
let _lastTouchAt = 0;

/** @type {boolean} 触屏双触发防护：touchstart 后 350ms 内的合成 click 忽略 */
const TOUCH_CLICK_GUARD_MS = 350;

/** 点击/触摸事件分发到当前屏幕（CSS 像素坐标） */
function handlePointerDown(clientX, clientY) {
  // 首次点击激活音频（遵循浏览器自动播放策略）
  if (!_audioResumed) {
    _audioResumed = true;
    if (audio) audio.resume();
  }

  if (!router) return;
  const { x, y } = getCanvasCoords(clientX, clientY);
  const screen = router.getCurrentScreen();
  if (screen && typeof screen.handleClick === 'function') {
    const hit = screen.handleClick(x, y);
    if (hit && audio) audio.playSFX('click', 0.5);
  }
}

// 鼠标点击（触屏设备上 touchstart 已处理，350ms 内的合成 click 忽略）
canvas.addEventListener('click', (e) => {
  if (Date.now() - _lastTouchAt < TOUCH_CLICK_GUARD_MS) return;
  handlePointerDown(e.clientX, e.clientY);
});

// 触控点击（移动端）
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  _lastTouchAt = Date.now();
  const touch = e.touches[0];
  if (touch) {
    handlePointerDown(touch.clientX, touch.clientY);
  }
}, { passive: false });

/* ============================================================
   启动
   ============================================================ */

// 启动引导流程（加载数据 → 初始化游戏）
bootGame();

/* ============================================================
   导出（预留：供其他模块引用）
   ============================================================ */

export {
  canvas,
  ctx,
  resizeCanvas,
};
