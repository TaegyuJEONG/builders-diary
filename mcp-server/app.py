"""HTTP Wrapper for MCP Server - Builder's Diary using Flask"""
import os
import json
from pathlib import Path
import sys

# Add mcp-server directory to path
sys.path.insert(0, str(Path(__file__).parent))

from flask import Flask, request, jsonify
from tools.generate_record import GenerateRecordTool

# Initialize Flask app
app = Flask(__name__)

# Initialize the tool
tool = GenerateRecordTool()

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({"status": "ok"}), 200

@app.route('/tools/generate_record', methods=['POST'])
def generate_record():
    """Handle generate_record tool calls."""
    try:
        tool_input = request.get_json()
        result = tool.execute(**tool_input)
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    print(f"Builder's Diary MCP Server running on port {port}")
    app.run(host='0.0.0.0', port=port, debug=False)
