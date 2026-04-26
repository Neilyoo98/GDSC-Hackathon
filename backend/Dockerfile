FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    golang-go \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install production Python deps. The sentence-transformers package remains
# available as a local fallback, but Railway uses OpenAI embeddings to avoid
# shipping a multi-GB PyTorch/CUDA image.
COPY backend/requirements.txt .
RUN pip install --no-cache-dir $(grep -v "sentence-transformers" requirements.txt | grep -v "^#" | grep -v "^$" | tr '\n' ' ')

# Copy source
COPY backend/ .

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
