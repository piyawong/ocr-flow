#!/usr/bin/env python3
"""
Solution 5 v2: Hybrid Multi-Scale + PaddleOCR (with api_key parameter)

Uses api_key parameter instead of env variable for thread safety
"""
import os
import sys
import asyncio
from pathlib import Path
from PIL import Image
from openai import OpenAI
import tempfile

sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def load_env():
    """Load .env"""
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key] = value


def crop_image(image_path: str) -> tuple[str, str, str, str]:
    """Crop into 3 sections"""
    img = Image.open(image_path)

    if img.mode == 'RGBA':
        rgb_img = Image.new('RGB', img.size, (255, 255, 255))
        rgb_img.paste(img, mask=img.split()[3])
        img = rgb_img

    width, height = img.size
    section_height = height // 3
    overlap = 20

    top = img.crop((0, 0, width, section_height + overlap))
    middle = img.crop((0, section_height - overlap, width, 2 * section_height + overlap))
    bottom = img.crop((0, 2 * section_height - overlap, width, height))

    top_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
    mid_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
    bot_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name

    top.save(top_path, "JPEG")
    middle.save(mid_path, "JPEG")
    bottom.save(bot_path, "JPEG")

    return image_path, top_path, mid_path, bot_path


def ocr_typhoon(image_path: str, api_key: str) -> str:
    """Run Typhoon OCR with api_key parameter"""
    try:
        from typhoon_ocr import ocr_document
        return ocr_document(
            pdf_or_image_path=image_path,
            api_key=api_key,  # ✅ ส่ง api_key ตรงนี้!
            model="typhoon-ocr",
            task_type="v1.5",
            figure_language="Thai"
        )
    except Exception as e:
        return f"[Typhoon Error: {e}]"


def ocr_paddle(image_path: str) -> str:
    """Run PaddleOCR"""
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_textline_orientation=True, lang='th')
        result = ocr.predict(image_path)

        lines = []
        if result:
            for item in result:
                try:
                    rec_texts = item['rec_texts'] if 'rec_texts' in item else None
                    if rec_texts:
                        for text in rec_texts:
                            if text and text.strip():
                                lines.append(text)
                except (TypeError, KeyError):
                    pass

        return '\n'.join(lines) if lines else "[Paddle: No text]"
    except Exception as e:
        return f"[Paddle Error: {e}]"


async def ocr_all_parallel(full, top, mid, bot, api_key: str) -> dict:
    """
    Run 5 OCR tasks in parallel using asyncio + threads
    """
    loop = asyncio.get_event_loop()

    # แตก 5 tasks parallel
    tasks = [
        loop.run_in_executor(None, ocr_typhoon, full, api_key),
        loop.run_in_executor(None, ocr_typhoon, top, api_key),
        loop.run_in_executor(None, ocr_typhoon, mid, api_key),
        loop.run_in_executor(None, ocr_typhoon, bot, api_key),
        loop.run_in_executor(None, ocr_paddle, full)
    ]

    results = await asyncio.gather(*tasks)

    return {
        "full": results[0],
        "top": results[1],
        "mid": results[2],
        "bot": results[3],
        "paddle": results[4]
    }


def llm_ensemble(ocr_results: dict, api_key: str) -> str:
    """2-step LLM ensemble"""
    client = OpenAI(
        base_url="https://api.opentyphoon.ai/v1",
        api_key=api_key
    )

    # Load orgs
    org_section = ""
    org_path = Path(__file__).parent.parent.parent / "organizations.json"
    if org_path.exists():
        import json
        try:
            with open(org_path, "r", encoding="utf-8") as f:
                orgs = json.load(f)
            if orgs:
                org_section = f"""
## รายชื่อมูลนิธิที่ถูกต้อง:
{chr(10).join([f"- {name}" for name in orgs])}

กฎ: ถ้า OCR อ่านผิด → จับคู่กับรายชื่อข้างบน
---
"""
        except:
            pass

    # Step 1: Combine Multi-Scale Typhoon
    prompt1 = f"""รวม OCR จาก 4 scales (Full เป็นหลัก):

Full (โครงสร้างดี - **ใช้เป็นหลัก**):
{ocr_results['full']}

Top 1/3:
{ocr_results['top']}

Mid 1/3:
{ocr_results['mid']}

Bot 1/3:
{ocr_results['bot']}

วิธีรวม:
1. ใช้โครงสร้างจาก Full
2. แก้คำผิดด้วย Top/Mid/Bot (แต่ละ section)

ผลลัพธ์:"""

    r1 = client.chat.completions.create(
        model="typhoon-v2.5-30b-a3b-instruct",
        messages=[
            {"role": "system", "content": "รวม OCR ตอบเฉพาะข้อความ"},
            {"role": "user", "content": prompt1}
        ],
        temperature=0.1,
        max_tokens=20000
    )

    typhoon_combined = r1.choices[0].message.content

    # Step 2: Cross-check with Paddle
    prompt2 = f"""รวม OCR (Typhoon Combined เป็นหลัก):
{org_section}
Typhoon Combined (**ใช้เป็นหลัก**):
{typhoon_combined}

PaddleOCR (แก้คำผิด):
{ocr_results['paddle']}

วิธีรวม:
1. ใช้โครงสร้างจาก Typhoon Combined
2. Cross-check กับ Paddle (แก้คำผิด)
3. Match organizations

ผลลัพธ์:"""

    r2 = client.chat.completions.create(
        model="typhoon-v2.5-30b-a3b-instruct",
        messages=[
            {"role": "system", "content": "รวม OCR ตอบเฉพาะข้อความ"},
            {"role": "user", "content": prompt2}
        ],
        temperature=0.1,
        max_tokens=20000
    )

    return r2.choices[0].message.content


async def process_image(image_path: str, api_key: str) -> dict:
    """Full pipeline"""
    print("[1/3] Cropping...")
    full, top, mid, bot = crop_image(image_path)

    print("[2/3] Running 5 OCR tasks in parallel...")
    ocr_results = await ocr_all_parallel(full, top, mid, bot, api_key)

    print("[3/3] 2-step LLM ensemble...")
    result = llm_ensemble(ocr_results, api_key)

    # Cleanup
    try:
        os.unlink(top)
        os.unlink(mid)
        os.unlink(bot)
    except:
        pass

    return {
        "typhoon_full": ocr_results["full"],
        "paddle": ocr_results["paddle"],
        "ensemble": result
    }


def main():
    load_env()
    api_key = os.environ.get('TYPHOON_OCR_API_KEY_1')

    if not api_key:
        print("Error: TYPHOON_OCR_API_KEY_1 not found")
        sys.exit(1)

    image_path = sys.argv[1] if len(sys.argv) > 1 else '../../test.jpg'

    if not Path(image_path).exists():
        print(f"Error: {image_path} not found")
        sys.exit(1)

    print("=" * 60)
    print("Solution 5 v2: Hybrid with api_key parameter")
    print("=" * 60)

    result = asyncio.run(process_image(image_path, api_key))

    # Save all results
    output_dir = Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)

    with open(output_dir / "typhoon_full.txt", "w", encoding="utf-8") as f:
        f.write(result["typhoon_full"])
    with open(output_dir / "paddle.txt", "w", encoding="utf-8") as f:
        f.write(result["paddle"])
    with open(output_dir / "ensemble.txt", "w", encoding="utf-8") as f:
        f.write(result["ensemble"])

    print("\n" + "=" * 60)
    print("1. TYPHOON FULL OCR:")
    print("=" * 60)
    print(result["typhoon_full"][:400])

    print("\n" + "=" * 60)
    print("2. PADDLE OCR:")
    print("=" * 60)
    print(result["paddle"][:400])

    print("\n" + "=" * 60)
    print("3. ENSEMBLE RESULT (FINAL):")
    print("=" * 60)
    print(result["ensemble"][:800])

    print("\n" + "=" * 60)
    print(f"Saved to: {output_dir}")
    print("=" * 60)


if __name__ == '__main__':
    main()
