#!/bin/bash

cd /Users/piyawongmahattanasawat/Desktop/OCR-flow-v2/ocr-service/solutions/02-multi-ocr-llm

export TYPHOON_API_KEY=sk-44MOILV802Bx5EHXKZALQyCUwd9ZXWqIDbNxYwpuqIeY7zE9

echo "==========================================="
echo "Testing test.jpg..."
echo "==========================================="
python3 ocr_multi_ensemble.py ../../test.jpg 2>&1 | tail -15
cp output/ensemble_result.txt output/test_result.txt

echo ""
echo "==========================================="
echo "Testing test_2.jpg..."
echo "==========================================="
python3 ocr_multi_ensemble.py ../../test_2.jpg 2>&1 | tail -15
cp output/ensemble_result.txt output/test_2_result.txt

echo ""
echo "==========================================="
echo "Testing test_3.jpg..."
echo "==========================================="
python3 ocr_multi_ensemble.py ../../test_3.jpg 2>&1 | tail -15
cp output/ensemble_result.txt output/test_3_result.txt

echo ""
echo "==========================================="
echo "All tests completed!"
echo "Results saved to output/"
echo "==========================================="
