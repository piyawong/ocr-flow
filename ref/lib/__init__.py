"""
OCR Flow Processing Library

This library contains modules for processing OCR documents:

## Modules

### config.py
Configuration constants and settings:
- FUZZY_THRESHOLD: Threshold for fuzzy pattern matching (0-100)
- API_BASE_URL: Base URL for API endpoints
- API_TIMEOUT: Timeout for API requests (seconds)
- UPLOAD_TIMEOUT: Timeout for file uploads (seconds)

### templates.py
Document template management:
- DocumentTemplate: Dataclass defining document template structure
- UNMATCHED_TEMPLATE: Default template for unmatched documents
- load_templates(): Load templates from JSON file

### utils.py
Utility functions:
- log(): Print timestamped log messages
- get_processable_folders(): Get folders ready to process
- get_sorted_images(): Get sorted image files from folder
- mark_folder_as_labeled(): Mark folder as processed

### ocr.py
OCR and PDF operations:
- ocr_image_typhoon(): Perform OCR using Typhoon OCR API
- create_pdf_from_images(): Create PDF from image files

### pattern_matching.py
Pattern matching logic:
- text_matches_single_pattern(): Check if text matches a single pattern
- text_matches_patterns(): Check if text matches any pattern (OR/AND logic)
- find_matching_template(): Find best matching template for text
- get_full_match_info(): Get detailed match information for summary

### document_grouping.py
Document grouping logic:
- DocumentGroup: Dataclass representing a group of pages forming a document
- group_pages_by_patterns(): Group pages into documents based on template patterns

### data_parsing.py
Data extraction from OCR text:
- parse_foundation_instrument_data(): Extract structured data from foundation instrument OCR
- parse_committee_members_data(): Extract structured data from committee members OCR

### api_client.py
API communication:
- send_foundation_data_to_api(): Send foundation data to API
- upload_pdfs_to_api(): Upload PDF files to API
- upload_logo_to_api(): Upload logo image to API
- create_folder_via_api(): Create folder in API
- upload_pdf_file(): Upload single PDF file

## Usage Example

```python
from lib.config import FUZZY_THRESHOLD
from lib.templates import load_templates
from lib.utils import log, get_sorted_images
from lib.ocr import ocr_image_typhoon, create_pdf_from_images
from lib.pattern_matching import find_matching_template
from lib.document_grouping import group_pages_by_patterns
from lib.data_parsing import parse_foundation_instrument_data
from lib.api_client import send_foundation_data_to_api

# Load templates
templates = load_templates(Path("templates.json"))

# Get images
images = get_sorted_images(Path("folder"))

# OCR images
ocr_texts = {}
for idx, img_path in enumerate(images, 1):
    text, confidence = ocr_image_typhoon(img_path, api_key)
    ocr_texts[idx] = text

# Group pages into documents
documents, unmatched, incomplete = group_pages_by_patterns(ocr_texts, templates)

# Parse data
foundation_data = parse_foundation_instrument_data(ocr_texts, documents[0])

# Send to API
send_foundation_data_to_api(folder_id, output_folder)
```
"""

# Export all public symbols
from .config import FUZZY_THRESHOLD, API_BASE_URL, API_TIMEOUT, UPLOAD_TIMEOUT
from .templates import DocumentTemplate, UNMATCHED_TEMPLATE, load_templates
from .utils import log, get_processable_folders, get_sorted_images, mark_folder_as_labeled
from .ocr import ocr_image_typhoon, create_pdf_from_images
from .pattern_matching import (
    text_matches_single_pattern,
    text_matches_patterns,
    find_matching_template,
    get_full_match_info
)
from .document_grouping import DocumentGroup, group_pages_by_patterns
from .data_parsing import parse_foundation_instrument_data, parse_committee_members_data
from .api_client import (
    send_foundation_data_to_api,
    upload_pdfs_to_api,
    upload_logo_to_api,
    create_folder_via_api,
    upload_pdf_file
)

__all__ = [
    # Config
    "FUZZY_THRESHOLD",
    "API_BASE_URL",
    "API_TIMEOUT",
    "UPLOAD_TIMEOUT",
    # Templates
    "DocumentTemplate",
    "UNMATCHED_TEMPLATE",
    "load_templates",
    # Utils
    "log",
    "get_processable_folders",
    "get_sorted_images",
    "mark_folder_as_labeled",
    # OCR
    "ocr_image_typhoon",
    "create_pdf_from_images",
    # Pattern Matching
    "text_matches_single_pattern",
    "text_matches_patterns",
    "find_matching_template",
    "get_full_match_info",
    # Document Grouping
    "DocumentGroup",
    "group_pages_by_patterns",
    # Data Parsing
    "parse_foundation_instrument_data",
    "parse_committee_members_data",
    # API Client
    "send_foundation_data_to_api",
    "upload_pdfs_to_api",
    "upload_logo_to_api",
    "create_folder_via_api",
    "upload_pdf_file",
]

__version__ = "1.0.0"
