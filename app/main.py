from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import hashlib, json, re
from .config import settings
from .schemas import *
from . import store
from .llm import complete, parse_json

app=FastAPI(title=settings.app_name)
Path(settings.data_dir,"audio").mkdir(parents=True,exist_ok=True)
app.mount("/media",StaticFiles(directory=Path(settings.data_dir,"audio")),name="media")
@app.exception_handler(Exception)
async def errors(request: Request, exc: Exception):
    from fastapi import HTTPException
    if isinstance(exc, HTTPException): return JSONResponse(status_code=exc.status_code,content={"error":{"code":"http_error","message":str(exc.detail)}})
    if isinstance(exc, (TimeoutError,)) or exc.__class__.__name__ in ("TimeoutException",): return JSONResponse(status_code=504,content={"error":{"code":"upstream_timeout","message":"上游服务请求超时（30 秒）。"}})
    return JSONResponse(status_code=502,content={"error":{"code":"upstream_error","message":str(exc) or "上游服务请求失败。"}})

@app.get("/health")
async def health(): return {"status":"ok"}

@app.post("/api/ask",response_model=Answer)
async def ask(x: AskRequest):
    selected=x.selected_text
    # Context input is bounded around the first selected-text occurrence; only that local excerpt reaches the model.
    i=x.chapter_context.find(selected)
    context=(x.chapter_context[max(0,i-500):i+len(selected)+500] if i>=0 else selected[:500]+" "+x.chapter_context[:500])
    try: answer=await complete("只根据提供的选中文本与局部上下文回答。材料没有说明时明确说不知道；禁止编造、推测剧情或使用外部知识。",f"选中文本：{selected}\n局部上下文：{context}\n问题：{x.question}")
    except RuntimeError: answer=f"给定文本中提到：{selected}。目前未配置语言模型，无法进一步可靠回答。"
    return {"answer":answer}

@app.put("/api/books/{book_id}/chapters/{chapter_id}/summary")
async def save_summary(book_id:str, chapter_id:str, x:SummaryRequest):
    store.put_summary(book_id,chapter_id,x.chapter_order,x.summary); return {"status":"saved"}

@app.post("/api/recap",response_model=Recap)
async def recap(x:RecapRequest):
    rows=store.get_summaries(x.book_id,x.last_read_position)
    if not rows: return {"recap":"目前没有读到上次阅读位置的章节摘要，暂时无法生成前情提要。"}
    summaries="\n".join(r[0] for r in rows)
    try: text=await complete("根据给定的已读章节摘要写中文前情提要，严格3到5句话。包含读到的位置、关键人物和未解伏笔。绝不提及材料之外或后续章节剧情。",f"上次读到章节序号：{x.last_read_position}\n已读摘要：{summaries}\n读者笔记：{json.dumps(x.recent_notes,ensure_ascii=False)}")
    except RuntimeError: text=f"上次读到第 {x.last_read_position} 章。此前章节摘要共 {len(rows)} 条。摘要内容：{summaries[:600]}。请继续从这里阅读。"
    return {"recap":text}

@app.post("/api/chapters/{chapter_id}/extract",response_model=Extraction)
async def extract(chapter_id:str,x:ExtractRequest):
    old=[c.model_dump() for c in x.existing_characters]
    try:
        raw=await complete("从本章增量抽取人物与关系，优先把别名并入已有角色，不重算全书。关系必须给出逐字原文证据句。只输出JSON对象 characters和relations。",f"已有角色：{json.dumps(old,ensure_ascii=False)}\n本章：{x.chapter_text}",True)
        return Extraction.model_validate(parse_json(raw))
    except RuntimeError:
        names=[]
        for name in re.findall(r"[\u4e00-\u9fff]{2,3}",x.chapter_text):
            if name not in names and name not in ("一个人","说道","然后","忽然","只是","因为"): names.append(name)
        return Extraction(characters=[Character(name=n) for n in names[:12] if not any(n==c.name or n in c.aliases for c in x.existing_characters)],relations=[])

@app.post("/api/dialogue/emotion",response_model=EmotionResult)
async def emotion(x:EmotionRequest):
    try:
        raw=await complete("识别对话说话人和情绪。优先依据描写中的语气词。emotion_label仅可为：愤怒、悲伤、温柔、冷漠、惊讶、撒娇、恐惧、平静。intensity为1至5。只输出JSON。",f"前后描写：{x.surrounding_text}\n对话：{x.dialogue}",True)
        return EmotionResult.model_validate(parse_json(raw))
    except RuntimeError:
        label=next((v for k,v in [("冷冷地","冷漠"),("哽咽","悲伤"),("嗤笑","冷漠"),("怒","愤怒"),("笑","温柔")] if k in x.surrounding_text),"平静")
        m=re.match(r"\s*([^：:]{1,20})[：:]\s*(.*)",x.dialogue,re.S)
        return EmotionResult(speaker=m.group(1) if m else "未知",text=m.group(2) if m else x.dialogue,emotion_label=label,emotion_intensity=3,voice_hint=label)

@app.post("/api/tts",response_model=AudioResult)
async def tts(x:TTSRequest):
    key=hashlib.sha256(f"{x.text}\0{x.voice_id}\0{x.emotion_label}\0{x.intensity}".encode()).hexdigest()
    cached=store.audio_get(key)
    if cached and Path(cached).exists(): return {"audio_url":f"/media/{Path(cached).name}"}
    if not settings.tts_base_url: from fastapi import HTTPException; raise HTTPException(503,"TTS未配置，请设置TTS_BASE_URL")
    import httpx
    headers={"Authorization":f"Bearer {settings.tts_api_key}"} if settings.tts_api_key else {}
    async with httpx.AsyncClient(timeout=30) as client:
        r=await client.post(settings.tts_base_url,json={"text":x.text,"voice_id":x.voice_id,"emotion":x.emotion_label,"intensity":x.intensity},headers=headers)
        r.raise_for_status()
    path=Path(settings.data_dir,"audio",key+".mp3"); path.write_bytes(r.content); store.audio_put(key,str(path))
    return {"audio_url":f"/media/{path.name}"}

@app.post("/api/roleplay",response_model=Reply)
async def roleplay(x:RoleplayRequest):
    card=x.character_card
    system=f"你扮演{card.name}。人格：{card.persona}\n表达风格：{card.speaking_style}\n知识边界：{card.knowledge_boundary}\n严格只依据角色卡、用户提供的已读信息和对话历史回答。对边界之外、尤其未读章节内容，用角色口吻说‘这我还不知道’。绝不剧透。"
    history="\n".join(f"{m.get('role','user')}: {m.get('content','')}" for m in x.history[-20:])
    try: reply=await complete(system,f"历史对话：\n{history}\n用户：{x.user_message}")
    except RuntimeError: reply=f"{card.name}：这我还不知道。"
    return {"reply":reply}
