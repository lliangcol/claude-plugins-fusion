# 命令生成器（Command Generator）需求方案设计

## 1. 背景与问题

`nova-plugin` 已提供 15 个 Claude Code 自定义命令（见 `nova-plugin/commands/`），并有两份配套文档：

- `nova-plugin/docs/commands-reference-guide.md`：命令完全参考手册（参数、示例、工作流模板）
- `nova-plugin/docs/claude-code-commands-handbook.md`：命令使用手册（选型与差异对比）

现实使用中存在典型摩擦点：

- 新手难以从“场景”快速定位到正确命令/工作流。
- 同一命令在不同场景下的输入结构（参数、示例模板）需要反复复制粘贴与改写。
- 多命令串联（探索 → 规划 → 实施 → 交付）时，后续命令需要复用前一步产物（导出文件路径、分析结论、计划文档路径），容易漏填或填错。

因此需要一个“命令生成软件”，通过可视化面板与工作流向导，将“选命令 → 填参数 → 生成可直接调用的命令文本 → 保存/复用”变成低摩擦流程。

## 2. 目标与非目标

### 2.1 产品目标（Goals）

- 按“使用场景 + 工作流阶段”分组、排序命令，支持搜索与推荐。
- 选择命令后，在生成面板按字段引导输入，生成可直接粘贴到 Claude Code 的命令文本。
- 支持工作流模式：按步骤逐个生成命令；允许跳过步骤；后续步骤可复用前一步的输入/产物。
- 命令生成面板支持文件上传（用于拼装上下文）与本地保存/导出：全平台保存到应用内（历史/草稿），桌面端可选路径写入，手机端（iOS Safari/Android Chrome）以下载/分享为主。
- 支持将生成记录保存为“命令草稿/模板”，便于复用与团队共享（MVP 可先做本地保存）。

### 2.2 非目标（Non-Goals）

- 不直接在本软件内执行 Claude Code 命令，也不接管 Claude Code 会话上下文。
- 不自动解析 Claude Code 运行结果（除非用户手动粘贴/导入输出，或输出被写入已知文件路径）。
- 不替代 `nova-plugin` 的命令定义与文档；本软件以它们为“事实来源”，但需要单独的机器可读元数据来驱动表单。

## 3. 用户与使用场景

### 3.1 目标用户

- 研发工程师：日常排障、需求理解、计划制定、实现与交付。
- TL / Reviewer：做计划评审与高风险代码审计式评审。
- 新成员：快速上手、减少误用命令。

### 3.2 典型场景（来自参考手册的速查表）

- 需求分析：新功能理解（`/senior-explore`）、快速对齐（`/explore-lite`）、需求文档评审（`/explore-review`）
- 故障排查：生产问题深挖（`/senior-explore`）、快速定位（`/explore-lite`）
- 方案规划：轻量计划（`/plan-lite`）、正式设计文档（`/produce-plan`）、Java/Spring 专项（`/backend-plan`）
- 计划评审：`/plan-review`
- 代码评审：日常（`/review-lite`）、核心逻辑（`/review-only`）、高风险审计（`/review-strict`）
- 实施：按批准计划严格执行（`/implement-plan`）、标准受控（`/implement-standard`）、快速低风险（`/implement-lite`）
- 交付：完整交付（`/finalize-work`）、极简总结（`/finalize-lite`）

## 4. 产品形态与技术边界（建议）

考虑后期可部署到手机端（主要运行在 iOS Safari / Android Chrome），并满足“面板 + 文件上传 + 本地保存/导出”的诉求，推荐采用离线优先的 PWA 方案：

- 推荐形态（MVP）：本地离线 Web 应用（PWA，可安装到桌面/手机主屏幕）
  - 离线能力：Service Worker 缓存静态资源，首次加载后可离线使用
  - 文件上传：浏览器 `<input type="file">`
  - 本地保存与导出（能力分级）：
    - 全平台一致：保存到应用内（IndexedDB），用于历史/草稿复用
    - 桌面 Chrome/Edge：支持 File System Access API 时，允许用户选择文件/目录并写入
    - 移动端（尤其 iOS Safari）：不保证支持目录选择/直接写入文件；以“下载/分享”导出为主，由系统接管保存位置
- 可选形态（非 MVP）：
  - 桌面封装：Electron/Tauri（更强文件系统权限与一致体验）
  - 手机封装：Capacitor（需要 iOS/Android 更强文件系统能力或更一致的分享/导出体验时）

本需求文档默认以 “PWA（本地离线 Web 应用）” 为实现假设，并以 iOS Safari/Android Chrome 的能力边界作为核心约束。

## 5. 核心概念与术语

- Command（命令）：`/senior-explore` 等可在 Claude Code 中调用的指令。
- Scenario（场景）：以用户意图描述的问题类型（例如“生产问题深挖”）。
- Workflow（工作流）：一组有顺序关系的命令步骤模板（例如“新需求从不清晰到交付”）。
- Step（步骤）：工作流中的一个命令实例（包含输入、生成的命令文本、可选的运行输出/产物）。
- Artifact（产物）：可被后续步骤引用的输出（常见为文件路径，如 `EXPORT_PATH`、`PLAN_OUTPUT_PATH`）。
- Variable（变量）：将前序步骤产物/文本以 `{{var}}` 形式在后续输入中复用的机制。

## 6. 功能需求（MVP）

### 6.1 命令浏览与选择

- 提供两种入口：
  1) 按场景入口（推荐）：场景卡片/列表 → 推荐命令或推荐工作流
  2) 按命令入口：按阶段（Explore/Plan/Review/Implement/Finalize）分组，支持搜索
- 命令列表默认排序规则：
  - 先按阶段顺序：Explore → Plan → Review → Implement → Finalize
  - 同阶段内按“约束强度”从强到弱（参考手册中的强/中/弱标记）
- 每个命令展示：
  - 一句话定位
  - 适用/不适用
  - 关键输入字段（必填/可选）
  - 常用示例入口（复制模板）

### 6.2 命令生成面板（单命令模式）

选中命令后进入生成面板：

- 字段表单：按命令元数据渲染（见第 9 节）
  - 必填字段校验（为空禁止生成/高亮提示）
  - 字段类型：单行/多行、选择器、布尔开关、文件路径、列表项
- 文件上传（多文件）：
  - 支持将文件内容以“可折叠/可截断”的方式插入到指定字段（常见为 `CONTEXT`）
  - 每个文件提供三种插入策略：
    1) 仅插入文件路径（推荐给代码文件/大文件）
    2) 插入前 N 行/前 N 字符（默认）
    3) 完整插入（需大小限制与风险提示）
- 预览区：实时生成最终命令文本（可编辑，编辑后不反向覆盖表单，避免误丢）
- 输出“命令详情”：
  - 命令名 + 阶段 + 约束强度
  - 生成时间
  - 字段快照（便于审阅）
- 最终命令文本（可复制）
- 一键复制：复制“最终命令文本”
- 本地保存与导出（能力分级）：
  - 保存到应用内：写入 IndexedDB（历史/草稿/可复用）
  - 导出到本地文件：
    - 能力允许时启用系统文件选择器（File System Access API）
    - 否则使用“下载/分享”导出（iOS Safari 默认路径）
  - 默认文件名：`<command>-<yyyyMMdd-HHmmss>.<ext>`
  - 导出内容：`命令详情(.md)` / `命令文本(.txt)` / `字段快照(.json)`（可选）

### 6.3 工作流模式（分步生成，可跳过）

- 提供内置工作流模板（第 8 节），用户可一键进入“分步向导”
- Stepper 交互：
  - 显示步骤顺序、当前步骤、可选步骤（optional）
  - 每一步都可“生成命令”并单独复制/保存
  - 支持“跳过此步”（标记为 skipped），后续依赖字段提示缺失
- 复用前一步输出：
  - 本软件内置“产物变量”机制：前一步产物可在后续字段中引用
  - 支持用户手动粘贴 Claude Code 输出到步骤的 `stepOutput`，并将其注册为变量（例如 `{{explore_output}}`）
  - 对于“写文件”的命令（`/produce-plan`、`/backend-plan`），`PLAN_OUTPUT_PATH` 天然可作为稳定产物变量

### 6.4 命令草稿与历史（MVP 简化）

- 本地保存“生成记录”（命令名、字段值、生成文本、时间、所属工作流/步骤）
- 支持从历史记录“一键复用”并再次生成（可修改字段）
- 支持导出/导入（JSON）用于团队共享（可选）

## 7. 命令分组、排序与依赖规则

### 7.1 分组维度

- 维度 A：工作流阶段（Explore/Plan/Review/Implement/Finalize）
- 维度 B：使用场景（需求分析/故障排查/方案规划/计划评审/代码评审/实施/交付）
- UI 建议：默认以“场景”作为主导航；“命令”作为次级浏览入口。

### 7.2 依赖/复用关系（核心）

定义“可复用产物”，并在工作流模板中声明映射：

- `/senior-explore`
  - 产物：`EXPORT_PATH`（可选）→ `analysis_export_path`
- `/produce-plan`、`/backend-plan`
  - 产物：`PLAN_OUTPUT_PATH`（必填）→ `plan_output_path`
- `/implement-plan`
  - 输入依赖：`PLAN_INPUT_PATH` 默认可取 `plan_output_path`
- `/plan-review`
  - 输入建议：可引用 `plan_output_path` 或用户粘贴的计划摘要

缺失依赖时行为：

- 字段仍允许手工输入（不强绑）
- UI 给出清晰提示：缺失的变量、推荐补全方式（回到上一步填写导出路径 / 粘贴输出 / 选择文件）

## 8. 内置工作流模板（来自命令参考手册）

> 注：这些模板用于“步骤向导”的默认配置，可在后续版本支持自定义与保存。

### 工作流 A：新需求开发（需求不清晰）

1) `/senior-explore`（澄清事实、未知与风险，可选导出 `EXPORT_PATH`）
2) `/plan-lite`（轻量计划对齐，可粘贴上一步输出摘要）
3) `/produce-plan`（需要正式文档时，写入 `PLAN_OUTPUT_PATH`）
4) `/plan-review`（对计划做决策质量评审）
5) `/implement-plan`（已批准则严格执行）或 `/implement-standard`
6) `/finalize-work`

推荐变量映射：

- `analysis_export_path` → `/produce-plan.ANALYSIS_INPUTS`（作为文件路径列表）
- `plan_output_path` → `/implement-plan.PLAN_INPUT_PATH`

### 工作流 B：生产问题修复

1) `/senior-explore`（DEPTH=deep，必要时导出 `EXPORT_PATH`）
2) `/plan-lite`（可选：回滚与风险记录）
3) `/implement-standard` 或 `/implement-lite`（按风险选择）
4) `/review-strict`（可选：风险较高时）
5) `/finalize-work`

### 工作流 C：PR 代码评审（按风险选择）

- 小改动 → `/review-lite`
- 核心逻辑 → `/review-only`
- 高风险/审计 → `/review-strict`

### 工作流 D：Java 后端端到端

1) `/senior-explore`
2) `/backend-plan`（写入 `PLAN_OUTPUT_PATH`）
3) `/plan-review`
4) `/implement-plan`
5) `/review-strict`（可选）
6) `/finalize-work`

## 9. 命令元数据模型（驱动表单与生成）

由于 `nova-plugin/commands/*.md` 主要是“给模型的指令”，并非稳定可解析的结构化定义，建议在软件侧维护一份机器可读的 `manifest`（JSON/YAML 均可）。

### 9.1 核心数据结构（建议）

#### CommandDefinition

- `id`: string（如 `senior-explore`）
- `displayName`: string
- `stage`: `explore|plan|review|implement|finalize`
- `constraintLevel`: `strong|medium|weak`
- `description`: string（一句话定位）
- `inputMode`: `structured|freeform`
- `fields`: `FieldDefinition[]`
- `template`: string（最终命令文本模板，支持 `{{fieldId}}` 与 `{{var}}`）
- `outputs`: `OutputDefinition[]`（声明可复用产物）
- `examples`: `Example[]`（用于一键填充/参考）

#### FieldDefinition（输入字段）

- `id`: string（如 `PLAN_OUTPUT_PATH`）
- `label`: string
- `required`: boolean
- `type`: `text|multiline|select|boolean|path|list|files`
- `help`: string（提示与注意事项）
- `default`: string | boolean
- `options`: string[]（select）
- `bindable`: boolean（是否允许绑定变量）

#### WorkflowDefinition（工作流）

- `id`, `title`, `description`
- `steps`: `WorkflowStep[]`

`WorkflowStep` 包含：

- `stepId`
- `commandId`
- `optional`: boolean
- `autoBindings`: 预设变量映射规则（例如把 `plan_output_path` 自动填入 `PLAN_INPUT_PATH`）

#### ScenarioDefinition（场景）

- `id`, `category`, `title`
- `recommendedCommandId`（单命令）或 `recommendedWorkflowId`（工作流）

### 9.2 元数据来源与维护策略

- “事实来源”仍然是：
  - 命令文本：`nova-plugin/commands/*.md`
  - 人类参考：`nova-plugin/docs/commands-reference-guide.md`
- 软件使用 `manifest` 作为唯一的机器可读驱动：
  - MVP：手工维护（15 个命令可控）
  - 后续：写脚本从参考手册/命令模板中提取基础信息，人工校对后更新 `manifest`

## 10. 命令文本生成规则（拼装规范）

### 10.1 统一格式

- 所有生成结果必须是“可直接粘贴到 Claude Code 输入框”的纯文本。
- structured 命令采用 `KEY: value`（或多行块）形式，例如：

```text
/produce-plan
PLAN_OUTPUT_PATH: docs/plans/xxx.md
PLAN_INTENT: ...
ANALYSIS_INPUTS:
- docs/analysis/a.md
CONSTRAINTS:
- No DB schema change
```

### 10.2 多行字段与列表字段

- 多行字段用“块”表示（与参考手册保持一致），例如：

```text
CONTEXT:
- File: docs/req.md
  ---
  (content...)
  ---
```

- 列表字段统一用 `- ` 前缀，避免模型误解析。

### 10.3 变量引用

- 允许在任意字段中引用 `{{var}}`（由工作流上下文或用户自定义输出注册）
- 生成时若变量缺失：
  - 在预览中以显眼占位符显示（例如 `<<MISSING:var>>`）
  - 生成按钮可选择“阻断”或“允许生成但提示”

## 11. 本地存储与导出

- 本地存储（IndexedDB）：
  - `manifest` 版本号
  - 生成历史（RunSession）
  - 用户自定义模板/工作流（后续版本）
- 导出方式（能力分级）：
  - File System Access API：写入用户选择的文件（主要用于桌面 Chrome/Edge）
  - 下载：生成 Blob 并下载（移动端/不支持 API 时）
  - 分享：支持时调用 Web Share API（移动端优先，可选）
- 导出格式：
  - `*.md`：保存“命令详情 + 命令文本”
  - `*.txt`：仅保存“命令文本”
  - `*.json`：保存“字段快照 + 元信息”（用于再编辑/共享）

## 12. 非功能需求

- 离线优先：不依赖网络；使用 Service Worker 缓存静态资源；支持以 PWA 方式安装（桌面/手机）。
- 兼容性：以 iOS Safari / Android Chrome 为主要目标；“路径选择写入”以能力检测为准，移动端默认下载/分享导出。
- 隐私与安全：
  - 明确提示用户“上传/插入的文件内容会进入命令文本”，避免误泄露敏感信息
  - 提供“一键脱敏/删除文件内容，仅保留路径”的快捷操作（可选）
- 性能：
  - 文件内容插入有大小限制（例如单文件默认上限 200KB，可配置）
  - 预览拼装应在 100ms 级别完成（MVP 不做极限优化）
- 可用性：
  - 支持键盘操作、快捷键复制
  - 表单字段有清晰示例与错误提示

## 13. MVP 验收标准（建议）

- 能按场景与阶段浏览并选择 15 个命令，生成文本可在 Claude Code 直接调用。
- `/senior-explore`、`/produce-plan`、`/backend-plan`、`/implement-plan` 的必填字段有校验，生成格式符合参考手册示例。
- 工作流模式至少内置 4 套模板（第 8 节），支持逐步生成、跳过步骤、复用导出路径变量。
- 支持文件上传并插入到 `CONTEXT`（或指定字段），且支持“仅插入路径”。
- 支持保存到应用内并从历史记录复用生成；导出时支持“能力允许的路径写入”与“下载/分享（移动端默认）”。

## 14. 风险与开放问题

- Claude Code 侧对“文件上传”的能力边界：本软件可插入文件内容/路径，但无法保证 Claude Code 会读取某路径；需要在命令模板中明确要求模型读取哪些文件。
- iOS Safari 的文件系统能力限制：无法提供“目录选择 + 直接写入文件”的稳定体验；需要以“应用内保存 + 下载/分享导出”为默认路径；如未来必须强支持该能力，需考虑 Capacitor 等原生封装。
- PWA 离线缓存与存储配额差异：不同浏览器对 Service Worker/IndexedDB 配额与清理策略不同（iOS Safari 更严格），需有文件插入大小限制与“导出备份”提示。
- “后一个命令使用前一个命令输出”的自动化程度：
  - MVP 建议以“路径变量 + 用户粘贴输出”为主
  - 若未来需要自动抓取 Claude Code 输出，需要考虑与 Claude Code 的集成点（插件 API/日志接口等），目前不在范围内。
