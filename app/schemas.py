from pydantic import BaseModel, Field
from typing import Literal
Emotion = Literal["愤怒","悲伤","温柔","冷漠","惊讶","撒娇","恐惧","平静"]
class AskRequest(BaseModel): selected_text: str = Field(min_length=1); chapter_context: str = ""; question: str = Field(min_length=1); book_id: str
class Answer(BaseModel): answer: str
class RecapRequest(BaseModel): book_id: str; last_read_position: int = Field(ge=0); recent_notes: list[str] = []
class Recap(BaseModel): recap: str
class SummaryRequest(BaseModel): chapter_order: int = Field(ge=0); summary: str = Field(min_length=1)
class ExistingCharacter(BaseModel): name: str; aliases: list[str] = []; traits: list[str] = []
class ExtractRequest(BaseModel): chapter_text: str = Field(min_length=1); existing_characters: list[ExistingCharacter] = []
class Character(BaseModel): name: str; aliases: list[str] = []; traits: list[str] = []
class Relation(BaseModel): from_: str = Field(alias="from"); to: str; type: str; evidence: str
class Extraction(BaseModel): characters: list[Character] = []; relations: list[Relation] = []
class EmotionRequest(BaseModel): dialogue: str; surrounding_text: str = ""
class EmotionResult(BaseModel): speaker: str; text: str; emotion_label: Emotion; emotion_intensity: int = Field(ge=1,le=5); voice_hint: str
class TTSRequest(BaseModel): text: str = Field(min_length=1); voice_id: str; emotion_label: Emotion; intensity: int = Field(ge=1,le=5)
class AudioResult(BaseModel): audio_url: str
class CharacterCard(BaseModel): name: str; persona: str; speaking_style: str; knowledge_boundary: str
class RoleplayRequest(BaseModel): character_card: CharacterCard; history: list[dict[str,str]] = []; user_message: str
class Reply(BaseModel): reply: str
