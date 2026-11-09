<div align="center">

# AI-Kanban

> 一体化 AI 驱动的看板 + 聊天工具，支持任务分级、WIP 预警、依赖关系与智能洞察。

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Create React App](https://img.shields.io/badge/CRA-5.0-09d3ac?style=flat)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Stars](https://img.shields.io/github/stars/wenqiyuan0-netizen/aikanban?style=social)

</div>

AI-Kanban 是一个基于 React 的互动式看板应用。它把传统看板与 AI 对话结合，允许用自然语言操作看板，并提供任务分级（Epic / Story / Task）、故事点统计、WIP 时长预警、依赖阻塞检测和可视化图表。

## Features

- **双模式**：看板操作模式 + World Info 引导设置模式
- **AI 代理**：以“专业看板经理”身份分析完整看板数据，生成增量补丁指令并用亲切中文回复
- **任务分级与故事点**：Epic / Story / Task，按点数统计工作量
- **智能预警**：WIP 停留时长超阈值提醒、依赖阻塞检测
- **可视化**：基于 Recharts 的 CFD 等图表（按列颜色）
- **导入导出与历史**：支持看板状态管理与事件记录
- 使用 **DeepSeek API**（OpenAI 兼容接口）

## Quick Start

**前提条件：** Node.js 18+

```bash
git clone https://github.com/wenqiyuan0-netizen/aikanban.git
cd aikanban
npm install
npm start
```

打开 [http://localhost:3000](http://localhost:3000)。

> **重要**：AI 功能需要 DeepSeek API Key。当前代码中有硬编码的 Key（仅供演示），上线前请替换为自己的 Key，并避免将真实 Key 提交到仓库。

## Installation

```bash
npm install
```

常用命令：

| 命令             | 说明                     |
|------------------|--------------------------|
| `npm start`      | 启动开发服务器（默认端口 3000） |
| `npm run build`  | 构建生产版本到 `build/`   |
| `npm test`       | 运行测试                 |

项目使用 CRACO + Tailwind CSS。

## Usage

1. 启动后进入看板界面，可拖拽任务卡片在列之间移动。
2. 使用聊天框用自然语言让 AI 添加、更新、分配或分析任务。
3. 在 World Info 模式下引导补全项目元数据（项目名、目标、模块、成员等）。
4. 查看图表了解看板健康状态与累积流量。
5. AI 会返回增量补丁（不会覆盖整个看板），并用亲切口吻给出建议。

## Configuration

- **DeepSeek API Key**：在 `src/App.js` 中查找 `HARDCODED_API_KEY` 并替换为你自己的 Key。
- 模型与端点已配置为 DeepSeek 官方兼容接口（`deepseek-chat`）。
- 任务点数权重、WIP 阈值、模块颜色等可在代码中调整。

## Contributing

欢迎提交 Issue 和 Pull Request。请保持代码风格一致，并在提交前说明改动目的。

## License

本仓库目前没有许可证文件。如需使用、分叉或再分发，请与作者确认使用条款。

## Acknowledgments

- 图表：[Recharts](https://recharts.org/)
- 样式：[Tailwind CSS](https://tailwindcss.com/)
- AI 接口：[DeepSeek](https://www.deepseek.com/)
