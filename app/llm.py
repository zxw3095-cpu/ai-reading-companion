import httpx, json
from .config import settings

async def complete(system: str, user: str, json_mode: bool=False) -> str:
    if not settings.openai_api_key: raise RuntimeError("LLM is not configured")
    headers={"Authorization":f"Bearer {settings.openai_api_key}"}
    payload={"model":settings.openai_model,"messages":[{"role":"system","content":system},{"role":"user","content":user}],"temperature":0.2}
    if json_mode: payload["response_format"]={"type":"json_object"}
    async with httpx.AsyncClient(timeout=settings.openai_timeout_seconds) as client:
        r=await client.post(settings.openai_base_url.rstrip("/")+"/chat/completions",headers=headers,json=payload); r.raise_for_status(); return r.json()["choices"][0]["message"]["content"]

def parse_json(text):
    return json.loads(text)
