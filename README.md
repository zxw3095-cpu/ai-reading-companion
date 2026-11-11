# AI Reading Companion

FastAPI backend starter for an AI-assisted reading app. Includes selection Q&A, spoiler-aware recap generation, incremental character/relationship extraction, dialogue emotion labeling, on-demand cached TTS, and in-character roleplay.

## Run locally

Requires Python 3.11+.

```bash
python -m venv .venv
# Windows: .venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload
```

Set `OPENAI_API_KEY` and optional compatible `OPENAI_BASE_URL`/`OPENAI_MODEL` in `.env` for LLM calls. Without a key, deterministic local fallbacks keep the API usable for development. Set `TTS_BASE_URL` and `TTS_API_KEY` to enable a compatible TTS service. Interactive API docs: `/docs`.

## API overview

- `POST /api/ask`: answer from selected text and at most 500 characters on either side.
- `POST /api/recap`: build a 3–5 sentence recap using chapter summaries through the last-read chapter only.
- `POST /api/chapters/{chapter_id}/extract`: incrementally extract characters and evidence-backed relations.
- `POST /api/dialogue/emotion`: JSON-only dialogue emotion annotation.
- `POST /api/tts`: lazily generate audio; identical requests are cached.
- `POST /api/roleplay`: answer in a character voice within supplied knowledge boundaries.
- `PUT /api/books/{book_id}/chapters/{chapter_id}/summary`: store a chapter summary. Chapter order must be supplied as an integer; recap never reads later summaries.

All API errors use `{ "error": { "code": "...", "message": "..." } }`. LLM requests have a 30-second timeout. Data is stored under `DATA_DIR` (SQLite and generated audio); keep that directory out of version control.

## Example: selected-text Q&A

```bash
curl -X POST http://127.0.0.1:8000/api/ask \
  -H 'Content-Type: application/json' \
  -d '{"selected_text":"The old clock stopped at midnight.","chapter_context":"Mira entered the tower. The old clock stopped at midnight. A faint bell answered from below.","question":"What happened to the clock?","book_id":"demo"}'
```

The bundled local fallback returns a concise answer based on the selection. Configure an LLM key for model-generated answers.
