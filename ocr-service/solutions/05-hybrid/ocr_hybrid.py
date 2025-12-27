#!/usr/bin/env python3
"""
Solution 5: Hybrid Multi-Scale + PaddleOCR

Strategy:
1. Run 5 OCR tasks in parallel:
   - Typhoon Full (structure หลัก)
   - Typhoon Top 1/3 (แม่น section บน)
   - Typhoon Mid 1/3 (แม่น section กลาง)
   - Typhoon Bot 1/3 (แม่น section ล่าง)
   - PaddleOCR Full (แม่นตัวอักษร)
2. LLM combines in 2 steps:
   Step 1: Full + Top/Mid/Bot → Typhoon Combined (Full เป็นหลัก)
   Step 2: Typhoon Combined + Paddle → Final Result (Typhoon Combined เป็นหลัก)
"""
import os
import sys
import asyncio
from pathlib import Path
from PIL import Image
from openai import OpenAI
import tempfile

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def load_env():
    """Load environment variables from .env file"""
    env_path = Path(__file__).parent.parent.parent / ".env"
    if env_path.exists():
        with open(env_path, "r") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ[key] = value


def crop_image_sections(image_path: str) -> tuple[str, str, str, str]:
    """
    Crop image into 3 sections and save to temp files.

    Returns:
        Tuple of (full_path, top_path, middle_path, bottom_path)
    """
    img = Image.open(image_path)

    # Convert RGBA to RGB (for PNG with transparency)
    if img.mode == 'RGBA':
        rgb_img = Image.new('RGB', img.size, (255, 255, 255))
        rgb_img.paste(img, mask=img.split()[3])
        img = rgb_img

    width, height = img.size

    # Calculate section heights
    section_height = height // 3

    # Crop sections with small overlap to avoid cutting words
    overlap = 20
    top = img.crop((0, 0, width, section_height + overlap))
    middle = img.crop((0, section_height - overlap, width, 2 * section_height + overlap))
    bottom = img.crop((0, 2 * section_height - overlap, width, height))

    # Save to temp files
    top_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
    mid_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
    bot_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name

    top.save(top_path, "JPEG")
    middle.save(mid_path, "JPEG")
    bottom.save(bot_path, "JPEG")

    return image_path, top_path, mid_path, bot_path


def ocr_typhoon(image_path: str) -> str:
    """Run Typhoon OCR on image"""
    try:
        # Set TYPHOON_API_KEY for typhoon_ocr library
        if 'TYPHOON_OCR_API_KEY_1' in os.environ:
            os.environ['TYPHOON_API_KEY'] = os.environ['TYPHOON_OCR_API_KEY_1']

        from typhoon_ocr import ocr_document
        return ocr_document(
            pdf_or_image_path=image_path,
            task_type="v1.5",
            figure_language="Thai"
        )
    except Exception as e:
        return f"[Typhoon OCR Error: {e}]"


def ocr_paddle(image_path: str) -> str:
    """Run PaddleOCR on image"""
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

        return '\n'.join(lines) if lines else "[PaddleOCR: No text]"
    except Exception as e:
        return f"[PaddleOCR Error: {e}]"


async def ocr_all_parallel(full_path: str, top_path: str, mid_path: str, bot_path: str) -> dict:
    """
    Run 5 OCR tasks in parallel:
    - 4x Typhoon (full + 3 crops)
    - 1x PaddleOCR (full)
    """
    loop = asyncio.get_event_loop()

    # Run all 5 OCR tasks concurrently
    tasks = [
        loop.run_in_executor(None, ocr_typhoon, full_path),
        loop.run_in_executor(None, ocr_typhoon, top_path),
        loop.run_in_executor(None, ocr_typhoon, mid_path),
        loop.run_in_executor(None, ocr_typhoon, bot_path),
        loop.run_in_executor(None, ocr_paddle, full_path)
    ]

    results = await asyncio.gather(*tasks)

    return {
        "typhoon_full": results[0],
        "typhoon_top": results[1],
        "typhoon_middle": results[2],
        "typhoon_bottom": results[3],
        "paddle_full": results[4]
    }


def llm_ensemble(ocr_results: dict, api_key: str = None) -> str:
    """
    Two-step LLM ensemble:
    Step 1: Combine Full + Top/Mid/Bot (Full เป็นหลัก)
    Step 2: Typhoon Combined + Paddle (Typhoon Combined เป็นหลัก)
    """
    client = OpenAI(
        base_url="https://api.opentyphoon.ai/v1",
        api_key=api_key or os.environ.get("TYPHOON_OCR_API_KEY_1")
    )

    # Load organizations if available
    org_section = ""
    org_json_path = Path(__file__).parent.parent.parent / "organizations.json"
    if org_json_path.exists():
        import json
        try:
            with open(org_json_path, "r", encoding="utf-8") as f:
                org_list = json.load(f)

            if org_list and len(org_list) > 0:
                org_names = "\n".join([f"- {name}" for name in org_list])
                org_section = f"""
## รายชื่อมูลนิธิที่ถูกต้อง (ใช้แก้ชื่อที่ OCR อ่านผิด):
```
{org_names}
```

**กฎ:** ถ้า OCR อ่านชื่อมูลนิธิผิดเล็กน้อย → จับคู่กับรายชื่อที่ถูกต้องข้างบน

---
"""
        except:
            pass

    # Step 1: Combine Typhoon Multi-Scale
    prompt_step1 = f"""คุณเป็นผู้เชี่ยวชาญในการรวมผลลัพธ์ OCR จากหลาย scales สำหรับเอกสารภาษาไทย

## ผลลัพธ์ Typhoon OCR:

### Full Image OCR (โครงสร้าง markdown ดี - **ใช้เป็นหลัก**):
```
{ocr_results["typhoon_full"]}
```

### Top Section OCR (1/3 บน - crop แล้วอ่านแม่นกว่า):
```
{ocr_results["typhoon_top"]}
```

### Middle Section OCR (1/3 กลาง - crop แล้วอ่านแม่นกว่า):
```
{ocr_results["typhoon_middle"]}
```

### Bottom Section OCR (1/3 ล่าง - crop แล้วอ่านแม่นกว่า):
```
{ocr_results["typhoon_bottom"]}
```

---

## วิธีการรวม (สำคัญ!):

1. **ใช้โครงสร้างและเนื้อหาจาก Full Image เป็นหลัก**
   - เก็บ headers, bullet points, numbering ทั้งหมด
   - ห้ามลบหรือเพิ่มส่วนใดจาก Full

2. **แก้ไขเฉพาะคำที่ผิดโดยใช้ Section OCRs:**
   - **ส่วนบน** (บรรทัดที่ 1-33%) → เทียบกับ Top Section OCR
   - **ส่วนกลาง** (บรรทัดที่ 34-66%) → เทียบกับ Middle Section OCR
   - **ส่วนล่าง** (บรรทัดที่ 67-100%) → เทียบกับ Bottom Section OCR
   - ถ้า Full อ่านคำผิด แต่ Section อ่านถูก → แก้คำนั้น

ให้ผลลัพธ์ที่รวมแล้ว (โครงสร้างจาก Full, แก้คำด้วย Sections):"""

    response_step1 = client.chat.completions.create(
        model="typhoon-v2.5-30b-a3b-instruct",
        messages=[
            {"role": "system", "content": "คุณเป็นผู้เชี่ยวชาญในการรวม OCR จากหลาย scales ตอบเฉพาะข้อความที่รวมแล้ว"},
            {"role": "user", "content": prompt_step1}
        ],
        temperature=0.1,
        max_tokens=20000
    )

    typhoon_combined = response_step1.choices[0].message.content

    # Step 2: Cross-check with PaddleOCR
    prompt_step2 = f"""คุณเป็นผู้เชี่ยวชาญในการรวมผลลัพธ์ OCR สำหรับเอกสารภาษาไทย
{org_section}
## ผลลัพธ์ OCR:

### Typhoon OCR Combined (โครงสร้าง markdown ดี - **ใช้เป็นหลัก**):
```
{typhoon_combined}
```

### PaddleOCR (อ่านตัวอักษรไทยแม่นกว่า - ใช้แก้คำผิด):
```
{ocr_results["paddle_full"]}
```

---

## วิธีการรวม (สำคัญ!):

1. **ใช้โครงสร้างและเนื้อหาจาก Typhoon Combined เป็นหลัก**
   - เก็บทุกอย่างจาก Typhoon Combined
   - ห้ามลบหรือเพิ่มส่วนใด

2. **Cross-check ทุกคำกับ PaddleOCR:**
   - สำรวจทุกบรรทัดใน Typhoon → หาคำที่อาจผิด → ค้นหาคำที่ถูกใน PaddleOCR
   - **ตัวอย่างการแก้:**
     - Typhoon: "วัดภูพระสงฆ์" + PaddleOCR: "วัตถุประสงค์" → ใช้ "**วัตถุประสงค์**"
     - Typhoon: "เทศะชุมชน" + PaddleOCR: "เคนะชุมชน" → ใช้ "**เคหะชุมชน**" (แก้สะกด)
     - Typhoon: "รวมมือ" + PaddleOCR: "ร่วมมือ" → ใช้ "**ร่วมมือ**"

3. **แก้ไขการสะกดให้ถูกต้อง:**
   - ใช้ความรู้ภาษาไทยในการแก้สะกด
   - ห้ามเพิ่ม/ลบเนื้อหา

ให้ผลลัพธ์ที่รวมแล้วในรูปแบบ markdown (โครงสร้างจาก Typhoon, แก้คำด้วย Paddle):"""

    response_step2 = client.chat.completions.create(
        model="typhoon-v2.5-30b-a3b-instruct",
        messages=[
            {"role": "system", "content": "คุณเป็นผู้เชี่ยวชาญในการรวมและแก้ไข OCR ตอบเฉพาะข้อความที่รวมแล้ว"},
            {"role": "user", "content": prompt_step2}
        ],
        temperature=0.1,
        max_tokens=20000
    )

    return response_step2.choices[0].message.content


async def process_image(image_path: str, api_key: str = None) -> dict:
    """
    Full pipeline: Crop → 5 OCR Parallel → 2-Step LLM Ensemble
    """
    print(f"[1/3] Cropping image into 3 sections...")
    full_path, top_path, mid_path, bot_path = crop_image_sections(image_path)

    print("[2/3] Running 5 OCR tasks in parallel (4 Typhoon + 1 Paddle)...")
    ocr_results = await ocr_all_parallel(full_path, top_path, mid_path, bot_path)

    print("[3/3] Running 2-step LLM ensemble...")
    print("   Step 1: Combining Typhoon Multi-Scale (Full เป็นหลัก)")
    print("   Step 2: Cross-checking with PaddleOCR (Typhoon Combined เป็นหลัก)")
    ensemble_result = llm_ensemble(ocr_results, api_key)

    # Cleanup temp files
    try:
        os.unlink(top_path)
        os.unlink(mid_path)
        os.unlink(bot_path)
    except:
        pass

    return {
        "typhoon_full": ocr_results["typhoon_full"],
        "typhoon_top": ocr_results["typhoon_top"],
        "typhoon_middle": ocr_results["typhoon_middle"],
        "typhoon_bottom": ocr_results["typhoon_bottom"],
        "paddle_full": ocr_results["paddle_full"],
        "ensemble": ensemble_result
    }


def main():
    # Load .env file
    load_env()

    api_key = os.environ.get('TYPHOON_OCR_API_KEY_1')
    if not api_key:
        print("Error: TYPHOON_OCR_API_KEY_1 not found in .env")
        sys.exit(1)

    if len(sys.argv) < 2:
        image_path = '../../test.jpg'
    else:
        image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(f"Error: File '{image_path}' not found")
        sys.exit(1)

    print("=" * 60)
    print("Solution 5: Hybrid Multi-Scale + PaddleOCR")
    print("=" * 60)

    try:
        result = asyncio.run(process_image(image_path, api_key))

        # Save results
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)

        with open(output_dir / "typhoon_full.txt", "w", encoding="utf-8") as f:
            f.write(result["typhoon_full"])

        with open(output_dir / "typhoon_top.txt", "w", encoding="utf-8") as f:
            f.write(result["typhoon_top"])

        with open(output_dir / "typhoon_middle.txt", "w", encoding="utf-8") as f:
            f.write(result["typhoon_middle"])

        with open(output_dir / "typhoon_bottom.txt", "w", encoding="utf-8") as f:
            f.write(result["typhoon_bottom"])

        with open(output_dir / "paddle_full.txt", "w", encoding="utf-8") as f:
            f.write(result["paddle_full"])

        with open(output_dir / "ensemble_result.txt", "w", encoding="utf-8") as f:
            f.write(result["ensemble"])

        print("\n" + "=" * 60)
        print("TYPHOON FULL OCR:")
        print("=" * 60)
        print(result["typhoon_full"][:300] + "..." if len(result["typhoon_full"]) > 300 else result["typhoon_full"])

        print("\n" + "=" * 60)
        print("PADDLE OCR:")
        print("=" * 60)
        print(result["paddle_full"][:300] + "..." if len(result["paddle_full"]) > 300 else result["paddle_full"])

        print("\n" + "=" * 60)
        print("ENSEMBLE RESULT:")
        print("=" * 60)
        print(result["ensemble"][:500] + "..." if len(result["ensemble"]) > 500 else result["ensemble"])

        print("\n" + "=" * 60)
        print(f"Results saved to: {output_dir}")
        print("=" * 60)

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
