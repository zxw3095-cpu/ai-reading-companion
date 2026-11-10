import sqlite3
from pathlib import Path
from .config import settings

def connect():
    Path(settings.data_dir).mkdir(parents=True, exist_ok=True)
    db=sqlite3.connect(Path(settings.data_dir)/"reader.sqlite3")
    db.execute("CREATE TABLE IF NOT EXISTS summaries(book TEXT, chapter TEXT, ord INTEGER, body TEXT, PRIMARY KEY(book,chapter))")
    db.execute("CREATE TABLE IF NOT EXISTS audio(cache_key TEXT PRIMARY KEY, path TEXT)")
    return db
def put_summary(book, chapter, order, body):
    with connect() as db: db.execute("INSERT OR REPLACE INTO summaries VALUES(?,?,?,?)",(book,chapter,order,body))
def get_summaries(book, position):
    with connect() as db: return db.execute("SELECT body FROM summaries WHERE book=? AND ord<=? ORDER BY ord",(book,position)).fetchall()
def audio_get(key):
    with connect() as db: row=db.execute("SELECT path FROM audio WHERE cache_key=?",(key,)).fetchone(); return row[0] if row else None
def audio_put(key,path):
    with connect() as db: db.execute("INSERT OR REPLACE INTO audio VALUES(?,?)",(key,path))
