# Recommended Patterns for Amendment Documents (Group 152, Pages 11-16)

## Overview

This document contains recommended patterns for 4 templates that currently have NO patterns defined. These patterns are based on detailed analysis of pages 11-16 from Group 152.

**IMPORTANT:** Please review each pattern carefully before approving. These patterns are designed to be:
- **Specific** (not too broad)
- **Stable** (not variable data)
- **Distinctive** (unique to each document type)

---

## Template 1: ตราสารฉบับที่2 (id: 3)

### Current Status
- **isSinglePage:** false ✓ (correct - multi-page document)
- **firstPagePatterns:** null (EMPTY - needs patterns)
- **lastPagePatterns:** null (EMPTY - needs patterns)
- **negativePatterns:** null (may need to block ฉบับที่ 3, 4, 5...)

### Document Examples
- Page 10 from Group 152: "ข้อบังคับมูลนิธิลูกอีสาน (ฉบับที่ 2) พ.ศ. 2546"

### Recommended Patterns

#### **firstPagePatterns** (First Page - OR logic between variants)

**Variant 1:** Strong match for "ฉบับที่ 2" with context
```json
[
  "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง",
  "ฉบับที่ 2"
]
```
**Reasoning:**
- "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง" - Header text indicating amendment regulations
- "ฉบับที่ 2" - Version number (amendment #2)
- AND logic: Both must appear → Specific to 2nd amendment

**Variant 2:** Alternative format with year
```json
[
  "ข้อบังคับ",
  "ฉบับที่ 2",
  "พ.ศ."
]
```
**Reasoning:**
- "ข้อบังคับ" - Regulations
- "ฉบับที่ 2" - Version 2
- "พ.ศ." - Buddhist Era year
- Catches documents that don't have the full "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง" header

**Variant 3:** Without year (for documents that don't show year on first page)
```json
[
  "ข้อบังคับ",
  "ฉบับที่ ๒",
  "หมวดที่"
]
```
**Reasoning:**
- "ฉบับที่ ๒" - Thai numeral version (in case OCR reads Thai numerals)
- "หมวดที่" - Indicates it's showing regulation sections
- Covers OCR variations

#### **lastPagePatterns** (Last Page - OR logic between variants)

**Variant 1:** Standard signature format
```json
[
  "ลงนาม",
  "ผู้จัดทำข้อบังคับ",
  "ฉบับที่ 2"
]
```
**Reasoning:**
- "ลงนาม" - Signature section
- "ผู้จัดทำข้อบังคับ" - Person who prepared the regulations
- "ฉบับที่ 2" - Confirms this is 2nd amendment (on last page)

**Variant 2:** Without explicit version on last page
```json
[
  "ลงนาม",
  "ผู้จัดทำข้อบังคับ",
  "สำเนาถูกต้อง"
]
```
**Reasoning:**
- "สำเนาถูกต้อง" - Certified copy stamp
- Common on last page of official documents
- If first page matched "ฉบับที่ 2", this confirms it's the end

#### **firstPageNegativePatterns** (Prevent false matches)

```json
[
  "ฉบับที่ 3"
]
```
```json
[
  "ฉบับที่ ๓"
]
```
```json
[
  "ฉบับที่ 4"
]
```
**Reasoning:**
- Block versions 3, 4, 5... from matching this template
- Each amendment version should have its own template

---

## Template 2: ตราสารฉบับที่3 (id: 4)

### Current Status
- **isSinglePage:** false ✓ (correct - multi-page document)
- **firstPagePatterns:** null (EMPTY - needs patterns)
- **lastPagePatterns:** null (EMPTY - needs patterns)
- **negativePatterns:** null (may need to block ฉบับที่ 2, 4, 5...)

### Document Examples
- Pages 11-12 from Group 152: "ข้อบังคับมูลนิธิลูกอีสาน (ฉบับที่ 3) พ.ศ. 2549"

### Recommended Patterns

#### **firstPagePatterns** (First Page - OR logic between variants)

**Variant 1:** Strong match for "ฉบับที่ 3" with context
```json
[
  "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง",
  "ฉบับที่ 3"
]
```
**Reasoning:**
- "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง" - Header from page 11
- "ฉบับที่ 3" - Version number (amendment #3)
- Exact match from actual page 11

**Variant 2:** With year
```json
[
  "ข้อบังคับ",
  "ฉบับที่ 3",
  "พ.ศ."
]
```
**Reasoning:**
- Catches title format with year
- "พ.ศ. 2549" appeared on page 11

**Variant 3:** Thai numeral version
```json
[
  "ข้อบังคับ",
  "ฉบับที่ ๓",
  "หมวดที่"
]
```
**Reasoning:**
- "ฉบับที่ ๓" - Thai numeral (OCR variation)
- "หมวดที่" - Shows regulation sections

**Variant 4:** Focus on amendment content
```json
[
  "ฉบับที่ 3",
  "แก้ไขเพิ่มเติมข้อบังคับ"
]
```
**Reasoning:**
- "แก้ไขเพิ่มเติมข้อบังคับ" - Explicitly states this is amending regulations
- Combined with version number = strong signal

#### **lastPagePatterns** (Last Page - OR logic between variants)

**Variant 1:** Standard signature
```json
[
  "ลงนาม",
  "ผู้จัดทำข้อบังคับ"
]
```
**Reasoning:**
- Standard ending for regulations documents
- Works for any amendment version

**Variant 2:** With certification
```json
[
  "สำเนาถูกต้อง",
  "ข้อบังคับ"
]
```
**Reasoning:**
- "สำเนาถูกต้อง" - Certified copy
- "ข้อบังคับ" - Confirms it's regulations document

#### **firstPageNegativePatterns** (Prevent false matches)

```json
[
  "ฉบับที่ 2"
]
```
```json
[
  "ฉบับที่ ๒"
]
```
```json
[
  "ฉบับที่ 4"
]
```
**Reasoning:**
- Block other amendment versions from matching this template

---

## Template 3: ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ (id: 15)

### Current Status
- **isSinglePage:** false (SHOULD BE true - this is typically single-page)
- **firstPagePatterns:** null (EMPTY - needs patterns)
- **lastPagePatterns:** null (not needed if single-page)
- **negativePatterns:** null

### Document Examples
- Page 13 from Group 152: Official letter requesting/approving amendment registration

### **RECOMMENDATION: Change isSinglePage to TRUE**

This document type is typically a single-page official letter.

### Recommended Patterns

#### **firstPagePatterns** (OR logic between variants)

**Variant 1:** Strong official letter format
```json
[
  "เรื่อง",
  "ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ"
]
```
**Reasoning:**
- "เรื่อง" - Subject line (standard in Thai official letters)
- Full subject text from page 13
- Very specific - low chance of false match

**Variant 2:** With document number
```json
[
  "ที่ มท",
  "ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับ"
]
```
**Reasoning:**
- "ที่ มท" - Document number prefix (Ministry of Interior)
- Shortened subject text
- Identifies official government correspondence

**Variant 3:** Focus on key action
```json
[
  "ขออนุญาตจดทะเบียน",
  "แก้ไขเพิ่มเติมข้อบังคับ",
  "มูลนิธิ"
]
```
**Reasoning:**
- "ขออนุญาตจดทะเบียน" - Request for registration
- "แก้ไขเพิ่มเติมข้อบังคับ" - Amendment of regulations
- "มูลนิธิ" - Foundation
- Three key terms that define this document type

**Variant 4:** Approval format
```json
[
  "นายทะเบียนมูลนิธิ",
  "อนุญาต",
  "แก้ไขเพิ่มเติมข้อบังคับ"
]
```
**Reasoning:**
- "นายทะเบียนมูลนิธิ" - Foundation Registrar
- "อนุญาต" - Approve/grant permission
- From page 13: "นายทะเบียนมูลนิธิกรุงเทพมหานครพิจารณาแล้ว อนุญาต..."
- Catches approval letters (vs. request letters)

#### **negativePatterns** (Prevent false matches)

```json
[
  "ใบสำคัญแสดง"
]
```
**Reasoning:**
- Block certificates from matching this template
- This template is for LETTERS, not certificates

```json
[
  "แต่งตั้งกรรมการ"
]
```
**Reasoning:**
- Block committee appointment documents
- Page 13 is ONLY about amendments, not committee changes

---

## Template 4: ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ (id: 44)

### Current Status
- **isSinglePage:** false ✓ (correct - can be multi-page)
- **firstPagePatterns:** null (EMPTY - needs patterns)
- **lastPagePatterns:** null (EMPTY - needs patterns)
- **negativePatterns:** null

### Document Examples
- Page 14 from Group 152: "ข้อบังคับของมูลนิธิกุลกีฬา(ฉบับที่ 2)" - Single page showing specific amendments
- Pages 15-16 from Group 152: "ใบสำคัญแสดงการจดทะเบียนแต่งตั้งกรรมการของมูลนิธิขึ้นใหม่ทั้งชุด/...//การแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ" - Multi-page certificate

### Document Characteristics
- **Certificate format** (not full regulations, not request letter)
- Shows only specific amended sections (e.g., "แก้ไขเพิ่มเติมข้อบังคับ ข้อ 2 และข้อ 3")
- May be standalone OR combined with other registrations (e.g., committee appointment)
- Contains government seal/signature
- Can be single-page OR multi-page

### Recommended Patterns

#### **firstPagePatterns** (First Page - OR logic between variants)

**Variant 1:** Standard certificate title
```json
[
  "ใบสำคัญแสดงการจดทะเบียน",
  "แก้ไขเพิ่มเติมข้อบังคับ",
  "มูลนิธิ"
]
```
**Reasoning:**
- "ใบสำคัญแสดงการจดทะเบียน" - Certificate of registration
- "แก้ไขเพิ่มเติมข้อบังคับ" - Amendment of regulations
- "มูลนิธิ" - Foundation
- From page 15 title
- Very specific to amendment certificates

**Variant 2:** Shortened certificate format
```json
[
  "ใบสำคัญแสดง",
  "แก้ไขเพิ่มเติมข้อบังคับมูลนิธิ"
]
```
**Reasoning:**
- Catches variations of certificate title
- Key phrase: "แก้ไขเพิ่มเติมข้อบังคับมูลนิธิ"

**Variant 3:** Focus on amendment details
```json
[
  "แก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ",
  "ข้อ",
  "ความว่า"
]
```
**Reasoning:**
- From page 15: "แก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ ข้อ 2 และข้อ 3 ความว่า"
- "ข้อ" - Article/section number
- "ความว่า" - "stating that" (introduces the amended text)
- Indicates showing specific section amendments

**Variant 4:** Partial regulations document format (like page 14)
```json
[
  "ข้อบังคับของมูลนิธิ",
  "ฉบับที่",
  "แก้ไขเพิ่มเติม"
]
```
**Reasoning:**
- From page 14: "ข้อบังคับของมูลนิธิกุลกีฬา(ฉบับที่ 2) พ.ศ. 2546"
- "แก้ไขเพิ่มเติม" appears in subtitle
- This format shows partial regulations (not full document)
- Different from "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง" (full document format)

**Variant 5:** Certificate without "ใบสำคัญ" header
```json
[
  "ฉบับที่",
  "แก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ",
  "หมวดที่ 1"
]
```
**Reasoning:**
- Catches documents like page 14 that don't have "ใบสำคัญ" in title
- "หมวดที่ 1" - Shows it's partial sections (not full regulations)
- "ฉบับที่" - Version number

#### **lastPagePatterns** (Last Page - OR logic between variants)

**Variant 1:** Official signature
```json
[
  "ให้ไว้ ณ วันที่",
  "นายทะเบียนมูลนิธิ"
]
```
**Reasoning:**
- "ให้ไว้ ณ วันที่" - Standard certificate date phrase
- "นายทะเบียนมูลนิธิ" - Foundation Registrar
- From page 16 ending

**Variant 2:** Government official signature
```json
[
  "อธิบดีกรมการปกครอง",
  "ปลัดกระทรวงมหาดไทย"
]
```
**Reasoning:**
- From page 16: "รองอธิบดี รักษาราชการแทน อธิบดีกรมการปกครอง ปฏิบัติราชการแทน ปลัดกระทรวงมหาดไทย"
- High-level government titles
- Indicates official certificate

**Variant 3:** Simple signature format (single-page documents)
```json
[
  "ลงนาม",
  "ผู้จัดทำข้อบังคับ"
]
```
**Reasoning:**
- From page 14: "(นายธนาธร พรมทองดี) ผู้จัดทำข้อบังคับ"
- For single-page amendment documents

#### **negativePatterns** (Prevent false matches)

```json
[
  "ข้อบังคับที่ขอจดทะเบียนเปลี่ยนแปลง"
]
```
**Reasoning:**
- Block FULL amendment regulations documents
- This template is for CERTIFICATES showing partial amendments
- Full regulations documents should match "ตราสารฉบับที่X" templates

```json
[
  "เรื่อง ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติม"
]
```
**Reasoning:**
- Block REQUEST LETTERS from matching this template
- This template is for CERTIFICATES, not letters

---

## Summary of Pattern Counts

| Template ID | Template Name | First Page Variants | Last Page Variants | Negative Patterns |
|-------------|---------------|---------------------|--------------------|--------------------|
| 3 | ตราสารฉบับที่2 | 3 variants | 2 variants | 3 patterns |
| 4 | ตราสารฉบับที่3 | 4 variants | 2 variants | 3 patterns |
| 15 | ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ | 4 variants | N/A (single-page) | 2 patterns |
| 44 | ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ | 5 variants | 3 variants | 2 patterns |

---

## Testing Plan

After updating templates, test with:

1. **Relabel pages 11-16 of Group 152**
   - Expected results:
     - Page 11-12 → "ตราสารฉบับที่3"
     - Page 13 → "ขออนุญาตจดทะเบียนแก้ไขเพิ่มเติมข้อบังคับของมูลนิธิ"
     - Page 14 → "ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ"
     - Page 15-16 → "ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ"

2. **Check for false positives**
   - Verify that original "ตราสาร" (pages 1-9) are NOT matched by amendment templates
   - Verify that committee documents (without amendments) are NOT matched by amendment templates

3. **Check for false negatives**
   - Search for other groups with amendment documents
   - Verify they are now being labeled correctly

---

## Additional Considerations

### **Pattern Design Philosophy**

1. **Specific over broad:** Use multiple specific terms (AND logic) to reduce false matches
2. **Stable terms only:** Avoid variable data (names, dates, numbers) that change per document
3. **Multiple variants:** Provide OR logic between variants to catch different formats
4. **Negative patterns:** Block overlapping document types

### **OCR Variations Handled**

- Thai numerals vs. Arabic numerals (ฉบับที่ ๒ vs. ฉบับที่ 2)
- Spacing variations (normalized by system)
- Case variations (normalized to lowercase)

### **Edge Cases to Monitor**

1. **Combined documents** (like page 15-16): Certificate with both committee + amendments
   - Current design: Will match "ใบสำคัญแสดงการแก้ไขเพิ่มเติมข้อบังคับมูลนิธิ" if amendment text is present
   - May need additional logic if purely committee documents (without amendments) should match different template

2. **Amendment versions 4, 5, 6...:**
   - Currently only have templates for ฉบับที่ 2 and ฉบับที่ 3
   - May need to create additional templates OR generalize to "ตราสารแก้ไขเพิ่มเติม (ทุกฉบับ)"

3. **Different foundation types:**
   - Patterns are foundation-agnostic (work for any มูลนิธิ)
   - Should work for สมาคม (associations) as well if similar format

---

## Next Steps for User

1. ✅ **Review patterns above**
   - Check if patterns are specific enough
   - Check if patterns might cause false matches
   - Modify as needed

2. ✅ **Approve patterns**
   - Confirm which variants to use
   - Confirm negative patterns

3. ⏭️ **I will update templates via API**

4. ⏭️ **Test with relabel**
   - Relabel pages 11-16
   - Verify results
   - Adjust patterns if needed

5. ⏭️ **Consider generalization**
   - Should we create one general "ตราสารแก้ไขเพิ่มเติม" template instead of separate templates for each version?
   - Trade-off: Specific templates = more control, General template = easier maintenance

---

**Ready for review!** Please let me know if you'd like to proceed with these patterns or if any modifications are needed.
