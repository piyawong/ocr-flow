"""
OCR and PDF module for OCR flow processing.

This module contains:
- ocr_image_typhoon() - Perform OCR using Typhoon OCR API
- create_pdf_from_images() - Create PDF from image files
"""

from __future__ import annotations
import os
import sys
from pathlib import Path

import img2pdf
from typhoon_ocr import ocr_document

# Import utils - handle both package and direct execution
try:
    from .utils import log
except ImportError:
    from utils import log


# =============================================================================
# OCR FUNCTIONS
# =============================================================================

def ocr_image_typhoon(image_path: Path, api_key: str) -> tuple[str, float]:
    """
    OCR image using Typhoon OCR API.

    Args:
        image_path: Path to image file
        api_key: Typhoon OCR API key

    Returns:
        Tuple of (text, confidence)
        - text: OCR result text (with common OCR errors fixed)
        - confidence: Always 0.0 since Typhoon doesn't provide confidence score
    """
    try:
        # Temporarily set API key for this request
        original_key = os.environ.get('TYPHOON_API_KEY')
        os.environ['TYPHOON_API_KEY'] = api_key

        try:
            # Use Typhoon OCR v1.5 with Thai language optimization
            markdown = ocr_document(
                pdf_or_image_path=str(image_path),
                model="typhoon-ocr",           # Use v1.5 (faster, more robust)
                figure_language="Thai",        # Optimize for Thai documents
                task_type="v1.5"              # Single-prompt architecture (faster)
            )

            # Fix common OCR errors: ไม้หันอากาศ + สระอา → สระอำ
            markdown = markdown.replace("ํา", "ำ")
            # Remove # character from OCR result
            markdown = markdown.replace("#", "")
            # Fix common Thai word OCR errors
            markdown = markdown.replace("เบ็ดเกลัด", "เบ็ดเตล็ด")
            # Typhoon OCR doesn't provide confidence score, return 0.0
            return markdown, 0.0
        finally:
            # Restore original key
            if original_key:
                os.environ['TYPHOON_API_KEY'] = original_key
            elif 'TYPHOON_API_KEY' in os.environ:
                del os.environ['TYPHOON_API_KEY']
    except Exception as e:
        log(f"❌ Error OCR image {image_path.name}: {e}")
        return "", 0.0


# =============================================================================
# PDF FUNCTIONS
# =============================================================================

def create_pdf_from_images(image_paths: list[Path], output_path: Path):
    """
    Create a PDF from images using img2pdf.

    Args:
        image_paths: List of image file paths
        output_path: Path to save PDF file

    Raises:
        Exception: If PDF creation fails
    """
    images_bytes = []
    for img_path in image_paths:
        with open(img_path, 'rb') as f:
            images_bytes.append(f.read())

    pdf_bytes = img2pdf.convert(images_bytes)
    with open(output_path, 'wb') as f:
        f.write(pdf_bytes)
