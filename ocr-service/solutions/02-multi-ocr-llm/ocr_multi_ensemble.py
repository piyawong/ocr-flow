#!/usr/bin/env python3
"""
Solution 2: Multi-OCR + LLM Ensemble
Run multiple OCR engines and use LLM to combine/select best result
"""
import os
import sys
from pathlib import Path
from openai import OpenAI

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def ocr_typhoon(image_path: str) -> str:
    """OCR using Typhoon OCR API"""
    try:
        from typhoon_ocr import ocr_document
        return ocr_document(
            pdf_or_image_path=image_path,
            task_type="v1.5",
            figure_language="Thai"
        )
    except Exception as e:
        return f"[Typhoon OCR Error: {e}]"


def ocr_paddle(image_path: str) -> str:
    """OCR using PaddleOCR"""
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_textline_orientation=True, lang='th')
        result = ocr.predict(image_path)

        lines = []
        if result:
            for item in result:
                # Access rec_texts via dict-like access (works for OCRResult)
                try:
                    rec_texts = item['rec_texts'] if 'rec_texts' in item else None
                    if rec_texts:
                        for text in rec_texts:
                            if text and text.strip():
                                lines.append(text)
                except (TypeError, KeyError):
                    pass

        return '\n'.join(lines) if lines else "[PaddleOCR: No text extracted]"
    except Exception as e:
        import traceback
        return f"[PaddleOCR Error: {e}]"


def load_charter_example() -> str:
    """Load charter example for few-shot learning"""
    example_path = Path(__file__).parent / "example.txt"
    if example_path.exists():
        with open(example_path, "r", encoding="utf-8") as f:
            return f.read()
    return ""


def llm_ensemble(typhoon_result: str, paddle_result: str, api_key: str = None) -> str:
    """
    Use LLM to combine results from Typhoon and PaddleOCR
    Uses few-shot learning with charter example
    """
    client = OpenAI(
        base_url="https://api.opentyphoon.ai/v1",
        api_key=api_key or os.environ.get("TYPHOON_API_KEY")
    )

    # Load charter example for context
    charter_example = load_charter_example()

    prompt = f"""คุณเป็นผู้เชี่ยวชาญในการรวมผลลัพธ์ OCR จาก 2 engines สำหรับเอกสารราชการไทย

⚠️ **กฎสำคัญที่สุด:**
- **ห้าม copy เนื้อหาจาก Reference** - Reference ใช้เพื่อดูคำศัพท์ที่ถูกต้องเท่านั้น
- **ต้องใช้เนื้อหาจาก OCR เท่านั้น** - ชื่อมูลนิธิ, ที่อยู่, เนื้อหาทั้งหมดต้องมาจาก OCR
- **ตัวอย่าง:** ถ้า OCR อ่านได้ "มูลนิธิ สวัสดิ์ ตันติสุข" ห้ามเปลี่ยนเป็นชื่ออื่นจาก Reference

## ผลลัพธ์ OCR ที่ต้องรวม (ใช้เนื้อหาจากส่วนนี้เท่านั้น!):

### Typhoon OCR (โครงสร้าง markdown ดี แต่บางคำอาจอ่านผิด):
```
{typhoon_result}
```

### PaddleOCR (อ่านตัวอักษรไทยแม่นกว่า แต่ไม่มี structure):
```
{paddle_result}
```

---

## วิธีการรวมผลลัพธ์:

1. **ใช้โครงสร้าง markdown จาก Typhoon เป็นหลัก**

2. **ใช้เนื้อหาจาก OCR เท่านั้น:**
   - ชื่อมูลนิธิ ที่อยู่ เนื้อหาทุกอย่างต้องมาจาก OCR
   - ห้าม copy จาก Reference

3. **Cross-check ระหว่าง Typhoon และ PaddleOCR (สำคัญมาก!):**
   - **วิธีการ:** สำรวจทุกบรรทัดใน Typhoon → หาคำที่อาจผิด → ค้นหาคำที่ถูกใน PaddleOCR
   - **ตัวอย่างการแก้:**
     - Typhoon: "วัดภูพระสงฆ์" (ดูแปลก) + PaddleOCR: "วัตถุประสงค์" → **ใช้ "วัตถุประสงค์"**
     - Typhoon: "เทศะชุมชน" + PaddleOCR: "เคนะชุมชน" → **ใช้ "เคหะชุมชน"** (แก้สะกด)
     - Typhoon: "รวมมือ" + PaddleOCR: "ร่วมมือ" → **ใช้ "ร่วมมือ"**
   - **กฎ:** คำใดใน Typhoon ที่ดูไม่ถูกต้อง → ให้เทียบกับ PaddleOCR ทันที

4. **แก้ไขการสะกดให้ถูกต้อง:**
   - ใช้ความรู้ภาษาไทยในการแก้สะกด
   - ถ้าข้อใดว่างเปล่า ให้คงหมายเลขข้อนั้นไว้
   - **ห้ามเพิ่มหมวดหรือข้อที่ไม่มีใน OCR**

## Reference สำหรับแก้คำศัพท์ (ใช้แก้คำผิดเท่านั้น ห้าม copy เนื้อหา):
```
{charter_example}
```

ให้ผลลัพธ์ที่รวมแล้วในรูปแบบ markdown (เนื้อหาจาก OCR เท่านั้น!):"""

    response = client.chat.completions.create(
        model="typhoon-v2.5-30b-a3b-instruct",  # Typhoon 2.5 - Best Thai fluency
        messages=[
            {"role": "system", "content": "คุณเป็นผู้เชี่ยวชาญในการรวมและแก้ไขผลลัพธ์ OCR ตอบเฉพาะข้อความที่รวมแล้วเท่านั้น"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        max_tokens=20000
    )

    return response.choices[0].message.content


def process_image(image_path: str, api_key: str = None) -> dict:
    """
    Full pipeline: Typhoon + PaddleOCR -> LLM Ensemble
    """
    print(f"[1/3] Running Typhoon OCR on {image_path}...")
    typhoon_result = ocr_typhoon(image_path)

    print("[2/3] Running PaddleOCR...")
    paddle_result = ocr_paddle(image_path)

    print("[3/3] Running LLM ensemble...")
    ensemble_result = llm_ensemble(typhoon_result, paddle_result, api_key)

    return {
        "typhoon": typhoon_result,
        "paddle": paddle_result,
        "ensemble": ensemble_result
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
    print("Solution 2: Multi-OCR + LLM Ensemble (Typhoon + Paddle)")
    print("=" * 60)

    try:
        result = process_image(image_path, api_key)

        # Save results
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)

        with open(output_dir / "typhoon_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result["typhoon"])

        with open(output_dir / "paddle_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result["paddle"])

        with open(output_dir / "ensemble_result.txt", "w", encoding="utf-8") as f:
            f.write(result["ensemble"])

        print("\n" + "=" * 60)
        print("TYPHOON OCR:")
        print("=" * 60)
        print(result["typhoon"][:300] + "..." if len(result["typhoon"]) > 300 else result["typhoon"])

        print("\n" + "=" * 60)
        print("PADDLE OCR:")
        print("=" * 60)
        print(result["paddle"][:300] + "..." if len(result["paddle"]) > 300 else result["paddle"])

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
