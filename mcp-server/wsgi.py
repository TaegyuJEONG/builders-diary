#!/usr/bin/env python3
"""
Flask Wrapper for Builder's Diary MCP HTTP Server
Gunicorn compatible WSGI application
No external imports to avoid path issues on Railway
"""

import json
import logging
import sys
import os
from pathlib import Path

# Add mcp-server directory to path (both local and Railway /app)
app_dir = os.environ.get('APP_DIR', str(Path(__file__).parent))
sys.path.insert(0, app_dir)
sys.path.insert(0, '/app')

from flask import Flask, request, jsonify

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create Flask app
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# Routes

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "ok",
        "service": "builders-diary-mcp",
        "version": "1.0.0"
    }), 200

@app.route('/mcp/tools/list', methods=['GET', 'POST'])
def list_tools():
    """List available MCP tools"""
    try:
        tools = [
            {
                "name": "generate_record",
                "description": "Generate a Builder's Diary record from your work",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "project": {
                            "type": "string",
                            "description": "Project name"
                        },
                        "goal": {
                            "type": "string",
                            "description": "Goal/objective"
                        },
                        "title": {
                            "type": "string",
                            "description": "Record title"
                        },
                        "summary": {
                            "type": "string",
                            "description": "Brief summary"
                        },
                        "tags": {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": "Tags"
                        }
                    },
                    "required": ["project", "goal", "title"]
                }
            }
        ]
        return jsonify({"tools": tools}), 200
    except Exception as e:
        logger.error(f"Error listing tools: {e}", exc_info=True)
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/mcp/tools/call', methods=['POST'])
def call_tool():
    """Call an MCP tool (stub for now)"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({"error": "Empty request body", "status": "error"}), 400
        
        tool_name = data.get('tool')
        tool_input = data.get('input', {})
        
        if not tool_name:
            return jsonify({"error": "Missing 'tool' field", "status": "error"}), 400
        
        logger.info(f"Tool call: {tool_name}")
        
        # Stub response
        return jsonify({
            "status": "ok",
            "tool": tool_name,
            "message": "Tool call received (stub implementation)"
        }), 200
        
    except Exception as e:
        logger.error(f"Tool call error: {e}", exc_info=True)
        return jsonify({"error": str(e), "status": "error"}), 500

@app.route('/', methods=['GET'])
def index():
    """Index endpoint"""
    return jsonify({
        "service": "builders-diary-mcp",
        "version": "1.0.0",
        "endpoints": {
            "health": "GET /health",
            "list_tools": "GET /mcp/tools/list",
            "call_tool": "POST /mcp/tools/call"
        }
    }), 200

# Error handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Not found", "status": "error"}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({"error": "Internal server error", "status": "error"}), 500

# CORS headers
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

if __name__ == '__main__':
    # Development server
    app.run(host='0.0.0.0', port=8000, debug=False)
