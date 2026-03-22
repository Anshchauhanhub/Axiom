"""
Service — MCQ Generation.

Generates context-aware multiple-choice questions for a given task/chapter
using the LLM, and validates the output.
"""

from app.llm.client import generate_mcq_quiz


async def create_quiz_for_task(task_title: str, task_description: str | None) -> dict:
    """
    Generate a set of 5 MCQs for a given task.

    Returns a dict with the structure:
    {
        "questions": [
            {
                "question": "...",
                "options": ["A", "B", "C", "D"],
                "correct": 0  # index of correct answer
            },
            ...
        ]
    }
    """
    context = f"Topic: {task_title}"
    if task_description:
        context += f"\nDetails: {task_description}"

    mcq_data = await generate_mcq_quiz(context)
    return mcq_data
