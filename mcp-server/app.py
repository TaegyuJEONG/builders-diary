"""HTTP Wrapper for MCP Server - Builder's Diary"""
import json
import os
from pathlib import Path
import sys

# Add mcp-server directory to path
sys.path.insert(0, str(Path(__file__).parent))

from tools.generate_record import GenerateRecordTool

# Initialize the tool
tool = GenerateRecordTool()

# Simple HTTP server using built-in libraries
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

class MCPRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        """Handle POST requests for tool calls."""
        if self.path == '/tools/generate_record':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                tool_input = json.loads(body)
                result = tool.execute(**tool_input)
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_GET(self):
        """Handle GET requests for health check."""
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"status": "ok"}).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        """Suppress log messages."""
        pass

def run_server():
    """Run the MCP HTTP server."""
    port = int(os.environ.get('PORT', 8000))
    server = HTTPServer(('0.0.0.0', port), MCPRequestHandler)
    print(f"Builder's Diary MCP Server running on port {port}")
    server.serve_forever()

if __name__ == '__main__':
    run_server()
