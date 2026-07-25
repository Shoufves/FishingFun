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
import {
  ScreenRouter, ScreenType,
  TitleScreen, MapSelectScreen, Screen,
} from './core/ScreenRouter.js';

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

/** @type {boolean} 游戏主循环是否已启动 */
let _gameRunning = false;

/** @type {ScreenRouter|null} 画面路由实例 */
let router = null;

/* ============================================================
   Canvas 尺寸自适应
   ============================================================ */

/**
 * 调整 Canvas 尺寸以匹配窗口大小
 * 维护 devicePixelRatio 以保证 Retina 屏清晰度
 */
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
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
   主循环
   ============================================================ */

/**
 * 游戏主循环 — 由 requestAnimationFrame 驱动
 * @param {number} timestamp - 当前帧时间戳（ms）
 */
function gameLoop(timestamp) {
  // --- 计算 delta time ---
  const dt = lastFrameTime ? timestamp - lastFrameTime : 0;
  lastFrameTime = timestamp;

  // --- 更新 FPS 显示 ---
  frameCount++;
  fpsTimer += dt;
  if (fpsTimer >= 1000) {
    fpsDisplay = `${frameCount} FPS`;
    frameCount = 0;
    fpsTimer = 0;
  }

  // --- 清屏 ---
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  // --- 委托给当前屏幕 ---
  const screen = router ? router.getCurrentScreen() : null;
  if (screen) {
    screen.update(dt);
    screen.render(ctx);
  }

  // --- HUD 叠加层（FPS + 调试信息）---
  drawDebugOverlay();

  // --- 请求下一帧 ---
  requestAnimationFrame(gameLoop);
}

/**
 * 绘制调试叠加层（FPS、路由栈信息等）
 */
function drawDebugOverlay() {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // FPS（右上角）
  ctx.font = '12px "Courier New", Courier, monospace';
  ctx.fillStyle = '#f0e6c0';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(fpsDisplay, width - 12, 12);

  // 路由栈深（右上角 FPS 下方）
  if (router) {
    ctx.font = '10px "Courier New", Courier, monospace';
    ctx.fillStyle = '#5a7a8a';
    ctx.fillText('栈深: ' + router.getStackDepth(), width - 12, 28);
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

/* ============================================================
   FishingScreen 占位屏
   ============================================================ */

/**
 * 钓鱼场景占位屏 — T-004 仅用于验证路由切换
 * 后续 T-007 及以后会实现完整内容
 */
class FishingScreen extends Screen {
  /** @override */
  onEnter(params) {
    super.onEnter();
    console.log('[FishingScreen] 进入钓鱼场景, params:', params);
  }

  /** @override */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    // 简洁的占位画面
    ctx.fillStyle = '#0a1a2a';
    ctx.fillRect(0, 0, w, h);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '22px "Courier New", Courier, monospace';
    ctx.fillStyle = '#8ab0c0';
    ctx.fillText('🎣 钓鱼场景（占位）', w / 2, h / 2 - 20);

    ctx.font = '13px "Courier New", Courier, monospace';
    ctx.fillStyle = '#5a7a8a';
    ctx.fillText('按 ← 返回选择钓场', w / 2, h / 2 + 20);

    // 返回按钮
    const backBtnX = 16, backBtnY = 16, backBtnW = 80, backBtnH = 36;
    ctx.fillStyle = '#3a5a6a';
    ctx.fillRect(backBtnX, backBtnY, backBtnW, backBtnH);
    ctx.fillStyle = '#1a2a3a';
    ctx.fillRect(backBtnX + 1, backBtnY + 1, backBtnW - 2, backBtnH - 2);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '14px "Courier New", Courier, monospace';
    ctx.fillStyle = '#a0c4e0';
    ctx.fillText('← 返回', backBtnX + backBtnW / 2, backBtnY + backBtnH / 2);
  }

  /** @override */
  _setupRegions() {
    super._setupRegions();
    this._addClickRegion(16, 16, 80, 36, () => {
      this.router.pop();
    });
  }
}

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

    // 4. 初始化画面路由
    router = new ScreenRouter(ctx);
    window._router = router;  // 调试：暴露到全局供 DevTools 检查

    // 注册屏幕
    router.register(ScreenType.TITLE, () => new TitleScreen(router));
    router.register(ScreenType.MAP_SELECT, () => new MapSelectScreen(router));
    router.register(ScreenType.FISHING, () => new FishingScreen(router));

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

/** 点击/触摸事件分发到当前屏幕 */
function handlePointerDown(clientX, clientY) {
  if (!router) return;
  const { x, y } = getCanvasCoords(clientX, clientY);
  const screen = router.getCurrentScreen();
  if (screen && typeof screen.handleClick === 'function') {
    screen.handleClick(x, y);
  }
}

// 鼠标点击
canvas.addEventListener('click', (e) => {
  handlePointerDown(e.clientX, e.clientY);
});

// 触控点击（移动端）
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
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
