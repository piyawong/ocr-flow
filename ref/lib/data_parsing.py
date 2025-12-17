"""
Data parsing module for OCR flow processing.

This module contains:
- parse_foundation_instrument_data() - Extract structured data from foundation instrument OCR
- parse_committee_members_data() - Extract structured data from committee members OCR
"""

from __future__ import annotations
import re

# Handle both package and direct execution
try:
    from .document_grouping import DocumentGroup
except ImportError:
    from document_grouping import DocumentGroup


# Thai to Arabic numeral mapping
THAI_TO_ARABIC = {
    '๐': '0', '๑': '1', '๒': '2', '๓': '3', '๔': '4',
    '๕': '5', '๖': '6', '๗': '7', '๘': '8', '๙': '9'
}

def convert_thai_to_arabic(text: str) -> str:
    """Convert Thai numerals to Arabic numerals."""
    for thai, arabic in THAI_TO_ARABIC.items():
        text = text.replace(thai, arabic)
    return text


# =============================================================================
# DATA PARSING FUNCTIONS
# =============================================================================

def parse_foundation_instrument_data(ocr_texts: dict[int, str], foundation_doc: DocumentGroup) -> dict:
    """
    Parse foundation instrument (ตราสาร) OCR text to extract structured data.

    Args:
        ocr_texts: Dict mapping page number to OCR text
        foundation_doc: DocumentGroup for ตราสาร.pdf

    Returns:
        Dict with extracted foundation data matching example.json structure:
        {
            "name": "ชื่อมูลนิธิ",
            "shortName": "ชื่อย่อ",
            "address": "ที่อยู่สำนักงาน",
            "logoDescription": "คำอธิบายเครื่องหมาย",
            "charterSections": [
                {
                    "number": "หมายเลขหมวด",
                    "title": "ชื่อหมวด",
                    "articles": [
                        {
                            "number": "หมายเลขข้อ",
                            "content": "เนื้อหาข้อความ"
                        }
                    ]
                }
            ]
        }
    """
    # Combine all text from foundation instrument pages
    combined_text = ""
    for page_num in foundation_doc.pages:
        if page_num in ocr_texts:
            combined_text += ocr_texts[page_num] + "\n"

    # Convert all Thai numerals to Arabic numerals first (before any parsing)
    combined_text = convert_thai_to_arabic(combined_text)

    # Remove page numbers (e.g., <page_number>- 2 -</page_number>)
    combined_text = re.sub(r'<page_number>.*?</page_number>', '', combined_text)

    # Fix OCR errors: Replace "ชื่อ X" with "ข้อ X" for numbers 1-12 (already converted to Arabic)
    for num in range(1, 13):
        combined_text = combined_text.replace(f'ชื่อ {num}', f'ข้อ {num}')

    # Fix OCR error: "หมวดที่ 72" should be "หมวดที่ 12" (common OCR error)
    combined_text = combined_text.replace('หมวดที่ 72', 'หมวดที่ 12')

    # Fix OCR error: "บทบัดเคล็ด" should be "บทเบ็ดเตล็ด"
    combined_text = combined_text.replace('บทบัดเคล็ด', 'บทเบ็ดเตล็ด')

    # Initialize result structure
    data = {
        "name": "",
        "shortName": "",
        "address": "",
        "logoDescription": "",
        "charterSections": []
    }

    # Extract name (ชื่อมูลนิธิ) - ข้อ ๑ มูลนิธินี้ชื่อว่า ... หรือ มูลนิธินี้มีชื่อว่า ...
    # Stop before: **, ย่อว่า, ขอว่า, ชื่อย่อว่า (same line or new line), เรียกเป็นภาษา, or ข้อ 2/ข้อ ๒
    name_match = re.search(r'มูลนิธินี้(?:มี)?ชื่อว่า\s+(.+?)(?=\s*\*\*|\s*ชื่อย่อว่า|\n\s*ชื่อย่อว่า|\s*ย่อว่า|\s*ขอว่า|\s*เรียกเป็นภาษา|\n\s*ข้อ\s*[๒2]|$)', combined_text, re.DOTALL)
    if name_match:
        name_text = name_match.group(1).strip().replace('\n', ' ')
        # Remove double quotes
        name_text = name_text.replace('"', '')
        # Remove "มูลนิธิ" completely from anywhere in the name
        name_text = name_text.replace('มูลนิธิ', '')
        data["name"] = name_text.strip()

    # Extract short name (ชื่อย่อ)
    # Method 1: Look for "ย่อว่า" or "ขอว่า" pattern, stop before "เรียก"
    short_match = re.search(r'(?:ชื่อย่อว่า|ย่อว่า|ขอว่า)\s+(.+?)(?=\s+(?:เรียก|เขียน|หรือ|คือ|ข้อ|ย่อว่า|ขอว่า)|\n\s*ข้อ|\n\s*ย่อว่า|\n|$)', combined_text)
    if short_match:
        short_text = short_match.group(1).strip()
        # Check if it contains Thai abbreviation pattern (e.g., ม.ล.อ.)
        # If the matched text contains "เรียก", it's not a clean short name, use Method 2
        if 'เรียก' not in short_text:
            data["shortName"] = short_text
        else:
            short_text = None  # Force to use Method 2
    else:
        short_text = None

    # Method 2: If Method 1 didn't work, look for pattern like "ม.ส.", "ม.ส.ต.", "ม.ล.อ." in section 1
    if not short_text:
        # Find section 1 text first
        section1_match = re.search(r'หมวดที่\s+1(.+?)(?=หมวดที่\s+\d+|$)', combined_text, re.DOTALL)
        if section1_match:
            section1_text = section1_match.group(1)
            # Look for pattern: 2-4 Thai letters separated by dots
            # Match: ม.ส. or ม.ส.ต. or ม.ล.อ. or ม.ส.ต.ส.
            abbr_match = re.search(r'([ก-ฮ]{1,2}\.[ก-ฮ]{1,2}\.(?:[ก-ฮ]{1,2}\.)?(?:[ก-ฮ]{1,2}\.)?)', section1_text)
            if abbr_match:
                data["shortName"] = abbr_match.group(1).strip()

    # Extract address (ที่อยู่สำนักงาน) - from ข้อ 3 in หมวดที่ 1
    # Find text from ข้อ 3 to หมวดที่ 2
    addr_match = re.search(r'ข้อ\s+3[\.\s]+(.+?)(?=\s*หมวดที่\s+2|$)', combined_text, re.DOTALL)
    if addr_match:
        addr_full_text = addr_match.group(1).strip().replace('\n', ' ')
        # Remove sentence containing "ตั้งอยู่" (e.g., "สำนักงานของมูลนิธิตั้งอยู่ที่")
        addr_clean = re.sub(r'[^\.]*ตั้งอยู่[^0-9]*', '', addr_full_text, count=1)
        # Remove "รับรองสำเนาถูกต้อง" and everything after it
        addr_clean = re.sub(r'(?:รับรอง)?สำเนาถูกต้อง.*$', '', addr_clean, flags=re.IGNORECASE)
        # Clean up leading/trailing whitespace and **
        addr_clean = re.sub(r'\*\*', '', addr_clean).strip()
        data["address"] = addr_clean

    # Extract logo description (เครื่องหมาย) - เครื่องหมายของมูลนิธินี้ คือ ...
    logo_match = re.search(r'เครื่องหมายของมูลนิธินี้\s+คือ\s+(.+?)(?=\n\s*<figure>|\n\s*ข้อ|$)', combined_text, re.DOTALL)
    if logo_match:
        data["logoDescription"] = logo_match.group(1).strip().replace('\n', ' ')

    # Extract charter sections (หมวดและข้อ)
    # Find all sections (หมวดที่ X)
    section_pattern = r'หมวดที่\s+([๐-๙\d]+)\s+([^\n]+)'
    sections = list(re.finditer(section_pattern, combined_text))

    # Check if there are articles before the first section (implicit section 1)
    if sections:
        first_section_pos = sections[0].start()
        text_before_first_section = combined_text[:first_section_pos]

        # Extract articles before first section
        article_pattern = r'ข้อ\s+([๐-๙\d]+)[\.\s]+(.+?)(?=\n\s*ข้อ|\n\s*หมวด|$)'
        articles_before = []

        for article_match in re.finditer(article_pattern, text_before_first_section, re.DOTALL):
            article_num = article_match.group(1)
            article_full_text = article_match.group(2).strip().replace('\n', ' ')

            # Extract sub-items (e.g., 1.1, 1.2...)
            sub_item_pattern = rf'{article_num}\.(\d+)\s+(.+?)(?=\s*{article_num}\.\d+|$)'
            sub_items = []

            for sub_match in re.finditer(sub_item_pattern, article_full_text):
                sub_num = f"{article_num}.{sub_match.group(1)}"
                sub_content = sub_match.group(2).strip()

                sub_items.append({
                    "number": sub_num,
                    "content": sub_content
                })

            # Extract main content (text before first sub-item, if any)
            if sub_items:
                first_sub_match = re.search(rf'{article_num}\.\d+', article_full_text)
                if first_sub_match:
                    main_content = article_full_text[:first_sub_match.start()].strip()
                else:
                    main_content = article_full_text

                article_data = {
                    "number": article_num,
                    "content": main_content,
                    "subItems": sub_items
                }
            else:
                article_data = {
                    "number": article_num,
                    "content": article_full_text
                }

            articles_before.append(article_data)

        # If there are articles before first section, add them as section 1
        if articles_before:
            data["charterSections"].append({
                "number": "1",
                "title": "ชื่อเครื่องหมายและสำนักงานที่ตั้ง",
                "articles": articles_before
            })

    # Process explicit sections
    for i, section_match in enumerate(sections):
        section_num = section_match.group(1)
        section_title = section_match.group(2).strip()

        # Find text between this section and next section
        start_pos = section_match.end()
        end_pos = sections[i+1].start() if i+1 < len(sections) else len(combined_text)
        section_text = combined_text[start_pos:end_pos]

        # Extract articles (ข้อ) in this section
        article_pattern = r'ข้อ\s+([๐-๙\d]+)[\.\s]+(.+?)(?=\n\s*ข้อ|\n\s*หมวด|$)'
        articles = []

        for article_match in re.finditer(article_pattern, section_text, re.DOTALL):
            article_num = article_match.group(1)
            article_full_text = article_match.group(2).strip().replace('\n', ' ')

            # Extract sub-items (e.g., 4.1, 4.2, 4.3...)
            # Pattern: article_num.X where X is a number
            sub_item_pattern = rf'{article_num}\.(\d+)\s+(.+?)(?=\s*{article_num}\.\d+|$)'
            sub_items = []

            for sub_match in re.finditer(sub_item_pattern, article_full_text):
                sub_num = f"{article_num}.{sub_match.group(1)}"
                sub_content = sub_match.group(2).strip()

                sub_items.append({
                    "number": sub_num,
                    "content": sub_content
                })

            # Extract main content (text before first sub-item, if any)
            if sub_items:
                # Get text before first sub-item
                first_sub_match = re.search(rf'{article_num}\.\d+', article_full_text)
                if first_sub_match:
                    main_content = article_full_text[:first_sub_match.start()].strip()
                else:
                    main_content = article_full_text

                article_data = {
                    "number": article_num,
                    "content": main_content,
                    "subItems": sub_items
                }
            else:
                # No sub-items, just regular content
                article_data = {
                    "number": article_num,
                    "content": article_full_text
                }

            articles.append(article_data)

        if articles:  # Only add section if it has articles
            data["charterSections"].append({
                "number": section_num,  # Already converted to Arabic at the beginning
                "title": section_title,
                "articles": articles
            })

    return data


def parse_committee_members_data(ocr_texts: dict[int, str], committee_docs: list) -> dict:
    """
    Parse committee members (บัญชีรายชื่อกรรมการมูลนิธิ) OCR text to extract structured data.

    Args:
        ocr_texts: Dict mapping page number to OCR text
        committee_docs: List of DocumentGroup for บัญชีรายชื่อกรรมการมูลนิธิ.pdf (can be multiple files)

    Returns:
        Dict with extracted committee members data matching example-committee.json structure:
        {
            "committeeMembers": [
                {
                    "name": "ชื่อ-สกุล",
                    "address": "ที่อยู่",
                    "phone": "เบอร์โทรศัพท์ (หรือ None)",
                    "position": "ตำแหน่ง"
                }
            ]
        }
    """
    # Support both single doc (backwards compat) and list of docs
    if not isinstance(committee_docs, list):
        committee_docs = [committee_docs]

    # Combine all text from all committee documents
    combined_text = ""
    for doc in committee_docs:
        for page_num in doc.pages:
            if page_num in ocr_texts:
                combined_text += ocr_texts[page_num] + "\n"

    # Initialize result structure
    data = {
        "committeeMembers": []
    }

    # Extract ALL tables from <table> tags (support multiple tables)
    table_pattern = r'<table>(.*?)</table>'
    table_matches = re.finditer(table_pattern, combined_text, re.DOTALL)

    for table_match in table_matches:
        table_content = table_match.group(1)

        # Extract rows (skip header row)
        row_pattern = r'<tr>(.*?)</tr>'
        rows = re.findall(row_pattern, table_content, re.DOTALL)

        for i, row in enumerate(rows):
            if i == 0:  # Skip header row
                continue

            # Extract cells
            cell_pattern = r'<td>(.*?)</td>'
            cells = re.findall(cell_pattern, row, re.DOTALL)

            if len(cells) >= 4:  # Need at least: ที่, ชื่อ, อายุ, ที่อยู่
                # Parse fields (flexible for different table formats)
                name = cells[1].strip() if len(cells) > 1 else None
                address = cells[3].strip() if len(cells) > 3 else None

                # Try to get phone (column 5 in 8-column table, or column 4 in some tables)
                phone = None
                if len(cells) >= 8:  # 8-column table
                    phone_text = cells[4].strip() if len(cells) > 4 else ""
                    if phone_text and phone_text != "":
                        phone = phone_text
                elif len(cells) >= 7:  # Check if column 4 looks like phone
                    phone_text = cells[4].strip() if len(cells) > 4 else ""
                    if phone_text and ('-' in phone_text or phone_text.isdigit()):
                        phone = phone_text

                # Try to get position (column 7 in 8-column table, or column 6 in some tables)
                position = ""
                if len(cells) >= 8:  # 8-column table
                    position = cells[6].strip() if len(cells) > 6 else ""
                elif len(cells) >= 6:  # 6-column table
                    position = cells[5].strip() if len(cells) > 5 else ""

                member = {
                    "name": name,
                    "address": address,
                    "phone": phone,
                    "position": position
                }

                data["committeeMembers"].append(member)

    return data
