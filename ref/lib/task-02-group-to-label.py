#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = [
#     "typhoon-ocr",
#     "pillow",
#     "img2pdf",
#     "rapidfuzz",
#     "python-dotenv",
#     "opencv-python",
#     "numpy",
# ]
# ///
"""
Task: Convert grouped images to PDF + OCR text using Typhoon OCR API
Logic:
- Pick folders from 02-group/ that don't have "-temp" or "-label" suffix
- OCR each image using Typhoon OCR API → save as .txt
- Read OCR text and match patterns to group into documents
- Create separate PDFs for each matched document
- Output to 03-label/{folder_id}/
- Rename processed folder to {id}-label or {id}-incomplete
- Load API key from .env file

NOTE: Most logic has been refactored into lib/ modules.
      Read lib/README.md for detailed module documentation.
"""

from __future__ import annotations
import json
import sys
import os
import re
from pathlib import Path
from datetime import datetime
from dotenv import load_dotenv
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

# Import from lib modules
# See lib/README.md for detailed documentation of each module
from lib import (
    # Utils
    log,
    get_processable_folders,
    get_sorted_images,
    mark_folder_as_labeled,

    # Templates
    load_templates,
    UNMATCHED_TEMPLATE,

    # OCR
    ocr_image_typhoon,
    create_pdf_from_images,

    # Document Grouping
    group_pages_by_patterns,

    # Data Parsing
    parse_foundation_instrument_data,
    parse_committee_members_data,

    # API Client
    send_foundation_data_to_api,
    upload_pdfs_to_api,
    upload_logo_to_api,
)

# Import logo extractor (not yet refactored into lib)
from logo_extractor import LogoExtractorFlexible

# Load environment variables from .env
load_dotenv()


# =============================================================================
# MAIN PROCESSING
# =============================================================================

def process_folder(folder_id: int, folder: Path, label_dir: Path, templates: list, api_keys: list[str]) -> tuple[bool, bool]:
    """
    Process a single folder - OCR images, match patterns, create PDFs.

    Args:
        folder_id: Folder ID to process
        folder: Path to folder containing images
        label_dir: Output directory (03-label/)
        templates: List of DocumentTemplate objects
        api_keys: List of 2 API keys for parallel processing

    Returns:
        Tuple of (success, has_unmatched)
        - success: True if processing completed
        - has_unmatched: True if there are unmatched or incomplete pages
    """
    log(f"📁 Processing folder {folder_id}...")

    # Rename folder to -label immediately to prevent reprocessing in auto mode
    mark_folder_as_labeled(folder, has_unmatched=False)
    log(f"  ✓ Folder renamed to {folder_id}-label (locked for processing)")

    # Update folder path to new renamed folder
    folder = folder.parent / f"{folder_id}-label"

    images = get_sorted_images(folder)
    if not images:
        log(f"  [Folder {folder_id}] No images found")
        return False, False

    log(f"  [Folder {folder_id}] Found {len(images)} images")

    # Create output folder
    output_folder = label_dir / str(folder_id)
    output_folder.mkdir(parents=True, exist_ok=True)

    # Check if OCR already done (ocrs/combined.txt exists)
    combined_path = output_folder / "ocrs" / "combined.txt"
    skip_ocr = combined_path.exists()

    if skip_ocr:
        log(f"  ✓ OCR already done - loading existing OCR data...")

    # ==========================================================================
    # Step 1: OCR all images first (using 2 threads for parallel processing)
    # ==========================================================================
    ocr_texts: dict[int, str] = {}  # page_num -> text
    ocr_confidence: dict[int, float] = {}  # page_num -> confidence
    image_by_page: dict[int, Path] = {}  # page_num -> image_path

    # Create ocrs subdirectory
    ocrs_dir = output_folder / "ocrs"
    ocrs_dir.mkdir(parents=True, exist_ok=True)

    if skip_ocr:
        # Load existing OCR results
        for idx, img_path in enumerate(images, 1):
            txt_path = ocrs_dir / f"{idx}.txt"
            if txt_path.exists():
                with open(txt_path, 'r', encoding='utf-8') as f:
                    ocr_texts[idx] = f.read()
                ocr_confidence[idx] = 1.0  # Assume good quality
                image_by_page[idx] = img_path
        log(f"  ✓ Loaded {len(ocr_texts)} existing OCR results")
    else:
        log(f"  Step 1: OCR all images (2 threads with separate API keys)...")

        # Thread-safe lock for writing results
        lock = threading.Lock()

        def process_image(idx: int, img_path: Path, api_key: str):
            """Process a single image with OCR"""
            try:
                text, confidence = ocr_image_typhoon(img_path, api_key)

                # Thread-safe write to shared dictionaries
                with lock:
                    ocr_texts[idx] = text
                    ocr_confidence[idx] = confidence
                    image_by_page[idx] = img_path

                # Save individual text file to ocrs/ folder
                txt_path = ocrs_dir / f"{idx}.txt"
                with open(txt_path, 'w', encoding='utf-8') as f:
                    f.write(text)

                return (idx, img_path.name, True, None)

            except Exception as e:
                # Thread-safe write error
                with lock:
                    ocr_texts[idx] = f"[OCR Error: {e}]"
                    ocr_confidence[idx] = 0.0
                    image_by_page[idx] = img_path

                return (idx, img_path.name, False, str(e))

        # Use ThreadPoolExecutor with 2 workers (one per API key)
        with ThreadPoolExecutor(max_workers=2) as executor:
            # Submit all tasks with round-robin API key assignment
            futures = {
                executor.submit(process_image, idx, img_path, api_keys[(idx - 1) % 2]): (idx, img_path)
                for idx, img_path in enumerate(images, 1)
            }

            # Process results as they complete
            for future in as_completed(futures):
                idx, img_name, success, error = future.result()
                if success:
                    log(f"    OCR [{idx}/{len(images)}]: {img_name} ✓")
                else:
                    log(f"    OCR [{idx}/{len(images)}]: {img_name} ✗ ERROR: {error}")

        # Save combined text (all pages) to ocrs/
        all_texts = [f"=== Page {i} ===\n{ocr_texts[i]}" for i in sorted(ocr_texts.keys())]
        combined_path = ocrs_dir / "combined.txt"
        with open(combined_path, 'w', encoding='utf-8') as f:
            f.write('\n\n'.join(all_texts))
        log(f"  Saved: ocrs/combined.txt")

    # ==========================================================================
    # Step 2: Match patterns and group pages
    # ==========================================================================
    log(f"  Step 2: Match patterns...")
    documents, unmatched, incomplete_docs = group_pages_by_patterns(ocr_texts, templates)

    # Report unmatched pages but continue
    if unmatched:
        log(f"")
        log(f"  ⚠️  ALERT: Found {len(unmatched)} unmatched pages!")
        log(f"  ⚠️  Unmatched pages: {unmatched}")
        for page_num in unmatched:
            txt_file = output_folder / f"{page_num}.txt"
            log(f"  ⚠️  Page {page_num}: {txt_file}")
            # Show first 100 chars of text for debugging
            preview = ocr_texts[page_num][:100].replace('\n', ' ')
            log(f"      Preview: {preview}...")
        log(f"")

    if not documents and not incomplete_docs:
        log(f"  ⚠️  No documents matched any template")
        log(f"  ❌ STOPPED: No documents found")
        return False, True  # has_unmatched=True because no documents matched

    log(f"  Found {len(documents)} complete documents")

    # ==========================================================================
    # Step 3: Create PDFs for each matched document
    # ==========================================================================
    is_checked_pdfs = False

    if documents:
        log(f"  Step 3: Create PDFs...")

        # Create pdfs subdirectory
        pdfs_dir = output_folder / "pdfs"
        pdfs_dir.mkdir(parents=True, exist_ok=True)

        # Track created filenames to handle duplicates
        created_files = {}

        # Track template matching info for config.json
        page_template_map = {}

        for doc in documents:
            pdf_name = doc.template.name
            category = doc.template.category
            doc_images = [image_by_page[p] for p in doc.pages]

            # Handle duplicate filenames by adding -1, -2, etc.
            base_name = pdf_name
            if base_name in created_files:
                created_files[base_name] += 1
                # Split name and extension
                parts = base_name.rsplit('.', 1)
                if len(parts) == 2:
                    pdf_name = f"{parts[0]}-{created_files[base_name]}.{parts[1]}"
                else:
                    pdf_name = f"{base_name}-{created_files[base_name]}"
            else:
                created_files[base_name] = 0

            # กำหนด path ตาม category ใน pdfs/ folder
            if category:
                # สร้าง folder ตาม category ถ้ายังไม่มี ใน pdfs/
                category_folder = pdfs_dir / category
                category_folder.mkdir(parents=True, exist_ok=True)
                pdf_path = category_folder / pdf_name
                display_path = f"pdfs/{category}/{pdf_name}"
            else:
                pdf_path = pdfs_dir / pdf_name
                display_path = f"pdfs/{pdf_name}"

            try:
                create_pdf_from_images(doc_images, pdf_path)
                log(f"    Created: {display_path} (pages {doc.start_page}-{doc.end_page}, {len(doc.pages)} pages)")

                # Record template matching info
                for idx, page_num in enumerate(doc.pages):
                    page_info = {
                        "template": doc.template.name,
                        "category": category or "root",
                        "status": "matched"
                    }

                    # Add matching info for start and end pages
                    if idx == 0:
                        # First page - show what matched the start pattern
                        page_info["page_type"] = "start"
                        page_info["match_reason"] = doc.start_match_info
                        if doc.start_negative_match:
                            page_info["negative_match"] = doc.start_negative_match
                    elif idx == len(doc.pages) - 1:
                        # Last page - show what matched the end pattern
                        page_info["page_type"] = "end"
                        page_info["match_reason"] = doc.end_match_info
                        if doc.end_negative_match:
                            page_info["negative_match"] = doc.end_negative_match
                    else:
                        # Middle pages
                        page_info["page_type"] = "middle"

                    page_template_map[page_num] = page_info
            except Exception as e:
                log(f"    ERROR creating {display_path}: {e}")
                return False, False

        is_checked_pdfs = True  # Mark as checked after successfully creating all PDFs
    else:
        log(f"  Step 3: Skipped - No complete documents to create PDFs")
        page_template_map = {}
        is_checked_pdfs = True  # Mark as checked even if skipped

    # ==========================================================================
    # Step 3.5: Extract logo from first page of ตราสาร.pdf
    # ==========================================================================
    log(f"  Step 3.5: Extract logo from ตราสาร.pdf...")
    is_have_logo = False
    is_checked_logo = False

    # Find ตราสาร.pdf document
    foundation_doc = None
    for doc in documents:
        if doc.template.name == "ตราสาร.pdf":
            foundation_doc = doc
            break

    if foundation_doc and foundation_doc.pages:
        first_page_num = foundation_doc.pages[0]
        first_page_image = image_by_page.get(first_page_num)

        if first_page_image:
            logo_path = output_folder / "logo.png"
            try:
                extractor = LogoExtractorFlexible(min_area=2000, max_aspect_ratio=3.0)
                result = extractor.extract_logo(
                    first_page_image,
                    logo_path,
                    resize=(500, 500),
                    keep_aspect_ratio=True
                )

                if result['success']:
                    is_have_logo = True
                    log(f"  ✓ Logo extracted from page {first_page_num} (ตราสาร.pdf)")
                    log(f"     Score: {result.get('selected_score', 0):.2f}, "
                        f"Solidity: {result.get('solidity', 0):.2f}, "
                        f"Compactness: {result.get('compactness', 0):.2f}")
                    log(f"     Saved: logo.png")
                else:
                    log(f"  ⚠️  No logo found on page {first_page_num}")

                is_checked_logo = True
            except Exception as e:
                log(f"  ⚠️  Failed to extract logo: {e}")
                is_checked_logo = True
        else:
            log(f"  ⚠️  First page image of ตราสาร.pdf not found")
            is_checked_logo = True
    else:
        log(f"  ⚠️  ตราสาร.pdf not found - cannot extract logo")
        is_checked_logo = True

    # ==========================================================================
    # Step 4: Create summary.md
    # ==========================================================================
    log(f"  Step 4: Create summary.md...")
    summary_lines = [f"# OCR Summary for Folder {folder_id}\n\n"]
    summary_lines.append(f"## Total Pages: {len(images)}\n\n")
    summary_lines.append(f"## Matched Pages: {len(images) - len(unmatched)}\n\n")
    if unmatched:
        summary_lines.append(f"## Unmatched Pages: {len(unmatched)} ❌\n\n")

    summary_lines.append("## Page-to-Template Mapping\n\n")
    summary_lines.append("| Page | Template | Status | Match Info | Confidence |\n")
    summary_lines.append("|------|----------|--------|------------|------------|\n")

    for doc in documents:
        for idx, page_num in enumerate(doc.pages):
            conf = ocr_confidence.get(page_num, 0.0)
            conf_pct = f"{conf * 100:.1f}%" if conf > 0 else "N/A"

            # Determine page status and match info
            if len(doc.pages) == 1:
                status = "Single page"
                match_info = f"Start: {doc.start_match_info} / End: {doc.end_match_info}"
            elif idx == 0:
                status = "Start"
                match_info = doc.start_match_info
            elif idx == len(doc.pages) - 1:
                status = "End"
                match_info = doc.end_match_info
            else:
                status = "Continue"
                match_info = "-"

            summary_lines.append(f"| {page_num} | {doc.template.name} | {status} | {match_info} | {conf_pct} |\n")

    # Add incomplete documents section
    if incomplete_docs:
        summary_lines.append("\n## Incomplete Documents (Started but no last page found) ⚠️\n\n")
        for incomplete_doc in incomplete_docs:
            summary_lines.append(f"### {incomplete_doc.template.name}\n")
            summary_lines.append(f"- **Pages**: {incomplete_doc.pages[0]}-{incomplete_doc.pages[-1]} ({len(incomplete_doc.pages)} pages)\n")
            summary_lines.append(f"- **Start Match**: {incomplete_doc.start_match_info}\n")
            summary_lines.append(f"- **Looking for**: {incomplete_doc.template.last_page_patterns}\n")
            summary_lines.append(f"- **Issue**: Last page pattern not found\n\n")

            # Show page details
            summary_lines.append("| Page | Status | Preview | Confidence |\n")
            summary_lines.append("|------|--------|---------|------------|\n")
            for idx, page_num in enumerate(incomplete_doc.pages):
                conf = ocr_confidence.get(page_num, 0.0)
                conf_pct = f"{conf * 100:.1f}%" if conf > 0 else "N/A"
                preview = ocr_texts[page_num][:60].replace('\n', ' ')
                if idx == 0:
                    status = "START"
                else:
                    status = "Continue"
                summary_lines.append(f"| {page_num} | {status} | {preview}... | {conf_pct} |\n")
            summary_lines.append("\n")

    # Add truly unmatched pages section (pages not in any document or incomplete document)
    incomplete_pages = set()
    for incomplete_doc in incomplete_docs:
        incomplete_pages.update(incomplete_doc.pages)

    truly_unmatched = [p for p in unmatched if p not in incomplete_pages]

    if truly_unmatched:
        summary_lines.append("\n## Unmatched Pages (Need Manual Review)\n\n")
        summary_lines.append("| Page | Preview | Confidence |\n")
        summary_lines.append("|------|---------|------------|\n")
        for page_num in truly_unmatched:
            conf = ocr_confidence.get(page_num, 0.0)
            conf_pct = f"{conf * 100:.1f}%" if conf > 0 else "N/A"
            preview = ocr_texts[page_num][:80].replace('\n', ' ')
            summary_lines.append(f"| {page_num} | {preview}... | {conf_pct} |\n")

    summary_path = output_folder / "summary.md"
    with open(summary_path, 'w', encoding='utf-8') as f:
        f.writelines(summary_lines)
    log(f"  Saved: summary.md")

    # ==========================================================================
    # Step 4.5: Create skeleton JSON files (will be filled with data later)
    # ==========================================================================
    log(f"  Step 4.5: Create skeleton JSON files...")

    # Create foundation-instrument.json skeleton
    foundation_skeleton = {
        "name": None,
        "shortName": None,
        "address": None,
        "logoDescription": None,
        "charterSections": []
    }
    foundation_path = output_folder / "foundation-instrument.json"
    with open(foundation_path, 'w', encoding='utf-8') as f:
        json.dump(foundation_skeleton, f, indent=2, ensure_ascii=False)
    log(f"  Created skeleton: foundation-instrument.json")

    # Create committee-members.json skeleton
    committee_skeleton = {
        "committeeMembers": []
    }
    committee_path = output_folder / "committee-members.json"
    with open(committee_path, 'w', encoding='utf-8') as f:
        json.dump(committee_skeleton, f, indent=2, ensure_ascii=False)
    log(f"  Created skeleton: committee-members.json")

    # ==========================================================================
    # Step 5: Create config.json - Track template matching for each page
    # ==========================================================================
    log(f"  Step 5: Create config.json...")

    # Identify pages in incomplete documents (started but no last_page found)
    incomplete_pages = set()
    for incomplete_doc in incomplete_docs:
        incomplete_pages.update(incomplete_doc.pages)

    # Identify truly unmatched pages (no first_page_pattern matched)
    truly_unmatched = [p for p in unmatched if p not in incomplete_pages]

    # Add pages to config with reason information
    for page_num in unmatched:
        if page_num in incomplete_pages:
            # This page is part of an incomplete document
            page_template_map[page_num] = {
                "template": None,
                "category": None,
                "status": "incomplete",
                "reason": "no_last_page_found"  # started as document but last_page_pattern not found
            }
        else:
            # This page is truly unmatched
            page_template_map[page_num] = {
                "template": "เอกสารไม่มีชื่อ.pdf",
                "category": "unmatched",
                "status": "unmatched",
                "reason": "no_first_page_match"  # couldn't find any matching first_page_pattern
            }

    # Calculate overall status
    total_matched = len(images) - len(unmatched)
    is_all_matched = len(unmatched) == 0

    # Check if "ตราสาร.pdf" exists in matched documents
    # Collect all committee member documents
    foundation_doc = None
    committee_docs = []  # Changed to list to support multiple files
    for doc in documents:
        if doc.template.name == "ตราสาร.pdf":
            foundation_doc = doc
        elif doc.template.name == "บัญชีรายชื่อกรรมการมูลนิธิ.pdf":
            committee_docs.append(doc)

    has_foundation_instrument = foundation_doc is not None
    has_committee_members = len(committee_docs) > 0

    # Check for committee member file warnings and validate continuity
    committee_warnings = []
    committee_files_continuous = True

    if len(committee_docs) > 1:
        log(f"  ℹ️  Found {len(committee_docs)} บัญชีรายชื่อกรรมการมูลนิธิ files")
        for idx, doc in enumerate(committee_docs):
            log(f"      File {idx+1}: pages {doc.pages[0]}-{doc.pages[-1]}")

        # Check if order numbers are continuous between files
        # Parse first row's ลำดับที่ from each file to check continuity
        last_order_num = None
        for idx, doc in enumerate(committee_docs):
            # Get OCR text for first page of this document
            first_page = doc.pages[0]
            if first_page in ocr_texts:
                text = ocr_texts[first_page]
                # Try to find first order number in table (ลำดับที่)
                # Pattern: <tr><td>number</td>...
                first_row_match = re.search(r'<tr><td>(\d+)</td>', text)
                if first_row_match:
                    current_order = int(first_row_match.group(1))

                    if last_order_num is not None:
                        # Check if this file continues from previous file
                        if current_order != last_order_num + 1:
                            log(f"  ⚠️  WARNING: Order numbers NOT continuous!")
                            log(f"      File {idx} ended at order {last_order_num}")
                            log(f"      File {idx+1} starts at order {current_order} (expected {last_order_num + 1})")
                            committee_warnings.append(f"Committee files have discontinuous order numbers (gap between file {idx} and {idx+1})")
                            committee_files_continuous = False
                            break

                    # Find last order number in this file
                    all_rows = re.findall(r'<tr><td>(\d+)\.?</td>', text)
                    if all_rows:
                        last_order_num = int(all_rows[-1].rstrip('.'))

        if committee_files_continuous:
            log(f"  ✓ Committee files are continuous - will merge all files")

    # Parse foundation instrument data if exists
    foundation_data = {}
    is_checked_foundation = False
    if has_foundation_instrument:
        try:
            foundation_data = parse_foundation_instrument_data(ocr_texts, foundation_doc)
            log(f"  ✓ Parsed foundation instrument data")
            is_checked_foundation = True
        except Exception as e:
            log(f"  ⚠️  Warning: Failed to parse foundation instrument data: {e}")
            is_checked_foundation = False
    else:
        is_checked_foundation = False

    # Parse committee members data if exists
    committee_data = {}
    is_checked_members = False
    if has_committee_members:
        # Check if we can proceed with parsing
        if len(committee_docs) > 1 and not committee_files_continuous:
            log(f"  ⚠️  Committee files are NOT continuous - cannot parse members data")
            is_checked_members = False
        else:
            try:
                # Pass all committee docs (will be merged if multiple files)
                committee_data = parse_committee_members_data(ocr_texts, committee_docs)
                log(f"  ✓ Parsed committee members data from {len(committee_docs)} file(s)")

                is_checked_members = True
            except Exception as e:
                log(f"  ⚠️  Warning: Failed to parse committee members data: {e}")
                is_checked_members = False
    else:
        is_checked_members = False

    # Create config.json structure
    config = {
        "folder_id": folder_id,
        "total_pages": len(images),
        "matched_pages": total_matched,
        "unmatched_pages": len(unmatched),
        "incomplete_pages": len(incomplete_pages),
        "truly_unmatched_pages": len(truly_unmatched),
        "status": "matched" if is_all_matched else "has_unmatched",
        "match_percentage": round((total_matched / len(images) * 100), 1) if images else 0.0,
        "processed_date": datetime.now().isoformat(),
        "ocr_engine": "Typhoon OCR API",
        "foundation-instrument": has_foundation_instrument,
        "committee-members": has_committee_members,
        "is_have_logo": is_have_logo,
        "is_checked_logo": is_checked_logo,
        "is_checked_foundation": is_checked_foundation,
        "is_checked_members": is_checked_members,
        "is_checked_pdfs": is_checked_pdfs,
        "is_success": False,  # Will be updated after API call (only true if all checks pass and API succeeds)
        "warnings": [],  # List of warnings/issues found during processing
        "pages": {}
    }

    # Fill in page information
    for page_num in range(1, len(images) + 1):
        config["pages"][str(page_num)] = page_template_map[page_num]

    # Add warnings to config
    config["warnings"] = committee_warnings

    # Save config.json
    config_path = output_folder / "config.json"
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
    log(f"  Saved: config.json")

    # Update foundation-instrument.json with parsed data (if exists)
    if has_foundation_instrument and foundation_data:
        # Add folder ID to name field
        if "name" in foundation_data and foundation_data["name"]:
            foundation_data["name"] = f"[{folder_id}] {foundation_data['name']}"

        foundation_path = output_folder / "foundation-instrument.json"
        with open(foundation_path, 'w', encoding='utf-8') as f:
            json.dump(foundation_data, f, indent=2, ensure_ascii=False)
        log(f"  Updated foundation-instrument.json with parsed data")
    else:
        log(f"  ⚠️  Keeping foundation-instrument.json as skeleton (no data parsed)")

    # Update committee-members.json with parsed data (if exists)
    if has_committee_members and committee_data:
        committee_path = output_folder / "committee-members.json"
        with open(committee_path, 'w', encoding='utf-8') as f:
            json.dump(committee_data, f, indent=2, ensure_ascii=False)
        log(f"  Updated committee-members.json with parsed data")
    else:
        log(f"  ⚠️  Keeping committee-members.json as skeleton (no data parsed)")

    # Determine if folder has unmatched pages (either truly unmatched or incomplete)
    has_unmatched = len(unmatched) > 0 or len(incomplete_docs) > 0

    if has_unmatched:
        matched_count = len(images) - len(unmatched)
        match_pct = (matched_count / len(images) * 100) if images else 0
        log(f"  ⚠️  Match status: {matched_count}/{len(images)} pages ({match_pct:.1f}%)")
    else:
        log(f"  ✅ Match status: 100% all {len(images)} pages matched")

    # ==========================================================================
    # Step 6: Send data to API
    # ==========================================================================
    log(f"  Step 6: Send data to API...")

    # Check if all required steps are completed before sending to API
    all_checks_passed = (
        is_checked_logo and
        is_checked_foundation and
        is_checked_members and
        is_checked_pdfs
    )

    api_success = False
    foundation_id = None

    if all_checks_passed:
        log(f"  ✓ All checks passed (logo, foundation, members, pdfs)")
        api_success, foundation_id = send_foundation_data_to_api(folder_id, output_folder)

        if api_success:
            log(f"  ✅ API call successful")
        else:
            log(f"  ⚠️  API call failed")
    else:
        log(f"  ⚠️  Skipping API call - Not all checks passed:")
        log(f"      is_checked_logo: {is_checked_logo}")
        log(f"      is_checked_foundation: {is_checked_foundation}")
        log(f"      is_checked_members: {is_checked_members}")
        log(f"      is_checked_pdfs: {is_checked_pdfs}")

    # Update is_success in config.json - only true if all checks passed AND API succeeded
    config["is_success"] = api_success and all_checks_passed
    if foundation_id:
        config["api_foundation_id"] = foundation_id
    with open(config_path, 'w', encoding='utf-8') as f:
        json.dump(config, f, indent=2, ensure_ascii=False)

    if config["is_success"]:
        log(f"  ✅ is_success: true (all steps completed successfully)")
    else:
        log(f"  ⚠️  is_success: false (requires manual review)")

    # ==========================================================================
    # Step 7: Upload PDF files
    # ==========================================================================
    if api_success and foundation_id and not has_unmatched:
        log(f"  Step 7: Upload PDF files...")
        upload_pdfs_to_api(folder_id, output_folder, foundation_id)
    elif api_success and foundation_id and has_unmatched:
        log(f"  Step 7: Skipped PDF upload - has unmatched/incomplete pages (requires manual review)")
    else:
        log(f"  Step 7: Skipped PDF upload - API call not successful")

    # ==========================================================================
    # Step 8: Upload logo image
    # ==========================================================================
    if api_success and foundation_id:
        logo_path = output_folder / "logo.png"
        if logo_path.exists():
            log(f"  Step 8: Upload logo...")
            logo_upload_success = upload_logo_to_api(foundation_id, logo_path)
            if logo_upload_success:
                log(f"  ✅ Logo uploaded successfully")
            else:
                log(f"  ⚠️  Logo upload failed (but continuing...)")
        else:
            log(f"  Step 8: No logo to upload (logo.png not found)")
    else:
        log(f"  Step 8: Skipped logo upload - API call not successful")

    return True, has_unmatched


# =============================================================================
# MAIN FUNCTION
# =============================================================================

def main():
    base_dir = Path(__file__).parent
    group_dir = base_dir / "02-group"
    label_dir = base_dir / "03-label"
    templates_path = base_dir / "templates.json"

    label_dir.mkdir(exist_ok=True)

    log("=" * 60)
    log("Group to Label - Typhoon OCR API + Pattern Matching")
    log(f"  Input:  {group_dir}")
    log(f"  Output: {label_dir}")
    log("=" * 60)

    # Check API keys from .env (need 2 keys for 2 threads)
    api_key_1 = os.environ.get('TYPHOON_OCR_API_KEY_1')
    api_key_2 = os.environ.get('TYPHOON_OCR_API_KEY_2')

    if not api_key_1 or not api_key_2:
        log("ERROR: TYPHOON_OCR_API_KEY_1 and TYPHOON_OCR_API_KEY_2 not found in environment")
        log("  Please set them in .env file:")
        log("    TYPHOON_OCR_API_KEY_1=your_key_1")
        log("    TYPHOON_OCR_API_KEY_2=your_key_2")
        return

    api_keys = [api_key_1, api_key_2]
    log(f"✓ Loaded 2 Typhoon OCR API keys from environment")
    log(f"  - API Key 1: {api_key_1[:10]}...")
    log(f"  - API Key 2: {api_key_2[:10]}...")

    # Load templates from JSON
    try:
        templates = load_templates(templates_path)
        log(f"Loaded templates from: {templates_path}")
    except FileNotFoundError:
        log(f"ERROR: templates.json not found at {templates_path}")
        return
    except json.JSONDecodeError as e:
        log(f"ERROR: Invalid JSON in templates.json: {e}")
        return

    if not templates:
        log("ERROR: No templates defined in templates.json")
        return

    # Show configured templates
    log(f"Configured templates: {len(templates)}")
    for tmpl in templates:
        log(f"  - {tmpl.name}")
        log(f"      First page: {tmpl.first_page_patterns}")
        log(f"      Last page:  {tmpl.last_page_patterns}")
    log("-" * 60)

    # Typhoon OCR is ready (no client initialization needed)
    log("✓ Typhoon OCR API ready")

    # Check if specific folder ID is provided as argument
    target_folder_id = None
    if len(sys.argv) > 1:
        try:
            target_folder_id = int(sys.argv[1])
            log(f"Target folder: {target_folder_id}")
        except ValueError:
            log(f"ERROR: Invalid folder ID '{sys.argv[1]}'. Must be a number.")
            return

    # If target folder specified, process only that folder
    if target_folder_id is not None:
        folder_path = group_dir / str(target_folder_id)

        if not folder_path.exists():
            log(f"ERROR: Folder {target_folder_id} not found in {group_dir}")
            return

        log("-" * 60)
        success, has_unmatched = process_folder(target_folder_id, folder_path, label_dir, templates, api_keys)
        if success:
            if has_unmatched:
                log(f"⚠️  Folder {target_folder_id} completed with unmatched pages")
            else:
                log(f"✅ Folder {target_folder_id} completed successfully")
        else:
            log(f"⚠️  Folder {target_folder_id} processing failed")
        log("-" * 60)
        return

    # Otherwise, continuous loop to process all folders
    import time
    first_run = True
    while True:
        folders = get_processable_folders(group_dir)

        if not folders:
            if first_run:
                log("No folders to process")
                first_run = False
            else:
                log("No new folders found. Waiting for new folders...")
            time.sleep(5)  # Wait 5 seconds before checking again
            continue

        first_run = False
        log(f"Found {len(folders)} folders to process: {[f[0] for f in folders]}")
        log("-" * 60)

        # Process each folder
        processed_any = False
        for folder_id, folder in folders:
            success, has_unmatched = process_folder(folder_id, folder, label_dir, templates, api_keys)
            if success:
                if has_unmatched:
                    log(f"⚠️  Folder {folder_id} completed with unmatched pages")
                else:
                    log(f"✅ Folder {folder_id} completed successfully")
            else:
                log(f"⚠️  Folder {folder_id} processing failed - but continuing...")
            processed_any = True
            log("-" * 60)

        if processed_any:
            log("Checking for more folders...")
            time.sleep(2)  # Small delay before checking for new folders
        else:
            log("No folders were processed. Waiting...")
            time.sleep(5)


if __name__ == "__main__":
    main()
