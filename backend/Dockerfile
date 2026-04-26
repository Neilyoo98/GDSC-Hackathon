FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps (sentence-transformers excluded — uses sha256 fallback on Railway)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir $(grep -v "sentence-transformers" requirements.txt | grep -v "^#" | grep -v "^$" | tr '\n' ' ')

# Copy source
COPY backend/ .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
