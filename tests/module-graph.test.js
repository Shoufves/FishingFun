'use strict';

/**
 * 模块图完整性冒烟测试
 * 验证: 所有 src 模块可无错导入（模块间依赖与顶层代码无运行时错误）
 * 说明: 顶层代码仅做 typeof window 检查，无需真实 DOM；屏幕类只在方法内访问 DOM
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

/** 全部 src 模块（main.js 除外：其顶层会执行 bootGame） */
const MODULES = [
  '../src/data/CsvLoader.js',
  '../src/data/GameData.js',
  '../src/data/EquipmentData.js',
  '../src/data/EquipmentDef.js',
  '../src/data/PlaceholderEquipment.js',
  '../src/core/SaveManager.js',
  '../src/core/ScreenRouter.js',
  '../src/core/AudioManager.js',
  '../src/render/Renderer.js',
  '../src/render/BackgroundLayer.js',
  '../src/render/WaterAnimation.js',
  '../src/render/Sprite.js',
  '../src/fishing/CastingSystem.js',
  '../src/fishing/WaitSystem.js',
  '../src/fishing/CatchSystem.js',
  '../src/fishing/FishGenerator.js',
  '../src/fishing/FormulaSheet.js',
  '../src/systems/EquipmentManager.js',
  '../src/systems/BaitSystem.js',
  '../src/systems/EconomyManager.js',
  '../src/systems/FishDex.js',
  '../src/ui/CastingUI.js',
  '../src/ui/CatchUI.js',
  '../src/ui/WaitingUI.js',
  '../src/ui/screens/FishingScreen.js',
  '../src/ui/screens/ResultScreen.js',
  '../src/ui/screens/ShopScreen.js',
  '../src/ui/screens/EquipmentScreen.js',
  '../src/ui/screens/FishDexScreen.js',
  '../src/ui/screens/SettingsScreen.js',
];

test('全部 src 模块可无错导入', async () => {
  globalThis.window = { __DEBUG__: false };
  for (const mod of MODULES) {
    await import(mod); // 任何导入失败都会使测试失败
  }
  assert.equal(MODULES.length, 30);
});

test('FishGenerator 生成个体落在合法区间内（100 次采样）', async () => {
  const { FishGenerator } = await import('../src/fishing/FishGenerator.js');
  const gen = new FishGenerator();
  const def = {
    fishId: 1, fishName: '鲤鱼', scientificName: 'Cyprinus carpio',
    minLengthCm: 20, maxLengthCm: 80,
    minWeightKg: 0.15, maxWeightKg: 5.0,
    rarity: 2, fightPower: 3, basePriceGold: 40, expReward: 25,
    habitatLayer: '底层', activeTime: '全天',
  };
  for (let i = 0; i < 100; i++) {
    const f = gen.generate(def);
    assert.ok(f.length >= def.minLengthCm && f.length <= def.maxLengthCm * 1.5,
      '长度超出范围: ' + f.length);
    assert.ok(f.weight > 0, '体重必须为正');
    assert.ok(['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].includes(f.quality));
  }
});
