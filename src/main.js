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

  // ============================================================
  // TODO: 后续将渲染委托给各 Screen/Manager
  // 当前阶段仅绘制一个简单的测试图形
  // ============================================================
  drawTestScene(dt);

  // --- 请求下一帧 ---
  requestAnimationFrame(gameLoop);
}

/* ============================================================
   测试绘制
   ============================================================ */

/**
 * 绘制测试场景 — 用于验证 Canvas 和主循环正常工作
 * @param {number} dt - 距上一帧的时间差（ms）
 */
function drawTestScene(dt) {
  const width = window.innerWidth;
  const height = window.innerHeight;

  // --- 背景 ---
  // 底部渐变：模拟水面与深水区
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#0a1a2a');
  gradient.addColorStop(0.6, '#1a3a5a');
  gradient.addColorStop(1, '#0a2a3a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // --- 水面波纹（正弦动画） ---
  const time = performance.now() / 1000;
  ctx.strokeStyle = 'rgba(100, 180, 220, 0.2)';
  ctx.lineWidth = 2;

  for (let row = 0; row < 3; row++) {
    ctx.beginPath();
    const baseY = height * (0.5 + row * 0.15);
    for (let x = 0; x <= width; x += 8) {
      const y = baseY + Math.sin(x * 0.02 + time * 1.5 + row * 2) * 8
                    + Math.sin(x * 0.01 + time * 0.8) * 4;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // --- 测试文字 ---
  ctx.font = '16px "Courier New", Courier, monospace';
  ctx.fillStyle = '#a0c4e0';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('🎣 钓趣 — Fishing Fun', 16, 16);

  // --- FPS 显示 ---
  ctx.fillStyle = '#f0e6c0';
  ctx.textAlign = 'right';
  ctx.fillText(fpsDisplay, width - 16, 16);

  // --- 数据加载状态 ---
  if (window.GameData) {
    const fishCount = window.GameData.FishTable
      ? window.GameData.FishTable.length : 0;

    // 存档信息
    let saveInfo = '存档: 未加载';
    if (window.GameState) {
      const { player, timestamp } = window.GameState;
      saveInfo = `Lv.${player.level} | 金币: ${player.gold} | 存档: ${timestamp > 0 ? '已加载' : '初始'}`;
    }

    ctx.fillStyle = '#5a8a9a';
    ctx.textAlign = 'center';
    ctx.font = '12px "Courier New", Courier, monospace';
    ctx.fillText(
      `数据已加载 | 鱼种: ${fishCount} | ${saveInfo}`,
      width / 2, height - 24
    );
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

    // 4. 启动游戏
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
