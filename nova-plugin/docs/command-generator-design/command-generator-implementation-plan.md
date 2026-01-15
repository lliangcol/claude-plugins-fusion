# 命令生成器（Command Generator）软件实现计划

> **目标版本**：MVP v0.1（PWA 离线优先）  
> **适配范围**：桌面 Chrome/Edge（优先）+ iOS Safari / Android Chrome（可用，导出能力降级）  
> **最后更新**：2026-01-14

## 1. 背景与范围

本计划基于以下材料制定：

- 需求：`nova-plugin/docs/command-generator-design/command-generator-requirements.md`
- 设计草图：`nova-plugin/docs/command-generator-design/README.md`
  - IA：`nova-plugin/docs/command-generator-design/01-sitemap.md`
  - 流程：`nova-plugin/docs/command-generator-design/02-user-flows.md`
  - Wireframes：`nova-plugin/docs/command-generator-design/03-wireframes.md`
  - 数据模型：`nova-plugin/docs/command-generator-design/04-data-model.md`

实现对象：一个“命令生成软件”，用于为 `nova-plugin/commands/` 的 15 个 Claude Code 自定义命令提供 **场景导航、表单填充、命令文本拼装、工作流串联、历史/草稿、本地导出**。

### 1.1 MVP 交付边界（与需求一致）

- 不在软件内执行 Claude Code 命令；只生成可粘贴文本与可导出文件。
- “保存到本地路径选择写入”仅作为桌面端增强能力；移动端（iOS Safari/Android Chrome）默认使用“下载/分享”导出，并以“应用内保存（IndexedDB）”保证可用性。

## 2. 技术路线与项目结构（建议）

### 2.1 技术路线（MVP）

- 形态：PWA（离线优先 SPA）
- 前端：TypeScript + 现代前端框架（React 或 Vue 二选一）
- 构建：Vite
- 状态/存储：
  - 运行态：轻量状态管理（框架自带/或 Zustand/Pinia）
  - 持久化：IndexedDB（建议使用 `idb` 包封装）
- 表单与校验：
  - schema：Zod（或同级别 schema 库）
  - 表单：React Hook Form / Vue UseForm（按框架选择）
- 预览编辑：
  - MVP：`textarea`（支持复制与少量编辑）
  - 可选升级：CodeMirror（体积可控，适合移动端）
- PWA：Vite PWA 插件（或手写 service worker，优先用插件降低风险）

### 2.2 目录结构（建议）

> 仅作为规划，最终以实际实现为准。

实现目录约定：
- 仓库相对路径：`nova-plugin-command-generator/`
- 本机路径：`D:\Work\Projects\claude-plugins-fusion\nova-plugin-command-generator`

```
repo/
  nova-plugin-command-generator/      # 新增：命令生成器应用（独立目录）
    public/
    src/
    manifest/
      command-manifest.json           # 15 命令 + 工作流 + 场景
    tests/
  nova-plugin/
    docs/
      command-generator-design/
        command-generator-implementation-plan.md
        command-generator-requirements.md
      command-generator-design/
```

## 3. 里程碑与交付物

### Milestone 0：工程脚手架与基础约束（0.5 天）

交付物：

- `nova-plugin-command-generator/` 可本地启动/构建（dev/build）
- 基础规范：lint/format（若仓库已有统一规范则复用，不新增冲突规则）
- 基础页面骨架：路由、布局（移动/桌面适配）

验收点：

- 能在桌面浏览器打开首页并离线刷新（service worker 可后置到 Milestone 4，但至少确保静态资源路径与构建产物可用）

### Milestone 1：Manifest（命令/字段/模板）与拼装引擎（1–2 天）

交付物：

- `command-manifest.json` 初版：覆盖 15 个命令
  - 每个命令：stage、constraintLevel、description、fields、template、outputs、examples
  - 内置工作流模板（A/B/C/D）与场景入口映射
- 命令文本拼装引擎（纯函数）：
  - `renderTemplate(fields, variables) -> commandText`
  - 变量缺失策略：`<<MISSING:var>>`
  - 必填字段校验：缺失阻断生成

验收点：

- 对 `/senior-explore`、`/produce-plan`、`/backend-plan`、`/implement-plan` 的示例生成结果与参考手册结构一致（不要求逐字一致，但字段结构与层级一致）

### Milestone 2：单命令生成页面（表单 + 预览 + 复制 + 应用内保存）（2–3 天）

交付物：

- 路由：`/generate/:commandId`
- 表单渲染：根据 manifest 动态生成字段
- 预览区：实时生成命令文本（允许用户编辑）
- 保存到应用内（IndexedDB）：
  - 生成记录（RunSession）
  - 草稿（Draft，可选）
- 一键复制（Clipboard API，失败提示并提供手动选择复制）

验收点：

- 不同命令字段渲染正确；必填字段缺失提示清晰
- 生成记录可在历史页复用

### Milestone 3：文件上传与插入策略（1–2 天）

交付物：

- 文件上传（多文件）
- 插入策略：
  - 仅路径
  - 片段（前 N 行/字符）
  - 全文（受大小限制与确认提示）
- 插入位置：
  - MVP：默认插入到 `CONTEXT`（或 manifest 指定的 “filesTargetFieldId”）

验收点：

- 大文件不会卡死 UI（有大小限制与截断）
- iOS Safari/Android Chrome 可选择文件并插入（受系统权限限制时给出提示）

### Milestone 4：导出（桌面写入/下载/分享）+ PWA 离线（1–2 天）

交付物：

- 导出内容：
  - `命令详情.md`（包含字段快照 + 最终命令文本）
  - `命令文本.txt`
  - `字段快照.json`（可导入恢复）
- 导出方式（按能力检测显示）：
  - 桌面增强：File System Access API（`showSaveFilePicker`）
  - 通用：下载（Blob）
  - 移动优先：分享（Web Share API）
- PWA：
  - Service Worker 缓存静态资源
  - 安装提示（可选）

验收点：

- 桌面 Chrome/Edge：可“保存到文件”
- iOS Safari：至少能“下载/分享”（能力不足时不显示不可用按钮）
- 断网后仍可打开应用、浏览历史、生成命令

### Milestone 5：工作流向导（Stepper）与变量绑定（2–3 天）

交付物：

- 路由：`/workflows/:workflowId`
- Stepper：
  - 支持跳过步骤（skipped 标记）
  - 每步可生成/保存
- 变量绑定：
  - 产物变量（如 `plan_output_path`）自动填充到后续字段（按 manifest 的 autoBindings）
  - 支持用户手动注册变量（粘贴输出 -> 命名为 `{{explore_output}}` 等）
  - 缺失依赖提示清单（并能跳转到对应步骤）

验收点：

- 工作流 A（新需求）从 Step1 到 Step6 可跑通（允许跳过 Step3）
- `/implement-plan.PLAN_INPUT_PATH` 能自动引用 `/produce-plan.PLAN_OUTPUT_PATH`（或提示缺失）

### Milestone 6：测试、兼容性回归与发布（1–2 天）

交付物：

- 单元测试（优先覆盖“纯逻辑”）：
  - 模板渲染（字段/变量/缺失策略）
  - 校验逻辑（必填字段/列表字段）
  - 导出内容生成（md/txt/json）
- E2E（可选，按成本选择 Playwright）：
  - 单命令生成、保存、历史复用
- 手工测试矩阵与结论文档（建议写入 `nova-plugin/docs/command-generator-design/` 或单独文件）
- 静态部署说明（如 GitHub Pages/自托管静态站点）

验收点：

- MVP 验收标准全部满足（见需求文档第 13 节）

## 4. 关键实现拆解（工作包/WBS）

### 4.1 Manifest 制作（一次性核心成本）

- 从 `nova-plugin/commands/*.md` 与参考手册抽取：
  - 命令定位描述（display/description）
  - 字段（必填/可选/类型/默认值）
  - 示例（examples）
  - 输出产物（outputs）
  - 工作流模板（workflows）
- 明确字段类型（建议统一）：
  - `text|multiline|select|boolean|path|list|files`
- 模板拼装统一规则（见需求第 10 节），确保生成文本可直接粘贴。

### 4.2 模板渲染与字段序列化

- 约束：
  - structured 命令必须稳定输出 `KEY: value` / block / list
  - 列表字段统一 `- ` 前缀
- 策略：
  - 渲染时对空字段：
    - 必填：阻断生成
    - 非必填：可省略整个段落或保留空占位（建议可配置，MVP 默认省略空段落以减噪）

### 4.3 存储模型（IndexedDB）

建议 store：

- `runs`：RunSession（生成记录）
- `drafts`：草稿（未生成或待完善）
- `settings`：用户偏好（默认插入策略、片段长度、导出偏好等）

导入/导出：

- 导出 `json` 后可在其他设备导入恢复（解决 iOS 存储清理风险）。

### 4.4 导出能力检测与 UI 降级

- 按能力显示按钮：
  - `showSaveFilePicker` 存在：显示“保存到文件”
  - `navigator.share` 存在：显示“分享”
  - 始终提供“下载”
- iOS Safari 重点：
  - 不承诺目录选择/直接写文件
  - 提示文案：导出由系统决定保存位置

## 5. 风险清单与应对策略（实现层面）

- iOS Safari 存储清理（IndexedDB/缓存易被系统回收）
  - MVP：默认限制文件插入大小；提供“导出 JSON 备份”入口；在设置中提示
- 文件内容插入导致命令过长
  - MVP：默认“仅路径/片段”；全文插入需确认并显示字数预估
- Manifest 手工维护成本
  - MVP：先手工；后续再考虑半自动抽取脚本（不阻塞 MVP）

## 6. 计划输出物清单（用于后续评审/实现）

MVP 结束时应至少具备：

- 可运行的 PWA 应用（本地/静态部署均可）
- `command-manifest.json`（可作为二次开发的核心资产）
- 兼容性说明（桌面/移动端导出能力差异）
- 简要使用说明（如何选择命令、如何工作流串联、如何导出/分享）
