#!/usr/bin/env python3
"""
Solution 4: Multi-Scale OCR with Image Cropping

Strategy:
1. Crop image into 3 sections (Top, Middle, Bottom)
2. Run 4 OCR tasks in parallel:
   - Full image (for structure)
   - Top 1/3 (more accurate for top section)
   - Middle 1/3 (more accurate for middle section)
   - Bottom 1/3 (more accurate for bottom section)
3. LLM combines all results
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


async def ocr_all_parallel(full_path: str, top_path: str, mid_path: str, bot_path: str) -> dict:
    """
    Run 4 OCR tasks in parallel using asyncio.
    """
    loop = asyncio.get_event_loop()

    # Run all 4 OCR tasks concurrently
    tasks = [
        loop.run_in_executor(None, ocr_typhoon, full_path),
        loop.run_in_executor(None, ocr_typhoon, top_path),
        loop.run_in_executor(None, ocr_typhoon, mid_path),
        loop.run_in_executor(None, ocr_typhoon, bot_path)
    ]

    results = await asyncio.gather(*tasks)

    return {
        "full": results[0],
        "top": results[1],
        "middle": results[2],
        "bottom": results[3]
    }


def llm_ensemble(
    full_result: str,
    top_result: str,
    mid_result: str,
    bot_result: str,
    api_key: str = None
) -> str:
    """
    Use LLM to combine results from multi-scale OCR.
    """
    client = OpenAI(
        base_url="https://api.opentyphoon.ai/v1",
        api_key=api_key or os.environ.get("TYPHOON_API_KEY")
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

    prompt = f"""คุณเป็นผู้เชี่ยวชาญในการรวมผลลัพธ์ OCR จากหลาย scales สำหรับเอกสารภาษาไทย
{org_section}
## ผลลัพธ์ OCR ที่ต้องรวม:

### Main OCR (รูปเต็ม - โครงสร้าง markdown ดี):
```
{full_result}
```

### Top Section OCR (1/3 บน - crop แล้วอ่านแม่นกว่า):
```
{top_result}
```

### Middle Section OCR (1/3 กลาง - crop แล้วอ่านแม่นกว่า):
```
{mid_result}
```

### Bottom Section OCR (1/3 ล่าง - crop แล้วอ่านแม่นกว่า):
```
{bot_result}
```

---

## วิธีการรวมผลลัพธ์:

1. **ใช้โครงสร้าง markdown จาก Main OCR เป็นหลัก**
   - เก็บ headers, bullet points, numbering ทั้งหมด

2. **Cross-check ทุกคำใน Main กับ Section OCRs:**
   - **ส่วนบน** → เทียบกับ Top Section OCR
   - **ส่วนกลาง** → เทียบกับ Middle Section OCR
   - **ส่วนล่าง** → เทียบกับ Bottom Section OCR
   - ถ้า Main อ่านคำผิด แต่ Section อ่านถูก → ใช้จาก Section

3. **ตัวอย่างการแก้:**
   - Main: "วัดภูพระสงฆ์" + Top Section: "วัตถุประสงค์" → ใช้ "**วัตถุประสงค์**"
   - Main: "รวมมือ" + Middle Section: "ร่วมมือ" → ใช้ "**ร่วมมือ**"
   - Main: "องค์การ" + Bottom Section: "องค์กร" → ใช้ "**องค์กร**"

4. **แก้ไขการสะกดให้ถูกต้อง:**
   - ใช้ความรู้ภาษาไทยในการแก้สะกด
   - ห้ามเพิ่ม/ลบเนื้อหา

ให้ผลลัพธ์ที่รวมแล้วในรูปแบบ markdown:"""

    response = client.chat.completions.create(
        model="typhoon-v2.5-30b-a3b-instruct",
        messages=[
            {"role": "system", "content": "คุณเป็นผู้เชี่ยวชาญในการรวมและแก้ไขผลลัพธ์ OCR ตอบเฉพาะข้อความที่รวมแล้วเท่านั้น"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.1,
        max_tokens=20000
    )

    return response.choices[0].message.content


async def process_image(image_path: str, api_key: str = None) -> dict:
    """
    Full pipeline: Crop → Multi-OCR (parallel) → LLM Ensemble
    """
    print(f"[1/3] Cropping image into 3 sections...")
    full_path, top_path, mid_path, bot_path = crop_image_sections(image_path)

    print("[2/3] Running 4 OCR tasks in parallel...")
    ocr_results = await ocr_all_parallel(full_path, top_path, mid_path, bot_path)

    print("[3/3] Running LLM ensemble...")
    ensemble_result = llm_ensemble(
        ocr_results["full"],
        ocr_results["top"],
        ocr_results["middle"],
        ocr_results["bottom"],
        api_key
    )

    # Cleanup temp files
    try:
        os.unlink(top_path)
        os.unlink(mid_path)
        os.unlink(bot_path)
    except:
        pass

    return {
        "full_ocr": ocr_results["full"],
        "top_ocr": ocr_results["top"],
        "middle_ocr": ocr_results["middle"],
        "bottom_ocr": ocr_results["bottom"],
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
    print("Solution 4: Multi-Scale OCR with Image Cropping")
    print("=" * 60)

    try:
        result = asyncio.run(process_image(image_path, api_key))

        # Save results
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)

        with open(output_dir / "full_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result["full_ocr"])

        with open(output_dir / "top_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result["top_ocr"])

        with open(output_dir / "middle_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result["middle_ocr"])

        with open(output_dir / "bottom_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result["bottom_ocr"])

        with open(output_dir / "ensemble_result.txt", "w", encoding="utf-8") as f:
            f.write(result["ensemble"])

        print("\n" + "=" * 60)
        print("FULL IMAGE OCR:")
        print("=" * 60)
        print(result["full_ocr"][:300] + "..." if len(result["full_ocr"]) > 300 else result["full_ocr"])

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
