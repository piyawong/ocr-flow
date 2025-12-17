"""
Document grouping module for OCR flow processing.

This module contains:
- DocumentGroup dataclass - Represents a group of pages forming a document
- group_pages_by_patterns() - Group pages into documents based on template patterns
"""

from __future__ import annotations
from dataclasses import dataclass

# Handle both package and direct execution
try:
    from .templates import DocumentTemplate, UNMATCHED_TEMPLATE
    from .pattern_matching import find_matching_template, text_matches_patterns
    from .utils import log
except ImportError:
    from templates import DocumentTemplate, UNMATCHED_TEMPLATE
    from pattern_matching import find_matching_template, text_matches_patterns
    from utils import log


# =============================================================================
# DOCUMENT GROUPING DATA STRUCTURES
# =============================================================================

@dataclass
class DocumentGroup:
    """
    A group of pages that form a document.

    Attributes:
        template: DocumentTemplate that matched this document
        start_page: First page number (1-indexed)
        end_page: Last page number (1-indexed)
        pages: List of all page numbers in this document
        start_match_info: Information about what matched at start page
        end_match_info: Information about what matched at end page
        start_negative_match: If start was rejected by first_page_negative_patterns
        end_negative_match: If end was rejected by last_page_negative_patterns
    """
    template: DocumentTemplate
    start_page: int  # 1-indexed
    end_page: int  # 1-indexed
    pages: list[int]  # list of page numbers
    start_match_info: str = ""  # ข้อมูลว่า start page match เพราะอะไร
    end_match_info: str = ""  # ข้อมูลว่า end page match เพราะอะไร
    start_negative_match: str = ""  # ถ้า start ถูก reject เพราะ first_page_negative_patterns
    end_negative_match: str = ""  # ถ้า end ถูก reject เพราะ last_page_negative_patterns


# =============================================================================
# DOCUMENT GROUPING FUNCTIONS
# =============================================================================

def group_pages_by_patterns(
    ocr_texts: dict[int, str],  # page_num -> text
    templates: list[DocumentTemplate]
) -> tuple[list[DocumentGroup], list[int], list[DocumentGroup]]:
    """
    Group pages into documents based on template patterns.

    Logic:
    1. เมื่อเจอ first_page_pattern → เริ่ม document ใหม่
    2. หน้าต่อๆ ไปนับต่อจนกว่าจะเจอ last_page_patterns
    3. หลังจากเจอ last_page_patterns → หน้าถัดไปต้อง match first_page_pattern
    4. Template อาจมีแค่หน้าเดียว (first และ last อยู่หน้าเดียวกัน)

    Args:
        ocr_texts: Dictionary mapping page number to OCR text
        templates: List of document templates to match against

    Returns:
        Tuple of (complete_documents, unmatched_pages, incomplete_documents)
        - complete_documents: List of DocumentGroup with both start and end
        - unmatched_pages: List of page numbers that didn't match any template
        - incomplete_documents: List of DocumentGroup that started but never ended
    """
    page_nums = sorted(ocr_texts.keys())
    if not page_nums:
        return [], [], []

    documents = []
    unmatched_pages = []
    incomplete_documents = []
    current_doc: DocumentGroup | None = None
    expecting_first_page = True  # เริ่มต้นต้องหา first_page_pattern

    for page_num in page_nums:
        text = ocr_texts[page_num]

        if expecting_first_page:
            # ต้องหา first_page_pattern
            first_template, first_match_info = find_matching_template(text, templates, "first")

            if first_template:
                # Get full match info for summary (without truncation)
                _, full_first_info, first_score = text_matches_patterns(text, first_template.first_page_patterns, full_info=True)
                full_first_match_info = f"{full_first_info} (avg:{first_score:.1f}%)"

                # เริ่ม document ใหม่
                current_doc = DocumentGroup(
                    template=first_template,
                    start_page=page_num,
                    end_page=page_num,
                    pages=[page_num],
                    start_match_info=full_first_match_info
                )
                log(f"    Page {page_num}: ✅ START '{first_template.name}'")
                log(f"        → Matched by: {first_match_info}")

                # เช็คว่าเป็น single-page document หรือไม่
                if first_template.is_single_page:
                    # Single page document - ต้อง match ทั้ง start และ end ในหน้าเดียว
                    last_matched, last_match_info, _ = text_matches_patterns(text, first_template.last_page_patterns)
                    if last_matched:
                        # Match ทั้ง start และ end ในหน้าเดียว
                        _, full_last_info, _ = text_matches_patterns(text, first_template.last_page_patterns, full_info=True)
                        current_doc.end_match_info = full_last_info
                        documents.append(current_doc)
                        log(f"    Page {page_num}: ✅ SINGLE PAGE '{first_template.name}'")
                        log(f"        → Start: {first_match_info}")
                        log(f"        → End: {last_match_info}")
                        current_doc = None
                        expecting_first_page = True
                    else:
                        # Start match แต่ end ไม่ match → unmatched
                        unmatched_pages.append(page_num)
                        log(f"    Page {page_num}: ❌ UNMATCHED - Start pattern matched but end pattern not found (single-page template)")
                        current_doc = None
                        expecting_first_page = True
                else:
                    # Multi-page document - เช็คว่าหน้านี้เป็น last_page ด้วยมั้ย
                    last_matched, last_match_info, _ = text_matches_patterns(text, first_template.last_page_patterns)
                    if last_matched:
                        # Get full match info for end (for summary)
                        _, full_last_info, _ = text_matches_patterns(text, first_template.last_page_patterns, full_info=True)
                        current_doc.end_match_info = full_last_info
                        documents.append(current_doc)
                        log(f"    Page {page_num}: ✅ END '{first_template.name}' (single page)")
                        log(f"        → End matched by: {last_match_info}")
                        current_doc = None
                        expecting_first_page = True
                    else:
                        log(f"        → 🔍 Looking for last_page_patterns: {first_template.last_page_patterns}")
                        expecting_first_page = False
            else:
                # ไม่ match first_page_pattern ใดๆ → สร้างเป็น "เอกสารไม่มีชื่อ" single page document
                unmatched_doc = DocumentGroup(
                    template=UNMATCHED_TEMPLATE,
                    start_page=page_num,
                    end_page=page_num,
                    pages=[page_num],
                    start_match_info="No template matched",
                    end_match_info="No template matched"
                )
                documents.append(unmatched_doc)
                unmatched_pages.append(page_num)
                log(f"    Page {page_num}: ❌ UNMATCHED (creating as 'เอกสารไม่มีชื่อ')")

        else:
            # กำลังสร้าง document อยู่ - หาแค่ last_page_patterns
            current_doc.pages.append(page_num)
            log(f"    Page {page_num}: ⏩ CONTINUING '{current_doc.template.name}' (started at page {current_doc.start_page})")
            log(f"        → 🔍 Still looking for: {current_doc.template.last_page_patterns}")

            # เช็คว่า current template มี last_page_pattern ที่ match กับ text หรือไม่
            matched, match_info, _ = text_matches_patterns(text, current_doc.template.last_page_patterns)
            if matched:
                # เช็ค last_page_negative_patterns ก่อน END
                has_negative = False
                if current_doc.template.last_page_negative_patterns:
                    for neg_pattern in current_doc.template.last_page_negative_patterns:
                        # Handle both string and list patterns
                        if isinstance(neg_pattern, list):
                            if all(p in text for p in neg_pattern):
                                has_negative = True
                                break
                        else:
                            if neg_pattern in text:
                                has_negative = True
                                break

                if has_negative:
                    # มี negative pattern → ไม่ใช่ last page จริง ให้ continue ต่อ
                    # Record which negative pattern matched
                    negative_patterns_found = []
                    for neg_pattern in current_doc.template.last_page_negative_patterns:
                        if isinstance(neg_pattern, list):
                            if all(p in text for p in neg_pattern):
                                negative_patterns_found.append(str(neg_pattern))
                        else:
                            if neg_pattern in text:
                                negative_patterns_found.append(neg_pattern)
                    current_doc.end_negative_match = " AND ".join(negative_patterns_found)
                    log(f"        → ⚠️ Matched last_page_patterns but found negative pattern - not ending")
                    log(f"        → Negative patterns matched: {current_doc.end_negative_match}")
                else:
                    # จบ document นี้
                    current_doc.end_page = page_num
                    # Get full match info for summary
                    _, full_last_info, _ = text_matches_patterns(text, current_doc.template.last_page_patterns, full_info=True)
                    current_doc.end_match_info = full_last_info
                    documents.append(current_doc)
                    log(f"    Page {page_num}: ✅ END '{current_doc.template.name}' (pages {current_doc.start_page}-{page_num})")
                    log(f"        → End matched by: {match_info}")
                    current_doc = None
                    expecting_first_page = True
            # ถ้าไม่เจอ last_page_patterns ก็ถือว่าเป็นหน้ากลางของ document

    # ถ้ายังมี document ที่ยังไม่จบ
    if current_doc:
        log(f"    ⚠️  WARNING: Document '{current_doc.template.name}' incomplete (no last page found)")
        log(f"        → Was looking for last_page_patterns: {current_doc.template.last_page_patterns}")
        log(f"        → Pages in this incomplete document: {current_doc.pages}")
        log(f"        → 💡 Hint: Check if last_page_pattern is correct or add more patterns")
        incomplete_documents.append(current_doc)
        unmatched_pages.extend(current_doc.pages)

    return documents, unmatched_pages, incomplete_documents
