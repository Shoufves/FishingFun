'use strict';

/**
 * BossData 完整性测试（需求2）
 * 覆盖: 3 条 Boss 定义完整性（名称/介绍/血量/体型/奖励/特性/技能字段）
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_DATA, getBossById } from '../../src/data/BossData.js';

test('Boss 数量为 3', () => {
  assert.equal(BOSS_DATA.length, 3);
});

test('每条 Boss 信息完整（血量/体型/奖励/特性/技能/介绍）', () => {
  for (const b of BOSS_DATA) {
    assert.ok(b.id && typeof b.id === 'string', b.id + ' 缺 id');
    assert.ok(b.name, b.id + ' 缺名称');
    assert.ok(b.description && b.description.length >= 20, b.id + ' 介绍应完整');
    assert.ok(b.baseStamina >= 3000, b.id + ' 血量应极高（>=3000）');
    assert.ok(b.minLengthCm >= 100 && b.maxLengthCm > b.minLengthCm, b.id + ' 体型应较大');
    assert.ok(b.reward > 0, b.id + ' 缺金币奖励');
    assert.ok(b.trait && b.trait.name && b.trait.desc, b.id + ' 缺特性');
    assert.ok(b.skill && b.skill.type && b.skill.duration > 0 && b.skill.cooldown > 0,
      b.id + ' 缺技能');
  }
});

test('技能周期包含激活与冷却', () => {
  for (const b of BOSS_DATA) {
    const period = b.skill.duration + b.skill.cooldown;
    assert.ok(period > 0);
  }
});

test('getBossById 查询正确', () => {
  assert.equal(getBossById('boss_001').name, '深渊巨鳗');
  assert.equal(getBossById('boss_003').skill.type, 'immunePerfectOnly');
  assert.equal(getBossById('nope'), undefined);
});

test('Boss 对玩家伤害已平衡（2026-07-27 反馈：过高下调）', () => {
  for (const b of BOSS_DATA) {
    const dmg = b.trait.playerDamageMult || 1;
    const stam = b.trait.playerStaminaMult || 1;
    assert.ok(dmg <= 1.5, b.name + ' 对玩家伤害倍率应 ≤1.5，实际 ' + dmg);
    assert.ok(stam >= 0.9, b.name + ' 玩家耐力上限倍率应 ≥0.9，实际 ' + stam);
  }
  // 具体数值锁定
  assert.equal(getBossById('boss_001').trait.playerDamageMult, 1.2);
  assert.equal(getBossById('boss_002').trait.playerStaminaMult, 0.9);
  assert.equal(getBossById('boss_003').trait.playerDamageMult, 1.5);
});
