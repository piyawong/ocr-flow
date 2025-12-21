# Auto Label Logic - OCR Flow v2

> **อัปเดตล่าสุด:** 2025-12-15
> **เอกสารนี้อธิบาย:** Logic การทำงานของระบบ Auto Label PDF ใน Stage 2 (02-group)

---

## 📋 สารบัญ

1. [ภาพรวมการทำงาน](#ภาพรวมการทำงาน)
2. [ปัจจัยที่เกี่ยวข้อง](#ปัจจัยที่เกี่ยวข้อง)
3. [Pattern Matching Strategy](#pattern-matching-strategy)
4. [ขั้นตอนการทำงาน](#ขั้นตอนการทำงาน)
5. [ตัวอย่าง Flow](#ตัวอย่าง-flow)
6. [ไฟล์ที่เกี่ยวข้อง](#ไฟล์ที่เกี่ยวข้อง)
7. [Best Practices](#best-practices)

---

## 🎯 ภาพรวมการทำงาน

ระบบ Auto Label PDF ทำหน้าที่:
- **แยกเอกสารหลายหน้า** (multi-page documents) เป็นเอกสารย่อยตาม template
- **ระบุประเภทเอกสาร** ด้วย Pattern Matching และ OCR
- **จัดการเอกสาร** ทั้งแบบหน้าเดียว (single-page) และหลายหน้า (multi-page)

### กลไกหลัก
```
OCR Text → Normalize → Pattern Match → Document Ranges → Database (documents table)
```

> **✅ Storage:** ผลลัพธ์ถูกเก็บใน `documents` table (ไม่ใช่ labeled_files แล้ว)

### Document Types
- **Single-page document** - เอกสาร 1 หน้า (startPage = endPage)
- **Multi-page document** - เอกสารหลายหน้า (startPage < endPage)
- **Unmatched pages** - หน้าที่ไม่ match template ใดๆ (ไม่สร้าง document record)

---

## 🔧 ปัจจัยที่เกี่ยวข้อง

### 1. Templates (จาก Database)

Templates เก็บใน PostgreSQL table `templates` มีฟิลด์สำคัญ:

| ฟิลด์ | ประเภท | ความหมาย | ตัวอย่าง |
|------|--------|----------|----------|
| `name` | string | ชื่อ template | "ตราสาร", "บัญชีรายชื่อกรรมการ" |
| `firstPagePatterns` | JSONB | รูปแบบหน้าแรก | `[["มูลนิธิ", "ตราสาร"], ["foundation"]]` |
| `lastPagePatterns` | JSONB | รูปแบบหน้าสุดท้าย | `[["ลงชื่อ", "ประธาน"]]` |
| `firstPageNegativePatterns` | JSONB | คำที่ต้อง**ไม่เจอ**ในหน้าแรก | `[["แก้ไข"], ["เปลี่ยนแปลง"]]` |
| `lastPageNegativePatterns` | JSONB | คำที่ต้อง**ไม่เจอ**ในหน้าสุดท้าย | `[["ต่อหน้าถัดไป"]]` |
| `contextRules` | JSONB | กฎการ match ตาม context ของหน้าก่อนหน้า | `{"requirePreviousCategory": ["application_form"]}` |
| `isSinglePage` | boolean | เอกสารหน้าเดียวหรือไม่ | `true` / `false` |
| `isActive` | boolean | เปิดใช้งาน template นี้หรือไม่ | `true` / `false` |
| `category` | string | หมวดหมู่เอกสาร | "เอกสารมูลนิธิ" |
| `sortOrder` | number | ลำดับการพิจารณา | 0, 1, 2, ... |

#### Entity Definition

```typescript
// backend/src/templates/template.entity.ts
@Entity('templates')
export class Template {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'jsonb', nullable: true })
  firstPagePatterns: string[][] | null;

  @Column({ type: 'jsonb', nullable: true })
  lastPagePatterns: string[][] | null;

  @Column({ type: 'jsonb', nullable: true })
  firstPageNegativePatterns: string[][] | null;

  @Column({ type: 'jsonb', nullable: true })
  lastPageNegativePatterns: string[][] | null;

  @Column({ type: 'jsonb', nullable: true })
  contextRules: {
    requirePreviousCategory?: string[];
    blockPreviousCategory?: string[];
  } | null;

  @Column({ nullable: true })
  category: string | null;

  @Column({ default: false })
  isSinglePage: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  sortOrder: number;
}
```

#### Context Rules (contextRules)

**Context Rules** เป็นฟีเจอร์ที่ช่วยให้ระบบสามารถ match template ตาม **context ของหน้าก่อนหน้า** ได้ เหมาะสำหรับเอกสารที่มีหลาย variants ที่มี patterns คล้ายกัน แต่ต้องแยกตาม context

**Structure:**
```typescript
{
  requirePreviousCategory?: string[];  // Match เฉพาะเมื่อหน้าก่อนหน้าเป็น category ที่ระบุ
  blockPreviousCategory?: string[];    // ห้าม match เมื่อหน้าก่อนหน้าเป็น category ที่ระบุ
}
```

**Use Cases:**
- **เอกสารที่มีหลายรูปแบบ:** เช่น "หนังสือให้อำนาจ" มี 2 รูปแบบ (จัดตั้ง/เปลี่ยนแปลง)
- **ป้องกัน false match:** แยก templates ที่มี patterns คล้ายกันตาม context ของหน้าก่อนหน้า

**ตัวอย่าง Template ที่ใช้ contextRules:**

```json
{
  "name": "หนังสือให้อำนาจ (จัดตั้ง)",
  "category": "documents",
  "contextRules": {
    "requirePreviousCategory": ["application_form", "documents"]
  },
  "firstPagePatterns": [["หนังสือให้อำนาจ"]],
  "isSinglePage": true
}
```

```json
{
  "name": "หนังสือให้อำนาจ (เปลี่ยนแปลง)",
  "category": "documents",
  "contextRules": {
    "requirePreviousCategory": ["change_notice", "change_form"]
  },
  "firstPagePatterns": [["หนังสือให้อำนาจ"]],
  "isSinglePage": true
}
```

**ผลลัพธ์:**
- ถ้าหน้าก่อนหน้าเป็น "คำขอจัดตั้ง" (category: application_form) → match "หนังสือให้อำนาจ (จัดตั้ง)"
- ถ้าหน้าก่อนหน้าเป็น "หนังสือแจ้งเปลี่ยนแปลง" (category: change_notice) → match "หนังสือให้อำนาจ (เปลี่ยนแปลง)"

#### Template API Endpoints

- `GET /templates` - ดึง templates ทั้งหมด (เรียงตาม sortOrder, id)
- `GET /templates/:id` - ดึง template ตาม ID
- `POST /templates` - สร้าง template ใหม่
- `PUT /templates/:id` - แก้ไข template
- `DELETE /templates/:id` - ลบ template
- `POST /templates/:id/toggle` - เปิด/ปิด template (toggle isActive)

---

### 2. OCR Text Processing

#### OCR Text Format
OCR text จาก Typhoon OCR API มีรูปแบบ JSON:

```json
{
  "natural_text": "มูลนิธิ ตราสาร จัดตั้งเมื่อ...",
  "text": "มูลนิธิ ตราสาร..."
}
```

#### Text Extraction

```typescript
// backend/src/shared/label-utils/pattern-matcher.ts
export function extractOcrText(ocrText: string): string {
  if (!ocrText) return '';

  try {
    const parsed = JSON.parse(ocrText);
    if (parsed.natural_text) {
      return parsed.natural_text;
    }
    if (parsed.text) {
      return parsed.text;
    }
    return JSON.stringify(parsed);
  } catch {
    return ocrText;
  }
}
```

#### Text Normalization

```typescript
// Normalize text สำหรับ pattern matching
function normalizeText(text: string): string {
  return text
    .toLowerCase()        // แปลงเป็นตัวพิมพ์เล็กทั้งหมด
    .trim()               // ตัด whitespace ข้างหน้าและข้างหลัง
    .replace(/\s+/g, ' '); // Collapse multiple spaces เป็น single space
}
```

**ตัวอย่าง:**
```typescript
normalizeText("  มูลนิธิ    ตราสาร  ")
// → "มูลนิธิ ตราสาร"

normalizeText("FOUNDATION   INSTRUMENT")
// → "foundation instrument"
```

---

### 3. Pattern Matching Strategy

#### 🔍 Exact Match (Normalized Text Comparison)

ระบบใช้ **Exact Match** โดยการเปรียบเทียบข้อความที่ normalize แล้ว:

```typescript
export function containsPattern(
  text: string,
  pattern: string,
): PatternCheckResult {
  const normalizedText = normalizeText(text);
  const normalizedPattern = normalizeText(pattern);

  if (normalizedText.includes(normalizedPattern)) {
    return {
      found: true,
      score: 1.0,
      strategy: 'exact',
      matchedText: pattern,
    };
  }

  return { found: false, score: 0, strategy: 'none' };
}
```

**⚠️ หมายเหตุ:** ไม่มี Fuzzy Matching - ใช้ Exact Match เท่านั้น

---

#### ✅ AND/OR Logic

##### **AND Logic** (ภายใน variant)
ต้องเจอ**ทุกคำ**ใน array เดียวกัน

```json
["มูลนิธิ", "ตราสาร"]
```
- ต้องเจอทั้ง "มูลนิธิ" **และ** "ตราสาร" ในข้อความเดียวกัน
- ถ้าเจอแค่ "มูลนิธิ" → ❌ ไม่ผ่าน
- ถ้าเจอแค่ "ตราสาร" → ❌ ไม่ผ่าน
- ถ้าเจอทั้งสอง → ✅ ผ่าน

```typescript
export function checkPatternVariant(
  text: string,
  patterns: string[],
): MatchResult {
  const matchedPatterns: string[] = [];

  for (const pattern of patterns) {
    const result = containsPattern(text, pattern);
    if (!result.found) {
      return { matched: false, reason: `missing:'${pattern}'` };
    }
    matchedPatterns.push(`exact:'${pattern}'`);
  }

  return {
    matched: true,
    reason: matchedPatterns.join(', '),
    matchedPatterns,
  };
}
```

##### **OR Logic** (ระหว่าง variants)
เจอ variant **ใดก็ได้**

```json
[
  ["มูลนิธิ", "ตราสาร"],        // variant 1
  ["foundation", "instrument"]  // variant 2
]
```
- เจอ variant 1 (มูลนิธิ + ตราสาร) → ✅ ผ่าน
- เจอ variant 2 (foundation + instrument) → ✅ ผ่าน
- ไม่เจอทั้งสอง variant → ❌ ไม่ผ่าน

```typescript
export function checkPatterns(
  text: string,
  patterns: string | string[][] | undefined,
): MatchResult {
  if (!patterns) {
    return { matched: false, reason: 'no patterns defined' };
  }

  // Single string pattern
  if (typeof patterns === 'string') {
    const result = containsPattern(text, patterns);
    if (result.found) {
      return { matched: true, reason: `exact:'${patterns}'` };
    }
    return { matched: false, reason: `missing:'${patterns}'` };
  }

  // Array of arrays (multiple variants with AND logic within each)
  for (const variant of patterns) {
    const result = checkPatternVariant(text, variant);
    if (result.matched) {
      return result; // Return first matching variant
    }
  }

  return { matched: false, reason: 'no variant matched' };
}
```

---

---

#### 🔗 Context Rules (Match ตาม Context)

Context Rules ช่วยให้ระบบสามารถ match template ตาม **context ของหน้าก่อนหน้า** ได้

**กลไกการทำงาน:**
1. เมื่อหา template ใหม่ (currentTemplate = null) → ส่ง `previousTemplate` ไปยัง `findFirstPageTemplate()`
2. ตรวจสอบ `contextRules` ของแต่ละ template **ก่อน** check patterns
3. ถ้า template มี `requirePreviousCategory`:
   - ตรวจสอบว่า `previousTemplate.category` อยู่ใน list หรือไม่
   - ถ้า**ไม่อยู่** → skip template นี้ (ไม่ match)
4. ถ้า template มี `blockPreviousCategory`:
   - ตรวจสอบว่า `previousTemplate.category` อยู่ใน list หรือไม่
   - ถ้า**อยู่** → skip template นี้ (ไม่ match)

**ตัวอย่างการใช้งาน:**

```typescript
// Template 1: ต้องการให้มาหลัง application_form เท่านั้น
{
  "name": "หนังสือให้อำนาจ (จัดตั้ง)",
  "category": "documents",
  "contextRules": {
    "requirePreviousCategory": ["application_form", "documents"]
  },
  "firstPagePatterns": [["หนังสือให้อำนาจ"]]
}

// Template 2: ห้ามมาหลัง application_form
{
  "name": "หนังสือให้อำนาจ (เปลี่ยนแปลง)",
  "category": "documents",
  "contextRules": {
    "blockPreviousCategory": ["application_form"]
  },
  "firstPagePatterns": [["หนังสือให้อำนาจ"]]
}
```

**ผลลัพธ์:**
- หน้าก่อนหน้า = "คำขอจัดตั้ง" (application_form)
  - Template 1: ✅ Match (อยู่ใน requirePreviousCategory)
  - Template 2: ❌ Skip (อยู่ใน blockPreviousCategory)
- หน้าก่อนหน้า = "หนังสือแจ้งเปลี่ยนแปลง" (change_notice)
  - Template 1: ❌ Skip (ไม่อยู่ใน requirePreviousCategory)
  - Template 2: ✅ Match (ไม่อยู่ใน blockPreviousCategory)

---

#### ❌ Negative Patterns (ป้องกัน False Match)

Negative patterns ใช้เพื่อ**ปฏิเสธ**การ match ถ้าเจอคำที่ไม่ต้องการ

```typescript
export function checkNegativePatterns(
  text: string,
  patterns: string | string[][] | undefined,
): NegativeCheckResult {
  if (!patterns) {
    return { blocked: false, reason: '' };
  }

  if (typeof patterns === 'string') {
    const result = containsPattern(text, patterns);
    if (result.found) {
      return { blocked: true, reason: `negative:'${patterns}'` };
    }
    return { blocked: false, reason: '' };
  }

  for (const variant of patterns) {
    const allMatch = variant.every(p => containsPattern(text, p).found);
    if (allMatch) {
      return { blocked: true, reason: `negative:${JSON.stringify(variant)}` };
    }
  }

  return { blocked: false, reason: '' };
}
```

**ตัวอย่างการใช้งาน:**

```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [["มูลนิธิ", "ตราสาร"]],
  "firstPageNegativePatterns": [["แก้ไข"], ["เปลี่ยนแปลง"]]
}
```

- หน้าที่เจอ "มูลนิธิ" + "ตราสาร" → ✅ Match
- หน้าที่เจอ "มูลนิธิ" + "ตราสาร" + "แก้ไข" → ❌ ถูก block โดย negative pattern
- หน้าที่เจอ "มูลนิธิ" + "ตราสาร" + "เปลี่ยนแปลง" → ❌ ถูก block โดย negative pattern

---

## 🔄 ขั้นตอนการทำงาน

### Main Loop (Infinite Worker Loop)

```typescript
// backend/src/label-runner/label-runner.service.ts
async startLabelTask(): Promise<void> {
  if (this.isRunning) {
    this.log('Label task is already running', 'warning');
    return;
  }

  this.isRunning = true;
  this.log('=== ∞ Infinite Label Worker Loop Started ===', 'info');
  await this.reloadTemplates();

  try {
    // Infinite loop - runs until stopped
    while (this.isRunning) {
      // 1. Get groups ที่ isComplete = true AND isLabeled = false
      const groupsToProcess = await this.filesService.getGroupsReadyToLabel();

      // 2. ถ้าไม่มี group → รอ 5 วินาที
      if (groupsToProcess.length === 0) {
        this.log('⏳ No groups ready to label. Waiting...', 'info');
        await this.sleep(5000);
        continue;
      }

      // 3. Process แต่ละ group
      for (const gNum of groupsToProcess) {
        if (!this.isRunning) break;
        await this.processGroup(gNum);
      }

      // 4. รอ 2 วินาที → loop ใหม่
      if (this.isRunning) {
        await this.sleep(2000);
      }
    }
  } catch (error) {
    this.log(`Label worker loop error: ${error.message}`, 'error');
    this.isRunning = false;
  }
}
```

---

### Processing Algorithm (Core Logic)

```typescript
// backend/src/shared/label-utils/pattern-matcher.ts
export function processFilesForLabeling(
  files: FileForLabeling[],
  templates: Template[],
  log?: LogCallback,
): LabelProcessResult {
  let currentTemplate: Template | null = null;
  let previousTemplate: Template | null = null;  // ⭐ Track previous template for context rules
  let documentId = 0;
  let pageInDocument = 0;
  const pageLabels: PageLabel[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ocrText = extractOcrText(file.ocrText || '');
    let label: PageLabel;

    // ========================================
    // CASE 1: กำลังหา Document ใหม่
    // ========================================
    if (currentTemplate === null) {
      // ⭐ ส่ง previousTemplate เพื่อให้ context rules ทำงาน
      const { template, matchReason } = findFirstPageTemplate(
        ocrText,
        templates,
        previousTemplate
      );

      if (template) {
        documentId++;
        pageInDocument = 1;
        currentTemplate = template;

        if (template.is_single_page) {
          // เอกสารหน้าเดียว
          label = {
            templateName: template.name,
            category: template.category || '',
            status: 'single',
            matchReason,
            documentId,
            pageInDocument,
          };
          previousTemplate = template;  // ⭐ Update previous template
          currentTemplate = null; // Reset for next document
        } else {
          // เอกสารหลายหน้า - หน้าแรก
          label = {
            templateName: template.name,
            category: template.category || '',
            status: 'start',
            matchReason,
            documentId,
            pageInDocument,
          };
        }
      } else {
        // ไม่เจอ template ที่ match
        label = {
          templateName: null,
          category: '',
          status: 'unmatched',
          matchReason: 'no template matched',
          documentId: null,
          pageInDocument: null,
        };
      }
    }
    // ========================================
    // CASE 2: กำลังอยู่ใน Multi-page Document
    // ========================================
    else {
      pageInDocument++;

      // ตรวจสอบว่าเป็นหน้าสุดท้ายหรือไม่
      const lastPageResult = checkLastPage(ocrText, currentTemplate);

      if (lastPageResult.matched) {
        // หน้าสุดท้าย
        label = {
          templateName: currentTemplate.name,
          category: currentTemplate.category || '',
          status: 'end',
          matchReason: lastPageResult.reason,
          documentId,
          pageInDocument,
        };
        previousTemplate = currentTemplate;  // ⭐ Update previous template
        currentTemplate = null; // Reset for next document
      } else {
        // หน้ากลาง (continuation)
        label = {
          templateName: currentTemplate.name,
          category: currentTemplate.category || '',
          status: 'continue',
          matchReason: 'continuation',
          documentId,
          pageInDocument,
        };
        // ⚠️ ไม่ตรวจสอบ template อื่นในขณะที่อยู่ใน document
      }
    }

    pageLabels.push(label);
  }

  // Calculate stats
  const matched = pageLabels.filter(l => l.status !== 'unmatched').length;
  const total = pageLabels.length;
  const percentage = total > 0 ? (matched / total) * 100 : 0;

  return { pageLabels, matched, total, percentage };
}
```

---

### Template Matching Functions

#### Find First Page Template

```typescript
export function findFirstPageTemplate(
  text: string,
  templates: Template[],
  previousTemplate?: Template | null,  // ⭐ รับ previousTemplate เป็น parameter
): TemplateMatchResult {
  for (const template of templates) {
    // 1. ตรวจสอบ contextRules ก่อน (ถ้ามี previousTemplate)
    if (previousTemplate && template.context_rules) {
      const { requirePreviousCategory, blockPreviousCategory } = template.context_rules;

      // ตรวจสอบ requirePreviousCategory
      if (requirePreviousCategory && requirePreviousCategory.length > 0) {
        const prevCategory = previousTemplate.category || '';
        if (!requirePreviousCategory.includes(prevCategory)) {
          continue; // Skip: previous category ไม่ตรงกับที่ต้องการ
        }
      }

      // ตรวจสอบ blockPreviousCategory
      if (blockPreviousCategory && blockPreviousCategory.length > 0) {
        const prevCategory = previousTemplate.category || '';
        if (blockPreviousCategory.includes(prevCategory)) {
          continue; // Skip: previous category ถูก block
        }
      }
    }

    // 2. ตรวจสอบ firstPagePatterns
    const matchResult = checkPatterns(text, template.first_page_patterns);
    if (!matchResult.matched) continue;

    // 3. ตรวจสอบ firstPageNegativePatterns
    const negativeResult = checkNegativePatterns(
      text,
      template.first_page_negative_patterns,
    );
    if (negativeResult.blocked) {
      continue; // Skip template นี้
    }

    // ✅ Match แล้ว!
    return { template, matchReason: matchResult.reason };
  }

  return { template: null, matchReason: 'no template matched' };
}
```

#### Check Last Page

```typescript
export function checkLastPage(
  text: string,
  template: Template,
): MatchResult {
  if (!template.last_page_patterns) {
    return { matched: false, reason: 'no last_page_patterns defined' };
  }

  // 1. ตรวจสอบ lastPagePatterns
  const matchResult = checkPatterns(text, template.last_page_patterns);
  if (!matchResult.matched) {
    return matchResult;
  }

  // 2. ตรวจสอบ lastPageNegativePatterns
  const negativeResult = checkNegativePatterns(
    text,
    template.last_page_negative_patterns,
  );
  if (negativeResult.blocked) {
    return { matched: false, reason: negativeResult.reason };
  }

  return matchResult;
}
```

---

## 📊 ตัวอย่าง Flow

### สมมติมี 3 Templates

```json
[
  {
    "name": "ตราสาร",
    "firstPagePatterns": [["มูลนิธิ", "ตราสาร"]],
    "lastPagePatterns": [["ลงชื่อ", "ประธาน"]],
    "isSinglePage": false,
    "isActive": true,
    "sortOrder": 0
  },
  {
    "name": "บัญชีรายชื่อกรรมการ",
    "firstPagePatterns": [["บัญชีรายชื่อกรรมการ"]],
    "isSinglePage": true,
    "isActive": true,
    "sortOrder": 1
  },
  {
    "name": "หนังสือรับรอง",
    "firstPagePatterns": [["หนังสือรับรอง"]],
    "lastPagePatterns": [["ลงชื่อ"]],
    "isSinglePage": false,
    "isActive": true,
    "sortOrder": 2
  }
]
```

### Processing Flow

```
หน้า 1:
  OCR: "มูลนิธิ ตราสาร จัดตั้งเมื่อ..."
  → เจอ "มูลนิธิ" + "ตราสาร"
  → Match template "ตราสาร" (multi-page)
  → Label: START (ตราสาร, doc#1, page#1)

หน้า 2:
  OCR: "วัตถุประสงค์ของมูลนิธิ..."
  → กำลังอยู่ใน document "ตราสาร"
  → ตรวจสอบ lastPagePatterns: ไม่เจอ "ลงชื่อ" + "ประธาน"
  → Label: CONTINUE (ตราสาร, doc#1, page#2)

หน้า 3:
  OCR: "ลงชื่อ ประธานกรรมการ"
  → กำลังอยู่ใน document "ตราสาร"
  → ตรวจสอบ lastPagePatterns: เจอ "ลงชื่อ" + "ประธาน" ✅
  → Label: END (ตราสาร, doc#1, page#3)

หน้า 4:
  OCR: "บัญชีรายชื่อกรรมการมูลนิธิ..."
  → currentTemplate = null (หา document ใหม่)
  → เจอ "บัญชีรายชื่อกรรมการ"
  → Match template "บัญชีรายชื่อกรรมการ" (single-page)
  → Label: SINGLE (บัญชีรายชื่อกรรมการ, doc#2, page#1)

หน้า 5:
  OCR: "หนังสือรับรองการจดทะเบียน..."
  → currentTemplate = null (หา document ใหม่)
  → เจอ "หนังสือรับรอง"
  → Match template "หนังสือรับรอง" (multi-page)
  → Label: START (หนังสือรับรอง, doc#3, page#1)

หน้า 6:
  OCR: "ทั้งนี้ให้ไว้เพื่อ..."
  → กำลังอยู่ใน document "หนังสือรับรอง"
  → ตรวจสอบ lastPagePatterns: ไม่เจอ "ลงชื่อ"
  → Label: CONTINUE (หนังสือรับรอง, doc#3, page#2)

หน้า 7:
  OCR: "ภาพถ่าย บ้าน..."
  → currentTemplate = null (หา document ใหม่)
  → ไม่เจอ template ใดๆ ที่ match
  → Label: UNMATCHED
```

### ผลลัพธ์

```
Document #1: ตราสาร (3 หน้า)
  - Page 1: START
  - Page 2: CONTINUE
  - Page 3: END

Document #2: บัญชีรายชื่อกรรมการ (1 หน้า)
  - Page 1: SINGLE

Document #3: หนังสือรับรอง (2 หน้า)
  - Page 1: START
  - Page 2: CONTINUE (ไม่มี END → เอกสารไม่สมบูรณ์)

Unmatched: 1 หน้า
  - Page 7: UNMATCHED

Stats: 6/7 pages matched (85.7%)
```

---

### ตัวอย่าง Flow: Context-Based Matching

สมมติมี 2 Templates สำหรับ "หนังสือให้อำนาจ" ที่มี patterns เหมือนกัน แต่แยกตาม context:

```json
[
  {
    "name": "คำขอจัดตั้งมูลนิธิ",
    "category": "application_form",
    "firstPagePatterns": [["คำขอจัดตั้ง"]],
    "isSinglePage": true,
    "isActive": true,
    "sortOrder": 0
  },
  {
    "name": "หนังสือให้อำนาจ (จัดตั้ง)",
    "category": "documents",
    "contextRules": {
      "requirePreviousCategory": ["application_form", "documents"]
    },
    "firstPagePatterns": [["หนังสือให้อำนาจ"]],
    "isSinglePage": true,
    "isActive": true,
    "sortOrder": 1
  },
  {
    "name": "หนังสือแจ้งเปลี่ยนแปลง",
    "category": "change_notice",
    "firstPagePatterns": [["หนังสือแจ้งเปลี่ยนแปลง"]],
    "isSinglePage": true,
    "isActive": true,
    "sortOrder": 2
  },
  {
    "name": "หนังสือให้อำนาจ (เปลี่ยนแปลง)",
    "category": "documents",
    "contextRules": {
      "requirePreviousCategory": ["change_notice", "change_form"]
    },
    "firstPagePatterns": [["หนังสือให้อำนาจ"]],
    "isSinglePage": true,
    "isActive": true,
    "sortOrder": 3
  }
]
```

#### Processing Flow

```
หน้า 1:
  OCR: "คำขอจัดตั้งมูลนิธิ..."
  → เจอ "คำขอจัดตั้ง"
  → Match template "คำขอจัดตั้งมูลนิธิ" (single-page)
  → Label: SINGLE (คำขอจัดตั้งมูลนิธิ, doc#1, page#1)
  → previousTemplate = "คำขอจัดตั้งมูลนิธิ" (category: application_form)

หน้า 2:
  OCR: "หนังสือให้อำนาจ สำหรับการจัดตั้งมูลนิธิ..."
  → currentTemplate = null (หา document ใหม่)
  → previousTemplate.category = "application_form"

  → ลอง Match "หนังสือให้อำนาจ (จัดตั้ง)":
    - contextRules.requirePreviousCategory = ["application_form", "documents"]
    - previousTemplate.category = "application_form" ✅ อยู่ใน list
    - เจอ "หนังสือให้อำนาจ" ✅
    - Match สำเร็จ!

  → ลอง Match "หนังสือให้อำนาจ (เปลี่ยนแปลง)":
    - contextRules.requirePreviousCategory = ["change_notice", "change_form"]
    - previousTemplate.category = "application_form" ❌ ไม่อยู่ใน list
    - Skip template นี้

  → Label: SINGLE (หนังสือให้อำนาจ (จัดตั้ง), doc#2, page#1)
  → previousTemplate = "หนังสือให้อำนาจ (จัดตั้ง)"

หน้า 3:
  OCR: "หนังสือแจ้งเปลี่ยนแปลงกรรมการมูลนิธิ..."
  → currentTemplate = null (หา document ใหม่)
  → เจอ "หนังสือแจ้งเปลี่ยนแปลง"
  → Match template "หนังสือแจ้งเปลี่ยนแปลง" (single-page)
  → Label: SINGLE (หนังสือแจ้งเปลี่ยนแปลง, doc#3, page#1)
  → previousTemplate = "หนังสือแจ้งเปลี่ยนแปลง" (category: change_notice)

หน้า 4:
  OCR: "หนังสือให้อำนาจ สำหรับการเปลี่ยนแปลงกรรมการ..."
  → currentTemplate = null (หา document ใหม่)
  → previousTemplate.category = "change_notice"

  → ลอง Match "หนังสือให้อำนาจ (จัดตั้ง)":
    - contextRules.requirePreviousCategory = ["application_form", "documents"]
    - previousTemplate.category = "change_notice" ❌ ไม่อยู่ใน list
    - Skip template นี้

  → ลอง Match "หนังสือให้อำนาจ (เปลี่ยนแปลง)":
    - contextRules.requirePreviousCategory = ["change_notice", "change_form"]
    - previousTemplate.category = "change_notice" ✅ อยู่ใน list
    - เจอ "หนังสือให้อำนาจ" ✅
    - Match สำเร็จ!

  → Label: SINGLE (หนังสือให้อำนาจ (เปลี่ยนแปลง), doc#4, page#1)
```

#### ผลลัพธ์

```
Document #1: คำขอจัดตั้งมูลนิธิ (1 หน้า) - category: application_form
  - Page 1: SINGLE

Document #2: หนังสือให้อำนาจ (จัดตั้ง) (1 หน้า) - category: documents
  - Page 1: SINGLE
  - ⭐ Match ได้เพราะหน้าก่อนหน้าเป็น application_form

Document #3: หนังสือแจ้งเปลี่ยนแปลง (1 หน้า) - category: change_notice
  - Page 1: SINGLE

Document #4: หนังสือให้อำนาจ (เปลี่ยนแปลง) (1 หน้า) - category: documents
  - Page 1: SINGLE
  - ⭐ Match ได้เพราะหน้าก่อนหน้าเป็น change_notice

Stats: 4/4 pages matched (100%)
```

**สรุป:**
- Context Rules ช่วยแยก templates ที่มี patterns เหมือนกันตาม context ของหน้าก่อนหน้า
- ป้องกัน false match โดยไม่ต้องเพิ่ม patterns ที่ซับซ้อน
- ทำให้ระบบฉลาดขึ้นในการจับคู่เอกสารที่มีหลาย variants

---

## 📁 ไฟล์ที่เกี่ยวข้อง

### Backend Files

```
backend/src/
├── label-runner/
│   ├── label-runner.service.ts      # [MAIN] Infinite Worker Loop + Process Groups
│   ├── label-runner.controller.ts   # API endpoints
│   └── label-runner.module.ts
│
├── shared/label-utils/
│   ├── pattern-matcher.ts           # [CORE] Pattern matching logic
│   ├── types.ts                     # Interfaces และ types
│   └── index.ts                     # Exports
│
├── templates/
│   ├── template.entity.ts           # Template Entity (Database)
│   ├── templates.service.ts         # Template CRUD + getTemplatesForLabeling()
│   ├── templates.controller.ts      # API endpoints
│   └── dto/                         # CreateTemplateDto, UpdateTemplateDto
│
├── labeled-files/
│   ├── labeled-file.entity.ts       # LabeledFile Entity (Database)
│   └── labeled-files.service.ts     # CRUD + clearByGroup()
│
└── files/
    └── files.service.ts             # getGroupsReadyToLabel(), markGroupLabeled()
```

### Database Tables

- `templates` - Template configurations
- `files` - Files with OCR text (ocrText field)
- `groups` - Group metadata (isComplete, isLabeled)
- `labeled_files` - Label results (templateName, labelStatus, documentId, etc.)

---

## 💡 Best Practices

### 1. Template Design

#### ✅ DO: ใช้คำที่เฉพาะเจาะจง

```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [["มูลนิธิ", "ตราสาร", "จัดตั้ง"]]
}
```

#### ❌ DON'T: ใช้คำที่กว้างเกินไป

```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [["มูลนิธิ"]]  // ❌ กว้างเกินไป - อาจ match เอกสารอื่นได้
}
```

---

### 2. Negative Patterns

ใช้ negative patterns เพื่อป้องกัน false match:

```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [["มูลนิธิ", "ตราสาร"]],
  "firstPageNegativePatterns": [
    ["แก้ไข"],           // ป้องกัน "ตราสารแก้ไข"
    ["เปลี่ยนแปลง"]      // ป้องกัน "เปลี่ยนแปลงตราสาร"
  ]
}
```

---

### 3. Multi-language Support

ใช้หลาย variants สำหรับภาษาที่แตกต่างกัน:

```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [
    ["มูลนิธิ", "ตราสาร"],              // Thai variant
    ["foundation", "instrument"]        // English variant
  ]
}
```

---

### 4. Single-page vs Multi-page

#### Single-page Document

```json
{
  "name": "บัตรประชาชน",
  "firstPagePatterns": [["บัตรประจำตัวประชาชน"]],
  "isSinglePage": true  // ✅ ไม่ต้องหา last_page_patterns
}
```

#### Multi-page Document

```json
{
  "name": "ตราสาร",
  "firstPagePatterns": [["มูลนิธิ", "ตราสาร"]],
  "lastPagePatterns": [["ลงชื่อ", "ประธาน"]],
  "isSinglePage": false  // ✅ ต้องหา last_page_patterns
}
```

---

### 5. Template Priority (sortOrder)

Templates ที่มี `sortOrder` น้อยกว่าจะถูกตรวจสอบก่อน:

```json
[
  {
    "name": "ตราสารแก้ไข",
    "firstPagePatterns": [["มูลนิธิ", "ตราสาร", "แก้ไข"]],
    "sortOrder": 0  // ✅ ตรวจสอบก่อน
  },
  {
    "name": "ตราสาร",
    "firstPagePatterns": [["มูลนิธิ", "ตราสาร"]],
    "sortOrder": 1  // ตรวจสอบทีหลัง
  }
]
```

---

### 6. Context Rules Usage

ใช้ Context Rules เมื่อ:
- **มีหลาย variants ของเอกสารเดียวกัน** ที่มี patterns คล้ายกัน
- **ต้องการแยก templates ตาม context** ของหน้าก่อนหน้า
- **ป้องกัน false match** โดยไม่ต้องเพิ่ม patterns ที่ซับซ้อน

#### ✅ DO: ใช้ requirePreviousCategory

```json
{
  "name": "หนังสือให้อำนาจ (จัดตั้ง)",
  "category": "documents",
  "contextRules": {
    "requirePreviousCategory": ["application_form", "documents"]
  },
  "firstPagePatterns": [["หนังสือให้อำนาจ"]]
}
```

#### ✅ DO: ใช้ blockPreviousCategory

```json
{
  "name": "หนังสือให้อำนาจ (เปลี่ยนแปลง)",
  "category": "documents",
  "contextRules": {
    "blockPreviousCategory": ["application_form", "documents"]
  },
  "firstPagePatterns": [["หนังสือให้อำนาจ"]]
}
```

#### ⚠️ คำเตือน
- Context Rules ทำงาน**เฉพาะหน้าแรก**ของเอกสารใหม่ (เมื่อ currentTemplate = null)
- ถ้าไม่มี previousTemplate (หน้าแรกของ group) → Context Rules จะถูกข้าม
- ต้องกำหนด `category` ให้กับ templates ที่จะใช้ใน Context Rules

---

### 7. Debugging Tips

#### เปิด Logs
```typescript
// Frontend: ดู real-time logs ผ่าน SSE
GET /label-runner/logs (SSE)

// Logs จะแสดง:
// - Page X: [Template Name] [STATUS] - match reason
// - Matched: X/Y pages (Z%)
```

#### ตรวจสอบ OCR Text
```sql
-- ดู OCR text ของไฟล์ที่ไม่ match
SELECT id, order_in_group, ocr_text
FROM files
WHERE group_id = 1
ORDER BY order_in_group;
```

#### ตรวจสอบ Label Results
```sql
-- ดูผลการ label
SELECT order_in_group, template_name, label_status, match_reason
FROM labeled_files
WHERE group_id = 1
ORDER BY order_in_group;
```

---

## 🔧 API Endpoints

### Label Runner

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/label-runner/start` | เริ่ม infinite worker loop |
| POST | `/label-runner/stop` | หยุด worker loop |
| GET | `/label-runner/status` | ตรวจสอบสถานะ task |
| SSE | `/label-runner/logs` | รับ logs แบบ real-time |
| POST | `/label-runner/relabel/:groupId` | Re-label group ที่ระบุ |

### Templates

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/templates` | ดึง templates ทั้งหมด |
| GET | `/templates/:id` | ดึง template ตาม ID |
| POST | `/templates` | สร้าง template ใหม่ |
| PUT | `/templates/:id` | แก้ไข template |
| DELETE | `/templates/:id` | ลบ template |
| POST | `/templates/:id/toggle` | เปิด/ปิด template |

### Labeled Files

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/labeled-files/group/:groupId` | ดึง labeled files ของ group |
| GET | `/labeled-files/processed-groups` | ดึง list ของ group ที่ label แล้ว |
| POST | `/labeled-files/clear` | ลบ labeled files ทั้งหมด + reset groups.isLabeled |
| PATCH | `/labeled-files/group/:groupId/pages` | Manual label: อัปเดต labels ของหลายหน้า |

---

## 🚀 Performance Considerations

### 1. Template Loading
- Templates ถูก load 1 ครั้งตอน start task
- Reload templates เมื่อเรียก `relabel`
- ไม่ query database ทุกครั้งที่ process file

### 2. Pattern Matching
- ใช้ `includes()` สำหรับ exact match (O(n) complexity)
- Normalize text 1 ครั้งต่อหน้า
- Short-circuit evaluation (หยุดทันทีที่เจอ match)

### 3. Database Writes
- Batch insert labeled files (ทีละ file แต่ใน transaction เดียวกัน)
- Mark group เป็น labeled เพียงครั้งเดียวหลังจาก process เสร็จ

---

## 📝 Troubleshooting

### ปัญหา: Template ไม่ Match

**สาเหตุที่เป็นไปได้:**

1. **OCR ผิดพลาด**
   ```sql
   -- ตรวจสอบ OCR text
   SELECT ocr_text FROM files WHERE id = X;
   ```

2. **Pattern ไม่ครอบคลุม**
   ```json
   // ✅ เพิ่ม variants หรือ patterns
   "firstPagePatterns": [
     ["มูลนิธิ", "ตราสาร"],
     ["foundation", "instrument"]
   ]
   ```

3. **Negative Pattern Block**
   ```json
   // ตรวจสอบว่า negative patterns block หรือไม่
   "firstPageNegativePatterns": [["แก้ไข"]]
   ```

4. **Template ถูกปิด**
   ```sql
   -- ตรวจสอบ isActive
   SELECT name, is_active FROM templates;
   ```

---

### ปัญหา: Multi-page Document ไม่จบ

**สาเหตุ:** `lastPagePatterns` ไม่ match หน้าสุดท้าย

**วิธีแก้:**

1. ตรวจสอบ OCR text ของหน้าสุดท้าย
2. แก้ไข `lastPagePatterns` ให้ครอบคลุม
3. ใช้ Manual Label เพื่อแก้ไข label

---

### ปัญหา: False Match (Match ผิด)

**วิธีแก้:**

1. เพิ่ม patterns ให้เฉพาะเจาะจงขึ้น (AND logic)
2. ใช้ `firstPageNegativePatterns` เพื่อ block false match
3. ปรับ `sortOrder` ให้ template ที่เฉพาะเจาะจงกว่าถูกตรวจสอบก่อน

---

## 📚 Related Documentation

- [STRUCTURE.md](./STRUCTURE.md) - โครงสร้างระบบโดยรวม
- [task-runner.md](./task-runner.md) - Pattern สำหรับ Infinite Worker Loop + SSE Logging
- [parse-data.md](./parse-data.md) - Logic การ parse data จาก OCR (ตราสาร, กรรมการ)

---

**สร้างโดย:** OCR Flow Development Team
**อัปเดตล่าสุด:** 2025-12-15
