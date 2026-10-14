# 互联网使用资格考试中心 · IUQA

> **Internet Usage Qualification Authority**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](tsconfig.json)
[![React](https://img.shields.io/badge/React-19.3-61dafb.svg)](package.json)
[![Tests](https://img.shields.io/badge/tests-184%20unit%20%2B%2025%20e2e-brightgreen.svg)](docs/功能清单与验证结果.md)

## 🌐 在线演示

**https://internet-usage-qualification-center.pages.dev**

部署于 Cloudflare Pages。首次访问点击「建立本地档案并进入考试工作台」即可开始，
全部数据保存在你自己的浏览器中，不上传任何服务器。

> 该在线站点与本地构建产物完全一致；完整端到端测试套件（25 例）已针对该地址实际运行并通过。

一套**纯前端**的虚构互联网使用资格认证与在线考试系统。以驾照考试制度为灵感，
建立针对互联网使用能力、信息辨别能力、网络安全意识、逻辑思维与公共讨论素养的资格分级制度。

---

## ⚠️ 重要声明（请先阅读）

**本项目是虚构的娱乐性质考试系统。**

- 本项目中的**全部等级、证件、权限与模拟功能均为应用内设定**，不具有现实法律效力，
  也不构成任何行政许可、职业资格或专业资质。
- 本项目**不是**真实政府机构、**不是**真实考试系统，页面上出现的「机构」「证件」「印章」
  均为虚构设定，**不得用于求职、资质申报、行政审批或任何需要真实资质的场合**。
- 本项目的全部「互联网权限」都是**应用内的模拟授权**，只影响本站点的模拟页面、徽章、菜单与交互。
  IUQA **无法、也不会**控制使用者设备的真实网络连接、系统代理设置或对任何真实网站的访问。
- 本项目**不提供**任何 VPN 客户端、服务器地址、配置参数、订阅链接或连接能力，
  也不提供任何绕过访问限制的方法。
- 本项目**不收集、不上传任何个人数据**，全部档案与考试记录仅保存在使用者本机浏览器中。

**核心理念：互联网不是没有交通规则的高速公路。**

---

## 目录

- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [可用命令](#可用命令)
- [项目结构](#项目结构)
- [核心架构](#核心架构)
- [配置文件一览](#配置文件一览)
- [已实现功能](#已实现功能)
- [测试](#测试)
- [文档](#文档)
- [已知限制](#已知限制)

---

## 技术栈

| 领域 | 选型 | 版本 |
|---|---|---|
| 框架 | React | 19.3 |
| 语言 | TypeScript（严格模式） | 5.9 |
| 构建 | Vite | 8.3 |
| 路由 | React Router | 7.18 |
| 样式 | Tailwind CSS（CSS-first `@theme`） | 4.3 |
| 组件 | shadcn/ui 风格自建组件 + Radix UI 原语 | — |
| 图标 | Lucide React | 1.56 |
| 本地数据库 | Dexie.js（IndexedDB） | 4.4 |
| 校验 | Zod | 4.6 |
| 单元 / 组件测试 | Vitest + React Testing Library | 5.0 / 16.3 |
| 端到端测试 | Playwright | 1.64 |
| 图片导出 | html-to-image | 1.11 |

**没有后端、没有云数据库、没有账号中心、没有付费服务。** 不配置任何后端即可完整运行。

---

## 快速开始

环境要求：**Node.js ≥ 20.19**、**pnpm ≥ 9**（也可使用 npm / yarn）。

```bash
# 1. 安装依赖
pnpm install

# 2. 启动开发服务器（默认 http://localhost:5173）
pnpm dev

# 3. 首次打开页面时点击「建立本地档案并进入考试工作台」
```

首次访问会引导建立本地档案；档案、题库、考试规则会写入浏览器 IndexedDB。

> 若需要运行端到端测试，还需安装浏览器内核：`pnpm e2e:install`

---

## 可用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动开发服务器 |
| `pnpm typecheck` | 运行 TypeScript 严格类型检查（`tsc --noEmit`） |
| `pnpm test` | 运行全部单元与集成测试（Vitest） |
| `pnpm test:watch` | 以监听模式运行测试 |
| `pnpm test:coverage` | 生成覆盖率报告（`coverage/`） |
| `pnpm build` | 类型检查 + 生产构建（输出到 `dist/`） |
| `pnpm build:only` | 仅执行生产构建，跳过类型检查 |
| `pnpm preview` | 本地预览生产构建产物（`http://127.0.0.1:4173`） |
| `pnpm test:e2e` | 运行 Playwright 端到端测试（桌面端 + 移动端） |
| `pnpm e2e:install` | 安装 Playwright 浏览器内核 |
| `pnpm test:all` | 类型检查 + 单元测试 + 生产构建 |

### 开发环境启动说明

```bash
pnpm install
pnpm dev
```

- 开发服务器默认监听 `http://localhost:5173`。
- 修改源码后由 Vite HMR 自动热更新。
- 数据保存在浏览器 IndexedDB 中，**切换浏览器或使用无痕模式会得到一份全新的空数据**。

### 生产构建说明

```bash
pnpm build          # 类型检查 + 构建，产物在 dist/
pnpm preview        # 预览构建产物
```

- `dist/` 为纯静态文件，可直接部署到任意静态托管（Nginx、GitHub Pages、对象存储等）。
- 构建产物为单页应用，**部署时需将未匹配的路径回退到 `index.html`**（history 路由）。
- 无需任何环境变量或服务端配置。

### 部署到 Cloudflare Pages

项目已包含 Cloudflare Pages 所需的两个配置文件（位于 `public/`，构建时复制到 `dist/`）：

| 文件 | 作用 |
|---|---|
| `_redirects` | `/* /index.html 200`，把深层地址（`/exams`、`/certificate/xxx`）回退到 SPA 外壳 |
| `_headers` | 安全响应头（`nosniff` / `DENY` / `Referrer-Policy` / `Permissions-Policy`）与静态资源长缓存 |

```bash
# 1. 构建
pnpm build

# 2. 设置凭据（不要在仓库内保存 Token）
export CLOUDFLARE_ACCOUNT_ID=<你的 Account ID>
export CLOUDFLARE_API_TOKEN=<你的 API Token>

# 3. 部署（wrangler 通过 npx 临时获取，不是项目依赖）
pnpm deploy:cf
```

也可使用 `npx wrangler pages deploy dist --project-name=<项目名> --branch=main`。

> **首次部署**需先在 Cloudflare 控制台创建 Pages 项目，或调用
> `POST /accounts/{account_id}/pages/projects`（`{"name":"…","production_branch":"main"}`）创建。

### 针对任意地址运行端到端测试

```bash
# 测试本地预览服务（默认行为）
pnpm test:e2e

# 测试已部署的站点
PLAYWRIGHT_BASE_URL=https://internet-usage-qualification-center.pages.dev pnpm test:e2e
```

设置 `PLAYWRIGHT_BASE_URL` 后会跳过本地预览服务的启动，直接对目标地址执行全部用例。

---

## 项目结构

```
src/
├── app/                     应用装配层
│   ├── app-meta.ts          机构名称、版本号、免责声明
│   ├── config-context.tsx   配置上下文（内置配置 + 实时读取数据库配置）
│   ├── error-boundary.tsx   全局错误边界
│   ├── navigation.ts        导航配置（顶部 / 侧边 / 移动端共用）
│   ├── providers.tsx        启动门（数据库初始化 → 配置校验 → 播种 → 渲染）
│   ├── router.tsx           路由表
│   └── theme-context.tsx    明暗主题
├── components/
│   ├── admin/               题库管理、规则管理、数据管理面板
│   ├── certificate/         证件正文、校验图形
│   ├── common/              状态页、页头、指示器、二次确认
│   ├── exam/                题目卡片、倒计时、题号导航、交卷对话框、答卷复核
│   ├── forms/               档案表单
│   ├── home/                等级体系说明、公告栏
│   ├── layout/              顶部导航、侧边导航、状态面板、页脚、移动端导航
│   └── ui/                  Button / Card / Badge / Dialog / Tabs / Toast 等基础组件
├── data/                    ★ 全部外部配置（JSON）
│   ├── levels.json          等级体系
│   ├── exam-rules.json      考试规则与评分策略
│   ├── permissions.json     模拟互联网权限清单
│   ├── certificate-template.json  证件模板与文案
│   ├── announcements.json   公告
│   ├── study-materials.json 学习材料
│   └── question-banks/      ★ 题库
│       ├── demo-basic.json        56 题
│       ├── demo-intermediate.json 64 题
│       └── demo-advanced.json     74 题
├── features/                领域逻辑（与 UI 解耦）
│   ├── certificates/        证件签发、编号、校验图形
│   ├── config/              配置载入与导入导出
│   ├── exams/               抽题引擎、报名判定、考试过程、考试目录
│   ├── grading/             ★ 统一评分引擎
│   ├── levels/              等级查询
│   ├── permissions/         ★ 权限计算引擎
│   ├── profile/             档案服务与汇总
│   └── simulator/           模拟专区示例素材
├── hooks/                   useUserData / useAsyncAction
├── pages/                   11 个业务页面 + 模拟专区页面
├── schemas/                 Zod 校验 Schema 与错误路径格式化
├── services/                数据库、文件导入导出、图片导出
├── types/                   TypeScript 类型定义
└── utils/                   格式化、随机数、ID、类名合并
tests/
├── unit/                    单元测试
├── integration/             集成测试与组件测试
└── e2e/                     Playwright 端到端测试
docs/                        题库编写指南、导入导出说明、已知限制
```

---

## 核心架构

### 1. 数据流

```
题库 JSON ──校验──► IndexedDB(questionBanks)
                        │
考试规则 JSON ─校验──► IndexedDB(examRules)
                        │
                        ▼
              ┌──────────────────┐
              │  抽题引擎         │  按配额/难度/标签抽题，
              │  paper-builder   │  生成「试卷快照」（含正确选项、分值、规则版本）
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  答题过程         │  答案 / 剩余时间 / 当前题号
              │  attempt-service │  定期写入 IndexedDB，可刷新恢复
              └────────┬─────────┘
                       ▼  交卷（主动 / 超时 / 恢复）统一走 finalizeAttempt
              ┌──────────────────┐
              │  评分引擎         │  纯函数，内部使用「百分之一分」整数运算
              │  grading/engine  │  产出 ExamResult 并写回考试记录
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  证件签发         │  幂等 + 串行化，同一场考试只签发一张证件
              │  certificates    │  低等级证件转为「已被替代」并保留
              └────────┬─────────┘
                       ▼
              ┌──────────────────┐
              │  权限计算         │  hasPermission(context, id, config)
              │  permissions     │  等级继承 + 专项认证 + 显式授权清单
              └──────────────────┘
```

### 2. 关键设计决策

| 决策 | 原因 |
|---|---|
| **试卷快照**（`ExamPaper`）随考试记录一同持久化 | 导入新题库不会影响历史答卷复核；快照含正确选项、选项顺序、分值与规则版本 |
| **评分引擎为纯函数** | 主动交卷、超时交卷、恢复结算共用同一条可靠路径；重复判分结果完全一致 |
| **分数内部用「百分之一分」整数** | 从根本上避免浮点误差导致及格线边界判定不一致 |
| **选项随机化后按显示顺序重新编号** | 避免出现「第 4 个选项标着 A」的错乱观感；题库原始 ID 保留在 `sourceId` |
| **证件签发串行化** | 幂等检查与写入之间存在时间窗口，串行队列避免同一场考试签发多张证件 |
| **权限统一由 `features/permissions` 计算** | 页面路由、按钮显示与模拟功能共用同一判定，不用页面隐藏代替权限判断 |
| **等级与权限均为派生数据** | 由证件与考试记录实时计算，不写入档案，避免派生数据与事实漂移 |
| **考试记录永不删除** | 升级、重置等级或导入新题库都不会影响历史记录 |

### 3. 等级体系

| 等级 | 名称 | 授予考试 | 题量 | 时限 | 及格线 |
|---|---|---|---|---|---|
| L0 | 临时浏览状态（非资格等级，不签发证件） | — | — | — | — |
| L1 | 互联网浏览资格 | 互联网浏览资格基础考试 | 10 | 10 分钟 | 60 |
| L2 | 互动交流资格 | 互动交流资格进阶考试 | 15 | 15 分钟 | 70 |
| L3 | 内容发布资格 | 内容发布资格进阶考试 | 20 | 20 分钟 | 75 |
| L4 | 高级信息检索资格 | 高级信息检索资格考试 | 25 | 30 分钟 | 80 |
| L5 | 跨域信息访问资格 | 跨域信息访问资格特别考试 | 30 | 35 分钟 | 85 |
| L6 | 互联网高级资格 | 互联网高级资格考试 | 40 | 45 分钟 | 90 |

另有 2 场专项能力认证考试（信息辨别、网络安全），通过后不提升等级，只在证件上标注专项认证。

全部名称与参数均由 `src/data/levels.json` 与 `src/data/exam-rules.json` 配置，**没有任何硬编码**。

---

## 配置文件一览

| 文件 | 作用 | 是否可在应用内导入 |
|---|---|---|
| `src/data/levels.json` | 等级名称、英文名、序号、徽章色、证件题词 | 否（随构建分发） |
| `src/data/exam-rules.json` | 评分策略 + 每场考试的全部制度参数 | ✅ 题库管理页 |
| `src/data/permissions.json` | 模拟互联网权限清单 | 否（随构建分发） |
| `src/data/certificate-template.json` | 证件文案、条款、编号规则、签发机构 | 否（随构建分发） |
| `src/data/announcements.json` | 公告栏内容 | 否（随构建分发） |
| `src/data/study-materials.json` | 学习材料与自查问题 | 否（随构建分发） |
| `src/data/question-banks/*.json` | 题库（题目、选项、答案、解析、分值） | ✅ 题库管理页 |

> 题库通过 `import.meta.glob('../../data/question-banks/*.json')` 自动发现：
> **新增一个题库文件即可自动注册，无需修改任何代码。**

---

## 已实现功能

### 完整考试闭环

- ✅ 首次访问引导 → 建立本地档案（昵称 + 可选头像，不收集敏感信息）
- ✅ 首页考试工作台：当前等级、证件状态、升级条件、可参加考试、公告、制度说明
- ✅ 考试报名页：类别 / 等级 / 状态筛选，报名条件逐条说明，不符合时给出**具体原因**
- ✅ 考前须知：时限、题量、分值规则、及格线、题型说明、倒扣分、交卷规则、自动保存、不可逆提示
- ✅ 在线答题：六种题型、倒计时、进度、标记疑问、题号导航、暂存、键盘快捷键
- ✅ 定期自动保存 + 刷新 / 关闭浏览器后恢复
- ✅ 倒计时归零自动交卷；主动交卷 / 超时 / 恢复共用统一结算流程
- ✅ 交卷确认对话框（含未作答数量）
- ✅ 成绩页：总分、满分、正确 / 错误 / 未作答、通过状态、逐题作答、正确答案、解析、错误原因、知识点
- ✅ 统一评分引擎（单选 / 多选严格匹配 / 多选部分得分 / 判断 / 情景分析 / 阅读理解 / 观点辨析）
- ✅ 百分制归一化 + 可配置舍入方式，及格线边界判定与展示口径一致
- ✅ 等级晋升、专项能力认证、升级失败保留原等级
- ✅ 电子证件：网页展示、打印 / 另存为 PDF、下载 PNG、复制编号、复制展示页链接、证件历史
- ✅ 权限中心：结构化权限清单（解锁状态、解锁条件、说明、对应等级、升级建议）
- ✅ 考试历史：等级 / 通过状态 / 时间筛选，查看历史答卷与历史证件
- ✅ 题库管理：导入、导出、校验（含字段路径）、预览、统计、启用切换、恢复内置、清除数据
- ✅ 模拟专区：模拟浏览、高级检索、来源对比、证据链编排、模拟讨论区、跨域信息专区、VPN 知识专区

### 状态与异常处理

- ✅ 首次访问、未初始化档案、IndexedDB 不可用、刷新、关闭后恢复、考试超时
- ✅ 重复交卷幂等、重复生成证件幂等、JSON 格式错误、题库版本不兼容
- ✅ 导入失败不破坏现有题库、题目数量不足、考试规则损坏、证件记录不存在
- ✅ 路由参数非法、浏览器不支持导出能力
- ✅ 全部异常给出中文可读说明与修复建议，**不展示原始堆栈**

### 无障碍与响应式

- ✅ 键盘操作（含答题页快捷键）、合理焦点顺序、清晰的 `:focus-visible`
- ✅ 状态不只用颜色表达（徽章带文字、图标 + 文字双通道）
- ✅ 表单错误通过 `aria-describedby` 关联，`role="alert"` 即时播报
- ✅ 桌面三栏 / 移动单列布局，移动端底部固定导航，选项触控区 ≥ 44px
- ✅ 尊重 `prefers-reduced-motion`
- ✅ 全部页面在 1440px 与 412px 下无横向溢出（E2E 断言）

---

## 测试

```bash
pnpm typecheck    # TypeScript 严格检查
pnpm test         # 182 个单元 / 集成 / 组件测试
pnpm test:e2e     # 25 个端到端测试（桌面端 + 移动端）
```

| 测试套件 | 文件 | 用例数 | 覆盖内容 |
|---|---|---|---|
| 评分引擎 | `tests/unit/grading/engine.test.ts` | 38 | 单选 / 多选严格 / 多选部分 / 判断 / 情景分析 / 倒扣分 / 百分制 / 及格线边界 / 整数精度 |
| 题库校验 | `tests/unit/schemas/question-bank.test.ts` | 19 | 结构、枚举、ID 重复、非法选项引用、分值、材料缺失、容量检查 |
| 试卷生成 | `tests/unit/exams/paper-builder.test.ts` | 18 | 配额 / 固定 / 随机抽题、种子复现、选项重编号、评分配置解析 |
| 权限引擎 | `tests/unit/permissions/engine.test.ts` | 15 | 等级继承、显式清单、专项认证、证件作废、升级失败保留权限 |
| 证件服务 | `tests/unit/certificates/service.test.ts` | 22 | 编号格式、校验码、校验图形确定性、记录校验、当前证件选择 |
| 数据迁移 | `tests/unit/services/database.test.ts` | 6 | v1→v2 迁移、字段补齐、新表可用、复合索引 |
| 导出异常 | `tests/unit/services/image-export.test.ts` | 13 | 下载 / 打印 / 剪贴板能力缺失降级、PNG 导出异常恢复 |
| 题库文件 | `tests/unit/data/question-bank-files.test.ts` | 10 | 三个内置题库校验 + 每场考试容量匹配 |
| 考试闭环 | `tests/integration/exam-flow.test.ts` | 16 | 建档→开考→答题→交卷→判分→证件、超时、幂等、恢复、升级 |
| 题库导入保护 | `tests/integration/bank-import.test.ts` | 11 | 非法 JSON / 校验失败不破坏现有题库、导出往返、启用回退 |
| 答题界面 | `tests/integration/exam-ui.test.tsx` | 16 | 题型渲染、ARIA 角色、标记语义、题号面板、交卷对话框 |

端到端测试（`tests/e2e/`）：

| 文件 | 用例 | 覆盖内容 |
|---|---|---|
| `full-flow.spec.ts` | 1 | 首次访问 → 建档 → 模拟考试 → 正式考试 → 判分 → 证件 → 权限 → 升级考试 → 历史（桌面 + 移动） |
| `exam-resilience.spec.ts` | 10 | 刷新恢复、超时自动交卷、重复交卷幂等、未通过路径、非法参数、404、题库管理 |
| `certificate-export.spec.ts` | 5 | 真实 PNG 下载、打印调用、剪贴板复制、不可核验声明、证件历史 |
| `responsive.spec.ts` | 4 | 无横向溢出、移动端导航、倒计时与交卷可见、触控区尺寸、证件版式 |

---

## 文档

| 文档 | 内容 |
|---|---|
| [题库编写指南](docs/题库编写指南.md) | 题库 JSON 结构、六种题型写法、校验规则、常见错误、分片装配脚本 |
| [数据导入导出说明](docs/数据导入导出说明.md) | 题库 / 规则导入导出流程、校验错误路径、数据备份与恢复 |
| [已知限制](docs/已知限制.md) | 纯前端边界、无法做到的事情、浏览器兼容性、数据丢失风险 |
| [功能清单与验证结果](docs/功能清单与验证结果.md) | 实际实现的功能、测试实测结果、启动命令、未完成事项 |

---

## 已知限制（摘要）

1. **纯前端无安全边界**：熟悉浏览器开发者工具的使用者可以绕过界面直接修改 IndexedDB 数据或前端代码，
   本系统不对此作出任何安全承诺，本机记录也不具备可被第三方信任的性质。
2. **无在线核验能力**：证件上的校验图形是**装饰性图案，不可扫描**，本平台未部署任何验证服务。
3. **数据仅存本机**：清除浏览器数据、更换浏览器、使用无痕模式都会导致数据不可恢复，请及时导出备份。
4. **不提供任何真实网络能力**：不提供 VPN 客户端 / 配置 / 连接，不代理或镜像任何真实网站内容。
5. **模拟专区内容为虚构素材**：专区内的机构名称、账号名称与事件均为本平台编写，不对应任何真实主体。
6. **无后端、无账号体系**：不支持多设备同步、不支持多人协作、不支持教师端批阅。

完整说明见 [已知限制](docs/已知限制.md)。

---

## 许可与用途

本项目采用 [MIT License](LICENSE) 开源。

```
MIT License

Copyright (c) 2026 zexuan.peng
```

你可以自由使用、修改、分发本项目（包括商业用途），只需保留版权声明与许可声明。

> **许可范围说明**：MIT 协议覆盖的是**源代码**。
> 项目中虚构的机构名称、等级体系、证件文案与题目内容属于创作性内容，
> 转载或再分发时请一并保留 README 与证件页面中的**虚构性质声明**，
> 不得将本项目包装为真实政府机构、真实考试系统或真实资格认证。

本项目为演示与教学用途的纯前端应用，供学习 React / TypeScript / IndexedDB 应用架构参考。
再次强调：**全部等级、证件与网络权限均为虚构设定，不具有现实法律效力。**
