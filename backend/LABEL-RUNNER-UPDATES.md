# Label Runner Updates - Document Date Feature

## File: `label-runner/label-runner.service.ts`

### สิ่งที่ต้องทำ

เมื่อ Label Runner สร้าง `labeled_files` จากการ auto-label ให้:
1. สร้าง `documents` records ด้วย
2. Link `labeled_files.documentTableId` ไปยัง `documents.id`
3. Set `documentDate = null` (user จะกรอกทีหลังใน manual label)

---

### แก้ไข Method: `labelGroup(groupId: number)`

**หลังจากบรรทัดที่สร้าง labeled_files เสร็จ (ประมาณบรรทัด 200-300):**

```typescript
// EXISTING CODE: Create labeled_files for each file
for (const file of files) {
  const labeledFile = await this.labeledFilesService.createLabeledFile({
    groupId,
    orderInGroup: file.orderInGroup,
    groupedFileId: file.id,
    originalName: file.originalName,
    storagePath: file.storagePath,
    ocrText: file.ocrText,
    templateName: file.templateName,
    category: file.category,
    labelStatus: file.labelStatus,
    matchReason: file.matchReason,
    documentId: file.documentId,
    pageInDocument: file.pageInDocument,
  });
}

// === ADD THIS AFTER labeled_files creation ===

// Step: Link labeled_files to documents table
try {
  await this.labeledFilesService.linkFilesToDocuments(groupId);
  this.log(`Group ${groupId}: Linked files to documents table`);
} catch (err) {
  this.log(`Group ${groupId}: Error linking files to documents: ${err.message}`, 'error');
}
```

---

### เพิ่ม Method Helper (ถ้าจำเป็น)

ถ้า Label Runner ต้องการเข้าถึง `labeledFilesService.linkFilesToDocuments()` ให้:

1. ตรวจสอบว่า `LabeledFilesService` ถูก inject เข้ามาหรือยัง
2. ถ้ายัง ให้ inject:

```typescript
constructor(
  // ... existing injections
  private labeledFilesService: LabeledFilesService,
) {}
```

3. เพิ่ม `LabeledFilesModule` ใน imports ของ `LabelRunnerModule`:

```typescript
// label-runner.module.ts
@Module({
  imports: [
    // ... existing imports
    forwardRef(() => LabeledFilesModule), // Add this
  ],
})
```

---

## การทำงาน

### Auto-Label Flow (Updated)

```
1. Label Runner เริ่ม label group
2. Pattern matching → กำหนด template + documentId
3. สร้าง labeled_files (เหมือนเดิม)
4. **NEW:** Call linkFilesToDocuments()
   - สร้าง documents records (documentDate = null)
   - Link labeled_files.documentTableId → documents.id
   - Update pageCount
5. Mark group as labeled
```

### ผลลัพธ์

หลัง auto-label เสร็จ:
- `labeled_files` table: มี records ทั้งหมดพร้อม `documentTableId`
- `documents` table: มี records ของแต่ละ document พร้อม `documentDate = null`
- User สามารถไป manual label page และกรอก document date ได้ทันที

---

## Testing

### Test Case 1: Auto-label จาก scratch

1. Upload files → Group
2. Run auto-label
3. ตรวจสอบ:
   ```sql
   -- Check labeled_files
   SELECT id, "documentId", "templateName", "documentTableId"
   FROM labeled_files
   WHERE "groupId" = 1;

   -- Check documents created
   SELECT * FROM documents WHERE "groupId" = 1;

   -- Check link is correct
   SELECT lf.id, lf."documentId", lf."templateName", d.id as doc_id, d."documentDate"
   FROM labeled_files lf
   LEFT JOIN documents d ON lf."documentTableId" = d.id
   WHERE lf."groupId" = 1;
   ```

### Test Case 2: Re-label group

1. Clear labels: `POST /labeled-files/clear`
2. Re-run auto-label
3. ตรวจสอบว่า documents ถูกสร้างใหม่

---

## Important Notes

- `documentDate` จะเป็น `null` เสมอหลัง auto-label
- User ต้องไปกรอกวันที่เองใน manual label page
- ถ้า user ไม่กรอก วันที่จะเป็น `null` ตลอด (และไม่เป็นปัญหา - optional field)
