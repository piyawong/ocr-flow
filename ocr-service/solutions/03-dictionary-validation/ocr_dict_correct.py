#!/usr/bin/env python3
"""
Solution 3: Dictionary Validation
OCR with Typhoon OCR + PyThaiNLP spell checking and correction
"""
import os
import sys
import re
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))


def ocr_with_typhoon(image_path: str) -> str:
    """OCR using Typhoon OCR API"""
    from typhoon_ocr import ocr_document
    return ocr_document(
        pdf_or_image_path=image_path,
        task_type="v1.5",
        figure_language="Thai"
    )


def correct_with_pythainlp(text: str) -> dict:
    """
    Use PyThaiNLP to correct OCR errors
    Returns dict with corrected text and details
    """
    from pythainlp.spell import correct, spell
    from pythainlp.tokenize import word_tokenize
    from pythainlp.util import normalize

    # Step 1: Normalize text (fix common encoding issues)
    normalized = normalize(text)

    # Step 2: Tokenize into words
    words = word_tokenize(normalized, engine="newmm")

    # Step 3: Check and correct each word
    corrections = []
    corrected_words = []

    for word in words:
        # Skip non-Thai words, numbers, punctuation
        if not re.search(r'[\u0E00-\u0E7F]', word):
            corrected_words.append(word)
            continue

        # Skip short words (likely correct)
        if len(word) <= 1:
            corrected_words.append(word)
            continue

        # Check spelling
        suggestions = spell(word)

        if suggestions and suggestions[0] != word:
            # Word might be misspelled
            corrected_word = correct(word)
            if corrected_word != word:
                corrections.append({
                    "original": word,
                    "corrected": corrected_word,
                    "suggestions": suggestions[:3]
                })
                corrected_words.append(corrected_word)
            else:
                corrected_words.append(word)
        else:
            corrected_words.append(word)

    # Reconstruct text
    corrected_text = ''.join(corrected_words)

    return {
        "normalized": normalized,
        "corrected": corrected_text,
        "corrections": corrections,
        "num_corrections": len(corrections)
    }


def correct_common_ocr_errors(text: str) -> str:
    """
    Fix common Thai OCR errors using pattern matching
    """
    replacements = [
        # Common character confusions
        (r'ฒ', 'ช'),  # Sometimes misread
        (r'ณ', 'น'),  # ณ often misread as น
        (r'ฎ', 'ด'),  # ฎ often misread as ด
        (r'ฏ', 'ต'),  # ฏ often misread as ต

        # Common word errors
        (r'มูลนิฐิ', 'มูลนิธิ'),
        (r'มูณนิธิ', 'มูลนิธิ'),
        (r'มูลณิธิ', 'มูลนิธิ'),
        (r'สนับสนนุ', 'สนับสนุน'),
        (r'สนับสนน', 'สนับสนุน'),
        (r'สังเสริม', 'ส่งเสริม'),
        (r'สังเกตุ', 'สังเกต'),
        (r'เกียรติ์คุณ', 'เกียรติคุณ'),
        (r'สาธารณประโยชน์', 'สาธารณประโยชน์'),
        (r'สาชารณ', 'สาธารณ'),

        # Number/letter confusion
        (r'l', '1'),  # lowercase L to 1 in numbers
        (r'O', '0'),  # uppercase O to 0 in numbers

        # Tone mark issues
        (r'ํา', 'ำ'),  # Nikhahit + sara aa -> sara am
    ]

    result = text
    for pattern, replacement in replacements:
        result = re.sub(pattern, replacement, result)

    return result


def process_image(image_path: str) -> dict:
    """
    Full pipeline: OCR -> Pattern Correction -> Dictionary Correction
    """
    print(f"[1/3] Running OCR on {image_path}...")
    raw_ocr = ocr_with_typhoon(image_path)

    print("[2/3] Applying pattern-based corrections...")
    pattern_corrected = correct_common_ocr_errors(raw_ocr)

    print("[3/3] Running PyThaiNLP spell checking...")
    dict_result = correct_with_pythainlp(pattern_corrected)

    return {
        "raw_ocr": raw_ocr,
        "pattern_corrected": pattern_corrected,
        "dict_corrected": dict_result["corrected"],
        "corrections": dict_result["corrections"],
        "num_corrections": dict_result["num_corrections"]
    }


def main():
    api_key = os.environ.get('TYPHOON_API_KEY')
    if not api_key:
        print("Error: TYPHOON_API_KEY environment variable not set")
        sys.exit(1)

    if len(sys.argv) < 2:
        image_path = '../../test.jpg'
    else:
        image_path = sys.argv[1]

    if not Path(image_path).exists():
        print(f"Error: File '{image_path}' not found")
        sys.exit(1)

    print("=" * 60)
    print("Solution 3: Dictionary Validation (PyThaiNLP)")
    print("=" * 60)

    try:
        result = process_image(image_path)

        # Save results
        output_dir = Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)

        with open(output_dir / "raw_ocr.txt", "w", encoding="utf-8") as f:
            f.write(result["raw_ocr"])

        with open(output_dir / "pattern_corrected.txt", "w", encoding="utf-8") as f:
            f.write(result["pattern_corrected"])

        with open(output_dir / "dict_corrected.txt", "w", encoding="utf-8") as f:
            f.write(result["dict_corrected"])

        # Save corrections log
        with open(output_dir / "corrections_log.txt", "w", encoding="utf-8") as f:
            f.write(f"Total corrections: {result['num_corrections']}\n\n")
            for c in result["corrections"]:
                f.write(f"'{c['original']}' -> '{c['corrected']}'\n")
                f.write(f"  Suggestions: {c['suggestions']}\n\n")

        print("\n" + "=" * 60)
        print("RAW OCR:")
        print("=" * 60)
        print(result["raw_ocr"][:400] + "..." if len(result["raw_ocr"]) > 400 else result["raw_ocr"])

        print("\n" + "=" * 60)
        print("PATTERN CORRECTED:")
        print("=" * 60)
        print(result["pattern_corrected"][:400] + "..." if len(result["pattern_corrected"]) > 400 else result["pattern_corrected"])

        print("\n" + "=" * 60)
        print("DICTIONARY CORRECTED:")
        print("=" * 60)
        print(result["dict_corrected"][:400] + "..." if len(result["dict_corrected"]) > 400 else result["dict_corrected"])

        print("\n" + "=" * 60)
        print(f"Corrections made: {result['num_corrections']}")
        if result["corrections"]:
            print("\nSample corrections:")
            for c in result["corrections"][:5]:
                print(f"  '{c['original']}' -> '{c['corrected']}'")
        print("=" * 60)
        print(f"Results saved to: {output_dir}")
        print("=" * 60)

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
