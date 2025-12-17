"""
Database helper for PostgreSQL using psycopg2.

Provides functions to:
- Save folder and page data to PostgreSQL
- Replace JSON-based config storage

Dependencies:
    pip install psycopg2-binary python-dotenv

Environment variables required (in .env):
    DB_HOST=localhost
    DB_PORT=5433
    DB_NAME=ocr_flow
    DB_USER=postgres
    DB_PASSWORD=postgres
"""

import os
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime
from typing import Optional, List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

# Database connection parameters
DB_PARAMS = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5433')),
    'database': os.getenv('DB_NAME', 'ocr_flow'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
}


def get_connection():
    """Get a database connection."""
    return psycopg2.connect(**DB_PARAMS)


def save_folder_config(
    folder_id: int,
    total_pages: int,
    matched_pages: int,
    unmatched_pages: int,
    incomplete_pages: int,
    match_percentage: float,
    is_100_percent_matched: bool,
    status: str,
    processed_date: datetime,
    ocr_engine: str,
    is_ocr_success: bool,
    is_pdf_label_success: bool,
    warnings: List[str],
    pages: Dict[int, Dict[str, Any]]
) -> bool:
    """
    Save folder configuration to database.

    This replaces writing to label_config.json.

    Args:
        folder_id: Folder ID (from file system)
        total_pages: Total number of pages
        matched_pages: Number of matched pages
        unmatched_pages: Number of unmatched pages
        incomplete_pages: Number of incomplete pages
        match_percentage: Match percentage (0-100)
        is_100_percent_matched: Whether 100% matched
        status: Status ("auto_matched", "has_unmatched", "manual_matched")
        processed_date: When processed
        ocr_engine: OCR engine used
        is_ocr_success: Whether OCR succeeded
        is_pdf_label_success: Whether PDF labeling succeeded
        warnings: List of warning messages
        pages: Dictionary of page data {page_num: {template, category, status, ...}}

    Returns:
        True if successful, False otherwise
    """
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Insert or update folder
        cur.execute("""
            INSERT INTO folders (
                id, total_pages, matched_pages, unmatched_pages, incomplete_pages,
                match_percentage, is_100_percent_matched, status, processed_date,
                ocr_engine, is_ocr_success, is_pdf_label_success, warnings,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
            )
            ON CONFLICT (id) DO UPDATE SET
                total_pages = EXCLUDED.total_pages,
                matched_pages = EXCLUDED.matched_pages,
                unmatched_pages = EXCLUDED.unmatched_pages,
                incomplete_pages = EXCLUDED.incomplete_pages,
                match_percentage = EXCLUDED.match_percentage,
                is_100_percent_matched = EXCLUDED.is_100_percent_matched,
                status = EXCLUDED.status,
                processed_date = EXCLUDED.processed_date,
                ocr_engine = EXCLUDED.ocr_engine,
                is_ocr_success = EXCLUDED.is_ocr_success,
                is_pdf_label_success = EXCLUDED.is_pdf_label_success,
                warnings = EXCLUDED.warnings,
                updated_at = EXCLUDED.updated_at
        """, (
            folder_id, total_pages, matched_pages, unmatched_pages, incomplete_pages,
            match_percentage, is_100_percent_matched, status, processed_date,
            ocr_engine, is_ocr_success, is_pdf_label_success, warnings,
            datetime.now(), datetime.now()
        ))

        # Delete existing pages for this folder
        cur.execute("DELETE FROM pages WHERE folder_id = %s", (folder_id,))

        # Insert pages
        if pages:
            page_values = []
            for page_num, page_data in pages.items():
                page_values.append((
                    folder_id,
                    page_num,
                    page_data.get('template'),
                    page_data.get('category'),
                    page_data.get('status', 'unknown'),
                    page_data.get('page_type'),
                    page_data.get('match_reason'),
                    page_data.get('reason'),
                    datetime.now(),
                    datetime.now()
                ))

            execute_values(
                cur,
                """
                INSERT INTO pages (
                    folder_id, page_number, template, category, status,
                    page_type, match_reason, reason, created_at, updated_at
                ) VALUES %s
                """,
                page_values
            )

        conn.commit()
        return True

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"ERROR saving folder config to database: {e}")
        import traceback
        traceback.print_exc()
        return False

    finally:
        if conn:
            cur.close()
            conn.close()


def get_folder_config(folder_id: int) -> Optional[Dict[str, Any]]:
    """
    Get folder configuration from database.

    Args:
        folder_id: Folder ID to retrieve

    Returns:
        Dictionary with folder and pages data, or None if not found
    """
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        # Get folder data
        cur.execute("""
            SELECT
                id, total_pages, matched_pages, unmatched_pages, incomplete_pages,
                match_percentage, is_100_percent_matched, status, processed_date,
                ocr_engine, is_ocr_success, is_pdf_label_success, warnings
            FROM folders
            WHERE id = %s
        """, (folder_id,))

        folder_row = cur.fetchone()
        if not folder_row:
            return None

        # Get pages data
        cur.execute("""
            SELECT
                page_number, template, category, status, page_type,
                match_reason, reason
            FROM pages
            WHERE folder_id = %s
            ORDER BY page_number
        """, (folder_id,))

        pages_rows = cur.fetchall()

        # Build response
        config = {
            'folder_id': folder_row[0],
            'total_pages': folder_row[1],
            'matched_pages': folder_row[2],
            'unmatched_pages': folder_row[3],
            'incomplete_pages': folder_row[4],
            'match_percentage': float(folder_row[5]),
            'is_100_percent_matched': folder_row[6],
            'status': folder_row[7],
            'processed_date': folder_row[8].isoformat() if folder_row[8] else None,
            'ocr_engine': folder_row[9],
            'is_ocr_success': folder_row[10],
            'is_pdf_label_success': folder_row[11],
            'warnings': folder_row[12] or [],
            'pages': {}
        }

        # Add pages
        for page_row in pages_rows:
            page_num = page_row[0]
            config['pages'][str(page_num)] = {
                'template': page_row[1],
                'category': page_row[2],
                'status': page_row[3],
                'page_type': page_row[4],
                'match_reason': page_row[5],
                'reason': page_row[6]
            }

        return config

    except Exception as e:
        print(f"ERROR getting folder config from database: {e}")
        return None

    finally:
        if conn:
            cur.close()
            conn.close()


def list_all_folders() -> List[Dict[str, Any]]:
    """
    List all folders from database.

    Returns:
        List of folder dictionaries with summary data
    """
    conn = None
    try:
        conn = get_connection()
        cur = conn.cursor()

        cur.execute("""
            SELECT
                id, total_pages, matched_pages, unmatched_pages,
                match_percentage, status, is_100_percent_matched
            FROM folders
            ORDER BY id
        """)

        rows = cur.fetchall()
        folders = []

        for row in rows:
            folders.append({
                'id': str(row[0]),
                'totalPages': row[1],
                'matchedPages': row[2],
                'unmatchedPages': row[3],
                'matchPercentage': float(row[4]),
                'status': row[5],
                'isComplete': row[6] and row[3] == 0
            })

        return folders

    except Exception as e:
        print(f"ERROR listing folders from database: {e}")
        return []

    finally:
        if conn:
            cur.close()
            conn.close()
