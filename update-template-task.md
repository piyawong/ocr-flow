# Update Template Task

> **สำหรับ:** Claude AI Assistant
> **อัปเดตล่าสุด:** 2025-12-14

---

## Task Description

เมื่อผู้ใช้ **manual label** เอกสารแล้ว Claude จะ:

1. **อ่าน manual labels** - ดูว่าผู้ใช้ label หน้าไหนเป็นเอกสารอะไร
2. **วิเคราะห์ OCR text** - หา patterns ที่เหมาะสมจาก OCR text ของหน้านั้น
3. **แนะนำ/อัปเดต patterns** - เพิ่ม patterns ลงใน DB templates

---

## Workflow

```
1. ผู้ใช้ manual label ใน UI (หน้า 03-pdf-label)
   ↓
2. Claude อ่าน labeled files จาก API: GET /labeled-files/group/{groupId}
   ↓
3. Claude วิเคราะห์ OCR text ของแต่ละเอกสาร:
   - หน้าแรก (status: start/single) → หา firstPagePatterns
   - หน้าสุดท้าย (status: end) → หา lastPagePatterns
   ↓
4. Claude แนะนำ patterns และอัปเดตผ่าน API: PUT /templates/{id}
   ↓
5. ทดสอบโดย relabel group: POST /label-runner/relabel/{groupId}
```

---

## Pattern Selection Guidelines

### เลือก Patterns อย่างไร

1. **เลือกข้อความที่เป็นเอกลักษณ์** - ไม่ซ้ำกับเอกสารอื่น
2. **เลือกข้อความที่คงที่** - ไม่ใช่ชื่อคน/วันที่/ตัวเลขที่เปลี่ยนได้
3. **เลือก 2-4 patterns ต่อ variant** - มากเกินไปอาจ match ยาก
4. **หลีกเลี่ยง patterns สั้นเกินไป** - ต่ำกว่า 3 ตัวอักษรไม่ดี

### ตัวอย่างการเลือก

```
OCR Text หน้าแรก:
"ประกาศนายทะเบียนมูลนิธิกรุงเทพมหานคร
เรื่อง จดทะเบียนจัดตั้งมูลนิธิสมเจตน์ นำดอกไม้..."

Patterns ที่ดี:
✅ ["ประกาศนายทะเบียนมูลนิธิ", "เรื่อง จดทะเบียนจัดตั้งมูลนิธิ"]

Patterns ที่ไม่ดี:
❌ ["มูลนิธิ"] - สั้นเกินไป, ซ้ำกับเอกสารอื่น
❌ ["สมเจตน์ นำดอกไม้"] - ชื่อเฉพาะ, เปลี่ยนได้
```

---

## Impact Analysis (ผลกระทบการแก้ Template)

### ก่อนแก้ไข Template ต้องพิจารณา:

| ผลกระทบ | รายละเอียด | วิธีตรวจสอบ |
|---------|------------|-------------|
| **Groups ที่ labeled แล้ว** | อาจ match ผิดถ้า relabel | ดู `/labeled-files/summary` |
| **Template อื่นที่คล้ายกัน** | Patterns อาจชนกัน | เปรียบเทียบกับ templates ทั้งหมด |
| **False Positive** | Match เอกสารที่ไม่ใช่ | ต้องเพิ่ม negative patterns |
| **False Negative** | ไม่ match เอกสารที่ใช่ | ต้องเพิ่ม OR variants |

### Checklist ก่อนอัปเดต

- [ ] ตรวจสอบว่า patterns ไม่ซ้ำกับ template อื่น
- [ ] ตรวจสอบว่า patterns ไม่กว้างเกินไป
- [ ] พิจารณาเพิ่ม negative patterns ถ้าจำเป็น
- [ ] ทดสอบ relabel หลังอัปเดต

---

## API Reference

### อ่าน Labeled Files
```bash
GET /labeled-files/group/{groupId}
```

### อ่าน Templates
```bash
GET /templates
GET /templates/{id}
```

### อัปเดต Template
```bash
PUT /templates/{id}
Content-Type: application/json

{
  "firstPagePatterns": [["pattern1", "pattern2"]],
  "lastPagePatterns": [["pattern3"]],
  "firstPageNegativePatterns": null,
  "lastPageNegativePatterns": null,
  "isSinglePage": false,
  "category": "เอกสารจัดตั้งมูลนิธิ"
}
```

### Relabel Group (ทดสอบ)
```bash
POST /label-runner/relabel/{groupId}
```

---

## Example: Analyzing Manual Labels

### Input: Manual Labels from Group 1

| Page | Template | Status |
|------|----------|--------|
| 1-7 | ตราสาร.pdf | start → continue x5 → end |
| 8 | บัญชีรายชื่อกรรมการมูลนิธิ.pdf | single |
| 9-10 | ขออนุญาตจดทะเบียนจัดตั้งมูลนิธิ.pdf | start → end |
| 11 | ใบสำคัญแสดงการจดทะเบียนจัดตั้งมูลนิธิ.pdf | single |
| 12-13 | ประกาศนายทะเบียนจัดตั้งมูลนิธิ.pdf | start → end |

### Output: Recommended Patterns

**ตราสาร.pdf:**
- firstPagePatterns: `[["ข้อบังคับ", "หมวดที่ ๑", "ชื่อเครื่องหมายและสำนักงานที่ตั้ง"]]`
- lastPagePatterns: `[["บทเบ็ดเตล็ด", "ลงนาม", "ผู้จัดทำข้อบังคับ"]]`

**บัญชีรายชื่อกรรมการมูลนิธิ.pdf:**
- firstPagePatterns: `[["บัญชีรายชื่อกรรมการ", "หน้าที่เกี่ยวกับมูลนิธิ", "ขอรับรองว่าถูกต้อง"]]`
- isSinglePage: `true`

---

## Notes

- **sortOrder** มีผล - template ที่มี sortOrder ต่ำกว่าจะถูก match ก่อน
- **isActive** - สามารถปิด template ที่ไม่ต้องการใช้ได้
- **Pattern Matching** - ใช้ **Exact Match Only** (normalized text: lowercase + trim + collapse whitespace)
- **Negative patterns** - ถ้าเจอจะ block การ match ทันที (ใช้ exact match เช่นกัน)
