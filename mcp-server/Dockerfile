# Use official Python runtime as a base image
FROM python:3.11.16-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy ONLY necessary files (HTTP server wrapper + dependencies, NOT mcp_server or tools)
COPY app.py wsgi.py ./
COPY lib/ ./lib/

# Set PYTHONPATH explicitly
ENV PYTHONPATH=/app:$PYTHONPATH

# Expose port (Railway will route to this)
EXPOSE 8000

# Use ENTRYPOINT to force gunicorn execution
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "--timeout", "120", "wsgi:app"]
