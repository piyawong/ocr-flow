"""
OCR Microservice using Typhoon OCR API.

This service wraps the typhoon-ocr Python library to provide
OCR capabilities via HTTP API, supporting parallel requests.

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
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Typhoon OCR library
from typhoon_ocr import ocr_document


# =============================================================================
# MODELS
# =============================================================================

class OcrRequest(BaseModel):
    """Request model for OCR endpoint."""
    image_base64: str
    api_key: str
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
    api_key: str
    task_type: str = "v1.5"
    figure_language: str = "Thai"


class BatchOcrResponse(BaseModel):
    """Response model for batch OCR endpoint."""
    results: list[dict]  # [{id, text, success, error}, ...]


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str


# =============================================================================
# OCR FUNCTIONS
# =============================================================================

def post_process_ocr_text(text: str) -> str:
    """
    Post-process OCR text to fix common Thai OCR errors.

    Fixes:
    - ไม้หันอากาศ + สระอา → สระอำ
    - Remove # characters
    - Fix common Thai word errors
    - Convert Thai numerals to Arabic numerals
    """
    result = text

    # Fix ไม้หันอากาศ + สระอา → สระอำ (common OCR error)
    result = result.replace("ํา", "ำ")

    # Remove # characters from OCR result
    result = result.replace("#", "")

    # Fix common Thai word OCR errors
    result = result.replace("เบ็ดเกลัด", "เบ็ดเตล็ด")

    # Convert Thai numerals to Arabic numerals
    thai_numerals = ['๐', '๑', '๒', '๓', '๔', '๕', '๖', '๗', '๘', '๙']
    for i, thai_num in enumerate(thai_numerals):
        result = result.replace(thai_num, str(i))

    return result


async def perform_ocr(
    image_data: bytes,
    api_key: str,
    task_type: str = "v1.5",
    figure_language: str = "Thai"
) -> tuple[str, float]:
    """
    Perform OCR on image data using Typhoon OCR API.

    Args:
        image_data: Raw image bytes
        api_key: Typhoon OCR API key
        task_type: OCR task type (v1.5, default, structure)
        figure_language: Language for figure analysis

    Returns:
        Tuple of (text, confidence)
    """
    # Save image to temp file (typhoon_ocr requires file path)
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tmp:
        tmp.write(image_data)
        tmp_path = tmp.name

    try:
        # Temporarily set API key for this request
        original_key = os.environ.get('TYPHOON_API_KEY')
        os.environ['TYPHOON_API_KEY'] = api_key

        try:
            # Run OCR in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            markdown = await loop.run_in_executor(
                None,
                lambda: ocr_document(
                    pdf_or_image_path=tmp_path,
                    model="typhoon-ocr",
                    figure_language=figure_language,
                    task_type=task_type
                )
            )

            # Post-process OCR text
            processed_text = post_process_ocr_text(markdown)

            return processed_text, 0.0

        finally:
            # Restore original key
            if original_key:
                os.environ['TYPHOON_API_KEY'] = original_key
            elif 'TYPHOON_API_KEY' in os.environ:
                del os.environ['TYPHOON_API_KEY']

    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except:
            pass


# =============================================================================
# FASTAPI APP
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("🚀 OCR Microservice starting...")
    yield
    print("👋 OCR Microservice shutting down...")


app = FastAPI(
    title="Typhoon OCR Microservice",
    description="OCR service using Typhoon OCR API with Thai language optimization",
    version="1.0.0",
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
    return HealthResponse(status="healthy", version="1.0.0")


@app.post("/ocr", response_model=OcrResponse)
async def ocr_image(request: OcrRequest):
    """
    OCR a single image.

    Accepts base64-encoded image and returns OCR text.
    API key is passed in the request body for flexibility with multiple keys.
    """
    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image_base64)

        # Perform OCR
        text, confidence = await perform_ocr(
            image_data=image_data,
            api_key=request.api_key,
            task_type=request.task_type,
            figure_language=request.figure_language
        )

        return OcrResponse(
            text=text,
            confidence=confidence,
            success=True
        )

    except Exception as e:
        return OcrResponse(
            text="",
            confidence=0.0,
            success=False,
            error=str(e)
        )


@app.post("/ocr/upload", response_model=OcrResponse)
async def ocr_upload(
    file: UploadFile = File(...),
    api_key: str = Form(...),
    task_type: str = Form("v1.5"),
    figure_language: str = Form("Thai")
):
    """
    OCR an uploaded image file.

    Alternative endpoint for direct file upload.
    """
    try:
        # Read uploaded file
        image_data = await file.read()

        # Perform OCR
        text, confidence = await perform_ocr(
            image_data=image_data,
            api_key=api_key,
            task_type=task_type,
            figure_language=figure_language
        )

        return OcrResponse(
            text=text,
            confidence=confidence,
            success=True
        )

    except Exception as e:
        return OcrResponse(
            text="",
            confidence=0.0,
            success=False,
            error=str(e)
        )


@app.post("/ocr/batch", response_model=BatchOcrResponse)
async def ocr_batch(request: BatchOcrRequest):
    """
    OCR multiple images in parallel.

    Useful for processing multiple pages concurrently.
    Each image should have an 'id' field for tracking.
    """
    async def process_single(item: dict) -> dict:
        try:
            image_data = base64.b64decode(item["image_base64"])
            text, confidence = await perform_ocr(
                image_data=image_data,
                api_key=request.api_key,
                task_type=request.task_type,
                figure_language=request.figure_language
            )
            return {
                "id": item.get("id"),
                "text": text,
                "confidence": confidence,
                "success": True,
                "error": None
            }
        except Exception as e:
            return {
                "id": item.get("id"),
                "text": "",
                "confidence": 0.0,
                "success": False,
                "error": str(e)
            }

    # Process all images in parallel
    tasks = [process_single(item) for item in request.images]
    results = await asyncio.gather(*tasks)

    return BatchOcrResponse(results=list(results))


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
