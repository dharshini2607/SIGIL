FROM python:3.10-slim

WORKDIR /app

# Install native dependencies required for psycopg2 (PostgreSQL) and build tools
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Ensure google.generativeai gets installed since it was missing dynamically
RUN pip install --no-cache-dir google-generativeai psycopg2-binary

COPY . .

EXPOSE 8000

CMD ["sh", "-c", "python app/seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
