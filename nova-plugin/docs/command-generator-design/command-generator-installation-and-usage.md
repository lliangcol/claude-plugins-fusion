# 命令生成器安装步骤与使用说明

本文档面向 `nova-plugin-command-generator`（命令生成器应用），用于说明本地安装、运行、构建与基础使用流程。

## 1. 安装与运行

> 目录：`D:\Work\Projects\claude-plugins-fusion\nova-plugin-command-generator`

### 1.1 环境要求

- Node.js 18+（建议 20+）
- npm（随 Node 安装）

### 1.2 安装依赖

在命令行进入项目目录：

```bash
cd .\nova-plugin-command-generator
npm install
```

### 1.3 本地开发启动

```bash
npm run dev
```

终端会输出本地访问地址（例如 `http://localhost:5173`），浏览器打开即可。

### 1.4 构建与预览

```bash
npm run build
npm run preview
```

### 1.5 PWA 说明（离线）

应用包含 `sw.js` 与 `manifest.webmanifest`，首次访问后可离线使用核心功能。  
浏览器支持时可“安装到桌面/主屏幕”。

## 2. 功能使用说明（MVP）

### 2.1 场景选择

- 入口：顶部「场景」页
- 作用：按需求/排障/评审等场景推荐命令或工作流
- 操作：点击「用 /命令」或「启动工作流」

### 2.2 命令浏览

- 入口：顶部「命令」页
- 分组：Explore → Plan → Review → Implement → Finalize
- 强度：强 / 中 / 弱（约束强度提示）

### 2.3 单命令生成

入口：顶部「生成」页

1. 选择命令
2. 填写字段（必填字段带 `*`）
3. 需要上下文时上传文件
   - 插入策略：仅路径 / 片段 / 全文
   - 选择插入目标字段
4. 预览命令文本（可编辑，编辑后不回写表单）
5. 点击：
   - `生成并保存`（保存到历史）
   - `复制命令`
   - `保存/下载/分享`（导出 md/txt/json）

### 2.4 变量

用途：将前一步输出/路径复用到当前命令中。

- 在「生成」页填写变量名和值并添加
- 预览中缺失变量会显示 `<<MISSING:var>>`

### 2.5 工作流模式（分步）

入口：顶部「工作流」页 → 选择一个模板

特性：

- Stepper：可前后切换步骤、跳过步骤
- 变量绑定：当步骤产物存在时可自动填充后续字段
- 每步均可生成并保存到历史

### 2.6 历史记录

入口：顶部「历史」页

- 支持复制、复用（载入到表单）、删除

## 3. 导出与保存策略说明

- 保存到应用内：生成记录写入浏览器存储（本地）
- 导出方式（按能力显示）：
  - 桌面 Chrome/Edge：可“保存到文件”（File System Access API）
  - iOS Safari / Android Chrome：默认“下载/分享”

## 4. 已知限制（MVP）

- 未集成 IndexedDB（当前历史存储使用 localStorage）
- 未实现工作流整链路导出（仅单步导出）
- iOS Safari 无法提供目录选择写入，导出由系统接管保存位置

## 5. 入口与资料索引

- 需求文档：`nova-plugin/docs/command-generator-design/command-generator-requirements.md`
- 设计草图：`nova-plugin/docs/command-generator-design/README.md`
- 实现计划：`nova-plugin/docs/command-generator-design/command-generator-implementation-plan.md`
