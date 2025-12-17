"""
Utility module for OCR flow processing.

This module contains:
- log() - Print log messages with timestamp
- get_processable_folders() - Get folders ready to process
- get_sorted_images() - Get sorted image files from folder
- mark_folder_as_labeled() - Mark folder as processed
"""

from __future__ import annotations
import re
from datetime import datetime
from pathlib import Path


# =============================================================================
# LOGGING
# =============================================================================

def log(msg: str):
    """
    Print log with timestamp.

    Args:
        msg: Message to log
    """
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


# =============================================================================
# FOLDER OPERATIONS
# =============================================================================

def get_processable_folders(group_dir: Path) -> list[tuple[int, Path]]:
    """
    Get folders that are ready to process (no -temp, -label, or -incomplete suffix).

    Args:
        group_dir: Directory containing folders to process

    Returns:
        List of (folder_id, folder_path) tuples, sorted by folder_id
    """
    folders = []
    for d in group_dir.iterdir():
        if d.is_dir():
            name = d.name
            if name.endswith('-temp') or name.endswith('-label') or name.endswith('-incomplete'):
                continue
            if name.isdigit():
                folders.append((int(name), d))

    folders.sort(key=lambda x: x[0])
    return folders


def mark_folder_as_labeled(folder: Path, has_unmatched: bool = False):
    """
    Rename folder with -label suffix to mark as processed.

    Args:
        folder: Folder path to mark
        has_unmatched: Whether folder has unmatched pages (ignored - always use -label)
    """
    # Always rename to -label suffix
    new_name = f"{folder.name}-label"
    new_path = folder.parent / new_name

    # Rename the folder
    folder.rename(new_path)

    log(f"  ✓ Processing complete for folder: {folder.name}")
    log(f"    → Renamed to: {new_name}")
    if has_unmatched:
        log(f"    (Note: Some pages unmatched - check config.json for details)")
    else:
        log(f"    (All pages matched successfully)")


# =============================================================================
# IMAGE OPERATIONS
# =============================================================================

def get_sorted_images(folder: Path) -> list[Path]:
    """
    Get images sorted by numerical order.

    Args:
        folder: Folder containing images

    Returns:
        List of image file paths, sorted by numerical prefix
    """
    files = []
    for f in folder.iterdir():
        if f.is_file() and f.suffix.lower() in ['.jpeg', '.jpg', '.png']:
            match = re.match(r'^(\d+)', f.stem)
            if match:
                files.append((int(match.group(1)), f))

    files.sort(key=lambda x: x[0])
    return [f[1] for f in files]
