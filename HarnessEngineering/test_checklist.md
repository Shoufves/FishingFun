# 🎣 钓趣 (Fishing Fun) — 测试验证清单

> **版本**: v1.0
> **最后更新**: 2026-07-24
> **关联文档**: spec.md（功能规格）、plan.md（架构设计）、task.md（任务清单）

---

## 一、测试策略概览

| 测试层级 | 覆盖目标 | 工具/方法 |
|---|---|---|
| **单元测试** | 核心算法（抛竿判定、鱼生成、价格计算、经验曲线） | QUnit 或 Jest（纯逻辑，无 DOM） |
| **模块集成测试** | 模块间接口（DataLoader → FishingEngine, EconomyManager → Shop 等） | 手动 mock + 断言 |
| **UI 交互测试** | 用户操作流程（抛竿→等待→收线→结算） | 手动测试 + Canvas 截图对比 |
| **边界/异常测试** | 加载失败、存档损坏、极端数据 | 手动注入错误状态 |
| **性能测试** | 60fps 帧率、音游延迟、数据加载速度 | Chrome DevTools Performance tab |

---

## 二、单元测试清单

### 2.1 数据加载器 (DataLoader)

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| U-001 | 加载 FishTable.csv → 正确解析 305 行数据，无解析错误 | rows.length === 305 | P0 |
| U-002 | 加载 BaitTable.csv → 35 种饵料全部加载，BaitId 不重复 | 无重复 ID | P0 |
| U-003 | 加载 MapDefinition.csv → 15 张地图全部加载 | maps.length === 15 | P0 |
| U-004 | 加载 MapFishSpawn.csv → 809 行关联数据完整 | rows.length === 809 | P0 |
| U-005 | CSV 文件缺失/损坏 → 优雅降级，抛出明确错误信息 | Error thrown with filename | P1 |
| U-006 | 加载后按 FishId 建立索引 → 任意 FishId O(1) 查找 | lookup[42] !== undefined | P1 |

### 2.2 鱼生成器 (FishGenerator)

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| U-007 | 给定鱼种 ID，生成个体长度在 [MinLength, MaxLength] 内 | 10000 次采样全部在范围内 | P0 |
| U-008 | 体重符合幂律关系 W=aL^b，偏差不超过 ±5% | abs(W - a×L^b) < 0.05×W | P0 |
| U-009 | 10000 次采样长度的 Gamma 分布平均值为物种均值附近 | mean ≥ minLength, ≤ maxLength | P1 |
| U-010 | 突变触发率等于 BaseMutationRate（10000 次模拟，误差 ±2%） | |Rate - expected| < 0.02 | P1 |
| U-011 | 突变等级分布符合 70%/25%/5% 比例 | 10000 次采样，误差 ±3% | P1 |
| U-012 | 突变个体的长度可以突破 MaxLength 超过 15%/30%/50% | Lv1 ≤ 1.15×Max, Lv2 ≤ 1.30×Max, Lv3 ≤ 1.50×Max | P0 |
| U-013 | 相同的随机种子产生相同的鱼个体（确定性） | 两次 seed=42 结果完全一致 | P2 |

### 2.3 抛竿系统 (Casting)

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| U-014 | 游标在条状 UI 上来回匀速运动，3 次后失败 | Max 3 round trips, then CastFail | P0 |
| U-015 | 完美抛竿判定（游标完全在目标区内） | result === 'Perfect' | P0 |
| U-016 | 好抛竿判定（游标与目标区重叠 > 50%） | result === 'Good' | P0 |
| U-017 | 差抛竿判定（重叠 < 50%） | result === 'Poor' | P0 |
| U-018 | 目标区宽度受装备属性影响 | wider with better gear | P1 |
| U-019 | 装备变化时目标区宽度实时更新 | onEquip → recalc, 宽度变化 | P2 |

### 2.4 等待系统 (Waiting)

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| U-020 | 等待时间落在期望范围内（环境公式验证） | waitTime in [min, max] | P1 |
| U-021 | 饵料吸引力高 → 等待时间缩短 | 高吸引力 < 低吸引力 wait | P1 |
| U-022 | 鱼种选择权重符合 SpawnWeight 概率分布 | 10000 次采样，分布匹配 | P1 |
| U-023 | 水层不匹配时咬钩概率降低 | 不匹配 ×0.7 或 ×0.85 | P1 |
| U-024 | 活跃时段不匹配时咬钩概率降低 | 不匹配 ×0.6 | P1 |

### 2.5 收线系统（双耐力条搏鱼）

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| U-025 | 判定标记数公式正确 | count = 4 + floor(FP×1.5) + floor(R×0.5) | P0 |
| U-026 | Perfect 判定窗口 ±25ms → 正确输出 Perfect | within 25ms → 'Perfect' | P0 |
| U-027 | Great 窗口 25-50ms → 正确输出 Great | within 50ms → 'Great' | P0 |
| U-028 | Good 窗口 50-80ms → 正确输出 Good | within 80ms → 'Good' | P0 |
| U-029 | >80ms → Miss | beyond 80ms → 'Miss' | P0 |
| U-030 | 移动速度与 FightPower 正相关 | higher FP → faster speed | P1 |
| U-031 | 鱼耐力公式正确：FP×60+Rarity×150+100（四星过千） | 验证计算值准确 | P0 |
| U-032 | 玩家耐力公式正确：强度×1.5+刹车×4.0+拉力×0.6+50 | 各种装备配置下值合理 | P0 |
| U-033 | Perfect 对鱼造成全额伤害，玩家不掉耐 | dmg=baseDmg×1.0, plyStamina不变 | P0 |
| U-034 | Great 对鱼造成 0.75x 伤害，玩家掉 2% | dmg=baseDmg×0.75, plyStamina-2% | P0 |
| U-035 | Good 对鱼造成 0.5x 伤害，玩家掉 5% | dmg=baseDmg×0.50, plyStamina-5% | P0 |
| U-036 | Miss 对鱼无伤害，玩家掉 12% | dmg=0, plyStamina-12% | P0 |
| U-037 | 鱼耐力 ≤ 0 → 捕获成功 | fishStamina <=0 → SUCCESS | P0 |
| U-038 | 玩家耐力 ≤ 0 → 逃脱失败 | playerStamina <=0 → FAILURE | P0 |
| U-039 | 鱼耐力 < 25% 时进入狂暴阶段 | marker speed+20%, interval-25% | P1 |
| U-040 | 连续 3 次 Perfect 触发暴击 | Perfect×3→下一次伤害×1.5 | P1 |
| U-041 | 连续 5 次 Perfect 触发高级暴击 | Perfect×5→下一次伤害×2.0 | P1 |
| U-042 | 基础伤害公式正确：包含4种装备属性贡献 | 验证计算值准确 | P1 |
| U-043 | 装备越好 → 基础伤害越高 | 高级装备组合 > 低级装备组合 | P1 |
| U-044 | 判定标记按正确节奏生成 | interval = 700ms - FP×50ms | P1 |
| U-045 | 耐力条动画随数值变化实时更新 | bars visually update each frame | P2 |

### 2.6 经济系统 (Economy)

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| U-035 | 升级经验公式：第 N 级所需经验 = floor(100×1.15^(N-1)) | Lv1=100, Lv2=115, Lv5=175 | P0 |
| U-036 | 获取经验后等级提升正确 | 100exp Lv1→100exp→Lv2 | P0 |
| U-037 | 等级解锁地图和商店物品正确 | Lv5 unlock map 7, etc. | P1 |
| U-038 | 售价公式包含所有加成因子的正确计算 | test with known values | P0 |
| U-039 | 大尺寸鱼售价 > 小尺寸鱼 | sizeBonus 正影响 | P1 |
| U-040 | 突变鱼售价 > 普通鱼 | mutationBonus 正影响 | P1 |

### 2.7 装备系统 (Equipment)

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| U-041 | 装备品质倍率正确（普通×1.0 → 传说×2.2） | multiplier values correct | P0 |
| U-042 | 装备基本属性 + 品质倍率 = 实际属性 | effectiveAttr = base × qualityMul | P0 |
| U-043 | 装备稀有度影响售价和对属性加成 | rare item costs more, gives more | P1 |
| U-044 | 装备更换后钓鱼公式中的参数更新 | onEquip → recalcAllFormulas | P2 |

### 2.8 UI/渲染

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| U-045 | Canvas 尺寸适配窗口缩放 | canvas.width/height = window * dpr | P2 |
| U-046 | 像素渲染模式（image-rendering: pixelated） | no anti-aliasing on pixel art | P1 |
| U-047 | 屏幕切换时清理旧状态 | no leftover event listeners | P1 |

---

## 三、集成测试清单

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| I-001 | 完整钓鱼流程：选择地图 → 抛竿 → 等待 → 收线 → 结算 → 返回 | 流程无中断 | P0 |
| I-002 | 钓到鱼 → 金币增加 × 图鉴解锁 ✓ | gold + collection updated | P0 |
| I-003 | 成功/失败均消耗 1 鱼线 + 1 饵料 | inventory decremented | P0 |
| I-004 | 图鉴完成度随钓获新鱼种增加 | X/305 正确更新 | P1 |
| I-005 | 商店购买 → 金币减少 → 物品进入背包 | gold, inventory correct | P1 |
| I-006 | 装备更换 → 下一竿钓鱼参数变化 | catch bar changes | P1 |
| I-007 | 等级提升 → 新地图解锁 → 可进入 | map select shows new map | P1 |
| I-008 | 存档 → 刷新页面 → 读档 → 数据完整恢复 | all stats preserved | P0 |

---

## 四、边界情况测试

| # | 测试用例 | 期望结果 | 优先级 |
|---|---|---|---|
| B-001 | 金币为 0 时尝试购买物品 | 购买失败，提示金币不足 | P0 |
| B-002 | 鱼线/饵料数量为 0 时尝试钓鱼 | 提示资源不足，阻止出发 | P0 |
| B-003 | 鱼线拉力远小于挣扎力时必定断线 | lineSnap event triggered | P1 |
| B-004 | 同时触发多个咬钩（防连击保护） | 只处理第一个咬钩 | P2 |
| B-005 | localStorage 满 → 优雅提示存档失败 | error message shown | P1 |
| B-006 | 窗口失去焦点时正在收线判定 → 暂停或降级 | game pauses / all miss | P2 |
| B-007 | 所有地图未解锁时，地图选择页面显示 | locked maps with lock icon | P1 |
| B-008 | 鱼缸满时尝试放入鱼 | 提示鱼缸已满 | P1 |

---

## 五、性能测试

| # | 测试指标 | 达标标准 | 工具 |
|---|---|---|---|
| P-001 | Canvas 渲染帧率（空场景） | ≥ 60fps | Chrome DevTools FPS |
| P-002 | Canvas 渲染帧率（满水族箱动画） | ≥ 30fps | Chrome DevTools FPS |
| P-003 | 音游判定输入到响应延迟 | ≤ 16ms | performance.now() |
| P-004 | CSV 数据加载时间 | ≤ 2s | performance.mark/measure |
| P-005 | 存档写入/读取时间 | ≤ 100ms | performance.now() |
| P-006 | localStorage 存档体积 | ≤ 200KB | JSON.stringify().length |
| P-007 | 内存泄漏检查（循环钓鱼 100 次） | no sustained memory growth | Chrome Memory Tab |

---

## 六、游戏平衡性验证

| # | 验证项 | 方法 | 优先级 |
|---|---|---|---|
| V-001 | 常见鱼钓获率远高于稀有鱼 | 1000 次钓鱼统计，常见鱼 ≥ 70% | P1 |
| V-002 | 低等级地图平均收益 < 高等级地图 | 各地图 100 次钓鱼平均金币 | P1 |
| V-003 | 不同装备组合下收益方差合理 | 基础 vs 高级装备收益差异 ≤ 3× | P2 |
| V-004 | 完美抛竿+完美收线净收益 > 普通操作 | 完美操作额外收益 ≥ 30% | P1 |
| V-005 | 经验曲线 1-50 级累计所需经验可接受 | 50 级约 54 万 EXP，非变态 grind | P2 |

---

## 七、兼容性测试

| # | 浏览器 | 关键测试 |
|---|---|---|
| C-001 | Google Chrome 最新版 | 全功能覆盖 |
| C-002 | Mozilla Firefox 最新版 | Canvas + Web Audio + localStorage |
| C-003 | Microsoft Edge 最新版 | 主要流程 |
| C-004 | 移动端 Chrome（如有余力） | 触屏适配 |

---

## 八、测试数据生成

```javascript
// 用于测试的示例鱼数据（硬编码验证）
const testFish = {
  fishId: 2,          // 鲤鱼
  length: 45.5,       // cm
  weight: 2.34,       // kg (a=3.61e-5, b=2.975)
  rarity: 2,
  fightPower: 6,
  basePrice: 40,
  expReward: 25,
  mutationLevel: 0
};

// 预期结果
const expectedPrice = 40 * (1 + 0.12 + 0 + 0.1);  // ≈ 48.8
const expectedExp   = 25 * (1 + 0.12 * 0.8 + 0.15*2 + 0);  // ≈ 35.8
```

---

> **用法说明**：
> - 每个 Task 完成后，对照本清单执行对应的测试用例
> - 已通过的测试用 `[✅]` 标记，失败的用 `[❌]`
> - 新发现的测试用例追加在末尾并更新日期
> - P0 = 必须通过才能发布，P1 = 建议通过，P2 = 锦上添花
