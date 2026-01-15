English | [中文](../../README.md)

<div align="center">

# LLM Plugins Fusion

**A third-party LLM plugin marketplace + plugin collection**

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com)

</div>

---

## 📖 Overview

**LLM Plugins Fusion** is a third-party marketplace and curated plugin collection for LLM coding assistants (e.g., Claude Code). With this repo you can:

- 🎯 **One-command install**: quickly integrate plugins into Claude Code
- 🔧 **Workflow-first**: command presets covering a full engineering workflow
- 📚 **Solid docs**: practical handbooks and examples
- 🔄 **Easy to extend**: add new plugins and capabilities over time

---

## 🚀 Quick start

### Step 1: Add the marketplace

Run in Claude Code:

```bash
/plugin marketplace add lliangcol/llm-plugins-fusion
```

### Step 2: Install the plugin

```bash
/plugin install nova-plugin@llm-plugins-fusion
```

### Step 3: Start using it

```bash
# Show installed plugins
/plugin

# Use a command
/senior-explore analyze the current project
```

---

## 📁 Repository structure

```
llm-plugins-fusion/
├── 📄 .claude-plugin/
│   └── marketplace.json              # marketplace entry
├── 📦 nova-plugin/                    # plugin
│   ├── 📄 .claude-plugin/
│   │   └── plugin.json               # plugin metadata
│   ├── 📂 commands/                   # 15 command presets
│   │   ├── senior-explore.md
│   │   ├── explore-lite.md
│   │   ├── explore-review.md
│   │   ├── plan-lite.md
│   │   ├── produce-plan.md
│   │   ├── backend-plan.md
│   │   ├── plan-review.md
│   │   ├── review-lite.md
│   │   ├── review-only.md
│   │   ├── review-strict.md
│   │   ├── implement-plan.md
│   │   ├── implement-standard.md
│   │   ├── implement-lite.md
│   │   ├── finalize-work.md
│   │   └── finalize-lite.md
│   ├── 📂 docs/                       # docs
│   │   ├── commands-reference-guide.md
│   │   ├── claude-code-commands-handbook.md
│   │   ├── agents-summary.md
│   │   └── agents-summary.en.md
│   ├── 📂 hooks/                      # hooks config
│   ├── 📂 agents/                     # sub-agent definitions
│   ├── 📂 config/                     # config files
│   ├── 📂 output-styles/              # output styles
│   ├── 📂 scripts/                    # scripts
│   └── 📂 skills/                     # skills
└── 📄 README.md                       # Chinese README
```

---

## 🔌 Plugin: `nova-plugin`

<table>
<tr>
<td width="120"><strong>Version</strong></td>
<td>1.0.0</td>
</tr>
<tr>
<td><strong>Author</strong></td>
<td>liu liang</td>
</tr>
<tr>
<td><strong>Commands</strong></td>
<td>15</td>
</tr>
<tr>
<td><strong>Positioning</strong></td>
<td>Developer productivity workflow plugin</td>
</tr>
</table>

### 🎯 Core capabilities

A developer-productivity plugin for LLM coding assistants (Claude Code compatible), covering an end-to-end engineering workflow.

### Workflow stages

| Stage | Explore 🔍 | Plan 📝 | Review 🔎 | Implement ⚙️ | Finalize 📦 |
|------|--------|--------|--------|--------|--------|
| Goal | Understand the problem | Draft the plan | Review quality | Write code | Deliver outcomes |
| Commands | 3 commands | 4 commands | 3 commands | 3 commands | 2 commands |

---

## 🧠 Agents

The repo includes 69 sub-agent definitions across engineering, data, architecture, security, and ops domains under `nova-plugin/agents/`. Each agent includes role positioning, tools, and usage scenarios.

- Chinese summary: `nova-plugin/docs/agents-summary.md`
- English summary: `nova-plugin/docs/agents-summary.en.md`

---

## 📚 Documentation

| 📄 Document | 📝 Description | 🎯 Use cases |
|--------|--------|-----------|
| [📘 Command Reference Guide](nova-plugin/docs/commands-reference-guide.md) | Full parameters, 5+ scenarios, workflow templates | **Daily lookup, copy templates** |
| [📗 Command Handbook](nova-plugin/docs/claude-code-commands-handbook.md) | Grouped by type, command comparison | **Quick start, pick a command** |
| [🧠 Agents Summary](nova-plugin/docs/agents-summary.en.md) | Agent roles, tools, and scenarios | **Understand and pick agents** |

For the Chinese version, see `README.md` and `nova-plugin/docs/agents-summary.md`.
