<div align="center">

# AI-Kanban

> An integrated AI-driven Kanban + chat tool with task hierarchy, WIP warnings, dependencies, and intelligent insights.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)
![Create React App](https://img.shields.io/badge/CRA-5.0-09d3ac?style=flat)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3-38B2AC?style=flat&logo=tailwind-css&logoColor=white)
![Stars](https://img.shields.io/github/stars/wenqiyuan0-netizen/aikanban?style=social)

</div>

AI-Kanban is an interactive React-based Kanban board that combines traditional board management with AI conversation. It lets you operate the board using natural language and provides task levels (Epic / Story / Task), story point tracking, WIP duration warnings, dependency blocking detection, and visualizations.

## Features

- **Dual modes**: Kanban operation mode + World Info guided setup mode
- **AI agent**: Acts as a professional Kanban manager, analyzes the full board data, generates incremental patch instructions, and replies in a friendly tone
- **Task hierarchy & story points**: Epic / Story / Task with point-based workload tracking
- **Smart warnings**: WIP stay-duration threshold alerts and dependency blocking detection
- **Visualizations**: Recharts-based charts such as CFD (color-coded by column)
- **Import / export & history**: Board state management and event logging
- Powered by the **DeepSeek API** (OpenAI-compatible)

## Quick Start

**Prerequisites:** Node.js 18+

```bash
git clone https://github.com/wenqiyuan0-netizen/aikanban.git
cd aikanban
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000).

> **Important**: AI features require a DeepSeek API key. The code currently contains a hardcoded key for demo purposes only. Replace it with your own key before going public and never commit real keys to the repository.

## Installation

```bash
npm install
```

Common commands:

| Command          | Description                          |
|------------------|--------------------------------------|
| `npm start`      | Start the development server (port 3000) |
| `npm run build`  | Build the production version into `build/` |
| `npm test`       | Run tests                            |

The project uses CRACO + Tailwind CSS.

## Usage

1. After starting, enter the Kanban view and drag task cards between columns.
2. Use the chat box to ask the AI in natural language to add, update, assign, or analyze tasks.
3. In World Info mode, let the AI guide you through completing project metadata (name, goals, modules, members, etc.).
4. View the charts to understand board health and cumulative flow.
5. The AI returns incremental patches (it never overwrites the whole board) and gives suggestions in a friendly tone.

## Configuration

- **DeepSeek API Key**: Locate `HARDCODED_API_KEY` in `src/App.js` and replace it with your own key.
- The model and endpoint are already configured for the official DeepSeek OpenAI-compatible API (`deepseek-chat`).
- Task point weights, WIP thresholds, module colors, etc. can be adjusted in the source code.

## Contributing

Issues and pull requests are welcome. Please keep the code style consistent and clearly describe the purpose of your changes.

## License

This repository currently has no license file. If you want to use, fork, or redistribute the project, please confirm the terms with the author.

## Acknowledgments

- Charts: [Recharts](https://recharts.org/)
- Styling: [Tailwind CSS](https://tailwindcss.com/)
- AI API: [DeepSeek](https://www.deepseek.com/)
