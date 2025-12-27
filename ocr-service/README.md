# OCR Microservice - Solution 5

> Multi-Scale Typhoon OCR + 2-Step LLM Ensemble
> สำหรับเอกสารภาษาไทย

---

## Architecture

### Solution 5: Multi-Scale Typhoon OCR

```
Input Image
    │
    ├─[Crop] → Top 1/3, Mid 1/3, Bot 1/3
    │
    ├─ Typhoon Full OCR ─────┐
    ├─ Typhoon Top OCR ──────┤
    ├─ Typhoon Mid OCR ──────┤  (4 engines รัน parallel)
    └─ Typhoon Bot OCR ──────┘
           │
           ▼
    Step 1: LLM รวม Multi-Scale
           (Full เป็นหลัก + Top/Mid/Bot แก้คำ)
           │
           ▼
    Step 2: LLM + Organizations Matching
           (แก้ชื่อมูลนิธิที่อ่านผิด)
           │
           ▼
    Final Result
```

### Process & Threading Model

```
FastAPI Main Process
  │
  └─> ProcessPoolExecutor (5 workers max)
        │
        └─> Worker Process 1
              │
              ├─ Crop image → 3 sections
              │
              └─> ThreadPoolExecutor (4 threads)
                    ├─ Thread 1: Typhoon Full OCR (Key 1)
                    ├─ Thread 2: Typhoon Top OCR (Key 2)
                    ├─ Thread 3: Typhoon Mid OCR (Key 3)
                    └─ Thread 4: Typhoon Bot OCR (Key 4)
                          │
                          ▼
                    [รอทั้ง 4 engines เสร็จ]
                          │
                          ▼
                    Step 1: LLM รวม Multi-Scale (Random Key จาก 1-4)
                          │
                          ▼
                    Step 2: LLM + Organizations (Random Key อีกตัว)
                          │
                          ▼
                    Final Result
```

---

## API Endpoints

### 1. Health Check

**GET** `/health`

Response:
```json
{
  "status": "healthy",
  "version": "2.0.0"
}
```

---

### 2. OCR Single Image

**POST** `/ocr`

**Request:**
```json
{
  "image_base64": "base64_encoded_image_here",
  "api_key": "sk-xxx",  // Single key หรือ
  "api_key": [          // 4 keys สำหรับ load balancing
    "sk-key1",
    "sk-key2",
    "sk-key3",
    "sk-key4"
  ],
  "task_type": "v1.5",
  "figure_language": "Thai"
}
```

**Response:**
```json
{
  "text": "มูลนิธิ สวัสดิ์ ตันติสุข\n\nหมวดที่ ๑...",
  "confidence": 0.0,
  "success": true,
  "error": null
}
```

**curl Example:**
```bash
# Single Key
curl -X POST http://localhost:8000/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "...",
    "api_key": "sk-44MOILV802Bx5EHXKZALQyCUwd9ZXWqIDbNxYwpuqIeY7zE9"
  }'

# Multi Keys (Load Balanced)
curl -X POST http://localhost:8000/ocr \
  -H "Content-Type: application/json" \
  -d '{
    "image_base64": "...",
    "api_key": [
      "sk-key1",
      "sk-key2",
      "sk-key3",
      "sk-key4"
    ]
  }'
```

---

### 3. OCR Batch

**POST** `/ocr/batch`

**Request:**
```json
{
  "images": [
    {"id": "page1", "image_base64": "..."},
    {"id": "page2", "image_base64": "..."}
  ],
  "api_key": ["sk-key1", "sk-key2", "sk-key3", "sk-key4"],
  "task_type": "v1.5",
  "figure_language": "Thai"
}
```

**Response:**
```json
{
  "results": [
    {
      "id": "page1",
      "text": "...",
      "confidence": 0.0,
      "success": true,
      "error": null
    },
    {
      "id": "page2",
      "text": "...",
      "confidence": 0.0,
      "success": true,
      "error": null
    }
  ]
}
```

---

### 4. Sync Organizations

**POST** `/organizations/sync`

อัปเดตรายชื่อมูลนิธิที่ถูกต้อง (สำหรับ auto-correction)

**Request:**
```json
{
  "organizations": [
    "คุณพ่อแส คุณแม่วัน บุญเถื่อน",
    "สวัสดิ์ ตันติสุข",
    "เคหะชุมชนลาดกระบัง"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "message": "Successfully synced 3 organization(s)"
}
```

**curl Example:**
```bash
curl -X POST http://localhost:8000/organizations/sync \
  -H "Content-Type: application/json" \
  -d '{
    "organizations": [
      "คุณพ่อแส คุณแม่วัน บุญเถื่อน",
      "สวัสดิ์ ตันติสุข"
    ]
  }'
```

---

### 5. Get Organizations

**GET** `/organizations`

ดูรายชื่อมูลนิธิปัจจุบัน

**Response:**
```json
{
  "organizations": [
    "คุณพ่อแส คุณแม่วัน บุญเถื่อน",
    "สวัสดิ์ ตันติสุข",
    "เคหะชุมชนลาดกระบัง",
    "สมเจตน์ นำดอกไม้"
  ],
  "count": 4
}
```

**curl Example:**
```bash
curl http://localhost:8000/organizations
```

---

## API Key Distribution

### Single Key Mode:
```
1 key × 6 calls = 6 requests ต่อรูป
```

### Multi-Key Mode (แนะนำ):
```
OCR Phase (4 Typhoon engines):
  Key 1: Typhoon Full OCR = 1 request
  Key 2: Typhoon Top OCR = 1 request
  Key 3: Typhoon Mid OCR = 1 request
  Key 4: Typhoon Bot OCR = 1 request

LLM Phase (2 steps):
  Random 2 keys จาก 4 keys
  เช่น: ได้ Key 1, 3 → LLM Step 1 ใช้ Key 1, LLM Step 2 ใช้ Key 3
  หรือ: ได้ Key 2, 4 → LLM Step 1 ใช้ Key 2, LLM Step 2 ใช้ Key 4

PaddleOCR: Local (ไม่ใช้ API)
```

**ข้อดี Multi-Key:**
- กระจาย rate limit (50 req/min × 4 = 200 req/min)
- Random LLM keys → กระจายโหลดเท่าๆ กัน
- ทำได้ ~33 รูป/nาที (แทนที่จะ 8 รูป/นาที)

---

## Installation

### 1. Install Dependencies

```bash
pip install -r requirements.txt
```

**requirements.txt:**
```
fastapi
uvicorn
pydantic
python-multipart
typhoon-ocr
paddleocr
pillow
openai
```

### 2. Setup API Keys

สร้างไฟล์ `.env`:
```bash
TYPHOON_OCR_API_KEY_1=sk-xxx
TYPHOON_OCR_API_KEY_2=sk-xxx
TYPHOON_OCR_API_KEY_3=sk-xxx
TYPHOON_OCR_API_KEY_4=sk-xxx
```

### 3. Setup Organizations (Optional)

สร้างไฟล์ `organizations.json`:
```json
[
  "คุณพ่อแส คุณแม่วัน บุญเถื่อน",
  "สวัสดิ์ ตันติสุข",
  "เคหะชุมชนลาดกระบัง"
]
```

หรือใช้ API `/organizations/sync` อัปเดตได้

---

## Running

### Start Server

```bash
# Default (5 workers)
python main.py

# Custom workers
OCR_MAX_WORKERS=10 python main.py
```

Server จะรันที่: `http://localhost:8000`

---

## Testing

### Test Single Image

```bash
python test_multi_keys.py
```

### Manual Test with curl

```bash
# 1. Encode image
IMAGE_B64=$(base64 -i test.jpg)

# 2. Call API
curl -X POST http://localhost:8000/ocr \
  -H "Content-Type: application/json" \
  -d "{
    \"image_base64\": \"$IMAGE_B64\",
    \"api_key\": \"sk-44MOILV802Bx5EHXKZALQyCUwd9ZXWqIDbNxYwpuqIeY7zE9\"
  }"
```

---

## Performance

### Server Requirements (6 cores / 12 GB RAM):

| Workers | Concurrent Requests | Memory Usage |
|---------|---------------------|--------------|
| 5 | 5 requests | ~12 GB |
| 10 | 10 requests | ~24 GB (need upgrade) |

### Speed:

| Mode | Time per Image | Images per Minute |
|------|---------------|-------------------|
| Single Key | ~3-4 min | ~8 images |
| Multi-Key (4 keys) | ~3-4 min | ~33 images |

---

## Features

### ✅ OCR Accuracy Improvements:

1. **Multi-Scale OCR:**
   - Crop image → แต่ละ section อ่านแม่นกว่า
   - แก้ "วัดภูพระสงฆ์" → "วัตถุประสงค์" ✅

2. **PaddleOCR Cross-Check:**
   - อ่านตัวอักษรไทยแม่นกว่า
   - แก้ "เทศะชุมชน" → "เคหะชุมชน" ✅

3. **Organization Matching:**
   - แก้ชื่อมูลนิธิที่อ่านผิด
   - แก้ "บุญเฉื่อน" → "บุญเถื่อน" ✅

4. **2-Step LLM Ensemble:**
   - Step 1: รวม Multi-Scale
   - Step 2: Cross-check Paddle + Organizations

---

## Files Structure

```
ocr-service/
├── main.py                  # Main service (Solution 5)
├── main.py.backup           # Backup (original)
├── main.py.backup2          # Backup (solution 2)
├── main.py.backup3          # Backup (solution 5 draft)
├── organizations.json       # Organization names
├── requirements.txt         # Dependencies
├── .env                     # API keys
├── test.jpg                 # Test image 1
├── test_2.jpg               # Test image 2
├── test_3.jpg               # Test image 3
├── test_4.png               # Test image 4
└── test_multi_keys.py       # Test script
```

---

## Troubleshooting

### Server ไม่ start:

```bash
# Check port 8000
lsof -ti:8000 | xargs kill -9

# Start again
python main.py
```

### Rate Limit:

ถ้าเจอ `429 Too Many Requests`:
- ใช้ multi-keys (4 keys)
- ลด OCR_MAX_WORKERS

### Memory:

ถ้า RAM ไม่พอ:
- ลด OCR_MAX_WORKERS จาก 5 → 3
- หรือ upgrade RAM → 16-24 GB

---

**Created:** 2025-12-26
**Version:** 5.0.0
**Author:** OCR Flow Development Team
