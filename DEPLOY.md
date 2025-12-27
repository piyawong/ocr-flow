# OCR Flow v2 - Production Deployment Guide

> คู่มือการ deploy OCR Flow v2 สำหรับ production environment

---

## 📋 สิ่งที่ต้องเตรียม

### 1. Server Requirements
- **CPU:** 4+ cores (recommended 8 cores)
- **RAM:** 8GB+ (recommended 16GB)
- **Storage:** 100GB+ SSD
- **OS:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+

### 2. Software Requirements
- Docker Engine 24.0+
- Docker Compose 2.20+
- Git

### 3. API Keys
- **Typhoon OCR API Keys** (5 keys minimum)
  - สมัครที่: https://opentyphoon.ai/

---

## 🚀 ขั้นตอนการ Deploy

### Step 1: Clone Repository

```bash
# SSH to your production server
ssh user@your-server-ip

# Clone repository
git clone https://github.com/your-org/OCR-flow-v2.git
cd OCR-flow-v2
```

### Step 2: ตั้งค่า Environment Variables

```bash
# แก้ไข .env ด้วย editor (vim/nano)
nano .env

# หรือถ้ายังไม่มี .env ให้ copy จาก .env.example
cp .env.example .env
nano .env
```

**สิ่งที่ต้องเปลี่ยนใน `.env`:**

```bash
# ⚠️ MUST CHANGE (Security Critical)
DB_PASSWORD=your-strong-database-password-here
MINIO_ACCESS_KEY=your-minio-access-key
MINIO_SECRET_KEY=your-minio-secret-key-min-8-chars

# Generate strong JWT secret
JWT_SECRET=$(openssl rand -base64 64)

# ⚠️ MUST CHANGE (External Access)
# ใช้ server IP หรือ domain จริง (ไม่ใช้ localhost)
HOST_IP=46.250.238.125
FRONTEND_URL=http://46.250.238.125:3004
NEXT_PUBLIC_API_URL=http://46.250.238.125:4004

# หรือถ้ามี domain + SSL
# HOST_IP=your-domain.com
# FRONTEND_URL=https://your-domain.com
# NEXT_PUBLIC_API_URL=https://api.your-domain.com
```

**Development vs Production:**

```bash
# Development (localhost)
NEXT_PUBLIC_API_URL=http://localhost:4004

# Production (server IP/domain)
NEXT_PUBLIC_API_URL=http://46.250.238.125:4004
# หรือ https://api.your-domain.com
```

### Step 3: Build และ Start Services

```bash
# Build production images (first time only)
docker-compose -f docker-compose.prod.yml build

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# ตรวจสอบ logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 4: Create Admin User

```bash
# เปิดเว็บไปที่
https://your-domain.com/login

# คลิก "Create Default Admin User"
# หรือใช้ API:
curl -X POST http://your-server-ip:4004/auth/init-admin
```

**Default Admin:**
- Email: `admin@ocrflow.local`
- Password: `admin123`

⚠️ **เปลี่ยนรหัสผ่านทันทีหลัง login ครั้งแรก!**

---

## 🔒 Security Checklist

### Before Going Live:

- [ ] เปลี่ยน `DB_PASSWORD` เป็น strong password
- [ ] เปลี่ยน `MINIO_ACCESS_KEY` และ `MINIO_SECRET_KEY`
- [ ] สร้าง `JWT_SECRET` ใหม่ด้วย `openssl rand -base64 64`
- [ ] เปลี่ยนรหัสผ่าน admin user ทันทีหลัง login
- [ ] ตั้งค่า Firewall (เปิดเฉพาะ port ที่จำเป็น)
- [ ] ติดตั้ง SSL/TLS certificates (Let's Encrypt)
- [ ] ตั้งค่า Nginx/Caddy เป็น reverse proxy
- [ ] Enable automatic backups
- [ ] ตั้งค่า monitoring (Prometheus, Grafana)

---

## 🌐 Nginx Reverse Proxy (Optional แต่แนะนำ)

### Install Nginx

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Configure Nginx

```bash
sudo nano /etc/nginx/sites-available/ocrflow
```

**Nginx Config:**

```nginx
# Frontend (Main Website)
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE Support
    location /files/events {
        proxy_pass http://localhost:4004/files/events;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
    }
}

# Backend API
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://localhost:4004;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Upload size limit (for large PDFs)
        client_max_body_size 100M;
    }
}
```

### Enable Site & SSL

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/ocrflow /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Install SSL (Let's Encrypt)
sudo certbot --nginx -d your-domain.com -d api.your-domain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

---

## 📊 Monitoring & Logs

### View Logs

```bash
# All services
docker-compose -f docker-compose.prod.yml logs -f

# Specific service
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Last 100 lines
docker-compose -f docker-compose.prod.yml logs --tail=100 backend
```

### Health Checks

```bash
# Backend health
curl http://localhost:4004/health

# Frontend health
curl http://localhost:3004/api/health

# OCR Service health
curl http://localhost:8000/health
```

### Container Status

```bash
# Check all containers
docker-compose -f docker-compose.prod.yml ps

# Resource usage
docker stats
```

---

## 🔄 Updates & Maintenance

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild images
docker-compose -f docker-compose.prod.yml build

# Restart with zero downtime (rolling update)
docker-compose -f docker-compose.prod.yml up -d --no-deps --build backend
docker-compose -f docker-compose.prod.yml up -d --no-deps --build frontend

# Or restart all (with brief downtime)
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### Database Backup

```bash
# Backup PostgreSQL
docker exec ocr-postgres-prod pg_dump -U postgres ocrflow_prod > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i ocr-postgres-prod psql -U postgres ocrflow_prod < backup_20250101.sql
```

### MinIO Backup

```bash
# Backup MinIO data
docker run --rm \
  -v ocr-flow-v2_minio_data_prod:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/minio_$(date +%Y%m%d).tar.gz -C /data .

# Restore
docker run --rm \
  -v ocr-flow-v2_minio_data_prod:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/minio_20250101.tar.gz -C /data
```

---

## 🐛 Troubleshooting

### Services Won't Start

```bash
# Check Docker daemon
sudo systemctl status docker

# Check ports in use
sudo netstat -tulpn | grep -E '3004|4004|5434|8000|9004'

# Check logs for errors
docker-compose -f docker-compose.prod.yml logs backend
```

### Database Connection Errors

```bash
# Check PostgreSQL container
docker exec ocr-postgres-prod psql -U postgres -c "\l"

# Reset database (⚠️ DELETES ALL DATA)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d
```

### Out of Memory

```bash
# Check memory usage
free -h
docker stats

# Increase swap (if needed)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### High CPU Usage

```bash
# Check which container is using CPU
docker stats

# Scale down OCR threads (edit .env.prod)
# Reduce number of API keys or implement rate limiting
```

---

## 📝 Maintenance Schedule

### Daily
- ✅ Monitor logs for errors
- ✅ Check disk space (`df -h`)
- ✅ Verify all services are healthy

### Weekly
- ✅ Database backup
- ✅ MinIO backup
- ✅ Review resource usage
- ✅ Check for security updates

### Monthly
- ✅ Update Docker images
- ✅ Update application code
- ✅ Review and rotate logs
- ✅ Test disaster recovery

---

## 🆘 Support & Contact

**Issues:**
- GitHub: https://github.com/your-org/OCR-flow-v2/issues

**Documentation:**
- Main: `STRUCTURE.md`
- API: `api-reference.md`
- Database: `database-detailed.md`

---

## 📄 License

Copyright © 2025 OCR Flow Development Team
