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

# MCP Server runs on stdio (no port exposure needed)
# The server reads JSON-RPC messages from stdin and writes responses to stdout
CMD ["python", "app.py"]
