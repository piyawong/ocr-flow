"""
Configuration module for OCR flow processing.

This module contains:
- Global configuration constants
- Fuzzy matching thresholds
- API configuration
"""

# =============================================================================
# FUZZY MATCHING CONFIGURATION
# =============================================================================

# Fuzzy matching threshold (0-100) - ยิ่งสูงยิ่งต้องตรงมาก
# ลดเป็น 80 เพื่อรองรับ OCR ที่อ่านผิดเล็กน้อย เช่น "ข้อ" → "ขอ"
# และ sliding window ที่มี newline/whitespace ปน
FUZZY_THRESHOLD = 80


# =============================================================================
# API CONFIGURATION
# =============================================================================

# API base URL for foundation API
API_BASE_URL = "http://localhost:3001"

# API timeout in seconds
API_TIMEOUT = 10

# File upload timeout in seconds
UPLOAD_TIMEOUT = 30
