'use strict';

/**
 * ============================================================
 * src/main.js — 钓趣 (Fishing Fun) 游戏初始化入口
 * 版本: 1.0
 * 职责: Canvas 上下文获取、窗口自适应、requestAnimationFrame 主循环
 * ============================================================
 */

/* --- 导入（预留模块入口） --- */
// import { GameLoop } from './core/GameLoop.js';
// import { ScreenRouter } from './ui/ScreenRouter.js';

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

  // --- 状态提示 ---
  ctx.fillStyle = '#5a8a9a';
  ctx.textAlign = 'center';
  ctx.font = '12px "Courier New", Courier, monospace';
  ctx.fillText('Canvas 初始化成功 | 主循环稳定运行', width / 2, height - 24);
}

/* ============================================================
   事件绑定
   ============================================================ */

// 窗口 resize → 自适应 Canvas
window.addEventListener('resize', () => {
  resizeCanvas();
});

// 加载完成后隐藏遮罩层
window.addEventListener('load', () => {
  // 延迟一小段时间以便看到加载界面效果（正式版可移除 setTimeout）
  setTimeout(() => {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.add('hidden');
      // 完全隐藏后从 DOM 移除
      setTimeout(() => {
        overlay.style.display = 'none';
      }, 500);
    }
  }, 600);
});

/* ============================================================
   启动
   ============================================================ */

// 首次设置 Canvas 尺寸
resizeCanvas();

// 启动主循环
requestAnimationFrame(gameLoop);

/* ============================================================
   导出（预留：供其他模块引用）
   ============================================================ */

export {
  canvas,
  ctx,
  resizeCanvas,
};
