# Use official Python runtime as a base image
FROM python:3.11.16-slim

WORKDIR /app

# Install only gunicorn and Flask
RUN pip install --no-cache-dir gunicorn==21.2.0 flask==3.0.0

# Copy ONLY wsgi.py (NO app.py, mcp_server.py, or tools!)
COPY wsgi.py /app/
COPY app.py /app/
COPY lib/ /app/lib/

ENV PYTHONPATH=/app

EXPOSE 8000

# Force explicit gunicorn call - NO Python auto-discovery
CMD exec gunicorn --bind 0.0.0.0:8000 --workers 1 --timeout 120 wsgi:app
