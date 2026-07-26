# 像素钓鱼游戏 — 架构与实施计划

> 版本 1.0 | 技术栈：HTML5 + JavaScript + CSS (Canvas 2D)，无框架 | 单机 localStorage 存档

---

## 1. 系统架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │ UIManager│  │Canvas    │  │ Audio    │  │ Input    │   │
│   │ (屏幕路由│  │渲染管线  │  │Manager   │  │Handler   │   │
│   │ + 菜单)  │  │(60fps)   │  │(WebAudio)│  │(按键/触)│   │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
├────────┼──────────────┼──────────────┼──────────────┼────────┤
│        ▼              ▼              ▼              ▼        │
│                    Game Logic Layer                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │Fishing   │  │Economy   │  │Equipment │  │MapManager│   │
│   │Engine    │  │Manager   │  │Manager   │   │(Spawn权 │   │
│   │(三段式   │  │(XP/金币/ │  │(装备CRUD │   │ 重+解锁)│   │
│   │ 钓鱼)    │  │ 商店)    │  │ +属性)   │   │          │   │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
│   ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐   │
│   │Fish      │  │Collect'n │  │Aquarium  │  │Save     │   │
│   │Generator │  │Manager   │  │Manager   │   │Manager  │   │
│   │(体长/    │  │(FishDex  │  │(水族箱   │   │(存档/   │   │
│   │ 变异/    │  │ 图鉴)    │  │ 管理)    │   │ 读档)   │   │
│   │ 品质)    │  │          │  │          │   │          │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├──────────────────────────────────────────────────────────────┤
│                      Model Layer                             │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │FishData  │  │Equipment │  │PlayerData│  │ItemData  │   │
│   │(鱼种定  │  │Data      │  │(等级/经  │  │(饵料/道  │   │
│   │ 义)     │  │(装备定   │  │ 验/金币) │  │ 具数据)  │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│   │MapData   │  │SpawnData │  │Mutation  │  │RecipeData│   │
│   │(地图定  │  │(生成条   │  │Data      │  │(预留:烹  │   │
│   │ 义)     │  │ 目)      │  │(变异系   │  │ 饪/合成) │   │
│   └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
├──────────────────────────────────────────────────────────────┤
│                      Data Layer                              │
│   ┌──────────────────────────────────────────────────┐       │
│   │              DataLoader                          │       │
│   │  (CSV解析器 + 请求合并 + 运行时数据缓存)         │       │
│   ├──────────────────────────────────────────────────┤       │
│   │  table/FishTable.csv │ table/BaitTable.csv     │       │
│   │  table/MapDef.csv │ table/MapFishSpawn.csv     │       │
│   ├──────────────────────────────────────────────────┤       │
│   │  localStorage (存档持久化)                        │       │
│   └──────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

**架构核心原则：**
- 单向数据流：Data Layer → Model → Game Logic → Presentation
- 各 Manager 之间仅通过 Model 数据耦合，不直接引用对方内部方法
- SaveManager 可读取所有 Model 数据，统一序列化到 localStorage
- UIManager 是可替换的渲染后端，游戏逻辑不依赖 Canvas API

---

## 2. 模块划分

### 2.1 DataLoader（数据加载器）

| 职责 | 说明 |
|------|------|
| CSV 解析 | 将 5 张 CSV 表格解析为结构化 JavaScript 对象数组 |
| 运行时缓存 | 解析后的数据保存在 `DataCache` 单例中，全局只读访问 |
| 请求合并 | 所有表格并行 fetch，全部就绪后触发初始化回调 |
| 数据校验 | 检查关键列的完整性（长度、范围、外键引用） |

**接口概要：**
```js
class DataLoader {
  static async loadAll() → { fishTable, baitTable, mapDef, spawnTable, equipTable }
  static getFishById(id) → FishDef
  static getSpawnsByMap(mapId) → SpawnEntry[]
  static getBaitById(id) → BaitDef
}
```

**涉及的 CSV 文件：**
- `table/FishTable.csv` — 305 种鱼的定义（ID、名称、稀有度、基础价格、体型参数 a/b、活动时间等）
- `table/BaitTable.csv` — 35 种饵料定义（ID、名称、效果倍率、价格、适用水域）
- `table/MapDefinition.csv` — 15 张地图定义（ID、名称、解锁条件、基础鱼类倍率）
- `table/MapFishSpawn.csv` — 809 条生成条目（地图ID、鱼ID、权重、最低/最高等级、时间窗口）
- `EquipmentTables.csv` — 装备定义（含 Rod/Reel/Line/Hook 四类子表）

### 2.2 FishingEngine（钓鱼引擎）

钓鱼三段式流程的控制器：

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  抛竿阶段   │ ──► │  等待阶段   │ ──► │  收竿节奏   │ ──► │  结果界面   │
│ (Casting)   │     │ (Waiting)   │     │  游戏 (Catch)│     │ (Result)    │
│ 精度条小游戏│     │ 随机等待时间│     │ 标记点击判定│     │ 展示捕获鱼 │
│ 决定落点    │     │ + 鱼咬钩RNG │     │ Perf/Good/   │     │ + 经验/金币 │
└─────────────┘     └─────────────┘     │ Miss判定     │     └─────────────┘
                                         └──────────────┘
```

| 职责 | 说明 |
|------|------|
| 抛竿判定 | 根据玩家在精度条上停止的位置计算落点精度（0-100%） |
| 等待计时 | 综合考虑装备、地图、饵料计算等待时长，内部使用 RNG 决定是否咬钩 |
| 鱼种选择 | 调用 MapManager 根据 spawn weight + 装备 + 饵料计算概率分布 |
| 鱼生成 | 委托 FishGenerator 创建实际捕获的鱼实例 |
| 收竿小游戏 | 管理标记序列、计时器、按帧更新判定窗口 |
| 结果结算 | 汇编捕获数据 → 调用 EconomyManager 结算经验/金币 |

**状态机：**
```
IDLE → CASTING → WAITING → CATCHING → RESULT → IDLE
                 ↑                        │
                 └── (超时/脱钩) ──────────┘
```

### 2.3 FishGenerator（鱼生成器）

| 职责 | 说明 |
|------|------|
| 体长生成 | 使用 Gamma 分布（形状参数 k=2~5，尺度参数 θ=平均体长/k） |
| 体重计算 | 幂律关系 W = a · L^b（a、b 来自 FishTable 每行定义） |
| 品质判定 | 根据装备品质 + 地图加成 + RNG 决定品质（Common→Uncommon→Rare→Epic→Legendary） |
| 变异系统 | 小概率 (<0.5%) 触发颜色/尺寸/发光变异，产生特殊个体 |
| 尺寸分布 | 以平均体长为基准，生成范围在 60%~140% 之间的实际体长 |

### 2.4 EquipmentManager（装备管理器）

| 职责 | 说明 |
|------|------|
| 装备 CRUD | 玩家装备栏的增删改查 |
| 属性计算 | 根据装备基础属性 + 品质倍率 + 强化等级计算最终数值 |
| 装备切换 | 当前装备组合的快速切换（预设方案） |
| 属性映射 | 将装备属性映射到钓鱼机制的各个环节 |

**四种装备的属性维度：**

| 装备 | 属性 | 影响 |
|------|------|------|
| 鱼竿 (Rod) | 强度、弹性、灵敏度、耐久、重量 | 抛竿精度上限、大鱼控制力 |
| 渔轮 (Reel) | 收线速度、齿轮比、轴承数、耐久 | 收竿速度、节奏游戏容错 |
| 鱼线 (Line) | 拉力、直径、弹性、耐磨 | 可挑战鱼类上限、脱钩率 |
| 鱼钩 (Hook) | 锋利度、大小、强度、倒刺 | 咬钩率、刺鱼成功率 |

**品质倍率表：**
```
Common → 1.0× | Uncommon → 1.25× | Rare → 1.5× | Epic → 2.0× | Legendary → 3.0×
```

### 2.5 EconomyManager（经济管理器）

| 职责 | 说明 |
|------|------|
| 经验计算 | 根据鱼的基础经验 × 品质倍率 × 体型倍率 |
| 等级管理 | exp = 100 × 1.15^(N-1) 指数曲线，升级时触发回调 |
| 金币管理 | 加减操作，下限为零，上限用 Number.MAX_SAFE_INTEGER 保护 |
| 商店逻辑 | 购买装备/饵料的校验、扣款、发放 |
| 出售逻辑 | 根据鱼基础价格 × 体型系数 × 品质系数 × 变异加成的公式计算售价 |

### 2.6 MapManager（地图管理器）

| 职责 | 说明 |
|------|------|
| 地图解锁 | 根据玩家等级判定未锁定地图 |
| 权重计算 | 根据 SpawnEntry.weight、当前装备加成、饵料效果、时间窗口计算鱼种概率 |
| 鱼种筛选 | 排除等级不匹配、时间窗口不合的 spawn 条目 |
| 当前地图状态 | 天气/时段（昼夜系统预留接口） |

**Spawn 权重选择算法：**
```
总权重 = Σ(符合条件的 SpawnEntry.weight × 饵料倍率 × 装备加成)
随机数 r = [0, 总权重)
遍历求和，当累计权重 > r 时选择该鱼种
```

### 2.7 SaveManager（存档管理器）

| 职责 | 说明 |
|------|------|
| 自动存档 | 每次关键操作后（捕获鱼、购买、装备变更）自动写入 localStorage |
| 手动存档 | 通过设置界面触发 |
| 读档 | 游戏启动时自动检测并恢复 |
| 数据迁移 | 存档版本号控制，支持未来数据结构变更的迁移 |
| 存档导出/导入 | Base64 编码的存档字符串（预留） |

**存档结构（JSON）：**
```json
{
  "version": 1,
  "player": { "level": 5, "xp": 320, "gold": 1250 },
  "inventory": { "equipment": [...], "baits": [...], "items": [...] },
  "equipped": { "rod": null, "reel": null, "line": null, "hook": null },
  "fishdex": { "caught": [123, 456], "totalPerSpecies": {...} },
  "aquarium": { "slots": [...], "capacity": 10 },
  "settings": { "musicVolume": 0.7, "sfxVolume": 1.0, "language": "zh" },
  "unlockedMaps": [1, 2, 3],
  "timestamp": 1712345678
}
```

### 2.8 CollectionManager（图鉴管理器）

| 职责 | 说明 |
|------|------|
| FishDex 图鉴 | 记录每种鱼是否已捕获、最大体长、累计数量 |
| 水族箱 | 管理已放置鱼只的展示、投喂（预留） |
| 统计信息 | 总捕获数、稀有鱼种数、完成度百分比 |
| 过滤器/排序 | 按稀有度、体长、水域分类查看 |

### 2.9 UIManager（界面管理器）

| 职责 | 说明 |
|------|------|
| 屏幕路由 | 管理主菜单、钓鱼场景、图鉴、商店、设置等界面切换 |
| 渲染管线 | 每帧调用 Canvas 渲染，图层顺序见第 4 节 |
| 动画系统 | 补间动画（tween）管理，支持缓动函数 |
| UI 组件库 | 按钮、滑动条、列表、弹窗等可复用组件 |
| 输入处理 | 鼠标/触控事件分发，键盘快捷键 |

### 2.10 AudioManager（音频管理器）

| 职责 | 说明 |
|------|------|
| 音效播放 | Web Audio API 加载和播放短音效（投水声、收竿声、成功/失败音） |
| 背景音乐 | 循环播放 BGM，支持渐入渐出 |
| 音量控制 | 独立控制 SFX 和 BGM 音量 |
| 音频池 | 同一音效同时播放多个实例时的资源复用 |

---

## 3. 数据流

### 3.1 一次完整钓鱼会话的数据流

```
玩家操作                          数据/逻辑处理                         UI更新
─────────                  ──────────────────                   ──────────
 点击"抛竿"  ──►  FishingEngine.startCasting()
                    ↓
 精度条交互  ──►  UIManager.updateCastingBar(progress)
                    ↓
 停止精度条  ──►  FishingEngine.resolveCast(position)
                    ├─ 计算精度 accuracy = 1 - |target - pos|/range
                    └─ 存储 accuracy → currentSession.castAccuracy
                    ↓
                    FishingEngine.startWaiting()
                    ├─ 计算等待时间 baseWait × equipmentBonus × mapBonus
                    ├─ 启动计时器 (setTimeout/requestAnimationFrame)
                    └─ 更新状态为 WAITING
                    ↓                                         显示等待动画
 等待完成    ──►  FishingEngine.onBite()
                    ├─ MapManager.selectFish(mapId, equipped, bait, time)
                    │     ├─ 筛选符合条件的 SpawnEntry
                    │     ├─ 权重计算 + 随机选择
                    │     └─ 返回 FishDef
                    ├─ FishGenerator.createFish(fishDef, playerLevel, mapBonus)
                    │     ├─ Gamma 分布生成体长 L
                    │     ├─ 幂律 W = a·L^b 计算体重
                    │     ├─ 品质判定 (RNG + 装备修正)
                    │     └─ 变异判定 (roll < 5%)
                     ├─ 计算双耐力值: fishStamina = f(fightPower, rarity)
                     │                 playerStamina = f(equipment)
                     ├─ 计算判定标记数 markerCount = f(fightPower, rarity)
                     └─ 更新状态为 CATCHING
                     ↓                                         显示双耐力条 + 判定轨道
  耐力对决    ──►  FishingEngine.onCatchTick(deltaTime)
                     ├─ 每个 marker 到达判定区时等待玩家输入
                     ├─ 判定: |差值| ≤ 25ms → Perfect → fishStamina -= baseDmg × 1.0
                     │       ≤ 60ms → Great   → fishStamina -= baseDmg × 0.75
                     │       ≤ 100ms → Good   → fishStamina -= baseDmg × 0.5
                     │       > 100ms → Miss   → playerStamina -= maxStamina × 12%
                     ├─ Perfect: 玩家不掉耐; Good: 玩家减 5%; Miss: 玩家减 12%
                     ├─ 反馈: note放大+虚化 + 音效 + 屏幕抖动 + 耐力条闪烁
                     └─ 当 fishStamina ≤ 0 或 playerStamina ≤ 0 时停止
                     ↓
  耐力归零    ──►  FishingEngine.resolveCatch()
                     ├─ fishStamina ≤ 0 → ✅ 成功钓获
                     │   ├─ EconomyManager.addXp(fish.xpReward × qualityMultiplier)
                     │   ├─ EconomyManager.addGold(fish.price)
                     │   ├─ CollectionManager.registerCatch(fish)
                     │   └─ SaveManager.autoSave()
                     └─ playerStamina ≤ 0 → ❌ 逃脱失败
                         └─ 显示断线/脱钩动画
                    ↓                                         显示结果界面
```

### 3.2 数据变更 → UI 更新机制

```
Model 数据变更
    │
    ▼
EventBus.emit('fish:caught', { fish, result })
    │
    ├──► UIManager.showResultScreen(data)
    ├──► CollectionManager 更新图鉴状态
    ├──► EconomyManager 检查等级提升
    │       └──► EventBus.emit('player:levelUp', newLevel)
    │               └──► UIManager.showLevelUpAnimation()
    └──► SaveManager.autoSave()
```

所有 Manager 之间不直接引用，通过全局 `EventBus` 解耦通信。

---

## 4. 渲染管线

Canvas 渲染采用**层叠绘制**模式，每帧按照固定顺序从底层到顶层绘制。

```
帧开始 (requestAnimationFrame callback)
    │
    ├── 1. clearCanvas() — 清除全帧
    │
    ├── 2. 背景层 (Background Layer)
    │     ├─ 天空/远景渐变
    │     ├─ 地图特有背景元素（树木、山峦、建筑等）
    │     └─ 水面底色
    │
    ├── 3. 水体层 (Water Layer)
    │     ├─ 水面纹理动画（像素波浪、光闪烁）
    │     ├─ 水底颜色渐变 (透明度叠加)
    │     └─ 水下粒子（气泡、光线）
    │
    ├── 4. 游戏对象层 (Game Object Layer)
    │     ├─ 浮标/鱼漂动画
    │     ├─ 水中鱼影（咬钩前的鱼影游动）
    │     └─ 钓鱼线
    │
    ├── 5. 节奏游戏层 (Rhythm Game Layer) — 仅在 CATCHING 状态
    │     ├─ 判定轨道
    │     ├─ 移动标记 (marker)
    │     ├─ 判定区域高亮
    │     └─ 点击特效 (Perfect/Great/Good/Miss)
    │
    ├── 6. UI 覆盖层 (UI Overlay Layer)
    │     ├─ 抛竿精度条
    │     ├─ 等待进度指示器
    │     ├─ 战斗条 (收竿时显示)
    │     ├─ 装备切换按钮
    │     └─ 饵料选择面板
    │
    ├── 7. HUD 层 (HUD Layer)
    │     ├─ 当前地图/时间
    │     ├─ 等级/经验条
    │     ├─ 金币数量
    │     ├─ 设置入口按钮
    │     └─ 返回按钮
    │
    ├── 8. 模态层 (Modal Layer) — 仅在弹窗时渲染
    │     ├─ 结果界面
    │     ├─ 商店界面
    │     ├─ 图鉴界面
    │     └─ 设置面板
    │
    └── 帧结束
```

**渲染性能策略：**
- 静态背景离屏渲染到 offscreenCanvas，每帧仅复制（`drawImage`）
- UI 元素使用脏矩形标记，仅重绘变化区域
- 粒子系统使用对象池避免 GC 抖动
- `requestAnimationFrame` 驱动，帧间隔超过 50ms 时跳帧

---

## 5. 关键算法清单

### 5.1 抛竿精度公式

```
落点偏差 = |玩家停止位置 - 目标区域中心|
精度 = max(0, 1 - 偏差 / 精度条总宽度)

装备修正后的精度 = 精度 × (1 + 0.1 × rod.sensitivity_rank)
```

### 5.2 等待时间公式

```
基础等待时间 = uniform(5, 30) 秒  ← 根据地图鱼种密度调整
装备修正 = 1 - 0.05 × (reel.speed_rank + line.elasticity_rank)
饵料修正 = 1 - bait.attractBonus
实际等待时间 = 基础等待时间 × 装备修正 × 饵料修正

咬钩概率 = min(0.95, 0.5 + 0.05 × hook.sharpness_rank + bait.biteRateBonus)
每 tick（约 1 秒）进行一次咬钩判定
最大等待时间 = 实际等待时间 × 2（超时则自动脱钩）
```

### 5.3 收竿难度公式（标记数量）

```
战力系数 = (rod.strength + reel.gearRatio + line.tensile + hook.strength) / 4
战斗难度 = 鱼类稀有度系数 / 战力系数
标记数量 = clamp(3 + floor(战斗难度 × 4), 3, 12)
标记间隔 = 基础间隔 × (1 - 0.1 × reel.speed_rank)
```

### 5.4 双耐力条对决模型

#### 5.4.1 耐力值计算

```
鱼最大耐力 = FightPower × 12 + Rarity × 6 + 20
玩家最大耐力 = rod.strength × 1.5 + reel.drag × 5 + line.tensile × 0.8 + 50
```

#### 5.4.2 伤害与耐力消耗

| 判定 | 时间窗口 | 系数 p | 鱼耐力伤害 | 玩家耐力损失 |
|---|---|---|---|---|
| Perfect | ≤ ±25ms | 1.0 | baseDmg × 1.0 | 0 |
| Great | ≤ ±60ms | 0.75 | baseDmg × 0.75 | 最大耐力 × 2% |
| Good | ≤ ±100ms | 0.50 | baseDmg × 0.50 | 最大耐力 × 5% |
| Miss | > ±100ms | 0.0 | 0 | 最大耐力 × 12% |

```
基础伤害 = rod.strength/15 + hook.sharpness/8 + reel.gearRatio × 2 + line.tensile/10
```

#### 5.4.3 胜负判定

```
对拼持续到一方耐力归零:
  鱼耐力 ≤ 0 → 成功钓获
  玩家耐力 ≤ 0 → 鱼逃脱（消耗1鱼线+1饵料）
```

#### 5.4.4 狂暴阶段

```
当鱼耐力 < 25%:
  判定标记速度 +20%, 标记间隔 -25% (最终挣扎)
```

#### 5.4.5 连击奖励

```
连续 Perfect ≥ 3次 → 下次 Perfect 伤害 × 1.5 (暴击)
连续 Perfect ≥ 5次 → 下次 Perfect 伤害 × 2.0
```

### 5.6 鱼体长生成（Gamma 分布）

```
形状参数 k = clamp(鱼种体型类别, 2, 5)
尺度参数 θ = 鱼种平均体长 / k
体长 L = Gamma(k, θ) × 随机浮动因子 (0.6~1.4)
```

实现使用 Marsaglia & Tsang 方法生成 Gamma 随机变量。

### 5.7 体重公式（幂律）

```
W = a × L^b
```

其中 a、b 从 FishTable 的每行定义中读取，L 为体长（cm），W 为体重（g）。

### 5.8 售价计算

```
体型倍率 = (实际体长 / 平均体长)^1.5
品质倍率 = [Common=1, Uncommon=1.5, Rare=2.5, Epic=5, Legendary=12]
变异加成 = 有变异 ? 2.0 : 1.0
最终售价 = floor(鱼种基础价格 × 体型倍率 × 品质倍率 × 变异加成)
```

### 5.9 经验计算

```
基础经验 = 鱼种基础经验 × 体型倍率（同售价体型倍率）
品质加成 = 品质倍率 × 0.5（额外经验系数）
最终经验 = floor(基础经验 × (1 + 品质加成))
```

### 5.10 升级曲线

```
升级所需经验 = floor(100 × 1.15^(当前等级 - 1))
总经验 = Σ(从 1 级到当前级的每级所需经验)
```

### 5.11 装备属性缩放

```
装备基础属性 = 装备定义中的基础值
品质系数 = Common:1.0, Uncommon:1.25, Rare:1.5, Epic:2.0, Legendary:3.0
最终属性 = floor(基础属性 × 品质系数)
```

（强化系统作为预留接口，未来版本可叠加强化倍率）

### 5.12 SpawnWeight 鱼种选择

```
function selectFish(spawnEntries, playerLevel, baitModifiers, timeOfDay):
    valid = filter(spawnEntries, e →
        playerLevel >= e.minLevel ∧ playerLevel ≤ e.maxLevel ∧
        timeOfDay in e.timeWindow)
    totalWeight = Σ(valid, e → e.weight × baitModifiers[e.baitType] × mapBonus)
    r = random(0, totalWeight)
    cumulative = 0
    for each entry in valid:
        cumulative += entry.weight × baitModifiers
        if cumulative > r: return entry.fishId
    return last(valid).fishId  // fallback
```

---

## 6. 实施顺序（Phase Plan）

### Phase 1 — 基础架构（Foundation）

**目标：** 可运行的空游戏壳，能加载数据并显示主菜单。

| 编号 | 任务 | 产出 |
|------|------|------|
| 1.1 | 项目目录结构搭建，index.html 入口 | 初始 HTML/CSS/JS 骨架 |
| 1.2 | DataLoader + CSV 数据解析 | 运行时 DataCache |
| 1.3 | SaveManager + localStorage 持久化 | 存档/读档功能 |
| 1.4 | UIManager 屏幕路由 | 主菜单屏幕切换 |
| 1.5 | Canvas 渲染管线基础实现 | 空白画布 + 帧循环 |
| 1.6 | EventBus 实现 | 全局事件系统 |

**验收标准：** 启动后可以看到主菜单，点击按钮切换屏幕，Canvas 背景正常渲染，刷新页面后保存的数据可恢复。

### Phase 2 — 核心玩法（Core Gameplay）

**目标：** 可玩的三段式钓鱼流程（抛竿→等待→收竿→结果）。

| 编号 | 任务 | 产出 |
|------|------|------|
| 2.1 | FishingEngine 状态机 | 完整状态转换 |
| 2.2 | 抛竿精度条小游戏 UI + 逻辑 | 可交互精度条 |
| 2.3 | 等待阶段 + RNG 咬钩 | 等待动画 + 咬钩触发 |
| 2.4 | 收竿节奏游戏（静态标记） | 标记生成 + 点击判定 |
| 2.5 | FishGenerator 基础实现 | 体长/体重生成 |
| 2.6 | 结果界面 | 捕获信息展示 |
| 2.7 | 基础鱼类数据接入（少量鱼种） | 至少有 10 种鱼可钓 |

**验收标准：** 玩家可以完成一次完整的钓鱼流程：抛竿、等待、拉鱼、看到结果。精度和节奏判定正常工作。

### Phase 3 — 系统集成（Systems）

**目标：** 装备系统、经济系统、商店、图鉴集成完毕。

| 编号 | 任务 | 产出 |
|------|------|------|
| 3.1 | EquipmentManager 完整实现 | 四种装备 CRUD + 属性计算 |
| 3.2 | 装备 UI（装备栏 + 切换界面） | 装备选择屏幕 |
| 3.3 | EconomyManager + XP/等级/金币 | 经验累积 + 升级 |
| 3.4 | 商店 UI（购买装备/饵料） | 可购买的商品列表 |
| 3.5 | 出售鱼类 UI | 背包 → 出售流程 |
| 3.6 | CollectionManager + FishDex 图鉴 | 图鉴界面 |
| 3.7 | 水族箱基础（放置鱼只展示） | 简单水族箱屏幕 |

**验收标准：** 装备影响钓鱼属性，商店购买正常，捕获鱼后图鉴更新，经验累积触发升级，可出售获取金币。

### Phase 4 — 内容填充（Content）

**目标：** 接入全部 305 种鱼、35 种饵料、15 张地图和 809 条生成条目。

| 编号 | 任务 | 产出 |
|------|------|------|
| 4.1 | 完整 FishTable.csv 导入 | 所有鱼种数据可用 |
| 4.2 | MapManager + 所有地图解锁逻辑 | 15 张地图可游玩 |
| 4.3 | 全部 SpawnEntry 接入 | 每张地图正确的鱼种分布 |
| 4.4 | 日/夜系统 + 时间窗口逻辑 | 不同时段不同鱼种 |
| 4.5 | BaitTable 完整实现 | 35 种饵料效果 |
| 4.6 | 变异系统完整实现 | 罕见变异个体 |
| 4.7 | 品质系统与装备联动 | 高品质鱼产出依赖高品质装备 |

**验收标准：** 任意地图、任意时段、任意装备组合下鱼种分布符合 CSV 数据定义。变异鱼可正常捕获。

### Phase 5 — 打磨（Polish）

**目标：** 音效、动画、视觉打磨，测试和性能优化。

| 编号 | 任务 | 产出 |
|------|------|------|
| 5.1 | AudioManager + 音效资源 | 投水、咬钩、判定音效 |
| 5.2 | Canvas 补间动画系统 | 流畅的 UI 过渡 |
| 5.3 | 像素画风视觉统一 | 配色/字体/像素对齐 |
| 5.4 | 设置界面（音量、语言） | 功能完整的设置页 |
| 5.5 | 性能优化（离屏渲染、脏矩形） | 稳定 60fps |
| 5.6 | 全面测试 | 边缘案例覆盖 |
| 5.7 | 未来系统接口预留 | Cooking/Crafting/Leaderboard 桩代码 |

**验收标准：** 游戏运行流畅（60fps），音效正常，无明显的视觉/交互 Bug。未来系统的接口定义明确。

---

## 7. 技术挑战与风险

### 7.1 Canvas 渲染性能（60fps 稳定性）

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 每帧绘制过多对象导致丢帧 | 画面卡顿，节奏游戏判定偏移 | 离屏 Canvas 缓存静态层；脏矩形增量更新；对象池复用粒子/UI 元素 |
| JavaScript GC 停顿 | 偶发性帧时间尖刺 | 预先分配对象池，避免帧中 `new`/`delete` 操作 |
| 像素缩放模糊 | 像素画风失真 | 使用 `image-rendering: pixelated` CSS，整数缩放因子 |

### 7.2 节奏游戏精度（延迟控制）

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| requestAnimationFrame 回调时间不精确 | 判定窗口偏移 | 使用 `performance.now()` 作为时间源，而非帧计数；在 rAF 回调中计算真实 delta |
| 输入延迟 | 玩家感觉"按键没反应" | touchstart/mousedown 事件优先于 click；减少事件气泡路径 |
| 帧率波动时判定失真 | 高难度标记序列不准 | delta 补偿：marker 位置 = 速度 × (当前时间 - 生成时间) |

**关键数值：** 节奏游戏需要在 <16ms（一帧）的精度内稳定运行。Perfect 窗口 ±25ms 意味着即使掉一帧也可能导致 Perfect 降为 Great。因此：

- 判定逻辑**不依赖帧号**，而是绝对时间戳比较
- 输入事件的时间戳直接从 `event.timeStamp` 获取
- 标记渲染位置通过 `(当前时间 - 标记生成时间) / 判定区间时长 × 轨道宽度` 计算，保证即使跳帧位置也正确

### 7.3 动画平滑度

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| 补间动画中途被屏幕切换打断 | UI 状态不一致 | 动画队列支持取消回掉，屏幕切换时清理未完成的动画 |
| 多层动画叠加导致复杂度飙升 | 渲染耗时增加 | 限制同时活跃的动画数量（≤ 16 个），超出则合并 |

### 7.4 数据完整性

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| localStorage 写失败（超出配额） | 存档丢失 | 序列化前估算大小，写失败时弹窗提示，提供导出保存的功能 |
| 存档版本不兼容 | 加载旧版存档崩溃 | 版本号字段 + 迁移函数表，启动时检测并自动迁移 |
| CSV 数据格式变更 | 解析出错 | DataLoader 解析时进行列数/类型校验，校验失败时提供明确错误信息并加载默认值 |

### 7.5 扩展性预留

| 预留系统 | 预留方式 | 触发条件 |
|----------|----------|----------|
| Cooking（烹饪） | RecipeData 模型 + `CookingManager` 桩接口 | Phase 5 之后 |
| Crafting（合成） | 装备强化 + 材料系统接口 | Phase 5 之后 |
| Leaderboard（排行） | `LeaderboardManager` 桩 + 分数提交接口 | Phase 5 之后 |
| Account（账号） | 存档加密导出 + `CloudSaveManager` 桩接口 | Phase 5 之后 |

所有桩接口位于 `src/interfaces/` 目录，以空函数或默认返回值实现，不阻塞主流程。

---

## 附录 A：目录结构

```
fish-game/
├── index.html                  # 入口 HTML
├── css/
│   └── style.css               # 全局样式
├── js/
│   ├── main.js                 # 初始化入口
│   ├── core/
│   │   ├── EventBus.js         # 全局事件系统
│   │   ├── GameLoop.js         # 主循环 (rAF)
│   │   └── StateMachine.js     # 通用状态机
│   ├── data/
│   │   ├── DataLoader.js       # CSV 加载器
│   │   ├── DataCache.js        # 运行时数据缓存
│   │   └── parsers/            # CSV 逐表解析器
│   ├── managers/
│   │   ├── FishingEngine.js    # 钓鱼引擎
│   │   ├── FishGenerator.js    # 鱼生成器
│   │   ├── EquipmentManager.js # 装备管理
│   │   ├── EconomyManager.js   # 经济管理
│   │   ├── MapManager.js       # 地图管理
│   │   ├── SaveManager.js      # 存档管理
│   │   ├── CollectionManager.js# 图鉴管理
│   │   └── AudioManager.js     # 音频管理
│   ├── ui/
│   │   ├── UIManager.js        # UI 总控
│   │   ├── CanvasRenderer.js   # 渲染管线
│   │   ├── AnimationSystem.js  # 补间动画
│   │   ├── screens/            # 各屏幕实现
│   │   └── components/         # 可复用 UI 组件
│   └── interfaces/             # 未来系统桩接口
├── table/
│   ├── FishTable.csv
│   ├── BaitTable.csv
│   ├── MapDefinition.csv
│   ├── MapFishSpawn.csv
│   └── EquipmentTables.csv
├── assets/
│   ├── sprites/                # 像素图（鱼、装备、UI）
│   ├── backgrounds/            # 地图背景图
│   └── audio/                  # 音效和 BGM
└── plan.md                     # 本文档
```

---

> **本文档为架构与实施计划，是代码编写阶段的唯一技术参考。关键算法和模块接口在实际编码中可能根据实现反馈微调，但总体架构和数据流方向保持不变。**
