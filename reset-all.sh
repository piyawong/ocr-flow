#!/bin/bash

# Reset OCR Flow v2 - Flush DB + Clean MinIO

echo "🧹 Resetting OCR Flow v2..."
echo "================================"
echo ""

# Stop all containers
echo "1️⃣  Stopping containers..."
docker-compose down

# Remove volumes (this will delete all data)
echo ""
echo "2️⃣  Removing volumes (DB + MinIO data)..."
docker volume rm ocr-flow-v2_postgres_data 2>/dev/null || echo "   ⚠️  postgres_data volume not found (may already be deleted)"
docker volume rm ocr-flow-v2_minio_data 2>/dev/null || echo "   ⚠️  minio_data volume not found (may already be deleted)"

# Start containers
echo ""
echo "3️⃣  Starting fresh containers..."
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "4️⃣  Waiting for services to be ready..."
echo "   Waiting for PostgreSQL..."
until docker exec ocr-postgres pg_isready -U postgres >/dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " ✅"

echo "   Waiting for MinIO..."
sleep 3
echo " ✅"

echo "   Waiting for Backend..."
sleep 5
echo " ✅"

echo ""
echo "================================"
echo "✅ Reset complete!"
echo ""
echo "📊 Services:"
echo "   - Backend:  http://localhost:4004"
echo "   - Frontend: http://localhost:3004"
echo "   - MinIO:    http://localhost:9005 (minioadmin/minioadmin)"
echo ""
echo "💡 Tip: Run 'docker-compose logs -f backend' to see backend logs"
echo ""
