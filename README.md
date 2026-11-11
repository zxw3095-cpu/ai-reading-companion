# AI Reading Companion

一个面向小说阅读的 AI 伴读项目，包含 FastAPI 后端 API 和可在浏览器中打开的阅读器 UI 原型。项目支持选中文本问答、阅读前情提要、章节人物关系抽取、对话情绪标注、按需语音生成和角色扮演。

> 当前仓库包含的是**后端 API 与前端原型**。前端页面的导入、目录、阅读设置等功能可直接体验；伴读聊天界面目前需要兼容本项目流式接口的本地代理（`http://localhost:8787/api/companion/stream`）。该代理尚未包含在本仓库中。FastAPI API 在 `http://127.0.0.1:8000`，目前也尚未与原型页面连通。

## 功能

- `POST /api/ask`：根据选中内容和附近上下文回答；传给模型的章节上下文最多取选中文本前后各 500 个字符。
- `POST /api/recap`：使用已读位置之前保存的章节摘要生成 3–5 句前情提要，不读取后续章节摘要。
- `PUT /api/books/{book_id}/chapters/{chapter_id}/summary`：保存章节摘要，供前情提要使用。
- `POST /api/chapters/{chapter_id}/extract`：根据单章文本增量抽取人物与关系，关系附原文证据。
- `POST /api/dialogue/emotion`：为对话标注说话人和固定枚举中的情绪。
- `POST /api/tts`：按需生成音频；相同文本、声音和情绪参数会复用缓存。
- `POST /api/roleplay`：在角色卡和已读信息的知识边界内进行角色扮演。
- `/docs`：交互式 API 文档；`/health`：健康检查。

## 环境要求

- Python 3.11 或更高版本
- 可选：OpenAI 兼容的聊天补全 API
- 可选：实现项目 TTS 请求格式的语音服务

## Windows 安装与启动

在仓库根目录打开 PowerShell：

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -e .
Copy-Item .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

若 PowerShell 阻止虚拟环境激活脚本，可以跳过激活，直接运行：

```powershell
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

启动后访问：

- API 文档：<http://127.0.0.1:8000/docs>
- 健康检查：<http://127.0.0.1:8000/health>

## macOS / Linux 安装与启动

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e .
cp .env.example .env
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

## 配置语言模型

API 服务启动时会从仓库根目录的 `.env` 读取设置。编辑 `.env`：

```dotenv
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=替换为你自己的密钥
OPENAI_MODEL=gpt-4o-mini
OPENAI_TIMEOUT_SECONDS=30
DATA_DIR=.data
```

也可以使用本机 Ollama 的 OpenAI 兼容接口。先确保 Ollama 正在运行，并已下载所选模型，再配置：

```dotenv
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
OPENAI_MODEL=qwen2.5:7b
```

`OPENAI_API_KEY` 留空时，部分 API 会使用简单的开发回退逻辑；回退逻辑不等同于真实模型回答。请勿提交真实密钥：`.env` 和运行数据目录 `.data/` 已加入 `.gitignore`。

## 配置 TTS

默认不调用语音服务。配置 `.env` 中的 `TTS_BASE_URL` 后，`POST /api/tts` 会向该地址发送 JSON：`{ "text", "voice_id", "emotion", "intensity" }`，并将服务返回的音频字节缓存为 MP3。可按服务要求设置 `TTS_API_KEY`。生成后的文件通过 `/media/...` 提供。

## API 快速示例

PowerShell：

```powershell
$body = @{
  selected_text = "The old clock stopped at midnight."
  chapter_context = "Mira entered the tower. The old clock stopped at midnight. A faint bell answered from below."
  question = "What happened to the clock?"
  book_id = "demo"
} | ConvertTo-Json

Invoke-RestMethod -Uri http://127.0.0.1:8000/api/ask -Method Post -ContentType "application/json" -Body $body
```

curl：

```bash
curl -X POST http://127.0.0.1:8000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"selected_text":"The old clock stopped at midnight.","chapter_context":"Mira entered the tower. The old clock stopped at midnight. A faint bell answered from below.","question":"What happened to the clock?","book_id":"demo"}'
```

成功时返回：

```json
{"answer":"The clock stopped at midnight."}
```

摘要接口只会使用已经保存、且 `chapter_order` 不大于 `last_read_position` 的摘要。先保存章节摘要：

```bash
curl -X PUT http://127.0.0.1:8000/api/books/demo/chapters/chapter-1/summary \
  -H 'Content-Type: application/json' \
  -d '{"chapter_order":1,"summary":"Mira returns to the island and finds a warning in the lighthouse."}'
```

然后请求前情提要：

```bash
curl -X POST http://127.0.0.1:8000/api/recap \
  -H 'Content-Type: application/json' \
  -d '{"book_id":"demo","last_read_position":1,"recent_notes":[]}'
```

## 前端阅读器原型

打开 [novel-companion-redesign/index.html](novel-companion-redesign/index.html) 即可体验阅读器原型。页面支持导入整本 TXT 或多个分章 TXT、目录检索、阅读设置、书签和阅读笔记。TXT 在浏览器中本地读取。

前端伴读聊天目前请求 `http://localhost:8787/api/companion/stream`，需要另行运行兼容的本地流式代理；此代理代码未包含在当前仓库中。该前端原型目前也没有调用上面 `:8000` 的 FastAPI API。

更多原型说明见 [novel-companion-redesign/README.md](novel-companion-redesign/README.md)。

## 数据与隐私

- API 数据库和生成的音频默认保存在 `.data/`。
- 导入阅读器的 TXT 仅由浏览器读取；使用伴读聊天或 API 时，发送到模型的文本取决于对应功能和你配置的服务。
- 请只导入和处理你有权使用的小说文本，不要把私人书稿、模型密钥或个人数据提交到公开仓库。

## 开发说明

```bash
pip install -e .
uvicorn app.main:app --reload
```

API 错误统一返回 `{ "error": { "code": "...", "message": "..." } }`。上游模型请求默认超时为 30 秒。
