"""
OCR Microservice using Multi-Scale Typhoon OCR + LLM Ensemble.

This service uses Typhoon OCR Multi-Scale (Full + 3 Crops) + LLM Ensemble
for high-accuracy Thai document OCR via HTTP API, supporting parallel requests.

Each OCR request runs in a separate process with its own environment,
avoiding race conditions when using different API keys concurrently.

Architecture:
    - 4× Typhoon OCR calls per image (Full, Top, Middle, Bottom sections)
    - 1× Typhoon LLM call for combining and correcting results
    - ProcessPoolExecutor for parallel processing

Usage:
    POST /ocr - OCR a single image (base64 or file upload)
    POST /ocr/batch - OCR multiple images in parallel
    GET /health - Health check
"""

from __future__ import annotations
import os
import base64
import tempfile
import asyncio
import logging
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
from typing import Optional, Union, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Form, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import uvicorn


# =============================================================================
# LOGGING CONFIGURATION
# =============================================================================

# Configure logging format with detailed information
LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
LOG_FORMAT = '%(asctime)s | %(levelname)-8s | PID:%(process)d | %(name)s:%(funcName)s:%(lineno)d | %(message)s'
LOG_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Configure root logger
logging.basicConfig(
    level=LOG_LEVEL,
    format=LOG_FORMAT,
    datefmt=LOG_DATE_FORMAT,
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

# Create logger for this module
logger = logging.getLogger(__name__)


# =============================================================================
# CUSTOM EXCEPTIONS
# =============================================================================

class OcrError(Exception):
    """Base exception for OCR errors."""
    pass

class OcrTimeoutError(OcrError):
    """OCR processing timed out."""
    pass

class OcrApiError(OcrError):
    """Error calling external OCR API."""
    pass

class InvalidImageError(OcrError):
    """Invalid or corrupted image data."""
    pass

class ProcessPoolCrashError(OcrError):
    """Worker process crashed unexpectedly."""
    pass


# =============================================================================
# PROCESS POOL (Global)
# =============================================================================

# ProcessPoolExecutor for running OCR in separate processes
# Each process has its own environment, avoiding race conditions with API keys
process_pool: Optional[ProcessPoolExecutor] = None


# =============================================================================
# MODELS
# =============================================================================

class OcrRequest(BaseModel):
    """Request model for OCR endpoint."""
    image_base64: str
    api_key: Union[str, List[str]]  # Single key or list of 4 keys for load balancing
    task_type: str = "v1.5"  # v1.5 (faster) or default/structure
    figure_language: str = "Thai"


class OcrResponse(BaseModel):
    """Response model for OCR endpoint."""
    text: str
    confidence: float = 0.0
    success: bool = True
    error: Optional[str] = None


class BatchOcrRequest(BaseModel):
    """Request model for batch OCR endpoint."""
    images: list[dict]  # [{image_base64, id}, ...]
    api_key: Union[str, List[str]]  # Single key or list of 4 keys for load balancing
    task_type: str = "v1.5"
    figure_language: str = "Thai"


class BatchOcrResponse(BaseModel):
    """Response model for batch OCR endpoint."""
    results: list[dict]  # [{id, text, success, error}, ...]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str


class SyncOrganizationsRequest(BaseModel):
    """Request model for syncing organization names."""
    organizations: list[str]


class SyncOrganizationsResponse(BaseModel):
    """Response model for syncing organization names."""
    success: bool
    count: int
    message: str


# =============================================================================
# OCR FUNCTIONS (Multi-Scale Typhoon OCR + LLM Ensemble)
# =============================================================================

def _ocr_worker(
    image_data: bytes,
    api_key: Union[str, List[str]],
    task_type: str,
    figure_language: str
) -> tuple[str, float]:
    """
    Worker function that runs in a separate process.
    Uses Solution 5: Multi-Scale Typhoon (Full + 3 Crops) + 2-Step LLM Ensemble.

    Uses multithreading (4 threads) inside this process for parallel OCR.

    Args:
        api_key: Single key or list of 4 keys [key_full, key_top, key_mid, key_bot]
                 If list: OCR uses different keys, LLM uses random 2 keys
    """
    import os
    import sys
    import tempfile
    import concurrent.futures
    import logging
    from PIL import Image
    from typhoon_ocr import ocr_document
    from openai import OpenAI

    # Configure logging for child process
    worker_logger = logging.getLogger(f"{__name__}.worker")
    if not worker_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(logging.Formatter(
            '%(asctime)s | %(levelname)-8s | PID:%(process)d | %(name)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
        worker_logger.addHandler(handler)
        worker_logger.setLevel(logging.INFO)

    # Log memory usage
    try:
        import psutil
        process = psutil.Process()
        mem_info = process.memory_info()
        worker_logger.info("=" * 80)
        worker_logger.info("OCR Worker started")
        worker_logger.info(f"Image size: {len(image_data)} bytes, task_type: {task_type}, language: {figure_language}")
        worker_logger.info(f"Memory usage: RSS={mem_info.rss / 1024 / 1024:.2f} MB, VMS={mem_info.vms / 1024 / 1024:.2f} MB")
    except ImportError:
        worker_logger.info("=" * 80)
        worker_logger.info("OCR Worker started")
        worker_logger.info(f"Image size: {len(image_data)} bytes, task_type: {task_type}, language: {figure_language}")
        worker_logger.info("psutil not available, memory logging disabled")

    # Normalize api_key to list of 4 keys
    if isinstance(api_key, str):
        # Single key → use for all
        keys = [api_key, api_key, api_key, api_key]
        worker_logger.info("Using single API key for all OCR calls")
    else:
        # List of keys
        if len(api_key) < 4:
            # Pad with first key if not enough
            keys = api_key + [api_key[0]] * (4 - len(api_key))
            worker_logger.info(f"API keys padded from {len(api_key)} to 4 keys")
        else:
            keys = api_key[:4]
            worker_logger.info("Using 4 different API keys for load balancing")

    # Save image to temp file
    worker_logger.info("Saving image to temporary file...")
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(image_data)
        tmp_path = tmp.name
    worker_logger.info(f"Temporary file created: {tmp_path}")

    try:
        # [1/5] Crop image into 3 sections
        worker_logger.info("[Step 1/5] Loading and cropping image...")
        img = Image.open(tmp_path)
        worker_logger.info(f"Image loaded: mode={img.mode}, size={img.size}")

        # Convert RGBA to RGB (for PNG)
        if img.mode == 'RGBA':
            worker_logger.info("Converting RGBA to RGB...")
            rgb_img = Image.new('RGB', img.size, (255, 255, 255))
            rgb_img.paste(img, mask=img.split()[3])
            img = rgb_img
            worker_logger.info("Conversion completed")

        width, height = img.size
        section_height = height // 3
        overlap = 20
        worker_logger.info(f"Image dimensions: {width}x{height}, section_height: {section_height}, overlap: {overlap}")

        # Crop sections
        worker_logger.info("Cropping image into 3 sections (top, middle, bottom)...")
        top = img.crop((0, 0, width, section_height + overlap))
        middle = img.crop((0, section_height - overlap, width, 2 * section_height + overlap))
        bottom = img.crop((0, 2 * section_height - overlap, width, height))
        worker_logger.info(f"Cropping completed: top={top.size}, middle={middle.size}, bottom={bottom.size}")

        # Save cropped sections
        worker_logger.info("Saving cropped sections to temporary files...")
        top_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
        mid_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name
        bot_path = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False).name

        top.save(top_path, "JPEG")
        middle.save(mid_path, "JPEG")
        bottom.save(bot_path, "JPEG")
        worker_logger.info(f"Cropped sections saved: top={top_path}, mid={mid_path}, bot={bot_path}")

        # [2/5] Run 5 OCR tasks in parallel using ThreadPoolExecutor
        worker_logger.info("[Step 2/5] Running 4 parallel Typhoon OCR tasks...")

        def run_typhoon(path, key, name):
            worker_logger.info(f"  → Starting OCR task: {name} (path={path})")
            try:
                result = ocr_document(
                    pdf_or_image_path=path,
                    api_key=key,  # ✅ แยก key ตาม index
                    model="typhoon-ocr",
                    task_type=task_type,
                    figure_language=figure_language
                )
                worker_logger.info(f"  ✓ OCR task completed: {name} ({len(result)} chars)")
                return result
            except Exception as e:
                worker_logger.error(f"  ✗ OCR task failed: {name} - {str(e)}")
                raise

        # Run 4 Typhoon OCR tasks concurrently (4 threads with different keys)
        worker_logger.info("Submitting 4 OCR tasks to ThreadPoolExecutor...")
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            future_full = executor.submit(run_typhoon, tmp_path, keys[0], "Full Image")
            future_top = executor.submit(run_typhoon, top_path, keys[1], "Top Section")
            future_mid = executor.submit(run_typhoon, mid_path, keys[2], "Middle Section")
            future_bot = executor.submit(run_typhoon, bot_path, keys[3], "Bottom Section")

            # Wait for all results
            worker_logger.info("Waiting for all OCR tasks to complete...")
            try:
                full_result = future_full.result()
                top_result = future_top.result()
                mid_result = future_mid.result()
                bot_result = future_bot.result()
            except Exception as ocr_error:
                worker_logger.error("=" * 80)
                worker_logger.error("❌ One or more OCR tasks failed!")
                worker_logger.error(f"Error: {str(ocr_error)}")
                worker_logger.error("=" * 80)
                raise RuntimeError(f"OCR task failed: {str(ocr_error)}") from ocr_error

        worker_logger.info("All 4 OCR tasks completed successfully")

        # [VALIDATION] Check if any OCR result is empty or too short
        worker_logger.info("Validating OCR results...")
        MIN_OCR_LENGTH = 10  # ขั้นต่ำ 10 ตัวอักษร

        ocr_results = [
            ("Full Image", full_result),
            ("Top Section", top_result),
            ("Middle Section", mid_result),
            ("Bottom Section", bot_result)
        ]

        validation_errors = []
        for name, result in ocr_results:
            if result is None:
                validation_errors.append(f"{name}: Result is None")
            elif not isinstance(result, str):
                validation_errors.append(f"{name}: Result is not a string (type: {type(result)})")
            elif len(result.strip()) == 0:
                validation_errors.append(f"{name}: Result is empty")
            elif len(result.strip()) < MIN_OCR_LENGTH:
                validation_errors.append(f"{name}: Result too short ({len(result.strip())} chars, min: {MIN_OCR_LENGTH})")

        if validation_errors:
            worker_logger.error("=" * 80)
            worker_logger.error("❌ OCR VALIDATION FAILED!")
            worker_logger.error("The following OCR results are invalid:")
            for err in validation_errors:
                worker_logger.error(f"  - {err}")
            worker_logger.error("")
            worker_logger.error("This may indicate:")
            worker_logger.error("  1. API returned empty response")
            worker_logger.error("  2. Image quality too poor to extract text")
            worker_logger.error("  3. API key quota exceeded")
            worker_logger.error("  4. Image format not supported")
            worker_logger.error("=" * 80)
            raise RuntimeError(f"OCR validation failed: {'; '.join(validation_errors)}")

        worker_logger.info("✓ OCR validation passed - all results are valid")
        worker_logger.info(f"  Full: {len(full_result)} chars, Top: {len(top_result)} chars, "
                          f"Mid: {len(mid_result)} chars, Bot: {len(bot_result)} chars")

        # Cleanup cropped images
        worker_logger.info("Cleaning up temporary cropped images...")
        try:
            os.unlink(top_path)
            os.unlink(mid_path)
            os.unlink(bot_path)
            worker_logger.info("Temporary files cleaned up")
        except Exception as cleanup_error:
            worker_logger.warning(f"Failed to cleanup temp files: {cleanup_error}")

        # [3/5] Load organizations
        worker_logger.info("[Step 3/5] Loading organization names...")
        org_section = ""
        org_json_path = Path(__file__).parent / "organizations.json"
        if org_json_path.exists():
            import json
            try:
                with open(org_json_path, "r", encoding="utf-8") as f:
                    org_list = json.load(f)

                if org_list and len(org_list) > 0:
                    worker_logger.info(f"Loaded {len(org_list)} organization names from organizations.json")
                    org_names = "\n".join([f"- {name}" for name in org_list])
                    org_section = f"""
## รายชื่อมูลนิธิที่ถูกต้อง (ใช้แก้ชื่อที่ OCR อ่านผิด):
```
{org_names}
```

**กฎ:** ถ้า OCR อ่านชื่อมูลนิธิผิดเล็กน้อย → จับคู่กับรายชื่อที่ถูกต้องข้างบน

---
"""
                else:
                    worker_logger.info("organizations.json is empty, skipping organization matching")
            except Exception as org_error:
                worker_logger.warning(f"Failed to load organizations.json: {org_error}")
        else:
            worker_logger.info("organizations.json not found, skipping organization matching")

        # [4/5] Step 1: Combine Typhoon Multi-Scale
        worker_logger.info("[Step 4/5] Running LLM Ensemble (Step 1: Combine Multi-Scale)...")
        # Random 2 keys จาก 4 keys สำหรับ LLM
        import random
        llm_keys = random.sample(keys, 2)  # เลือก 2 keys แบบสุ่ม
        worker_logger.info("Selected 2 random API keys for LLM calls")

        worker_logger.info("Initializing OpenAI client for Typhoon LLM...")
        client_step1 = OpenAI(
            base_url="https://api.opentyphoon.ai/v1",
            api_key=llm_keys[0]  # LLM Step 1 ใช้ key แรก
        )

        worker_logger.info("Preparing LLM prompt with OCR results...")
        prompt_step1 = f"""คุณเป็นผู้เชี่ยวชาญในการรวมผลลัพธ์ OCR จากหลาย scales สำหรับเอกสารภาษาไทย
{org_section}
## ผลลัพธ์ Typhoon OCR:

### Full Image OCR (**ใช้เป็นหลัก**):
```
{full_result}
```

### Top Section OCR (1/3 บน):
```
{top_result}
```

### Middle Section OCR (1/3 กลาง):
```
{mid_result}
```

### Bottom Section OCR (1/3 ล่าง):
```
{bot_result}
```

---

## ⚠️ กฎสำคัญ (ต้องปฏิบัติตาม):

### 1. **ห้ามลบหรือข้ามข้อความใดๆ**
   - ❌ ห้ามลบบรรทัด ห้ามข้ามบรรทัด ห้ามสรุป
   - ❌ ห้ามตัดทิ้ง ห้ามย่อ ห้ามเปลี่ยนโครงสร้าง
   - ✅ ต้องเก็บ**ทุกคำ ทุกบรรทัด ทุกข้อความ**จาก Full Image OCR
   - ✅ Output ต้องมีจำนวนบรรทัดใกล้เคียงกับ Full Image OCR

### 2. **ทำได้เฉพาะ: แก้คำผิด**
   - แก้เฉพาะคำที่ OCR อ่านผิด (typo, คำสะกดผิด)
   - เปรียบเทียบกับ Section OCRs เพื่อหาคำที่ถูกต้อง:
     * ส่วนบน (1/3 บน) → เทียบกับ Top Section OCR
     * ส่วนกลาง (1/3 กลาง) → เทียบกับ Middle Section OCR
     * ส่วนล่าง (1/3 ล่าง) → เทียบกับ Bottom Section OCR
   - ตัวอย่าง: Full อ่าน "วัดภูพระสงฆ์" แต่ Mid อ่าน "วัตถุประสงค์" → ใช้ "วัตถุประสงค์"

### 3. **แก้ชื่อมูลนิธิ (ถ้ามี):**
   - **ถ้าชื่อใน OCR คล้ายกับชื่อในรายชื่อ** (เช่น แค่ผิด 1-2 ตัวอักษร) → แก้ให้ตรงกับรายชื่อ
   - **ถ้าชื่อไม่เหมือนกันเลย** → **ห้ามแก้** ให้เก็บชื่อเดิมจาก OCR

### 4. **แก้การสะกดภาษาไทย**
   - แก้คำที่สะกดผิดชัดเจน (เช่น เคหะชุมชน → ถูกต้อง, เคหะชุมนน → ผิด)
   - ใช้ความรู้ภาษาไทยในการแก้

---

## 📋 Output Requirements:
1. ต้องมีจำนนวนบรรทัดใกล้เคียงกับ Full Image OCR (ห้ามน้อยกว่า 70% ของจำนวนบรรทัดต้นฉบับ)
2. ต้องครบทุกส่วนของเอกสาร (หัวเรื่อง, เนื้อหา, หมายเลข, วันที่, ฯลฯ)
3. ตอบเฉพาะข้อความที่รวมแล้ว (ไม่ต้องอธิบาย ไม่ต้องแสดงความคิดเห็น)

ให้ผลลัพธ์ที่รวมและแก้ไขแล้ว (ต้องครบทุกบรรทัด):"""

        worker_logger.info("Calling Typhoon LLM API (typhoon-v2.5-30b-a3b-instruct)...")
        try:
            response_step1 = client_step1.chat.completions.create(
                model="typhoon-v2.5-30b-a3b-instruct",
                messages=[
                    {"role": "system", "content": "รวม OCR จาก scales ต่างๆ โดย**ห้ามลบหรือข้ามข้อความใดๆ** ต้องเก็บทุกบรรทัดจาก Full Image OCR และแก้เฉพาะคำผิดเท่านั้น ตอบเฉพาะข้อความที่รวมแล้ว"},
                    {"role": "user", "content": prompt_step1}
                ],
                temperature=0.1,
                max_tokens=20000
            )
            worker_logger.info("LLM API call completed successfully")
        except Exception as llm_error:
            worker_logger.error(f"LLM API call failed: {str(llm_error)}")
            raise

        typhoon_combined = response_step1.choices[0].message.content
        worker_logger.info(f"LLM combined result: {len(typhoon_combined)} chars")

        # [VALIDATION] Check LLM output
        worker_logger.info("Validating LLM output...")
        if not typhoon_combined or len(typhoon_combined.strip()) == 0:
            worker_logger.error("=" * 80)
            worker_logger.error("❌ LLM VALIDATION FAILED!")
            worker_logger.error("LLM returned empty result!")
            worker_logger.error("")
            worker_logger.error("Input lengths:")
            worker_logger.error(f"  Full: {len(full_result)} chars")
            worker_logger.error(f"  Top: {len(top_result)} chars")
            worker_logger.error(f"  Mid: {len(mid_result)} chars")
            worker_logger.error(f"  Bot: {len(bot_result)} chars")
            worker_logger.error("=" * 80)
            raise RuntimeError("LLM returned empty result")

        # Check if LLM output is too short compared to input (should be at least 50% of Full Image OCR)
        MIN_LLM_RATIO = 0.5  # LLM output ต้องมีความยาวอย่างน้อย 50% ของ Full Image OCR
        full_length = len(full_result.strip())
        llm_length = len(typhoon_combined.strip())
        llm_ratio = llm_length / full_length if full_length > 0 else 0

        if llm_ratio < MIN_LLM_RATIO:
            worker_logger.warning("=" * 80)
            worker_logger.warning("⚠️  LLM OUTPUT TOO SHORT!")
            worker_logger.warning(f"Full Image OCR: {full_length} chars")
            worker_logger.warning(f"LLM Output: {llm_length} chars ({llm_ratio:.1%})")
            worker_logger.warning(f"Expected: At least {MIN_LLM_RATIO:.0%} of Full Image OCR ({int(full_length * MIN_LLM_RATIO)} chars)")
            worker_logger.warning("")
            worker_logger.warning("LLM may have removed content! Using Full Image OCR as fallback.")
            worker_logger.warning("=" * 80)

            # Fallback to Full Image OCR
            final_result = full_result
            worker_logger.info(f"✓ Using Full Image OCR as final result: {len(final_result)} chars")
        else:
            worker_logger.info(f"✓ LLM validation passed: {llm_length} chars ({llm_ratio:.1%} of Full Image)")
            final_result = typhoon_combined

        worker_logger.info("[Step 5/5] Finalizing result...")

        # Log final memory usage
        try:
            import psutil
            process = psutil.Process()
            mem_info = process.memory_info()
            worker_logger.info(f"Memory usage after processing: RSS={mem_info.rss / 1024 / 1024:.2f} MB, VMS={mem_info.vms / 1024 / 1024:.2f} MB")
        except:
            pass

        worker_logger.info(f"OCR Worker completed successfully: {len(final_result)} chars")
        worker_logger.info("=" * 80)
        return final_result, 0.0

    except Exception as e:
        import traceback
        error_msg = f"OCR Error: {str(e)}"
        full_traceback = traceback.format_exc()

        worker_logger.error("=" * 80)
        worker_logger.error(f"OCR Worker FAILED with exception: {error_msg}")
        worker_logger.error("Full traceback:")
        worker_logger.error(full_traceback)
        worker_logger.error("=" * 80)

        # Re-raise exception to propagate to parent process
        # This allows proper error handling in perform_ocr()
        raise RuntimeError(f"{error_msg}\n{full_traceback}") from e

    finally:
        # Clean up temp file
        worker_logger.info("Cleanup: Removing main temporary file...")
        try:
            os.unlink(tmp_path)
            worker_logger.info(f"Cleanup: Successfully removed {tmp_path}")
        except Exception as cleanup_error:
            worker_logger.warning(f"Cleanup: Failed to remove {tmp_path}: {cleanup_error}")


async def perform_ocr(
    image_data: bytes,
    api_key: Union[str, List[str]],
    task_type: str = "v1.5",
    figure_language: str = "Thai"
) -> tuple[str, float]:
    """
    Perform OCR on image data using Multi-OCR + LLM Ensemble.

    Runs in a separate process with 5 parallel OCR engines (multithreading).

    Args:
        image_data: Raw image bytes
        api_key: Single API key or list of 4 keys [full, top, mid, bot]
                 LLM uses keys[0] and keys[1]
        task_type: OCR task type (v1.5, default, structure)
        figure_language: Language for figure analysis

    Returns:
        Tuple of (text, confidence)
    """
    global process_pool

    logger.info(f"perform_ocr called: image_size={len(image_data)} bytes, task_type={task_type}")

    loop = asyncio.get_event_loop()

    try:
        # Run OCR in a separate process with timeout
        logger.info("Submitting OCR task to process pool...")

        result = await asyncio.wait_for(
            loop.run_in_executor(
                process_pool,
                _ocr_worker,
                image_data,
                api_key,
                task_type,
                figure_language
            ),
            timeout=300.0  # 5 minutes timeout
        )

        logger.info("OCR task completed from process pool")
        return result

    except asyncio.TimeoutError:
        error_msg = "OCR task timed out after 300 seconds (5 minutes)"
        logger.error("=" * 80)
        logger.error(f"⏱️  {error_msg}")
        logger.error("This may indicate:")
        logger.error("  1. API rate limiting (Typhoon API)")
        logger.error("  2. Network issues")
        logger.error("  3. Image too large/complex")
        logger.error("  4. LLM API hanging")
        logger.error("=" * 80)
        raise OcrTimeoutError(error_msg)

    except Exception as e:
        logger.error("=" * 80)
        logger.error(f"perform_ocr failed with exception: {str(e)}")
        logger.exception("Full exception traceback:")

        error_str = str(e).lower()

        # Categorize error and raise appropriate custom exception
        if any(keyword in error_str for keyword in ['pool', 'process', 'terminated', 'abruptly', 'broken']):
            logger.critical("🔥 CRITICAL: Process pool crash detected!")
            logger.critical("Possible root causes:")
            logger.critical("  1. Out of Memory (OOM) - worker process killed by system")
            logger.critical("  2. Segmentation fault in native library (PIL, numpy, typhoon-ocr)")
            logger.critical("  3. API key quota exceeded (causing exception in worker)")
            logger.critical("  4. Python multiprocessing serialization issue")
            logger.critical("")
            logger.critical("Recommendations:")
            logger.critical("  - Check Docker memory limits")
            logger.critical("  - Check system logs: docker logs ocr-service")
            logger.critical("  - Increase OCR_MAX_WORKERS for redundancy")
            logger.critical("  - Check Typhoon API key status")
            logger.error("=" * 80)
            raise ProcessPoolCrashError(f"Worker process crashed: {str(e)}") from e

        elif any(keyword in error_str for keyword in ['invalid', 'corrupt', 'cannot identify image', 'truncated']):
            logger.error("Invalid or corrupted image detected")
            logger.error("=" * 80)
            raise InvalidImageError(f"Invalid image data: {str(e)}") from e

        elif any(keyword in error_str for keyword in ['api', 'quota', 'rate limit', '401', '403', '429']):
            logger.error("API error detected (possibly quota/rate limit)")
            logger.error("=" * 80)
            raise OcrApiError(f"API error: {str(e)}") from e

        else:
            # Generic OCR error
            logger.error("=" * 80)
            raise OcrError(f"OCR processing failed: {str(e)}") from e


# =============================================================================
# FASTAPI APP
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global process_pool
    import multiprocessing

    # CRITICAL FIX: Use 'spawn' instead of 'fork' to avoid native library conflicts
    # fork() has issues with OpenCV, PIL, and other native libraries
    multiprocessing.set_start_method('spawn', force=True)

    # Get max workers from env or default to 5 (for 6 cores / 12 GB RAM)
    max_workers = int(os.environ.get('OCR_MAX_WORKERS', '5'))

    logger.info("=" * 80)
    logger.info("🚀 Multi-Scale OCR Microservice starting...")
    logger.info(f"   Max workers: {max_workers} processes")
    logger.info(f"   Multiprocessing mode: spawn (native library compatible)")
    logger.info(f"   Log level: {LOG_LEVEL}")
    logger.info(f"   Using: Typhoon 2.5 Multi-Scale (Full + 3 Crops) + 2-Step LLM Ensemble")
    logger.info(f"   Total: 4 Typhoon engines per image")
    logger.info("=" * 80)

    try:
        process_pool = ProcessPoolExecutor(max_workers=max_workers)
        logger.info(f"✓ Process pool initialized with {max_workers} workers (spawn mode)")
    except Exception as e:
        logger.error(f"✗ Failed to initialize process pool: {str(e)}")
        raise

    yield

    logger.info("=" * 80)
    logger.info("👋 Multi-OCR Microservice shutting down...")
    try:
        process_pool.shutdown(wait=True)
        logger.info("✅ Process pool shut down cleanly")
    except Exception as e:
        logger.error(f"✗ Error during process pool shutdown: {str(e)}")
    logger.info("=" * 80)


app = FastAPI(
    title="Multi-Scale OCR Microservice",
    description="OCR service using Typhoon OCR Multi-Scale (4× OCR + LLM Ensemble) with Thai language optimization",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# ENDPOINTS
# =============================================================================

@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(status="healthy", version="2.0.0")


@app.get("/test-worker")
async def test_worker():
    """Test if _ocr_worker function can be called (for debugging)."""
    import base64

    # Create a small test image (1x1 white pixel JPEG)
    test_image_base64 = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlbaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q=="

    try:
        image_data = base64.b64decode(test_image_base64)
        logger.info(f"Test: Calling _ocr_worker with {len(image_data)} bytes image")

        # Call worker function directly (NOT through process pool)
        result = _ocr_worker(
            image_data=image_data,
            api_key="test-key",
            task_type="v1.5",
            figure_language="Thai"
        )

        return {"success": True, "result_length": len(result[0]), "message": "Worker function works!"}

    except Exception as e:
        import traceback
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }


@app.post("/ocr", response_model=OcrResponse)
async def ocr_image(request: OcrRequest):
    """
    OCR a single image using Multi-OCR Ensemble.

    Accepts base64-encoded image and returns OCR text.
    API key is passed in the request body for flexibility with multiple keys.

    Returns:
        - 200: Success with OCR text
        - 400: Invalid image data
        - 500: Server error (OCR processing failed)
        - 504: Gateway timeout (OCR took too long)
    """
    logger.info("POST /ocr endpoint called")
    try:
        # Decode base64 image
        logger.info("Decoding base64 image...")
        try:
            image_data = base64.b64decode(request.image_base64)
        except Exception as decode_error:
            logger.error(f"Base64 decode failed: {decode_error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid base64 image data: {str(decode_error)}"
            )

        logger.info(f"Image decoded: {len(image_data)} bytes")

        # Perform OCR
        text, confidence = await perform_ocr(
            image_data=image_data,
            api_key=request.api_key,
            task_type=request.task_type,
            figure_language=request.figure_language
        )

        logger.info(f"POST /ocr completed successfully: {len(text)} chars, confidence={confidence}")
        return OcrResponse(
            text=text,
            confidence=confidence,
            success=True
        )

    except InvalidImageError as e:
        logger.error(f"Invalid image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except OcrTimeoutError as e:
        logger.error(f"OCR timeout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(e)
        )

    except OcrApiError as e:
        logger.error(f"OCR API error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )

    except (ProcessPoolCrashError, OcrError) as e:
        logger.error(f"OCR processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    except Exception as e:
        logger.error(f"POST /ocr failed with unexpected error: {str(e)}")
        logger.exception("Full exception traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@app.post("/ocr/upload", response_model=OcrResponse)
async def ocr_upload(
    file: UploadFile = File(...),
    api_key: str = Form(...),
    task_type: str = Form("v1.5"),
    figure_language: str = Form("Thai")
):
    """
    OCR an uploaded image file using Multi-OCR Ensemble.

    Alternative endpoint for direct file upload.

    Returns:
        - 200: Success with OCR text
        - 400: Invalid image file
        - 500: Server error (OCR processing failed)
        - 504: Gateway timeout (OCR took too long)
    """
    logger.info(f"POST /ocr/upload endpoint called: filename={file.filename}")
    try:
        # Read uploaded file
        try:
            image_data = await file.read()
            logger.info(f"File uploaded: {len(image_data)} bytes")
        except Exception as read_error:
            logger.error(f"File read failed: {read_error}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to read uploaded file: {str(read_error)}"
            )

        # Perform OCR
        text, confidence = await perform_ocr(
            image_data=image_data,
            api_key=api_key,
            task_type=task_type,
            figure_language=figure_language
        )

        logger.info(f"POST /ocr/upload completed successfully: {len(text)} chars")
        return OcrResponse(
            text=text,
            confidence=confidence,
            success=True
        )

    except InvalidImageError as e:
        logger.error(f"Invalid image: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

    except OcrTimeoutError as e:
        logger.error(f"OCR timeout: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(e)
        )

    except OcrApiError as e:
        logger.error(f"OCR API error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )

    except (ProcessPoolCrashError, OcrError) as e:
        logger.error(f"OCR processing error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    except Exception as e:
        logger.error(f"POST /ocr/upload failed with unexpected error: {str(e)}")
        logger.exception("Full exception traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@app.post("/ocr/batch", response_model=BatchOcrResponse)
async def ocr_batch(request: BatchOcrRequest):
    """
    OCR multiple images in parallel using Multi-OCR Ensemble.

    Useful for processing multiple pages concurrently.
    Each image should have an 'id' field for tracking.
    """
    logger.info(f"POST /ocr/batch endpoint called: {len(request.images)} images")

    async def process_single(item: dict) -> dict:
        item_id = item.get("id", "unknown")
        try:
            logger.info(f"  → Processing batch item: {item_id}")
            image_data = base64.b64decode(item["image_base64"])
            text, confidence = await perform_ocr(
                image_data=image_data,
                api_key=request.api_key,
                task_type=request.task_type,
                figure_language=request.figure_language
            )
            logger.info(f"  ✓ Batch item completed: {item_id} ({len(text)} chars)")
            return {
                "id": item_id,
                "text": text,
                "confidence": confidence,
                "success": True,
                "error": None,
                "error_type": None
            }
        except InvalidImageError as e:
            logger.error(f"  ✗ Batch item failed (invalid image): {item_id} - {str(e)}")
            return {
                "id": item_id,
                "text": "",
                "confidence": 0.0,
                "success": False,
                "error": str(e),
                "error_type": "invalid_image"
            }
        except OcrTimeoutError as e:
            logger.error(f"  ✗ Batch item failed (timeout): {item_id} - {str(e)}")
            return {
                "id": item_id,
                "text": "",
                "confidence": 0.0,
                "success": False,
                "error": str(e),
                "error_type": "timeout"
            }
        except OcrApiError as e:
            logger.error(f"  ✗ Batch item failed (API error): {item_id} - {str(e)}")
            return {
                "id": item_id,
                "text": "",
                "confidence": 0.0,
                "success": False,
                "error": str(e),
                "error_type": "api_error"
            }
        except ProcessPoolCrashError as e:
            logger.error(f"  ✗ Batch item failed (process crash): {item_id} - {str(e)}")
            return {
                "id": item_id,
                "text": "",
                "confidence": 0.0,
                "success": False,
                "error": str(e),
                "error_type": "process_crash"
            }
        except Exception as e:
            logger.error(f"  ✗ Batch item failed (unknown): {item_id} - {str(e)}")
            logger.exception("Full exception traceback:")
            return {
                "id": item_id,
                "text": "",
                "confidence": 0.0,
                "success": False,
                "error": str(e),
                "error_type": "unknown"
            }

    # Process all images in parallel
    logger.info("Starting parallel batch processing...")
    tasks = [process_single(item) for item in request.images]
    results = await asyncio.gather(*tasks)

    success_count = sum(1 for r in results if r.get("success"))
    logger.info(f"POST /ocr/batch completed: {success_count}/{len(results)} successful")

    return BatchOcrResponse(results=list(results))


@app.post("/organizations/sync", response_model=SyncOrganizationsResponse)
async def sync_organizations(request: SyncOrganizationsRequest):
    """
    Sync organization names to organizations.json file.

    This endpoint updates the list of correct organization names
    used for OCR correction.
    """
    try:
        import json

        org_json_path = Path(__file__).parent / "organizations.json"

        # Write to organizations.json
        with open(org_json_path, "w", encoding="utf-8") as f:
            json.dump(request.organizations, f, ensure_ascii=False, indent=4)

        return SyncOrganizationsResponse(
            success=True,
            count=len(request.organizations),
            message=f"Successfully synced {len(request.organizations)} organization(s)"
        )

    except Exception as e:
        return SyncOrganizationsResponse(
            success=False,
            count=0,
            message=f"Error: {str(e)}"
        )


@app.get("/organizations", response_model=dict)
async def get_organizations():
    """
    Get current list of organization names from organizations.json.
    """
    try:
        import json

        org_json_path = Path(__file__).parent / "organizations.json"

        if not org_json_path.exists():
            return {"organizations": [], "count": 0}

        with open(org_json_path, "r", encoding="utf-8") as f:
            orgs = json.load(f)

        return {"organizations": orgs, "count": len(orgs)}

    except Exception as e:
        return {"organizations": [], "count": 0, "error": str(e)}


# =============================================================================
# MAIN
# =============================================================================

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        workers=1  # Use 1 worker, async handles concurrency
    )
