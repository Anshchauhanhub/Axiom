from pydantic import BaseModel, Field
from typing import List


class VideoResource(BaseModel):
    title: str
    url: str
    satisfaction_score: float = Field(description="Score from 0.0 to 10.0 based on view ratio and transcript clarity")


class SyllabusModule(BaseModel):
    module_title: str
    core_topics: List[str]
    recommended_videos: List[VideoResource]


class ExamRoadmap(BaseModel):
    target_entity: str
    total_estimated_weeks: int
    modules: List[SyllabusModule]
