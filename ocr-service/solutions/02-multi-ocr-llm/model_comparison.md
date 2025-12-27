# Thai LLM Models Comparison for OCR Correction (2025)

> Research: เปรียบเทียบ Thai LLM models สำหรับงาน OCR text correction

---

## Models ที่ใช้ได้

| Model | Size | API | ราคา | Thai Performance | แนะนำ |
|-------|------|-----|------|-----------------|-------|
| **Typhoon v2.1-12b-instruct** ⭐ | 12B | ฟรี | **$0** | ดี | **ใช้อยู่** |
| **Typhoon 2.5** 🔥 | 30B MoE | มี | $0.10/1M tokens | **ดีมาก** (ใกล้เคียง GPT-4o) | **น่าสนใจ** |
| **Typhoon2-R1-70B** | 70B | มี | ไม่ระบุ | ดีมาก (reasoning) | เกินความจำเป็น |
| OpenThaiGPT-70b | 70B | Float16.cloud | ~$0.2-0.6/1M | ใกล้เคียง Claude Sonnet | ต้องจ่าย |
| SiamGPT-32B | 32B | ❌ ยังไม่มี | - | **ดีที่สุด** (score 63.59) | รอ API |
| SEA-LION | - | มี | ไม่ระบุ | ดี (multilingual SEA) | - |

---

## Benchmarks

### ThaiOCRBench (AACL 2025)
- **Dataset:** 2,808 human-verified samples ครอบคลุม 13 tasks, 30+ domains
- **Challenges:** handwriting, multi-column layouts, mixed-script (Thai + Pali/Sanskrit)
- **Common Errors:** inserted characters, missing diacritics, invented words

### Tau-Bench Retail (Typhoon 2.5)
| Model | Thai Score | English Score | Average |
|-------|------------|---------------|---------|
| Typhoon 2.5 | 50 | 60 | 55 |
| GPT-4o | ต่ำกว่าใน Thai | สูงกว่าใน English | - |
| Claude Sonnet 4 | - | - | ใกล้เคียง Typhoon 2.5 |

---

## สำหรับงาน OCR Correction

### งานปัจจุบัน: รวม Typhoon OCR + PaddleOCR
- Input: OCR text ที่อาจมีคำผิด
- Output: Text ที่แก้ไขแล้ว
- ความต้องการ:
  - เข้าใจ Thai language context ✅
  - Cross-check ระหว่าง OCR engines ✅
  - แก้สะกดให้ถูกต้อง ✅
  - ไม่เพิ่ม/ลบเนื้อหา ✅

### Typhoon v2.1-12b-instruct (ที่ใช้อยู่)
**ข้อดี:**
- ✅ **ฟรี** (50 req/min)
- ✅ เข้าใจภาษาไทยดี
- ✅ ทำงาน OCR correction ได้ดี (ทดสอบแล้ว)
- ✅ Few-shot learning ได้

**ข้อเสีย:**
- ⚠️ 12B parameters (เล็กกว่า models อื่น)
- ⚠️ Rate limit: 50 req/min

### Typhoon 2.5 (30B MoE)
**ข้อดี:**
- ✅ Thai fluency ดีกว่า GPT-4o
- ✅ Performance ใกล้เคียง Claude Sonnet 4
- ✅ ราคาถูก ($0.10/1M tokens)
- ✅ Agentic AI capabilities

**ข้อเสีย:**
- ❌ **ไม่ฟรี** (ต้องจ่ายเงิน)

**ค่าใช้จ่าย (ถ้าใช้ Typhoon 2.5):**
- Prompt: ~15,000 tokens (few-shot + OCR results)
- Output: ~2,000 tokens
- ต้นทุน/ภาพ: **~$0.0017** (~0.06 บาท)
- 1,000 ภาพ: **~$1.70** (~60 บาท)

---

## คำแนะนำ

### สำหรับ Production (ใช้จริง):

1. **ถ้าอยากฟรี:**
   - ใช้ **Typhoon v2.1-12b-instruct** ต่อ (ที่ใช้อยู่)
   - ทำงานได้ดี ผ่านการทดสอบแล้ว

2. **ถ้ายอมจ่ายเล็กน้อย (0.06 บาท/ภาพ):**
   - ลอง **Typhoon 2.5** (performance ดีกว่า + Thai fluency ดีกว่า)
   - คุ้มค่าถ้าต้องการความแม่นยำสูงสุด

3. **รอ SiamGPT-32B API:**
   - Model ดีที่สุดใน SEA-HELM (score 63.59)
   - แต่ยังไม่มี API

### สำหรับงานนี้:
✅ **Typhoon v2.1-12b-instruct เหมาะสมแล้ว**
- ฟรี + ทำงานได้ดี + แก้ OCR error ได้

ถ้าต้องการ accuracy สูงกว่า → ลอง **Typhoon 2.5** (ถูกมาก ~0.06 บาท/ภาพ)

---

## Sources:
- [Typhoon 2.5 Release](https://opentyphoon.ai/blog/en/typhoon2-5-release)
- [Typhoon 2 & 2.1 API Pro](https://opentyphoon.ai/blog/en/introducing-typhoon-2-api-pro-accessible-production-grade-thai-llms-3e139c077aab)
- [Typhoon Models Documentation](https://docs.opentyphoon.ai/en/models/)
- [ThaiOCRBench Benchmark](https://opentyphoon.ai/blog/en/thaiocrbench)
- [SiamGPT Research (SciSimple)](https://scisimple.com/en/articles/2025-02-16-introducing-typhoon-2-your-thai-language-companion--akg267o)
- [OpenThaiGPT-70b](https://blog.float16.cloud/the-first-70b-thai-llm/)
- [ThaiLLM Leaderboard](https://blog.opentyphoon.ai/introducing-the-thaillm-leaderboard-thaillm-evaluation-ecosystem-508e789d06bf)
