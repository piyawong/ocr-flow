"""
API client module for OCR flow processing.

This module contains:
- send_foundation_data_to_api() - Send foundation data to API
- upload_pdfs_to_api() - Upload PDF files to API
- upload_logo_to_api() - Upload logo image to API
- create_folder_via_api() - Create folder in API
- upload_pdf_file() - Upload single PDF file
"""

from __future__ import annotations
import json
import urllib.request
import urllib.error
import uuid
from pathlib import Path

# Handle both package and direct execution
try:
    from .config import API_BASE_URL, API_TIMEOUT, UPLOAD_TIMEOUT
    from .utils import log
except ImportError:
    from config import API_BASE_URL, API_TIMEOUT, UPLOAD_TIMEOUT
    from utils import log


# =============================================================================
# API COMMUNICATION FUNCTIONS
# =============================================================================

def send_foundation_data_to_api(folder_id: int, output_folder: Path) -> tuple[bool, str | None]:
    """
    Send foundation data to API endpoint.
    Combines foundation-instrument.json and committee-members.json data.

    Args:
        folder_id: Folder ID being processed
        output_folder: Path to output folder containing JSON files

    Returns:
        Tuple of (success, foundation_id)
        - success: True if data was sent successfully
        - foundation_id: ID returned from API, or None if failed

    Note:
        Returns (False, None) without sending if name is null/empty (requires manual review).
    """
    api_url = f"{API_BASE_URL}/foundations"
    log(f"  📡 Preparing to send data to API: {api_url}")

    # Read foundation-instrument.json
    foundation_path = output_folder / "foundation-instrument.json"
    foundation_data = None
    if foundation_path.exists():
        try:
            with open(foundation_path, 'r', encoding='utf-8') as f:
                foundation_data = json.load(f)
            log(f"     ✓ Loaded foundation-instrument.json")
        except Exception as e:
            log(f"     ⚠️  Warning: Failed to read foundation-instrument.json: {e}")
    else:
        log(f"     ⚠️  foundation-instrument.json not found - will send null")

    # Read committee-members.json
    committee_path = output_folder / "committee-members.json"
    committee_data = None
    if committee_path.exists():
        try:
            with open(committee_path, 'r', encoding='utf-8') as f:
                committee_data = json.load(f)
            log(f"     ✓ Loaded committee-members.json")
        except Exception as e:
            log(f"     ⚠️  Warning: Failed to read committee-members.json: {e}")
    else:
        log(f"     ⚠️  committee-members.json not found - will send null")

    # Combine data according to full-data.json structure
    log(f"     📦 Building payload...")
    payload = {}

    # Add foundation instrument fields if available
    if foundation_data:
        payload.update({
            "name": foundation_data.get("name"),
            "shortName": foundation_data.get("shortName"),
            "address": foundation_data.get("address"),
            "logoDescription": foundation_data.get("logoDescription"),
            "charterSections": foundation_data.get("charterSections", [])
        })
        log(f"     ✓ Added foundation data: {foundation_data.get('name', 'N/A')}")
    else:
        payload.update({
            "name": None,
            "shortName": None,
            "address": None,
            "logoDescription": None,
            "charterSections": None
        })
        log(f"     ⚠️  Foundation data is null")

    # Add committee members if available
    if committee_data and "committeeMembers" in committee_data:
        payload["committeeMembers"] = committee_data["committeeMembers"]
        log(f"     ✓ Added {len(committee_data['committeeMembers'])} committee members")
    else:
        payload["committeeMembers"] = None
        log(f"     ⚠️  Committee members data is null")

    # Check if name is valid before sending
    if not payload.get("name") or payload.get("name") == "":
        log(f"  ⚠️  Skipping API call: name is null or empty (requires manual review)")
        return False, None

    # Send POST request
    log(f"     🚀 Sending POST request...")
    try:
        json_data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        log(f"     📊 Payload size: {len(json_data)} bytes")

        req = urllib.request.Request(
            api_url,
            data=json_data,
            headers={
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': str(len(json_data))
            },
            method='POST'
        )

        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as response:
            response_data = response.read().decode('utf-8')
            log(f"  ✅ Successfully sent data to API (HTTP {response.status})")

            # Parse response to get foundation ID
            try:
                response_json = json.loads(response_data)
                foundation_id = response_json.get("id")
                log(f"     Foundation ID: {foundation_id}")
            except:
                foundation_id = None
                log(f"     ⚠️  Could not parse foundation ID from response")

            if len(response_data) > 150:
                log(f"     Response: {response_data[:150]}...")
            else:
                log(f"     Response: {response_data}")

            return True, foundation_id  # Success

    except urllib.error.HTTPError as e:
        log(f"  ❌ HTTP Error sending data to API: {e.code} {e.reason}")
        try:
            error_body = e.read().decode('utf-8')
            if len(error_body) > 200:
                log(f"     Error response: {error_body[:200]}...")
            else:
                log(f"     Error response: {error_body}")
        except:
            pass
        return False, None  # Failed
    except urllib.error.URLError as e:
        log(f"  ❌ URL Error sending data to API: {e.reason}")
        log(f"     💡 Make sure the API server is running at {api_url}")
        return False, None  # Failed
    except Exception as e:
        log(f"  ❌ Error sending data to API: {e}")
        return False, None  # Failed


def upload_pdfs_to_api(folder_id: int, output_folder: Path, foundation_id: str):
    """
    Upload PDF files to API.
    Scans pdfs/ folder and uploads all PDFs with proper folder structure.

    Args:
        folder_id: Folder ID being processed
        output_folder: Path to output folder containing pdfs/ subfolder
        foundation_id: Foundation ID from API
    """
    pdfs_dir = output_folder / "pdfs"
    if not pdfs_dir.exists():
        log(f"     ⚠️  pdfs/ folder not found - skipping upload")
        return

    # Track created folders: category_name -> folder_id
    created_folders = {}

    # Scan pdfs/ directory
    all_pdfs = []  # List of (pdf_path, category_name or None)

    # Get PDFs in root of pdfs/
    for item in pdfs_dir.iterdir():
        if item.is_file() and item.suffix.lower() == '.pdf':
            all_pdfs.append((item, None))  # No category (root)
        elif item.is_dir():
            # This is a category folder
            category_name = item.name
            for pdf_file in item.iterdir():
                if pdf_file.is_file() and pdf_file.suffix.lower() == '.pdf':
                    all_pdfs.append((pdf_file, category_name))

    if not all_pdfs:
        log(f"     ⚠️  No PDF files found in pdfs/ folder")
        return

    log(f"     Found {len(all_pdfs)} PDF files to upload")

    # Upload PDFs
    uploaded_count = 0
    for pdf_path, category in all_pdfs:
        try:
            # Create folder if needed (for categorized PDFs)
            parent_id = None
            if category:
                if category not in created_folders:
                    # Create folder via API
                    folder_created, folder_id = create_folder_via_api(foundation_id, category)
                    if folder_created:
                        created_folders[category] = folder_id
                        log(f"     ✓ Created folder: {category}")
                    else:
                        log(f"     ⚠️  Failed to create folder: {category} - uploading to root instead")
                        parent_id = None
                else:
                    parent_id = created_folders[category]

                parent_id = created_folders.get(category)

            # Upload PDF file
            success = upload_pdf_file(foundation_id, pdf_path, parent_id, category)
            if success:
                uploaded_count += 1
                if category:
                    log(f"     ✓ Uploaded: {category}/{pdf_path.name}")
                else:
                    log(f"     ✓ Uploaded: {pdf_path.name}")
            else:
                if category:
                    log(f"     ✗ Failed: {category}/{pdf_path.name}")
                else:
                    log(f"     ✗ Failed: {pdf_path.name}")

        except Exception as e:
            log(f"     ✗ Error uploading {pdf_path.name}: {e}")

    log(f"  ✅ Upload complete: {uploaded_count}/{len(all_pdfs)} files uploaded")


def create_folder_via_api(foundation_id: str, folder_name: str) -> tuple[bool, str | None]:
    """
    Create a folder via API.

    Args:
        foundation_id: Foundation ID
        folder_name: Name of folder to create

    Returns:
        Tuple of (success, folder_id)
        - success: True if folder was created
        - folder_id: ID of created folder, or None if failed
    """
    api_url = f"{API_BASE_URL}/foundations/{foundation_id}/folders"

    payload = {
        "foundationId": foundation_id,
        "name": folder_name
    }

    try:
        json_data = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        req = urllib.request.Request(
            api_url,
            data=json_data,
            headers={
                'Content-Type': 'application/json; charset=utf-8'
            },
            method='POST'
        )

        with urllib.request.urlopen(req, timeout=API_TIMEOUT) as response:
            response_data = response.read().decode('utf-8')
            response_json = json.loads(response_data)
            folder_id = response_json.get("id")
            return True, folder_id

    except Exception as e:
        log(f"     ✗ Error creating folder '{folder_name}': {e}")
        return False, None


def upload_pdf_file(foundation_id: str, pdf_path: Path, parent_id: str | None, category: str | None) -> bool:
    """
    Upload a single PDF file to API using multipart/form-data.

    Args:
        foundation_id: Foundation ID
        pdf_path: Path to PDF file to upload
        parent_id: Parent folder ID (or None for root)
        category: Category name (for logging only)

    Returns:
        True if upload was successful
    """
    api_url = f"{API_BASE_URL}/foundations/{foundation_id}/documents"

    # Read file
    with open(pdf_path, 'rb') as f:
        file_data = f.read()

    # Create multipart boundary
    boundary = f'----WebKitFormBoundary{uuid.uuid4().hex[:16]}'

    # Build multipart body
    body_parts = []

    # Add file field
    body_parts.append(f'--{boundary}'.encode())
    body_parts.append(f'Content-Disposition: form-data; name="file"; filename="{pdf_path.name}"'.encode())
    body_parts.append(f'Content-Type: application/pdf'.encode())
    body_parts.append(b'')
    body_parts.append(file_data)

    # Add parentId field if exists
    if parent_id:
        body_parts.append(f'--{boundary}'.encode())
        body_parts.append(b'Content-Disposition: form-data; name="parentId"')
        body_parts.append(b'')
        body_parts.append(parent_id.encode())

    # End boundary
    body_parts.append(f'--{boundary}--'.encode())

    # Join with CRLF
    body = b'\r\n'.join(body_parts)

    try:
        req = urllib.request.Request(
            api_url,
            data=body,
            headers={
                'Content-Type': f'multipart/form-data; boundary={boundary}'
            },
            method='POST'
        )

        with urllib.request.urlopen(req, timeout=UPLOAD_TIMEOUT) as response:
            return True

    except Exception as e:
        log(f"     ✗ Upload error: {e}")
        return False


def upload_logo_to_api(foundation_id: str, logo_path: Path) -> bool:
    """
    Upload logo image to API using multipart/form-data.

    Args:
        foundation_id: Foundation ID
        logo_path: Path to logo image file (PNG, JPG, JPEG, GIF, WebP)

    Returns:
        True if upload was successful

    API Endpoint:
        POST /foundations/:foundationId/logo
        Content-Type: multipart/form-data
        Field: file
    """
    api_url = f"{API_BASE_URL}/foundations/{foundation_id}/logo"

    # Check if file exists
    if not logo_path.exists():
        log(f"     ⚠️  Logo file not found: {logo_path}")
        return False

    # Read file
    try:
        with open(logo_path, 'rb') as f:
            file_data = f.read()
    except Exception as e:
        log(f"     ✗ Error reading logo file: {e}")
        return False

    # Determine MIME type from extension
    ext = logo_path.suffix.lower()
    mime_types = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    }
    content_type = mime_types.get(ext, 'image/png')

    # Create multipart boundary
    boundary = f'----WebKitFormBoundary{uuid.uuid4().hex[:16]}'

    # Build multipart body
    body_parts = []

    # Add file field
    body_parts.append(f'--{boundary}'.encode())
    body_parts.append(f'Content-Disposition: form-data; name="file"; filename="{logo_path.name}"'.encode())
    body_parts.append(f'Content-Type: {content_type}'.encode())
    body_parts.append(b'')
    body_parts.append(file_data)

    # End boundary
    body_parts.append(f'--{boundary}--'.encode())

    # Join with CRLF
    body = b'\r\n'.join(body_parts)

    try:
        req = urllib.request.Request(
            api_url,
            data=body,
            headers={
                'Content-Type': f'multipart/form-data; boundary={boundary}'
            },
            method='POST'
        )

        with urllib.request.urlopen(req, timeout=UPLOAD_TIMEOUT) as response:
            log(f"     ✓ Logo uploaded successfully (HTTP {response.status})")
            return True

    except urllib.error.HTTPError as e:
        log(f"     ✗ HTTP Error uploading logo: {e.code} {e.reason}")
        try:
            error_body = e.read().decode('utf-8')
            if len(error_body) > 100:
                log(f"       Error: {error_body[:100]}...")
            else:
                log(f"       Error: {error_body}")
        except:
            pass
        return False
    except urllib.error.URLError as e:
        log(f"     ✗ URL Error uploading logo: {e.reason}")
        return False
    except Exception as e:
        log(f"     ✗ Error uploading logo: {e}")
        return False
