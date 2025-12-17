"""
Pattern matching module for OCR flow processing.

This module contains:
- text_matches_single_pattern() - Check if text matches a single pattern
- text_matches_patterns() - Check if text matches any pattern (OR/AND logic)
- find_matching_template() - Find best matching template for text
- get_full_match_info() - Get detailed match information for summary
"""

from __future__ import annotations
from rapidfuzz import fuzz

# Handle both package and direct execution
try:
    from .config import FUZZY_THRESHOLD
    from .templates import DocumentTemplate
except ImportError:
    from config import FUZZY_THRESHOLD
    from templates import DocumentTemplate


# =============================================================================
# PATTERN MATCHING FUNCTIONS
# =============================================================================

def text_matches_single_pattern(text: str, pattern: str, full_info: bool = False) -> tuple[bool, str, float]:
    """
    Check if text contains a single pattern using fuzzy matching.

    Args:
        text: Text to search in
        pattern: Pattern to search for
        full_info: If True, return full pattern in match_info (for summary).
                   If False, truncate to 30 chars (for logs)

    Returns:
        Tuple of (matched, match_info, score)
        - matched: True if pattern matches
        - match_info: Description of match (e.g., "exact:'pattern'" or "fuzzy(85%):'pattern'")
        - score: Match score (0-100)
    """
    # ลองหา exact match ก่อน (เร็วกว่า)
    if pattern in text:
        if full_info:
            return True, f"exact:'{pattern}'", 100.0
        return True, f"exact:'{pattern[:30]}...'", 100.0

    # ถ้าไม่เจอ exact match ลอง fuzzy match
    # ตัด text เป็น chunks ขนาดเท่ากับ pattern แล้วเทียบ
    pattern_len = len(pattern)
    best_score = 0.0
    for i in range(len(text) - pattern_len + 1):
        chunk = text[i:i + pattern_len]
        score = fuzz.ratio(pattern, chunk)
        if score > best_score:
            best_score = score
        if score >= FUZZY_THRESHOLD:
            if full_info:
                return True, f"fuzzy({score:.1f}%):'{pattern}'", score
            return True, f"fuzzy({score:.1f}%):'{pattern[:30]}...'", score

    return False, "", best_score


def text_matches_patterns(text: str, patterns: list[str | list[str]], full_info: bool = False) -> tuple[bool, str, float]:
    """
    Check if text matches any of the patterns.

    Patterns can be:
    - str: Match if text contains this string (OR logic)
    - list[str]: Match if text contains ALL strings in the list (AND logic)

    Args:
        text: Text to search in
        patterns: List of patterns (strings or lists of strings)
        full_info: If True, return full pattern in match_info (for summary).
                   If False, truncate (for logs)

    Returns:
        Tuple of (matched, match_info, avg_score)
        - matched: True if any pattern matches
        - match_info: Description of best match
        - avg_score: Average score of best match

    Example:
        patterns = [
            "คำที่1",              # OR: เจอคำนี้คำเดียวก็ match
            ["คำที่2", "คำที่3"]   # AND: ต้องเจอทั้งคำที่2 และ คำที่3
        ]
    """
    best_score = 0.0
    best_match_info = ""

    for pattern in patterns:
        if isinstance(pattern, list):
            # AND logic: ต้องเจอทุกคำใน list
            match_results = [text_matches_single_pattern(text, p, full_info) for p in pattern]
            all_matched = all(matched for matched, _, _ in match_results)
            # Calculate average score
            scores = [score for _, _, score in match_results]
            avg_score = sum(scores) / len(scores) if scores else 0.0

            if all_matched and avg_score > best_score:
                best_score = avg_score
                matched_words = [info for _, info, _ in match_results]
                best_match_info = f"AND[{', '.join(matched_words)}]"
        else:
            # OR logic: เจอคำเดียวก็พอ
            matched, info, score = text_matches_single_pattern(text, pattern, full_info)
            if matched and score > best_score:
                best_score = score
                best_match_info = info

    # Return True if best score meets threshold
    if best_score >= FUZZY_THRESHOLD:
        return True, best_match_info, best_score

    return False, "", best_score


def find_matching_template(text: str, templates: list[DocumentTemplate], check_type: str) -> tuple[DocumentTemplate | None, str]:
    """
    Find template that matches the text for first/last page.
    Returns the template with highest average match score.

    Args:
        text: Text to match against
        templates: List of templates to check
        check_type: Either "first" or "last" - which patterns to check

    Returns:
        Tuple of (template, match_info)
        - template: Best matching template (or None if no match with score > 80)
        - match_info: Description of match

    Note:
        Only returns template if best_score > 80
        Checks first_page_negative_patterns or last_page_negative_patterns based on check_type
    """
    best_template = None
    best_info = ""
    best_score = 0.0

    for template in templates:
        # Check negative patterns based on check_type
        if check_type == "first":
            # Check first page negative patterns
            if template.first_page_negative_patterns:
                has_negative = False
                for neg_pattern in template.first_page_negative_patterns:
                    # Handle both string and list patterns
                    if isinstance(neg_pattern, list):
                        # AND logic: all patterns must be found
                        if all(p in text for p in neg_pattern):
                            has_negative = True
                            break
                    else:
                        # Single string pattern
                        if neg_pattern in text:
                            has_negative = True
                            break
                if has_negative:
                    # Skip this template - it has a negative pattern match
                    continue

            matched, info, score = text_matches_patterns(text, template.first_page_patterns)
            if matched and score > best_score:
                best_score = score
                best_template = template
                best_info = f"{info} (avg:{score:.1f}%)"

        elif check_type == "last":
            # Check last page negative patterns
            if template.last_page_negative_patterns:
                has_negative = False
                for neg_pattern in template.last_page_negative_patterns:
                    # Handle both string and list patterns
                    if isinstance(neg_pattern, list):
                        # AND logic: all patterns must be found
                        if all(p in text for p in neg_pattern):
                            has_negative = True
                            break
                    else:
                        # Single string pattern
                        if neg_pattern in text:
                            has_negative = True
                            break
                if has_negative:
                    # Skip this template - it has a negative pattern match
                    continue

            matched, info, score = text_matches_patterns(text, template.last_page_patterns)
            if matched and score > best_score:
                best_score = score
                best_template = template
                best_info = f"{info} (avg:{score:.1f}%)"

    # Only return template if best_score > 80
    if best_template and best_score > 80:
        return best_template, best_info

    return None, ""


def get_full_match_info(text: str, patterns: list[str | list[str]]) -> str:
    """
    Get full match info for summary (without truncation).

    Args:
        text: Text to match against
        patterns: List of patterns to check

    Returns:
        Match info string with full pattern text
    """
    matched, info, score = text_matches_patterns(text, patterns, full_info=True)
    if matched:
        return f"{info} (avg:{score:.1f}%)"
    return ""
