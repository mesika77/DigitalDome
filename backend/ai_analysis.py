import os
import base64
import json
import mimetypes
from dotenv import load_dotenv

load_dotenv()

SYSTEM_PROMPT = """You are a content moderation AI specialized in detecting hate speech, \
antisemitism, and extremist content in images and memes.
Analyze the provided image for:
1. Known hate symbols, extremist imagery, or antisemitic content
2. Coded language or symbols used by radical communities
3. Meme templates associated with hate groups
4. Any non-verbal indicators of harmful intent

Respond in JSON format:
{
  "contains_hate_content": boolean,
  "confidence": 0-100,
  "analysis": "brief explanation of findings",
  "detected_elements": ["list", "of", "specific", "elements", "found"],
  "recommendation": "block" | "review" | "approve"
}"""

FALLBACK_RESULT = {
    "contains_hate_content": False,
    "confidence": 0,
    "analysis": "AI analysis unavailable — falling back to hash-only matching.",
    "detected_elements": [],
    "recommendation": "approve",
}


def _image_to_base64(filepath: str) -> tuple[str, str]:
    mime_type, _ = mimetypes.guess_type(filepath)
    if not mime_type:
        mime_type = "image/png"
    with open(filepath, "rb") as f:
        data = base64.standard_b64encode(f.read()).decode("utf-8")
    return data, mime_type


async def analyze_with_claude(filepath: str) -> dict:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        return dict(FALLBACK_RESULT)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        image_data, media_type = _image_to_base64(filepath)

        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Analyze this image for hate content. Return only the JSON response.",
                        },
                    ],
                }
            ],
        )

        response_text = message.content[0].text
        start = response_text.find("{")
        end = response_text.rfind("}") + 1
        if start != -1 and end > start:
            return json.loads(response_text[start:end])
        return dict(FALLBACK_RESULT)

    except Exception:
        return dict(FALLBACK_RESULT)


async def generate_context_notes(filepath: str) -> str | None:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key == "your_key_here":
        return None

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=api_key)
        image_data, media_type = _image_to_base64(filepath)

        message = client.messages.create(
            model="claude-opus-4-6",
            max_tokens=512,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": media_type,
                                "data": image_data,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Briefly describe what makes this image potentially harmful or associated with extremist communities. 1-2 sentences max.",
                        },
                    ],
                }
            ],
        )

        return message.content[0].text.strip()
    except Exception:
        return None
