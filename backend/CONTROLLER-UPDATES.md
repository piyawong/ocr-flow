# Backend Controller Updates - Document Date Feature

## File: `labeled-files.controller.ts`

### 1. Update PATCH `/labeled-files/group/:groupId/pages` endpoint

**OLD:**
```typescript
@Patch('group/:groupId/pages')
async updateGroupPages(
  @Param('groupId') groupId: string,
  @Body() body: {
    updates: {
      id: number;
      templateName?: string;
      category?: string;
      labelStatus?: LabelStatus;
      documentId?: number;
      pageInDocument?: number;
    }[];
  },
) {
  return this.labeledFilesService.updatePageLabels(+groupId, body.updates);
}
```

**NEW:**
```typescript
@Patch('group/:groupId/pages')
async updateGroupPages(
  @Param('groupId') groupId: string,
  @Body() body: {
    updates: {
      id: number;
      templateName?: string;
      category?: string;
      labelStatus?: LabelStatus;
      documentId?: number;
      pageInDocument?: number;
    }[];
    documents?: {
      documentNumber: number;
      templateName: string;
      documentDate: string | null;
    }[];
  },
) {
  return this.labeledFilesService.updatePageLabels(
    +groupId,
    body.updates,
    body.documents, // Pass document dates
  );
}
```

---

### 2. Update GET `/labeled-files/group/:groupId` endpoint

**ADD this to response transformation:**
```typescript
@Get('group/:groupId')
async getGroupFiles(@Param('groupId') groupId: string) {
  const files = await this.labeledFilesService.findByGroup(+groupId);
  const documents = await this.labeledFilesService.getDocumentsByGroup(+groupId);

  return {
    groupId: +groupId,
    fileCount: files.length,
    files: files.map(f => ({
      id: f.id,
      orderInGroup: f.orderInGroup,
      originalName: f.originalName,
      storagePath: f.storagePath,
      templateName: f.templateName,
      category: f.category,
      labelStatus: f.labelStatus,
      documentId: f.documentId,
      pageInDocument: f.pageInDocument,
      isUserReviewed: f.isUserReviewed,
      reviewer: f.reviewer,
      ocrText: f.ocrText,
      // NEW: Include document info
      document: f.document ? {
        id: f.document.id,
        documentNumber: f.document.documentNumber,
        documentDate: f.document.documentDate,
      } : null,
    })),
    documents, // Include documents array
  };
}
```

---

### 3. Add NEW endpoint: GET `/labeled-files/documents/:groupId`

```typescript
/**
 * Get all documents for a group
 */
@Get('documents/:groupId')
async getGroupDocuments(@Param('groupId') groupId: string) {
  return this.labeledFilesService.getDocumentsByGroup(+groupId);
}
```

---

### 4. Add NEW endpoint: PATCH `/labeled-files/document/:documentId/date`

```typescript
/**
 * Update document date only
 */
@Patch('document/:documentId/date')
async updateDocumentDate(
  @Param('documentId') documentId: string,
  @Body() body: { documentDate: string | null },
) {
  const date = body.documentDate ? new Date(body.documentDate) : null;
  return this.labeledFilesService.updateDocumentDate(+documentId, date);
}
```

---

## Implementation Steps

1. Open `backend/src/labeled-files/labeled-files.controller.ts`
2. Update the PATCH endpoint signature
3. Update the GET endpoint to include documents
4. Add 2 new endpoints
5. Test with Postman/Thunder Client

---

## API Testing

### Test 1: Update pages with document dates
```bash
PATCH http://localhost:4004/labeled-files/group/1/pages
Content-Type: application/json

{
  "updates": [
    {
      "id": 1,
      "templateName": "ตราสาร",
      "labelStatus": "start",
      "documentId": 1,
      "pageInDocument": 1
    }
  ],
  "documents": [
    {
      "documentNumber": 1,
      "templateName": "ตราสาร",
      "documentDate": "2025-01-15"
    }
  ]
}
```

### Test 2: Get group files with documents
```bash
GET http://localhost:4004/labeled-files/group/1
```

### Test 3: Update document date
```bash
PATCH http://localhost:4004/labeled-files/document/1/date
Content-Type: application/json

{
  "documentDate": "2025-02-20"
}
```
