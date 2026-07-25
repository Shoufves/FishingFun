'use strict';

/**
 * T-007 验收测试脚本 — CastingSystem 逻辑单元测试
 * 运行: node test_t007_casting.mjs
 */

import { CastingSystem, PERFECT_ZONE_WIDTH, GOOD_ZONE_WIDTH } from './src/fishing/CastingSystem.js';

let pass = 0;
let fail = 0;

function assert(desc, cond) {
  if (cond) { pass++; console.log('  \u2705 ' + desc); }
  else { fail++; console.log('  \u274C ' + desc); }
}

const cs = new CastingSystem();
const perf = cs.getPerfectZone();
const good = cs.getGoodZone();

/* ============================================================
   1. 区间参数
   ============================================================ */
console.log('=== 1. 区间参数 ===');
assert('PERFECT_ZONE_WIDTH=8', PERFECT_ZONE_WIDTH === 8);
assert('GOOD_ZONE_WIDTH=30', GOOD_ZONE_WIDTH === 30);
assert('Perfect start=46', perf.start === 46);
assert('Perfect end=54',   perf.end   === 54);
assert('Good start=35',    good.start === 35);
assert('Good end=65',      good.end   === 65);

/* ============================================================
   2. Perfect 判定（光标中心在 [46,54]）
   ============================================================ */
console.log('\n=== 2. Perfect 判定 ===');
const perfectCases = [46, 47, 48, 49, 50, 51, 52, 53, 54];
for (const p of perfectCases) {
  cs.start(); cs._progress = p;
  assert('p=' + p + ' \u2192 perfect', cs.stop().grade === 'perfect');
}

/* ============================================================
   3. Good 判定（光标中心在 [35,46) ∪ (54,65]）
   ============================================================ */
console.log('\n=== 3. Good 判定 ===');
const goodCases = [35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45,
                   55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65];
for (const p of goodCases) {
  cs.start(); cs._progress = p;
  assert('p=' + p + ' \u2192 good', cs.stop().grade === 'good');
}

/* ============================================================
   4. Poor 判定（光标中心 <35 或 >65）
   ============================================================ */
console.log('\n=== 4. Poor 判定 ===');
const poorCases = [0, 5, 10, 15, 20, 25, 30, 33, 34,
                   66, 67, 70, 75, 80, 85, 90, 95, 100];
for (const p of poorCases) {
  cs.start(); cs._progress = p;
  assert('p=' + p + ' \u2192 poor', cs.stop().grade === 'poor');
}

/* ============================================================
   5. 边界测试（光标半入蓝区边缘）
   ============================================================ */
console.log('\n=== 5. 蓝区边界 Good 判定 ===');
// 光标宽度4%，光标中心在34.9时，范围[32.9, 36.9]，与蓝区[35,65]重叠=1.9，占比1.9/4=0.475 < 0.5 → Poor
cs.start(); cs._progress = 34.9;
assert('p=34.9 \u2192 poor（半入不足50%）', cs.stop().grade === 'poor');

// 光标中心在35时，范围[33, 37]，重叠=2，占比0.5 → Good
cs.start(); cs._progress = 35;
assert('p=35.0 \u2192 good（刚好50%重叠）', cs.stop().grade === 'good');

// 光标中心在65时，范围[63, 67]，重叠=2，占比0.5 → Good
cs.start(); cs._progress = 65;
assert('p=65.0 \u2192 good（刚好50%重叠）', cs.stop().grade === 'good');

// 光标中心在65.1时，范围[63.1, 67.1]，重叠=1.9，占比0.475 → Poor
cs.start(); cs._progress = 65.1;
assert('p=65.1 \u2192 poor（半入不足50%）', cs.stop().grade === 'poor');

/* ============================================================
   6. 往返超时
   ============================================================ */
console.log('\n=== 6. 往返超时自动 Fail ===');
cs.start();
assert('初始 isActive=true', cs.isActive() === true);
for (let i = 0; i < 6; i++) {
  cs._bounceCount++;
}
cs.update(1);
assert('6次反弹后 isActive=false', cs.isActive() === false);
assert('超时后 stop()=fail', cs.stop().grade === 'fail');

/* ============================================================
   7. 二次调用安全
   ============================================================ */
console.log('\n=== 7. 二次调用安全 ===');
cs.start();
cs._progress = 50;
const r1 = cs.stop();
assert('一次 stop 返回 grade', r1.grade === 'perfect' || r1.grade === 'good' || r1.grade === 'poor');
assert('一次 stop 返回 progress', typeof r1.progress === 'number');
const r2 = cs.stop();
assert('二次 stop 返回 fail', r2.grade === 'fail');

/* ============================================================
   8. 重置干净
   ============================================================ */
console.log('\n=== 8. 重置干净 ===');
cs.start();
assert('重置后 isActive=true', cs.isActive() === true);
assert('重置后 progress=0', cs.getProgress() === 0);
assert('重置后 direction=1', cs._direction === 1);
assert('重置后 bounceCount=0', cs._bounceCount === 0);

cs.update(500);
assert('更新500ms后 progress>0', cs.getProgress() > 0);

/* ============================================================
   9. 往返速度验证
   ============================================================ */
console.log('\n=== 9. 往返速度 ===');
cs.start();
cs.update(1205); // 1205ms → 83*1.205 ≈ 100
assert('1205ms 后到达右边界', Math.abs(cs.getProgress() - 100) < 1 && cs._direction === -1);

cs.update(1205); // 再1205ms → 反弹回左边界
assert('2410ms 后回到左边界', cs.getProgress() < 2);

/* ============================================================
   10. 完整来回时间（spec.md: 一次完整来回约 2.4s）
   ============================================================ */
console.log('\n=== 10. 来回时间 ===');
cs.start();
// 先到右边界（100/83 ≈ 1.205s）
cs.update(1205);
console.log('  t=1205ms:', cs.getProgress().toFixed(1), ', direction:', cs._direction);
assert('1205ms 到达右边界', Math.abs(cs.getProgress() - 100) < 1 && cs._direction === -1);
// 再到左边界（1205 + 1205 = 2410ms）
cs.update(1205);
console.log('  t=2410ms:', cs.getProgress().toFixed(1), ', direction:', cs._direction);
assert('2410ms 回到左边界', cs.getProgress() === 0 && cs._direction === 1);

// 验证往返次数追踪
assert('一回合 bounceCount=2', cs._bounceCount === 2);

/* ============================================================
   11. 结果汇总
   ============================================================ */
console.log('\n========================================');
console.log('  \u7528\u4F8B\u901A\u8FC7: ' + pass);
console.log('  \u7528\u4F8B\u5931\u8D25: ' + fail);
console.log('  \u603B\u7387: ' + (pass / (pass + fail) * 100).toFixed(1) + '%');
console.log('========================================');

process.exit(fail > 0 ? 1 : 0);
