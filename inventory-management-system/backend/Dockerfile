FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip and install setuptools/wheel first
RUN pip install --no-cache-dir --upgrade pip setuptools wheel --root-user-action=ignore

# Copy dependency files
COPY pyproject.toml ./

# Install Python dependencies
RUN pip install --no-cache-dir . --root-user-action=ignore

# Copy application code
COPY . .

# Run Alembic migrations then start the app
CMD ["sh", "-c", "alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir /app/app"]
