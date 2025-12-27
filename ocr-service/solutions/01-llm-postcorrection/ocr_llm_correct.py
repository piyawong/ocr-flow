#!/usr/bin/env python3
"""
Solution 1: LLM Post-correction
OCR with Typhoon OCR + LLM correction using GPT/Claude/Typhoon
"""
import os
import sys
from pathlib import Path
from openai import OpenAI

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def ocr_with_typhoon(image_path: str) -> str:
    """OCR using Typhoon OCR API"""
    from typhoon_ocr import ocr_document
    return ocr_document(
        pdf_or_image_path=image_path,
        task_type="v1.5",
        figure_language="Thai"
    )


def llm_correct(ocr_text: str, api_key: str = None) -> str:
    """
    Use LLM to correct OCR errors
    Uses Typhoon LLM API (OpenAI compatible)
    """
    client = OpenAI(
        base_url="https://api.opentyphoon.ai/v1",
        api_key=api_key or os.environ.get("TYPHOON_API_KEY")
    )

    prompt = f"""คุณเป็นผู้เชี่ยวชาญในการแก้ไขข้อความ OCR ภาษาไทย

งานของคุณคือแก้ไขข้อความที่ได้จาก OCR ให้ถูกต้อง โดย:
1. แก้ไขตัวอักษรที่อ่านผิด (เช่น ก→ด, ม→น, ธ→ช)
2. แก้ไขสระและวรรณยุกต์ที่ผิดพลาด
3. แก้ไขคำที่สะกดผิด
4. รักษาโครงสร้างและ formatting เดิม (markdown, หัวข้อ, ข้อย่อย)
5. ห้ามเพิ่มหรือลบเนื้อหาที่ไม่มีในต้นฉบับ
6. ถ้าไม่แน่ใจ ให้คงคำเดิมไว้

ข้อความ OCR:
---
{ocr_text}
---

ข้อความที่แก้ไขแล้ว:"""

    response = client.chat.completions.create(
        model="typhoon-v2.1-12b-instruct",  # Best for Thai language
        messages=[
            {"role": "system", "content": "คุณเป็นผู้เชี่ยวชาญในการแก้ไขข้อความ OCR ภาษาไทย ตอบเฉพาะข้อความที่แก้ไขแล้วเท่านั้น"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        max_tokens=8192
    )

    return response.choices[0].message.content


def process_image(image_path: str, api_key: str = None) -> dict:
    """
    Full pipeline: OCR -> LLM Correction
    """
    print(f"[1/2] Running OCR on {image_path}...")
    raw_ocr = ocr_with_typhoon(image_path)

    print("[2/2] Running LLM correction...")
    corrected = llm_correct(raw_ocr, api_key)

    return {
        "raw_ocr": raw_ocr,
        "corrected": corrected
    }


def main():
    api_key = os.environ.get('TYPHOON_API_KEY')
    if not api_key:
        print("Error: TYPHOON_API_KEY environment variable not set")
        sys.exit(1)

    if len(sys.argv) < 2:
        image_path = '../../test.jpg'
    else:
        image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(f"Error: File '{image_path}' not found")
        sys.exit(1)

    print("=" * 60)
    print("Solution 1: LLM Post-correction")
    print("=" * 60)

    try:
        result = process_image(image_path, api_key)

        # Save results
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)

        with open(output_dir / "raw_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result["raw_ocr"])

        with open(output_dir / "corrected.txt", "w", encoding="utf-8") as f:
            f.write(result["corrected"])

        print("\n" + "=" * 60)
        print("RAW OCR:")
        print("=" * 60)
        print(result["raw_ocr"][:500] + "..." if len(result["raw_ocr"]) > 500 else result["raw_ocr"])

        print("\n" + "=" * 60)
        print("CORRECTED:")
        print("=" * 60)
        print(result["corrected"][:500] + "..." if len(result["corrected"]) > 500 else result["corrected"])

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
