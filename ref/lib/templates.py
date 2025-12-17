"""
Template module for document pattern matching.

This module contains:
- DocumentTemplate dataclass - Defines document template structure
- UNMATCHED_TEMPLATE - Default template for unmatched documents
- load_templates() - Loads templates from JSON file
"""

from __future__ import annotations
import json
from dataclasses import dataclass, field
from pathlib import Path


# =============================================================================
# TEMPLATE DATA STRUCTURES
# =============================================================================

@dataclass
class DocumentTemplate:
    """
    Template for document pattern matching.

    Patterns can be:
    - str: Match if text contains this string (OR logic)
    - list[str]: Match if text contains ALL strings in the list (AND logic)

    Negative patterns: If any of these patterns are found, the template will NOT match
    is_single_page: If True, both start and end patterns must match on the same page
    """
    name: str  # ชื่อไฟล์ PDF ที่จะสร้าง
    first_page_patterns: list[str | list[str]]  # pattern สำหรับหน้าแรก
    last_page_patterns: list[str | list[str]]  # pattern สำหรับหน้าสุดท้าย
    category: str  # หมวดหมู่ (ถ้าไม่ว่าง จะสร้าง folder ตามชื่อนี้)
    first_page_negative_patterns: list[str] = field(default_factory=list)  # patterns ที่ถ้าเจอในหน้าแรกแล้วจะไม่ match (optional)
    last_page_negative_patterns: list[str] = field(default_factory=list)  # patterns ที่ถ้าเจอในหน้าสุดท้ายแล้วจะไม่ match (optional)
    is_single_page: bool = False  # ถ้าเป็น True จะ match ทั้ง start และ end ในหน้าเดียว


# Dummy template for unmatched pages
UNMATCHED_TEMPLATE = DocumentTemplate(
    name="เอกสารไม่มีชื่อ.pdf",
    first_page_patterns=[],
    last_page_patterns=[],
    category="เอกสารไม่มีชื่อ"
)


# =============================================================================
# TEMPLATE LOADING
# =============================================================================

def load_templates(json_path: Path) -> list[DocumentTemplate]:
    """
    Load templates from JSON file.

    Args:
        json_path: Path to templates.json file

    Returns:
        List of DocumentTemplate objects

    Raises:
        FileNotFoundError: If templates.json not found
        json.JSONDecodeError: If JSON is invalid
    """
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    templates = []
    for t in data.get("templates", []):
        templates.append(DocumentTemplate(
            name=t["name"],
            first_page_patterns=t["first_page_patterns"],
            last_page_patterns=t["last_page_patterns"],
            category=t.get("category", ""),  # default เป็น "" ถ้าไม่มี
            first_page_negative_patterns=t.get("first_page_negative_patterns", []),  # default เป็น [] ถ้าไม่มี
            last_page_negative_patterns=t.get("last_page_negative_patterns", []),  # default เป็น [] ถ้าไม่มี
            is_single_page=t.get("is_single_page", False),  # default เป็น False ถ้าไม่มี
        ))
    return templates
