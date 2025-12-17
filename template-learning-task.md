# Template Learning Task - เรียนรู้และปรับปรุง Templates จาก Manual Labels

> **สำหรับ:** Claude AI Assistant
> **อัปเดตล่าสุด:** 2025-12-14
> **Task Type:** Template Optimization & Auto-Learning

---

## 🎯 วัตถุประสงค์

เมื่อผู้ใช้ **manual label** เอกสารที่ระบบ auto-label ไม่ติด Claude จะ:

1. **อ่าน manual labels** - ดูว่าผู้ใช้ label หน้าไหนเป็นเอกสารอะไร
2. **วิเคราะห์ OCR text** - หา patterns ที่เหมาะสมจาก OCR text ของหน้านั้น
3. **สร้าง/อัปเดต templates** - เพิ่ม patterns ลงใน Database เพื่อให้ auto-label ผ่านครั้งถัดไป

**เป้าหมาย:** ให้ระบบ "เรียนรู้" จาก manual labels และปรับปรุง templates อัตโนมัติ

---

## 📋 เอกสารที่ต้องอ่านก่อน

**MANDATORY:** อ่านก่อนทำ task นี้ทุกครั้ง

1. **[auto-label.md](./auto-label.md)** ⭐ - เข้าใจ logic การทำงานของ auto-label
   - Pattern Matching Strategy (Exact Match)
   - AND/OR Logic
   - Negative Patterns
   - Template Structure

2. **[STRUCTURE.md](./STRUCTURE.md)** - โครงสร้างระบบ
   - Database Schema (templates table)
   - API Endpoints

---

## 🔄 Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. User Manual Label (ผ่าน UI: /stages/03-pdf-label/manual)   │
│    - User label หน้าที่ auto-label ไม่ติด                      │
│    - Save manual labels ผ่าน PATCH /labeled-files/group/:id   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. Claude อ่าน Manual Labels                                   │
│    API: GET /labeled-files/group/{groupId}                     │
│    - Filter เฉพาะ pages ที่ status !== 'unmatched'            │
│    - Group ตาม templateName                                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. วิเคราะห์ OCR Text แต่ละ Template                          │
│    For each template:                                          │
│    - หา FIRST PAGE (status: 'start' หรือ 'single')           │
│      → วิเคราะห์ firstPagePatterns                             │
│    - หา LAST PAGE (status: 'end') - ถ้าไม่ใช่ single page    │
│      → วิเคราะห์ lastPagePatterns                              │
│    - หา NEGATIVE PATTERNS (คำที่ควรหลีกเลี่ยง)                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. ตรวจสอบ Template ที่มีอยู่แล้ว                               │
│    API: GET /templates                                         │
│    - ถ้ามี template ชื่อเดียวกัน → ถาม user ว่าจะ:           │
│      [A] อัปเดต patterns ที่มีอยู่                            │
│      [B] เพิ่ม variants ใหม่ (OR logic)                       │
│      [C] สร้าง template ใหม่ (ถ้าเป็นคนละประเภท)             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. แสดง Recommended Patterns ให้ User Review                  │
│    - แสดง patterns ที่แนะนำ                                   │
│    - แสดง negative patterns (ถ้ามี)                           │
│    - แสดง reasoning (ทำไมถึงเลือก patterns นี้)              │
│    - รอ user อนุมัติก่อนดำเนินการ                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. สร้าง/อัปเดต Template                                       │
│    [NEW] POST /templates                                       │
│    [UPDATE] PUT /templates/{id}                                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. ทดสอบ (Relabel Group)                                       │
│    API: POST /label-runner/relabel/{groupId}                   │
│    - ตรวจสอบว่า auto-label ผ่านหรือไม่                        │
│    - แสดงผลลัพธ์: matched/total pages                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. รายงานผล                                                    │
│    - Template ที่สร้าง/อัปเดต                                 │
│    - Patterns ที่เพิ่ม                                         │
│    - ผลการทดสอบ (before/after)                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📚 API Endpoints

### อ่าน Manual Labels
```bash
GET /labeled-files/group/{groupId}

Response:
[
  {
    "id": 1,
    "orderInGroup": 1,
    "originalName": "page_001.jpg",
    "templateName": "ตราสาร",
    "labelStatus": "start",  // start | continue | end | single | unmatched
    "matchReason": "manual",
    "ocrText": "{\"natural_text\": \"ข้อบังคับ มูลนิธิ...\"}"
  },
  ...
]
```

### อ่าน Templates ที่มีอยู่
```bash
GET /templates

Response:
[
  {
    "id": 1,
    "name": "ตราสาร",
    "firstPagePatterns": [["ข้อบังคับ", "หมวดที่"]],
    "lastPagePatterns": [["ลงนาม", "ผู้จัดทำข้อบังคับ"]],
    "firstPageNegativePatterns": null,
    "isSinglePage": false,
    "isActive": true,
    "category": "เอกสารมูลนิธิ",
    "sortOrder": 0
  },
  ...
]
```

### สร้าง Template ใหม่
```bash
POST /templates
Content-Type: application/json

{
  "name": "ชื่อเอกสาร",
  "firstPagePatterns": [
    ["pattern1", "pattern2", "pattern3"],
    ["alternative_pattern"]
  ],
  "lastPagePatterns": [
    ["end_pattern1", "end_pattern2"]
  ],
  "firstPageNegativePatterns": [
    ["negative_pattern"]
  ],
  "lastPageNegativePatterns": null,
  "isSinglePage": false,
  "isActive": true,
  "category": "หมวดหมู่",
  "sortOrder": 0
}
```

### อัปเดต Template
```bash
PUT /templates/{id}
Content-Type: application/json

{
  "firstPagePatterns": [...],  // อัปเดตเฉพาะ field ที่ต้องการ
  "lastPagePatterns": [...]
}
```

### Relabel Group (ทดสอบ)
```bash
POST /label-runner/relabel/{groupId}

Response:
{
  "success": true,
  "matched": 10,
  "total": 12,
  "message": "Re-labeled group 1: 10/12 pages matched"
}
```

---

## 🔍 Pattern Selection Guidelines

### หลักการเลือก Patterns

#### 1. ✅ เลือกคำที่เป็นเอกลักษณ์
```
✓ GOOD: ["ข้อบังคับ", "หมวดที่", "ชื่อเครื่องหมาย"]
  → เฉพาะเจาะจง ไม่ซ้ำเอกสารอื่น

✗ BAD: ["มูลนิธิ"]
  → กว้างเกินไป ซ้ำกับเอกสารอื่นได้
```

#### 2. ✅ เลือกคำที่คงที่ (ไม่ใช่ข้อมูลผันแปร)
```
✓ GOOD: ["ประกาศนายทะเบียนมูลนิธิ", "เรื่อง จดทะเบียน"]
  → คำเหล่านี้ปรากฏในทุกฉบับ

✗ BAD: ["มูลนิธิสมเจตน์", "นายคณิสร เย็นใจ"]
  → ชื่อเฉพาะ เปลี่ยนไปตามแต่ละมูลนิธิ
```

#### 3. ✅ ใช้ 2-4 patterns ต่อ variant (AND logic)
```
✓ GOOD: ["บทเบ็ดเตล็ด", "ลงนาม", "ผู้จัดทำข้อบังคับ"]
  → ต้องเจอทั้ง 3 คำ (AND logic)

✗ BAD: ["ลงนาม"]
  → 1 คำอาจไม่เพียงพอ อาจ match ผิด
```

#### 4. ✅ หลีกเลี่ยงคำสั้นเกินไป
```
✓ GOOD: ["ข้อบังคับ", "หมวดที่"]
  → คำยาวพอที่จะเฉพาะเจาะจง

✗ BAD: ["ข้อ", "ที่"]
  → สั้นเกินไป match ง่ายเกินไป
```

#### 5. ✅ ใช้ Negative Patterns ป้องกัน False Positive
```
Template: ตราสาร
firstPagePatterns: [["ข้อบังคับ", "หมวดที่", "ชื่อเครื่องหมาย"]]

firstPageNegativePatterns: [
  ["แก้ไขเพิ่มเติมข้อบังคับ"],  // ป้องกัน match "ตราสารแก้ไข"
  ["ฉบับที่ ๒"],                 // ป้องกัน match "ตราสารฉบับที่ 2"
  ["บันทึกการประชุม"]            // ป้องกัน match "รายงานประชุม"
]
```

---

## 🛠️ วิธีวิเคราะห์ OCR Text

### ขั้นตอนที่ 1: Extract OCR Text

OCR text อยู่ในรูปแบบ JSON:
```json
{
  "natural_text": "ข้อบังคับ\nมูลนิธิสมเจตน์ น้ำดอกไม้...",
  "text": "ข้อบังคับ มูลนิธิสมเจตน์..."
}
```

ใช้ `natural_text` (ถ้ามี) หรือ `text`

### ขั้นตอนที่ 2: Normalize Text

ทำตามที่ระบบทำ (ดู auto-label.md):
```typescript
normalizedText = text
  .toLowerCase()        // แปลงเป็นตัวพิมพ์เล็ก
  .trim()               // ตัด whitespace
  .replace(/\s+/g, ' ') // Collapse whitespace
```

### ขั้นตอนที่ 3: หา Unique Patterns

#### สำหรับ First Page (status: 'start' หรือ 'single'):

1. **อ่าน OCR text ของหน้าแรก**
2. **หาคำที่โดดเด่น:**
   - ชื่อเอกสาร (เช่น "ข้อบังคับ", "ประกาศนายทะเบียน")
   - โครงสร้างเฉพาะ (เช่น "หมวดที่ ๑", "ข้อ ๑")
   - ส่วนหัว (เช่น "เรื่อง จดทะเบียน", "ชื่อเครื่องหมาย")
3. **ตรวจสอบว่าคำเหล่านี้ปรากฏเฉพาะหน้าแรกหรือไม่**
   - ดูหน้าอื่นๆ ใน group
   - ถ้าพบในหน้ากลางด้วย → ไม่เหมาะเป็น first_page_patterns

#### สำหรับ Last Page (status: 'end'):

1. **อ่าน OCR text ของหน้าสุดท้าย**
2. **หาคำที่บ่งบอกการจบเอกสาร:**
   - บทเบ็ดเตล็ด
   - ลายเซ็น (เช่น "ลงนาม", "ลงชื่อ")
   - ตำแหน่ง (เช่น "ผู้จัดทำข้อบังคับ", "ประธานกรรมการ")
3. **ตรวจสอบว่าคำเหล่านี้ปรากฏเฉพาะหน้าสุดท้ายหรือไม่**

### ขั้นตอนที่ 4: สร้าง Variants (OR Logic)

หากพบหลายรูปแบบของเอกสารเดียวกัน:
```json
"firstPagePatterns": [
  ["ข้อบังคับ", "หมวดที่", "ชื่อเครื่องหมาย"],     // Variant 1
  ["ข้อบังคับมูลนิธิ", "วัตถุประสงค์"],           // Variant 2
  ["ตราสารมูลนิธิ", "หมวดที่"]                    // Variant 3
]
```

---

## 📊 ตัวอย่างการวิเคราะห์

### Input: Manual Labels from Group 1

```json
[
  {
    "orderInGroup": 1,
    "templateName": "ตราสาร",
    "labelStatus": "start",
    "ocrText": "{\"natural_text\": \"ข้อบังคับ\\nมูลนิธิสมเจตน์...\\n\\nหมวดที่ ๑\\nชื่อ เครื่องหมาย และสำนักงาน\\n\\nข้อ ๑ มูลนิธินี้ชื่อว่า...\"}"
  },
  {
    "orderInGroup": 2,
    "templateName": "ตราสาร",
    "labelStatus": "continue",
    "ocrText": "{\"natural_text\": \"หมวดที่ ๒\\nวัตถุประสงค์...\"}"
  },
  {
    "orderInGroup": 7,
    "templateName": "ตราสาร",
    "labelStatus": "end",
    "ocrText": "{\"natural_text\": \"หมวดที่ ๑๒\\nบทเบ็ดเตล็ด\\n\\nข้อ ๔๒ ให้นำบทบัญญัติ...\\n\\n(ลงนาม) ผู้จัดทำข้อบังคับ\\n(นายคณิสร เย็นใจ)\\nประธานกรรมการมูลนิธิ\"}"
  }
]
```

### Analysis Process

#### 1. วิเคราะห์หน้าแรก (orderInGroup: 1, status: 'start'):

**OCR Text:**
```
ข้อบังคับ
มูลนิธิสมเจตน์...

หมวดที่ ๑
ชื่อ เครื่องหมาย และสำนักงาน

ข้อ ๑ มูลนิธินี้ชื่อว่า...
```

**Normalized:**
```
ข้อบังคับ มูลนิธิสมเจตน์... หมวดที่ ๑ ชื่อ เครื่องหมาย และสำนักงาน ข้อ ๑ มูลนิธินี้ชื่อว่า...
```

**คำที่โดดเด่น:**
- ✅ "ข้อบังคับ" - ปรากฏหน้าแรก
- ✅ "หมวดที่" - ปรากฏหลายหน้า แต่ร่วมกับ "ข้อบังคับ" เป็นเอกลักษณ์
- ✅ "ชื่อ เครื่องหมาย และสำนักงาน" - เฉพาะหน้าแรก
- ❌ "มูลนิธิสมเจตน์" - ชื่อเฉพาะ (ผันแปร)

**Recommended firstPagePatterns:**
```json
[
  ["ข้อบังคับ", "หมวดที่", "ชื่อ", "เครื่องหมาย", "และสำนักงาน"],
  ["ข้อบังคับ", "หมวดที่ ๑", "ข้อ ๑"]
]
```

**Reasoning:**
- Variant 1: ใช้โครงสร้างหน้าแรก (ชื่อ เครื่องหมาย และสำนักงาน)
- Variant 2: ใช้หมายเลขหมวดและข้อ (หมวดที่ ๑, ข้อ ๑)

#### 2. วิเคราะห์หน้าสุดท้าย (orderInGroup: 7, status: 'end'):

**OCR Text:**
```
หมวดที่ ๑๒
บทเบ็ดเตล็ด

ข้อ ๔๒ ให้นำบทบัญญัติ...

(ลงนาม) ผู้จัดทำข้อบังคับ
(นายคณิสร เย็นใจ)
ประธานกรรมการมูลนิธิ
```

**คำที่โดดเด่น:**
- ✅ "บทเบ็ดเตล็ด" - เฉพาะหน้าสุดท้าย
- ✅ "ลงนาม" - เฉพาะหน้าสุดท้าย
- ✅ "ผู้จัดทำข้อบังคับ" - เฉพาะหน้าสุดท้าย
- ✅ "ประธานกรรมการมูลนิธิ" - ตำแหน่ง
- ❌ "นายคณิสร เย็นใจ" - ชื่อคน (ผันแปร)

**Recommended lastPagePatterns:**
```json
[
  ["บทเบ็ดเตล็ด", "ลงนาม", "ผู้จัดทำข้อบังคับ"],
  ["หมวดที่ ๑๒", "บทเบ็ดเตล็ด", "ประธานกรรมการ"]
]
```

**Reasoning:**
- Variant 1: ใช้คำหลักที่บ่งบอกการจบ
- Variant 2: ใช้หมายเลขหมวดสุดท้าย + ตำแหน่ง

#### 3. ระบุ Negative Patterns:

**ถามตัวเอง:** มีเอกสารอื่นที่คล้ายกับ "ตราสาร" หรือไม่?
- ตราสารแก้ไข → เพิ่ม negative pattern: `["แก้ไขเพิ่มเติมข้อบังคับ"]`
- ตราสารฉบับที่ 2 → เพิ่ม: `["ฉบับที่ ๒"]`

**Recommended firstPageNegativePatterns:**
```json
[
  ["แก้ไขเพิ่มเติมข้อบังคับ"],
  ["ฉบับที่ ๒"],
  ["ฉบับที่ ๓"]
]
```

### Output: Recommended Template

```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [
    ["ข้อบังคับ", "หมวดที่", "ชื่อ", "เครื่องหมาย", "และสำนักงาน"],
    ["ข้อบังคับ", "หมวดที่ ๑", "ข้อ ๑"]
  ],
  "lastPagePatterns": [
    ["บทเบ็ดเตล็ด", "ลงนาม", "ผู้จัดทำข้อบังคับ"],
    ["หมวดที่ ๑๒", "บทเบ็ดเตล็ด", "ประธานกรรมการ"]
  ],
  "firstPageNegativePatterns": [
    ["แก้ไขเพิ่มเติมข้อบังคับ"],
    ["ฉบับที่ ๒"],
    ["ฉบับที่ ๓"]
  ],
  "lastPageNegativePatterns": null,
  "isSinglePage": false,
  "isActive": true,
  "category": "เอกสารมูลนิธิ",
  "sortOrder": 0
}
```

---

## ⚠️ Safety Checks

### ก่อนสร้าง/อัปเดต Template ต้องตรวจสอบ:

#### 1. ตรวจสอบ Template ที่มีอยู่แล้ว
```bash
GET /templates
```

**ถาม User:**
- มี template ชื่อ "ตราสาร" อยู่แล้ว (id: 1)
- คุณต้องการ:
  - [A] อัปเดต patterns ของ template นี้
  - [B] เพิ่ม variants ใหม่ (OR logic)
  - [C] สร้าง template ใหม่ (ชื่อต่างออกไป)

#### 2. ตรวจสอบ Patterns ไม่ชนกับ Template อื่น

**เปรียบเทียบ:**
```
Template A: ตราสาร
firstPagePatterns: [["ข้อบังคับ", "หมวดที่"]]

Template B: ตราสารแก้ไข
firstPagePatterns: [["ข้อบังคับ", "หมวดที่", "แก้ไขเพิ่มเติม"]]
```

**วิธีแก้:**
- Template A ต้องมี negative pattern: `["แก้ไขเพิ่มเติม"]`
- หรือ Template A ต้องเฉพาะเจาะจงกว่า

#### 3. ตรวจสอบ sortOrder

**Templates ที่เฉพาะเจาะจงกว่าควร มี sortOrder น้อยกว่า:**
```json
[
  {
    "name": "ตราสารแก้ไข",
    "firstPagePatterns": [["ข้อบังคับ", "แก้ไขเพิ่มเติม"]],
    "sortOrder": 0  // ตรวจสอบก่อน
  },
  {
    "name": "ตราสาร",
    "firstPagePatterns": [["ข้อบังคับ", "หมวดที่"]],
    "sortOrder": 1  // ตรวจสอบทีหลัง
  }
]
```

#### 4. ตรวจสอบ isSinglePage

**ถ้า template เป็นเอกสารหน้าเดียว:**
- `isSinglePage: true`
- ไม่ต้องมี `lastPagePatterns`

**ถ้าเป็นเอกสารหลายหน้า:**
- `isSinglePage: false`
- **ต้องมี** `lastPagePatterns` (ไม่งั้น match ไม่จบ)

---

## 🧪 Testing Workflow

### หลังจากสร้าง/อัปเดต Template แล้ว:

#### 1. Relabel Group
```bash
POST /label-runner/relabel/{groupId}
```

#### 2. ตรวจสอบผลลัพธ์
```json
{
  "success": true,
  "matched": 10,
  "total": 12,
  "message": "Re-labeled group 1: 10/12 pages matched"
}
```

**Expected:**
- ✅ หน้าที่ manual label ควร match ได้ทั้งหมด
- ✅ matched count ควรเพิ่มขึ้น (เทียบกับก่อน update)

#### 3. ดูรายละเอียด Labels
```bash
GET /labeled-files/group/{groupId}
```

**ตรวจสอบ:**
- `labelStatus` ถูกต้องหรือไม่ (start, continue, end, single)
- `templateName` ตรงกับที่คาดหวังหรือไม่
- `matchReason` แสดงว่าใช้ pattern ไหน

#### 4. ถ้า Match ไม่ผ่าน → Debug

**สาเหตุที่เป็นไปได้:**

1. **Patterns ไม่ครบ**
   - Solution: เพิ่ม patterns หรือ variants

2. **Patterns กว้างเกินไป → Match ผิด**
   - Solution: เพิ่ม patterns ให้เฉพาะเจาะจง หรือใช้ negative patterns

3. **Last Page ไม่จบ**
   - Solution: ตรวจสอบ `lastPagePatterns` ว่าครบหรือไม่

4. **OCR ผิดพลาด**
   - Solution: ดู OCR text จริงๆ อาจต้องเพิ่ม variants สำหรับ OCR error

---

## 📋 Checklist สำหรับ Claude

### ก่อนเริ่ม Task:
- [ ] อ่าน [auto-label.md](./auto-label.md) แล้วหรือยัง?
- [ ] เข้าใจ Exact Match logic แล้วหรือยัง?
- [ ] เข้าใจ AND/OR logic แล้วหรือยัง?
- [ ] เข้าใจ Negative Patterns แล้วหรือยัง?

### ขณะทำ Task:
- [ ] อ่าน manual labels จาก API แล้ว
- [ ] วิเคราะห์ OCR text ของทุกหน้าที่เกี่ยวข้อง
- [ ] เลือก patterns ที่เฉพาะเจาะจง (ไม่กว้างเกินไป)
- [ ] เลือก patterns ที่คงที่ (ไม่ใช่ข้อมูลผันแปร)
- [ ] ตรวจสอบ negative patterns (ป้องกัน false match)
- [ ] ตรวจสอบว่าไม่ชนกับ template อื่น
- [ ] **แสดง recommended patterns ให้ user review ก่อน**

### หลังอัปเดต Template:
- [ ] Relabel group เพื่อทดสอบ
- [ ] ตรวจสอบว่า match rate เพิ่มขึ้น
- [ ] รายงานผลให้ user ทราบ (before/after)

---

## 💡 Tips

### 1. การเลือก Patterns

**เทคนิค: ใช้ "ชั้นเชิง" (Layering)**
```json
// Layer 1: คำหลักที่แน่นอน 100%
["ข้อบังคับ", "หมวดที่ ๑"]

// Layer 2: โครงสร้างเอกสาร
["ชื่อ", "เครื่องหมาย", "และสำนักงาน"]

// รวมกัน (AND logic):
["ข้อบังคับ", "หมวดที่ ๑", "ชื่อ", "เครื่องหมาย"]
```

### 2. การจัดการ OCR Error

**ถ้า OCR อ่านผิดบ่อย:**
```json
// สร้าง variants สำหรับ OCR error ที่พบบ่อย
"firstPagePatterns": [
  ["ข้อบังคับ", "หมวดที่"],     // ปกติ
  ["ข้อบ่งคับ", "หมวดที่"],     // OCR อ่าน ั เป็น ่
  ["ข้อบังคับ", "หมดที่"]       // OCR พลาด "ว"
]
```

**แต่:** อย่าทำมากเกินไป → ใช้ exact match เท่าที่จำเป็น

### 3. การใช้ Category

**จัดกลุ่มเอกสาร:**
```json
{
  "name": "ตราสาร",
  "category": "เอกสารจัดตั้งมูลนิธิ"
},
{
  "name": "บัญชีรายชื่อกรรมการ",
  "category": "เอกสารจัดตั้งมูลนิธิ"
},
{
  "name": "หนังสือรับรอง",
  "category": "เอกสารรับรอง"
}
```

---

## 📝 Output Format

เมื่อทำ task เสร็จ ให้รายงานในรูปแบบนี้:

```markdown
## 📊 Template Learning Report

### Group Information
- **Group ID:** 1
- **Total Pages:** 12
- **Manual Labeled:** 12 pages

### Analysis Results

#### Template: ตราสาร (NEW / UPDATE)
- **Type:** Multi-page document
- **Pages in group:** 1-7 (7 pages)

**First Page Analysis (Page 1):**
- OCR Text (top 200 chars): "ข้อบังคับ มูลนิธิสมเจตน์..."
- Selected Patterns: ["ข้อบังคับ", "หมวดที่", "ชื่อ", "เครื่องหมาย"]
- Reasoning: เป็นคำที่ปรากฏเฉพาะหน้าแรกและเป็นเอกลักษณ์ของตราสาร

**Last Page Analysis (Page 7):**
- OCR Text (top 200 chars): "บทเบ็ดเตล็ด ลงนาม..."
- Selected Patterns: ["บทเบ็ดเตล็ด", "ลงนาม", "ผู้จัดทำข้อบังคับ"]
- Reasoning: คำเหล่านี้ปรากฏเฉพาะหน้าสุดท้าย

**Negative Patterns:**
- ["แก้ไขเพิ่มเติม"] - ป้องกัน match กับ "ตราสารแก้ไข"

**Recommended Template:**
```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [...],
  "lastPagePatterns": [...],
  "firstPageNegativePatterns": [...],
  "isSinglePage": false,
  "category": "เอกสารมูลนิธิ"
}
```

### Testing Results

**Before Update:**
- Matched: 0/12 pages (0%)

**After Update:**
- Matched: 12/12 pages (100%)
- ✅ All manual labels are now auto-detected

### Action Taken
- [X] Created new template: "ตราสาร" (id: 5)
- [ ] Updated existing template
- [X] Tested with relabel

### Recommendations
- Monitor next groups to ensure patterns work consistently
- May need to add more variants if OCR quality varies
```

---

## 🚫 Common Mistakes to Avoid

### 1. ❌ ใช้ชื่อเฉพาะเป็น Patterns
```json
// ❌ BAD
"firstPagePatterns": [["มูลนิธิสมเจตน์", "นายคณิสร"]]

// ✅ GOOD
"firstPagePatterns": [["ข้อบังคับ", "หมวดที่", "ชื่อเครื่องหมาย"]]
```

### 2. ❌ ใช้ Patterns กว้างเกินไป
```json
// ❌ BAD - อาจ match เอกสารอื่นได้
"firstPagePatterns": [["มูลนิธิ"]]

// ✅ GOOD
"firstPagePatterns": [["ข้อบังคับ", "หมวดที่", "มูลนิธิ"]]
```

### 3. ❌ ลืมใส่ lastPagePatterns (สำหรับ multi-page)
```json
// ❌ BAD - จะ match ไม่จบ
{
  "isSinglePage": false,
  "lastPagePatterns": null  // ❌ ผิด!
}

// ✅ GOOD
{
  "isSinglePage": false,
  "lastPagePatterns": [["บทเบ็ดเตล็ด", "ลงนาม"]]
}
```

### 4. ❌ ไม่ตรวจสอบว่า Patterns ชนกับ Template อื่น
```json
// Template A และ B มี patterns เหมือนกัน
// → ต้องใช้ negative patterns หรือ sortOrder

Template A (sortOrder: 0):
  firstPagePatterns: [["ข้อบังคับ", "แก้ไข"]]

Template B (sortOrder: 1):
  firstPagePatterns: [["ข้อบังคับ", "หมวดที่"]]
  firstPageNegativePatterns: [["แก้ไข"]]
```

---

## 🔗 Related Documentation

- **[auto-label.md](./auto-label.md)** - Auto label logic (MUST READ)
- **[STRUCTURE.md](./STRUCTURE.md)** - System architecture
- **[CLAUDE.md](./CLAUDE.md)** - AI assistant guidelines

---

**สร้างโดย:** OCR Flow Development Team
**อัปเดตล่าสุด:** 2025-12-14
