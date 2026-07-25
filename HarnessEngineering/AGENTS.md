# 🧠 AI 智能体操作指南（AI Agents' Action Guide）

> **版本**: v1.0  
> **最后更新**: 2026-07-24  
> **适用对象**: 所有为本项目贡献代码的 AI 智能体  

---

## 1. 📐 代码规范（JavaScript Coding Standards）

### 1.1 语言版本与语法

- **ES6+**：使用 `const` / `let`（禁止 `var`），箭头函数，模板字符串，解构赋值，`class` 语法，`import` / `export` 模块化。
- **严格模式**：所有 `.js` 文件头部加 `'use strict';`。

### 1.2 命名约定

| 类型 | 格式 | 示例 |
|------|------|------|
| 变量 / 函数 | `camelCase` | `fishWeight`, `calculateScore()` |
| 类 / 构造函数 | `PascalCase` | `class FishingRod {}` |
| 常量（全局） | `UPPER_SNAKE_CASE` | `const MAX_ROD_LEVEL = 5;` |
| 私有成员 | 以 `_` 开头 | `this._powerLevel` |
| 文件 / 目录 | `PascalCase` 或 `kebab-case` | `FishTable.js`, `bait-manager.js` |

### 1.3 命名原则

- **命名即文档**：变量名必须表达含义，禁止单字母命名（循环变量 `i`, `j`, `k` 除外）。
- **布尔值**：用 `is` / `has` / `can` / `should` 前缀，如 `isRare`, `hasMutation`。
- **事件处理**：用 `on` / `handle` 前缀，如 `onCastEnd`, `handleCatchResult`。

### 1.4 函数规范

- **单一职责**：一个函数只做一件事。
- **最大长度 50 行**：超过 50 行必须拆分子函数。计算行数时不含空行与注释。
- **纯函数优先**：不修改外部状态的无副作用纯函数优先实现；副作用集中在明确标注的模块边界。
- **参数数量 ≤ 3**：超过 3 个参数使用对象解构，如 `function spawnFish({ mapId, playerLevel, baitId })`。

### 1.5 JSDoc（公开 API 必加）

```javascript
/**
 * 根据物种参数生成一条鱼的体型数据
 * @param {Object} species - 鱼种数据对象
 * @param {number} species.MinLength_cm - 最小体长
 * @param {number} species.MaxLength_cm - 最大体长
 * @param {number} species.a - 条件因子
 * @param {number} species.b - 异速生长指数
 * @returns {{ length: number, weight: number }} 生成的体长(cm)与体重(kg)
 */
export function generateFishSize(species) { ... }
```

内部函数（模块内未导出）可不加 JSDoc，但必须有含义清楚的名字。

---

## 2. 📁 目录结构（Directory Structure）

```
fish/
├── index.html                  # 入口页面
├── src/                        # 源代码
│   ├── main.js                 # 游戏初始化入口
│   ├── core/                   # 核心引擎
│   │   ├── GameLoop.js         # 主循环 (requestAnimationFrame)
│   │   ├── InputManager.js     # 键盘/触控输入管理
│   │   ├── AudioManager.js     # 音效 & BGM 管理
│   │   └── StateMachine.js     # 游戏状态机
│   ├── fishing/                # 钓鱼系统
│   │   ├── CastingSystem.js    # 抛竿蓄力条
│   │   ├── WaitSystem.js       # 等待咬钩
│   │   ├── CatchSystem.js      # 音游式收竿判定
│   │   └── FishGenerator.js    # 鱼的体型/属性生成
│   ├── entities/               # 游戏实体
│   │   ├── Fish.js             # 鱼实体（含属性、外观生成）
│   │   ├── Player.js           # 玩家（等级、经验、金币）
│   │   ├── Rod.js              # 鱼竿
│   │   ├── Reel.js             # 卷线器
│   │   ├── Line.js             # 鱼线
│   │   └── Hook.js             # 鱼钩
│   ├── systems/                # 子系统（可插拔）
│   │   ├── EconomySystem.js    # 经济系统
│   │   ├── ExpSystem.js        # 经验/升级系统
│   │   ├── ShopSystem.js       # 商店系统
│   │   ├── InventorySystem.js  # 背包系统
│   │   ├── PokedexSystem.js    # 图鉴收集系统
│   │   ├── AquariumSystem.js   # 鱼缸展示系统
│   │   ├── CookingSystem.js    # 【预留】烹饪系统接口
│   │   └── CraftingSystem.js   # 【预留】制作系统接口
│   ├── data/                   # 数据读取层
│   │   ├── CsvLoader.js        # CSV 加载器（UTF-8 BOM 兼容）
│   │   ├── FishTable.js        # 鱼种数据表
│   │   ├── BaitTable.js        # 饵料数据表
│   │   ├── MapTable.js         # 地图数据表
│   │   └── SpawnTable.js       # 生成数据表
│   ├── ui/                     # 用户界面
│   │   ├── CanvasRenderer.js   # Canvas 渲染引擎
│   │   ├── HUD.js              # 游戏内 HUD
│   │   ├── MenuSystem.js       # 菜单系统
│   │   ├── ResultScreen.js     # 结算画面
│   │   └── ShopUI.js           # 商店界面
│   ├── network/                # 【预留】网络 / 账号系统
│   │   └── AccountService.js   # 账号服务接口（骨架）
│   └── utils/                  # 工具函数
│       ├── Random.js           # 概率分布工具（截断正态、Gamma）
│       ├── MathUtils.js        # 通用数学函数
│       └── CSVUtils.js         # CSV 解析工具
├── assets/                     # 资源文件
│   ├── images/                 # 像素图 / 精灵图
│   ├── audio/                  # 音效 / BGM
│   └── fonts/                  # 像素风字体（如有）
├── tests/                      # 测试文件
│   ├── core/
│   ├── fishing/
│   ├── entities/
│   └── data/
├── table/                      # 表数据文件
│   ├── FishTable.csv           # 【只读】308 种鱼数据
│   ├── BaitTable.csv           # 【只读】35 种饵料数据
│   ├── MapDefinition.csv       # 【只读】15 张地图数据
│   └── MapFishSpawn.csv        # 【只读】809 条鱼生成配置
├── README.md                    # 数据系统设计文档
├── HarnessEngineering/         # 工程文档目录
│   ├── AGENTS.md               # ← 本文档
│   ├── PROJECT.md              # 项目概览
│   ├── spec.md                 # 产品规格说明书
│   ├── plan.md                 # 实施计划
│   ├── task.md                 # 当前任务列表
│   └── test_checklist.md       # 测试清单
└── .eslintrc.json              # ESLint 配置（standard 规则集）
```

### 目录约定

- `src/` 下的子目录名使用**小写 + 复数语义**：`entities/`, `systems/`, `utils/`。
- 文件名使用 `PascalCase.js`（类文件）或 `kebab-case.js`（纯工具函数库）。
- 测试文件放在 `tests/` 下，路径结构镜像 `src/`，文件名以 `.test.js` 结尾。
- 预留模块（烹饪、制作、网络）只保留接口骨架文件，标注 `【预留】`，拒绝提前实现具体逻辑。

---

## 3. 📊 数据文件使用规则（CSV Data Rules）

### 3.1 只读契约

| 文件 | 行数 | 性质 |
|------|------|------|
| `table/FishTable.csv` | 308 条鱼 | ★ 只读（游戏数据源） |
| `table/BaitTable.csv` | 35 种饵料 | ★ 只读（游戏数据源） |
| `table/MapDefinition.csv` | 15 张地图 | ★ 只读（游戏数据源） |
| `table/MapFishSpawn.csv` | 809 条生成记录 | ★ 只读（游戏数据源） |

**严禁**：任何 AI 智能体不得修改、覆盖、删除以上 CSV 文件的内容。这些文件是最终的游戏数据源，由策划人工维护。

### 3.2 编码格式

- **UTF-8 with BOM**：CSV 文件首字节为 `0xEF 0xBB 0xBF`（BOM 字节序标记）。
- **行尾格式**：`CRLF`（`\r\n`），Windows 原生格式。
- 数据加载器 `CsvLoader.js` 必须自动检测并剥离 BOM 头，对外透明。

### 3.3 读取规则

```javascript
// ✅ 正确做法：通过 CsvLoader 统一加载
import { CsvLoader } from './data/CsvLoader.js';

// ⛔ 禁止：直接 import CSV 文件或手动解析
// import fishData from './FishTable.csv';  // 不要这么做
```

`CsvLoader.js` 内部实现要点：

1. 使用 `fetch()` + `encoding` 处理，或用 `FileReader` 读取后检测 `\ufeff` 前缀。
2. 将 CSV 行解析为对象数组，字段名映射为 `camelCase`（例如 `MinLength_cm` → `minLengthCm`）。
3. 数字字段自动转换为 `Number` 类型，不要留字符串。
4. 加载完成后将数据缓存为模块级常量，避免重复解析。

### 3.4 运行时修改

游戏运行时**不允许**改写 CSV 文件。玩家的进度数据（背包、等级、金币、图鉴完成度）使用 `localStorage` 或 `IndexedDB` 存储，格式为 JSON。

```javascript
// 存档路径示例（localStorage key）
const SAVE_KEY = 'fish_game_save_v1';
```

---

## 4. ✅ 质量闸门（Quality Gates）

### 4.1 代码检查（Lint）

- **规则集**：ESLint `standard` 配置（`eslint-config-standard`）。
- **配置位置**：项目根目录 `./.eslintrc.json`。
- **检查命令**：`npx eslint src/`。
- **CI 闸门**：提交前确保 lint 通过，0 errors, 0 warnings。

### 4.2 生产环境禁止项

| 禁止项目 | 原因 | 替代方案 |
|----------|------|----------|
| `console.log()` | 生产环境泄露调试信息 | 使用 `window.__DEBUG__` 标志 + `Logger` 工具类 |
| `debugger` 语句 | 阻塞执行 | 同上 |
| 硬编码魔法数值 | 可维护性差 | 提取为带名字的 `const` 常量 |
| 未捕获的 Promise 拒绝 | 静默吞错 | 全局 `window.onunhandledrejection` |

### 4.3 函数长度上限

- **50 行**：任何函数不得超过 50 行（不含空行和注释）。
- 超限 → 拆分为多个小函数，每个小函数只做一件事。
- `constructor` 和生命周期钩子（如 `update()`, `render()`）同样适用。

### 4.4 模块依赖方向

```
src/utils/  ←  src/data/  ←  src/entities/  ←  src/systems/  ←  src/ui/
                          ↘  src/fishing/  ←---↙
```

低层模块不得依赖高层模块。`utils/` 和 `data/` 是纯独立层。

---

## 5. 🧪 测试要求（Testing Standards）

### 5.1 测试框架

- **框架**：Jest（推荐）或 Mocha + Chai。
- **运行命令**：`npm test` / `npx jest`。

### 5.2 测试文件命名

```
src/data/CsvLoader.js      →  tests/data/CsvLoader.test.js
src/fishing/FishGenerator.js → tests/fishing/FishGenerator.test.js
src/entities/Fish.js         → tests/entities/Fish.test.js
```

- 测试文件统一放在 `tests/` 目录下。
- 文件名必须与源文件一致，仅后缀改为 `.test.js`。
- 路径结构精确镜像 `src/` 的目录层次。

### 5.3 覆盖率要求

| 模块 | 行覆盖率 | 分支覆盖率 | 说明 |
|------|----------|------------|------|
| `data/`（CsvLoader, 数据表） | ≥ 95% | ≥ 85% | 数据正确性至关重要 |
| `fishing/`（核心钓鱼流程） | ≥ 90% | ≥ 80% | 游戏核心玩法 |
| `entities/`（装备/鱼/玩家） | ≥ 85% | ≥ 75% | 属性计算较多 |
| `systems/`（经济/经验/商店） | ≥ 80% | ≥ 70% | |

### 5.4 测试内容

- **数据表测试**：所有 CSV 加载后断言行数、关键字段格式正确（如稀有度在 1-10 之间）。
- **算法测试**：随机函数提供 seed 种子，使测试可复现；边界情况（最小长度、最大长度、突变触发边界）。
- **状态机测试**：验证所有合法状态转换和非法状态拒绝。
- **UI 组件**：渲染结果快照测试（snapshot testing）。

---

## 6. 📚 文档关联（Documentation Chain）

### 6.1 阅读顺序

```
spec.md（做什么）
   ↓
plan.md（怎么做）
   ↓
task.md（当前做什么）
```

- **`spec.md`**（HarnessEngineering/）：产品规格说明书，定义功能需求、交互流程、UI 布局。任何 AI 智能体接到任务后，先读 `spec.md` 确认全局需求。
- **`plan.md`**（项目根目录）：数据系统设计文档，包含 308 种鱼的数据模型、长度-体重幂律关系、突变模型等算法细节。实现数据相关功能时必读。
- **`task.md`**（HarnessEngineering/）：当前任务清单和进度。只实现 `task.md` 中标记为 `[待办]`或 `[进行中]` 的条目。

### 6.2 文档更新

- 实现完成后，删除该 `task.md` 条目或在条目后加 `✅`。
- 发现 `spec.md` 与 `plan.md` 矛盾时，以 `spec.md` 为准并提出 issue。
- 禁止修改 `plan.md`（数据设计文档锁定）。

---

## 7. 🔧 Git 提交规范（Commit Convention）

### 7.1 提交格式

```
[模块] 操作: 简短描述
```

### 7.2 模块标签

| 标签 | 适用场景 |
|------|----------|
| `[鱼种]` | 鱼数据、鱼生成算法、图鉴 |
| `[钓具]` | 鱼竿/鱼线/鱼钩等装备系统 |
| `[饵料]` | 饵料数据与吸引逻辑 |
| `[地图]` | 地图、水域、鱼群生成 |
| `[核心]` | 主循环、状态机、Input/Canvas 基础设施 |
| `[UI]` | 界面、HUD、菜单、结算画面 |
| `[音效]` | 音频、BGM |
| `[经济]` | 金币、经验、等级、商店 |
| `[账号]` | 网络/存档/排行榜（预留接口） |
| `[测试]` | 测试用例 |
| `[文档]` | README、注释、工程文档 |
| `[重构]` | 不涉及功能变更的代码整理 |

### 7.3 操作标签

| 操作 | 含义 |
|------|------|
| `新增:` | 新功能、新文件 |
| `修复:` | Bug 修复 |
| `修改:` | 功能调整、配置变更 |
| `删除:` | 删除废弃代码 |
| `重构:` | 不改变行为的代码重组 |

### 7.4 示例

```
[鱼种] 新增: 添加力量属性计算
[核心] 修复: 状态机在切换地图时重复触发 onEnter
[钓具] 修改: 鱼竿长度属性影响抛竿蓄力条区间大小
[UI] 新增: 结算画面展示鱼像素形象及三项属性
[测试] 新增: FishGenerator 幂律算法边界测试
[文档] 修改: 更新 AGENTS.md 目录树
```

### 7.5 提交原子性

- **一个提交只做一件事**：禁止混合无关变更。
- 提交前运行 `npx eslint src/` 确保 lint 通过。

---

## 8. 🚨 AI 行为约束（AI Behavioral Constraints）

### 8.1 核实再声称（Verify Before Claiming）

- **"看到文件" ≠ "读过内容"**：声称某个文件存在时，必须用 `read_file` 工具实际读取过其内容，不能仅凭 `file_search` 或 `list_dir` 的结果推断。
- **"会工作" ≠ "已工作"**：实现某个功能后，必须运行 `run_tests`、`exec_shell` 等工具实际验证，不能凭感觉声称功能正常。
- **"能支持" ≠ "已实现"**：提到浏览器 API、ES 特性、第三方库等依赖时，确认项目环境中确实可用，不与既有限制冲突。

### 8.2 禁止幻觉 API

- 不要引用、调用、依赖未在本项目文档或 `package.json` 中列出的库/API。
- 需要引入外部库 → 先在 `task.md` 中标注，在 `spec.md` 中查找依据，确认必要性后再添加。
- Canvas API 使用 `CanvasRenderingContext2D` 标准 API，不猜想非标准扩展。

### 8.3 读写前确认

- **读文件前**：先用 `file_search` 或 `list_dir` 确认路径存在，再用 `read_file`。
- **写文件前**：确认不会覆盖重要数据（尤其是 `FishTable.csv` 等只读文件）。
- **执行命令前**：了解命令的预期输出和副作用。

### 8.4 预留接口契约

| 预留模块 | 接口骨架文件 | 契约 |
|----------|-------------|------|
| 烹饪系统 | `src/systems/CookingSystem.js` | 导出 `class CookingSystem`，方法签名空实现 |
| 制作系统 | `src/systems/CraftingSystem.js` | 同上 |
| 账号服务 | `src/network/AccountService.js` | 导出 `class AccountService`，包含 `login()`, `logout()`, `syncSave()` |
| 排行榜 | 嵌入 `AccountService.js` | 包含 `submitScore()`, `getLeaderboard()` |

- 上表接口**只提供方法签名 + 单行 JSDoc 说明**，方法体只写 `// TODO: 等待 v2 实现`。
- 游戏主体代码**不直接调用**预留接口；外部通过事件总线 (`EventBus`) 或钩子系统 (`Hooks`) 间接触发，如 `EventBus.emit('fish:caught', fishData)`。

### 8.5 无提示协作

- AI 智能体不问用户"你想怎么做"——根据本文档和 `task.md` 自行决策。
- 遇到模糊歧义时，在 `spec.md` 中搜索答案；查不到则选择**最保守的路径**（最小破坏、最小依赖）。
- 发现真正的设计缺陷时，在 `task.md` 对应条目后加 `⚠️ 疑问: ...` 并继续实现其余部分。

---

> **最后提醒**: 本文档是 AI 智能体的操作指南。每次接到任务后，先把本文档快速过一遍，确认约束条件再动手。代码是写给**人**读的，也是写给**未来的 AI** 维护的——始终保持整洁、一致、可推测。
