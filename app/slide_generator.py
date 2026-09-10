import json
import re
from app.agent import chat_model
from langchain_core.messages import HumanMessage, SystemMessage

def generate_slide(topic: str, context: str = "") -> dict:
    system_prompt = SystemMessage(
    content=(
            "Ты — помощник по созданию презентаций для курса Data Science. "
            "На основе темы и контекста сгенерируй структуру одного слайда в формате JSON. "
            "Структура должна содержать:\n"
            "- title (строка) — заголовок слайда\n"
            "- subtitle (строка, опционально) — подзаголовок\n"
            "- items (массив строк) — основные пункты (до 5)\n"
            "- formulas (массив строк, опционально) — только для формул, которые НЕ вписываются в текст (по умолчанию оставь пустым)\n\n"
            "ВАЖНО: формулы встраивай прямо в текст пунктов items:\n"
            "- Для строчных формул используй обрамление \\\\(...\\\\)\n"
            "- Для выносных формул используй обрамление \\\\[...\\\\]\n"
            "Это позволит отображать формулы по ходу текста.\n\n"
            "Пример:\n"
            "{\n"
            '  "title": "Определение временного ряда",\n'
            '  "subtitle": "Основные свойства",\n'
            '  "items": [\n'
            '    "Временной ряд — это последовательность наблюдений \\\\(x_t \\\\in \\\\mathbb{R}\\\\) во времени",\n'
            '    "Модель: \\\\[x_t = \\\\mu + \\\\varepsilon_t\\\\]",\n'
            '    "Пример: анализ цен на акции IBM"\n'
            '  ],\n'
            '  "formulas": []\n'
            "}\n\n"
            "Верни ТОЛЬКО JSON, без пояснений и markdown-обрамления."
        )
    )
    user_content = f"Тема: {topic}\nКонтекст обсуждения: {context}"
    user_prompt = HumanMessage(content=user_content)

    response = chat_model.invoke([system_prompt, user_prompt])
    raw = response.content.strip()
    print("Raw response:", raw)  # Отладка

    # Убираем markdown-обрамления
    raw = re.sub(r'^```json\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    raw = raw.strip()

    # Пробуем найти JSON внутри текста (если есть лишние пояснения до или после)
    json_match = re.search(r'\{.*\}', raw, re.DOTALL)
    if json_match:
        raw = json_match.group(0)
        print("Extracted JSON:", raw)

    # Очищаем от скрытых символов (например, BOM)
    raw = raw.replace('\ufeff', '')

    try:
        slide = json.loads(raw)
        # Базовая валидация
        if not isinstance(slide, dict) or "title" not in slide:
            raise ValueError("Неверная структура JSON: отсутствует поле title")
        return slide
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Ошибка парсинга JSON: {e}\nТекст: {raw}")
        # Fallback — извлекаем информацию из текста
        return {
            "title": topic,
            "subtitle": "Сгенерировано из текста",
            "items": [raw[:200] if len(raw) > 200 else raw],
            "formulas": []
        }