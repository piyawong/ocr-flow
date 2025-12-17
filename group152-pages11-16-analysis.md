# Analysis of Pages 11-16 (Group 152) - Amendment Documents

## Executive Summary

Pages 11-16 of Group 152 contain various types of amendment-related documents that were **not properly labeled** by the auto-label system. The current "ตราสาร" (Foundation Instrument) template has negative patterns that block amendment documents, but there are no proper templates with positive patterns to catch these amendment documents.

---

## Document Analysis by Page

### **Page 11** - Currently labeled: UNLABELED
**Document Type:** ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง - ข้อบังคับมูลนิธิลูกอีสาน (ฉบับที่ 3) พ.ศ. 2549

**Key Characteristics:**
- Header: "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง"
- Title: "ข้อบังคับมูลนิธิลูกอีสาน (ฉบับที่ 3) พ.ศ. 2549"
- Content discusses amendments to regulations (หมวดที่ 1, หมวดที่ 2)
- This is the FIRST PAGE of amended regulations document

**Why it failed to match:**
- Template "ตราสาร" (id: 1) has negative patterns: ["แก้ไข"], ["เปลี่ยนแปลง"], ["ฉบับที่ ๓"]
- Templates "ตราสารฉบับที่2" and "ตราสารฉบับที่3" exist but have NO patterns defined
- No template specifically targets "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง" header

---

### **Page 12** - Currently labeled: UNLABELED
**Document Type:** Continuation of ข้อบังคับมูลนิธิลูกอีสาน (ฉบับที่ 3)

**Key Characteristics:**
- Content shows detailed amendments:
  - "ข้อ 3 ให้แก้ไขเพิ่มเติมข้อบังคับในหมวดที่ 4 ว่าด้วย คุณสมบัติ และการพ้นจากตำแหน่งของกรรมการ"
  - Shows "ข้อ 7 กรรมการของมูลนิธิต้องมีคุณสมบัติดังนี้"
  - Changes qualifications from old to new text

**Why it failed to match:**
- This is a continuation page (not first/last page)
- Multi-page document detection relies on sequential processing
- Page 11 failed to match, so page 12 cannot be matched as continuation

---

### **Page 13** - Currently labeled: UNLABELED
**Document Type:** ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ (Official Request Letter)

**Key Characteristics:**
- Header: "ที่ มท 0309.3/1433"
- Subject: "เรื่อง ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ"
- Date: "26 ส.ค. 2546"
- Reference: "อ้างถึง หนังสือกรุงเทพมหานคร ที่ กท 0307/ป 5103"
- Attachments listed:
  1. ใบสำคัญแสดงการจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับ ของมูลนิธิ (ม.น.4)
  2. สำเนาเรื่องราวขออนุญาตจดทะเบียนการเปลี่ยนแปลงมูลนิธิ (ม.น.3)
- Content: Approval letter from นายทะเบียนมูลนิธิกรุงเทพมหานคร
- Signature: (นายสุรชัย ศรีสารคาม) ผู้อำนวยการ

**Why it failed to match:**
- Template "ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ" (id: 15) exists but has NO patterns defined
- This is a SINGLE-PAGE document (but template has isSinglePage: false)

---

### **Page 14** - Currently labeled: UNLABELED
**Document Type:** ข้อบังคับของมูลนิธิกุลกีฬา(ฉบับที่ 2) พ.ศ. 2546

**Key Characteristics:**
- Title: "ข้อบังคับของมูลนิธิกุลกีฬา(ฉบับที่ 2) พ.ศ. 2546"
- Subtitle: "แก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ"
- Section: "หมวดที่ 1 ชื่อ เครื่องหมาย และสำนักงานที่ตั้ง"
- Shows specific amendments:
  - ข้อ 2: About foundation symbol
  - ข้อ 3: About office location
- Signed by: (นายธนาธร พรมทองดี) ผู้จัดทำข้อบังคับ

**Why it failed to match:**
- This is ANOTHER foundation's amendment document (มูลนิธิกุลกีฬา, not ลูกอีสาน)
- Template "ตราสาร" blocks it with negative pattern ["ฉบับที่ 2"]
- Template "ตราสารฉบับที่2" has NO patterns defined
- This is a SINGLE-PAGE document showing only specific amended sections (not full regulations)

---

### **Page 15** - Currently labeled: UNLABELED
**Document Type:** ใบสำคัญแสดงการจดทะเบียน...และแก้ไขเพิ่มเติมข้อบังคับ (Certificate)

**Key Characteristics:**
- Title: "ใบสำคัญแสดงการจดทะเบียนแต่งตั้งกรรมการของมูลนิธิขึ้นใหม่ทั้งชุด/ การเปลี่ยนแปลงกรรมการของมูลนิธิ/การแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ"
- Foundation: มูลนิธิลูกอีสาน
- Location: "เลขที่ 389/27 หมู่ที่ 4 ถนนร่มเกล้า แขวงคลองสามประเวศ เขตลาดกระบัง กรุงเทพมหานคร"
- Content: Shows committee members table with 7 members
- Shows amendments: "แก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ ข้อ 2 และข้อ 3"
- Contains detailed amendment text (ข้อ 2 about symbol, ข้อ 3 about office location)

**Why it failed to match:**
- Template "ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ" (id: 44) exists but has NO patterns
- This document is HYBRID: combines committee appointment + amendment certificate
- Template "ใบสำคัญแสดงการจดทะเบียนแต่งตั้งกรรมการของมูลนิธิขึ้นใหม่ทั้งชุด" (id: 20) might match the committee part but not the amendment part

---

### **Page 16** - Currently labeled: UNLABELED
**Document Type:** Continuation of ใบสำคัญแสดงการจดทะเบียน (Certificate continuation)

**Key Characteristics:**
- Content: Continuation of regulations amendments
- Shows: "ข้อ 12 กรรมการดำเนินงานของมูลนิธิอยู่ในตำแหน่งคราวละ 4 ปี..."
- Shows: "ข้อ 14 กรรมการมูลนิธิที่พ้นจากตำแหน่งตามวาระหรือลาออก..."
- Shows: "ข้อ 22 สำหรับกรรมการตำแหน่งอื่น ๆ..."
- Shows: "ข้อ 44 การกระทำใดๆ ที่มีผลผูกพันมูลนิธิฯ..."
- Signature: "(นายเนศ จิตสุจริตวงศ์) รองอธิบดี รักษาราชการแทน อธิบดีกรมการปกครอง"
- Date: "31 ธ.ค. 2550"

**Why it failed to match:**
- This is a continuation page (LAST PAGE) of the certificate from page 15
- Multi-page detection depends on page 15 matching first

---

## Current Template Status

### Templates that EXIST but have NO patterns:

1. **ตราสารฉบับที่2** (id: 3) - NO patterns defined
2. **ตราสารฉบับที่3** (id: 4) - NO patterns defined
3. **ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ** (id: 15) - NO patterns defined
4. **ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ** (id: 44) - NO patterns defined

### Template that BLOCKS amendment documents:

**ตราสาร** (id: 1) has these negative patterns:
- ["ฉบับที่ ๒"]
- ["ฉบับที่ ๓"]
- ["แก้ไข"]
- ["เปลี่ยนแปลง"]

These negative patterns successfully prevent original "ตราสาร" from matching amendment documents, but there are no positive patterns in other templates to catch them.

---

## Root Cause Analysis

### Why pages 11-16 are UNLABELED:

1. **Template "ตราสาร" correctly blocks amendments** using negative patterns
2. **BUT amendment-specific templates have NO patterns defined:**
   - ตราสารฉบับที่2 (id: 3) - empty
   - ตราสารฉบับที่3 (id: 4) - empty
   - ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ (id: 15) - empty
   - ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ (id: 44) - empty

3. **Result:** Amendment documents fall through the cracks
   - They are correctly rejected by "ตราสาร" template
   - They are NOT caught by any amendment template (no patterns to match)
   - Final status: "unmatched" / "UNLABELED"

---

## Document Type Classification

Based on analysis of pages 11-16, amendment-related documents can be classified into 3 main types:

### Type 1: **Amended Regulations (Full Document)**
**Examples:** Pages 11-12 (ข้อบังคับมูลนิธิลูกอีสาน ฉบับที่ 3)

**Characteristics:**
- Full regulations document with amendments
- Multi-page document
- Starts with "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง" OR just title with "ฉบับที่ X"
- Contains: หมวดที่ 1, 2, 3... with amended content
- Ends with signature and "ผู้จัดทำข้อบังคับ"

**Template match:** ตราสารฉบับที่2 or ตราสารฉบับที่3 (depending on version)

---

### Type 2: **Amendment Request/Approval Letter**
**Example:** Page 13 (ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ)

**Characteristics:**
- Official letter format
- Single-page document
- Contains:
  - Document number: "ที่ มท XXXX"
  - Subject: "เรื่อง ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ"
  - Date
  - Reference: "อ้างถึง"
  - Attachments: "สิ่งที่ส่งมาด้วย"
  - Content: Request/approval details
  - Signature: Government official

**Template match:** ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ (id: 15)

---

### Type 3: **Amendment Certificate (Partial Amendments)**
**Examples:** Pages 14 (single page), Pages 15-16 (multi-page)

**Characteristics:**
- Certificate format showing only specific amended sections
- Can be single-page OR multi-page
- Contains:
  - Title: "ใบสำคัญแสดงการจดทะเบียน...แก้ไขเพิ่มเติมข้อบังคับ"
  - Foundation name and location
  - Specific amendment details (e.g., "แก้ไขเพิ่มเติมข้อบังคับ ข้อ 2 และข้อ 3")
  - Text of amended sections only (NOT full regulations)
  - Government seal/signature
  - Date

**Variations:**
- **Standalone amendment certificate** (like page 14)
- **Combined certificate** (committee + amendments, like pages 15-16)

**Template match:** ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ (id: 44)

---

## Recommended Solutions

### **Priority 1: Add patterns to existing templates**

Fill in the empty templates with proper patterns:

1. **ตราสารฉบับที่2** (id: 3)
2. **ตราสารฉบับที่3** (id: 4)
3. **ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ** (id: 15)
4. **ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ** (id: 44)

### **Priority 2: Consider generalizing amendment templates**

Instead of having separate templates for "ฉบับที่ 2", "ฉบับที่ 3", etc., consider:
- One general template: "ตราสารแก้ไขเพิ่มเติม (ฉบับที่ X)"
- Use patterns that can match any version number

---

## Next Steps

1. User reviews the recommended patterns (see separate section below)
2. User approves/modifies the patterns
3. Update templates via API
4. Test with relabel on pages 11-16
5. Verify that all pages are correctly labeled
