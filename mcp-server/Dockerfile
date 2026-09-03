# Use official Python runtime as a base image
FROM python:3.11.16-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port 8000 (though Railway will override this)
EXPOSE 8000

# Default PORT is 8000, Railway overrides with PORT env var
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "4", "--timeout", "60", "app:app"]
