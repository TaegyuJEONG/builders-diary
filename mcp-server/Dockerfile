# Use official Python runtime as a base image
FROM python:3.11.16-slim

# Set working directory
WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy ONLY wsgi.py and lib/ for safety
COPY wsgi.py .
COPY lib/ ./lib/
COPY tools/ ./tools/

# Set PYTHONPATH explicitly
ENV PYTHONPATH=/app:$PYTHONPATH
ENV FLASK_APP=wsgi

# Expose port (Railway will route to this)
EXPOSE 8000

# Use ENTRYPOINT to force gunicorn execution (prevents auto-detection of app.py)
ENTRYPOINT ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "1", "--timeout", "120", "wsgi:app"]
