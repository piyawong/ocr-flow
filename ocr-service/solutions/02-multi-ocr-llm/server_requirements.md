# PaddleOCR Server Deployment Requirements

> Spec การรัน PaddleOCR (PP-OCRv5 Thai) บน Server

---

## Models ที่ต้องใช้

| Model | Size | หน้าที่ |
|-------|------|---------|
| PP-OCRv5_server_det | 84 MB | ตรวจจับข้อความ |
| th_PP-OCRv5_mobile_rec | 7.7 MB | อ่านภาษาไทย |
| UVDoc | 31 MB | แก้การบิดเอียง |
| PP-LCNet_x1_0_doc_ori | 6.6 MB | หมุนภาพให้ตรง |
| PP-LCNet_x1_0_textline_ori | 6.6 MB | หมุนบรรทัดข้อความ |
| **รวม** | **~136 MB** | |

---

## Server Requirements

### Minimum (CPU only):
```
CPU:     4 cores (x86_64 with MKL support)
RAM:     8 GB
Storage: 2 GB (models + dependencies)
OS:      Ubuntu 20.04+, Windows 10+, macOS 12+
Python:  3.8 - 3.12
```

### Recommended (CPU):
```
CPU:     8 cores (Intel Xeon or AMD EPYC)
RAM:     16 GB
Storage: 5 GB
```

### Recommended (GPU - ถ้าต้องการเร็ว):
```
GPU:     NVIDIA GPU (Compute Capability ≥ 7.0)
         - RTX 3060 (12 GB VRAM) ขึ้นไป
         - RTX 4060/4070
         - A10/A100 (production)
CUDA:    11.8 or 12.6
RAM:     16 GB
Storage: 10 GB
```

---

## Performance Benchmarks

### CPU Inference (Intel Xeon):
| Image Size | Detection | Recognition | Total Time |
|------------|-----------|-------------|------------|
| 1024x768   | ~200 ms   | ~100 ms     | **~300 ms/image** |
| 2048x1536  | ~500 ms   | ~200 ms     | **~700 ms/image** |

### GPU Inference (RTX 3060):
| Image Size | Total Time | Speedup |
|------------|------------|---------|
| 1024x768   | **~50 ms** | 6x faster |
| 2048x1536  | **~120 ms** | 5-6x faster |

### GPU Inference (A100):
| Metric | Value |
|--------|-------|
| Throughput | **3,000+ tokens/sec** |
| Concurrent Requests | 64 requests |
| Latency | <50 ms/image |

---

## Memory Usage

### Runtime Memory (ต่อ process):
```
CPU:  2-3 GB RAM (model loading + inference)
GPU:  4-6 GB VRAM (model + batch processing)
```

### Concurrent Requests:
```
CPU:  1 request  → 2-3 GB
      10 requests → 8-12 GB (multi-process)

GPU:  1 request  → 4 GB VRAM
      4 requests → 8-10 GB VRAM
```

---

## Docker Deployment

### Recommended Docker Settings:
```dockerfile
FROM python:3.9-slim

# Shared memory (สำคัญ!)
docker run --shm-size=8g ...

# Resources
--memory=16g
--cpus=8
```

---

## สรุปแนะนำ

### สำหรับ Development/Testing:
```
CPU:  4-8 cores
RAM:  8-16 GB
Cost: ~$20-50/month (VPS)
```

### สำหรับ Production (CPU):
```
CPU:  8-16 cores
RAM:  16-32 GB
Cost: ~$100-200/month
Throughput: ~200-300 images/minute
```

### สำหรับ Production (GPU):
```
GPU:  RTX 4060/4070 or A10
RAM:  32 GB
Cost: ~$500-1000/month
Throughput: ~1,200-2,000 images/minute
```

---

## Cloud Provider Options

| Provider | Instance Type | vCPU | RAM | GPU | ราคา/เดือน |
|----------|--------------|------|-----|-----|-----------|
| AWS | t3.xlarge | 4 | 16 GB | - | ~$120 |
| AWS | g4dn.xlarge | 4 | 16 GB | T4 (16GB) | ~$400 |
| DigitalOcean | CPU-Optimized | 8 | 16 GB | - | ~$140 |
| Vultr | High Frequency | 8 | 16 GB | - | ~$96 |

---

## การ Optimize Performance

1. **ลด threads:** `PaddleOCR(use_mp=True, total_process_num=4)`
2. **ลดขนาดภาพ:** resize ก่อน OCR (ถ้าภาพใหญ่เกิน 2048px)
3. **GPU acceleration:** ใช้ TensorRT (เร็วขึ้น 2-3x)
4. **Batch processing:** process หลายรูปพร้อมกัน (GPU)

---

**Sources:**
- [PP-OCRv5 Documentation](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5.html)
- [PaddleOCR Installation Guide](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/installation.html)
- [High-Performance Inference](https://paddlepaddle.github.io/PaddleOCR/main/en/version3.x/deployment/high_performance_inference.html)
- [PaddleOCR-VL Guide](https://dev.to/czmilo/2025-complete-guide-paddleocr-vl-09b-baidus-ultra-lightweight-document-parsing-powerhouse-1e8l)
