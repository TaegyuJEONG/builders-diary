#!/usr/bin/env python3
"""
HTTP Server Wrapper for Builder's Diary MCP
Exposes MCP tools via REST API for Cursor, ChatGPT, Claude Web
"""

import json
import sys
import os
import logging
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# Add mcp-server directory to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp_server import BuildersDiaryMCPServer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global MCP server instance
_mcp_server = None

def get_mcp_server():
    """Get or create MCP server instance"""
    global _mcp_server
    if _mcp_server is None:
        _mcp_server = BuildersDiaryMCPServer()
    return _mcp_server


class MCPHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler for MCP requests"""
    
    def do_POST(self):
        """Handle POST requests"""
        try:
            # Parse request body
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length).decode('utf-8')
            
            if not body:
                self._error_response(400, "Empty request body")
                return
            
            request_data = json.loads(body)
            logger.info(f"POST {self.path} - {request_data.get('method', 'unknown')}")
            
            # Route to appropriate handler
            path = self.path.strip('/')
            
            if path == 'mcp/tools/list':
                self._handle_list_tools()
            elif path == 'mcp/tools/call':
                self._handle_tool_call(request_data)
            elif path == 'health':
                self._health_check()
            else:
                self._error_response(404, f"Unknown endpoint: {path}")
                
        except json.JSONDecodeError:
            self._error_response(400, "Invalid JSON")
        except Exception as e:
            logger.error(f"Error: {e}", exc_info=True)
            self._error_response(500, str(e))
    
    def do_GET(self):
        """Handle GET requests"""
        path = self.path.strip('/')
        logger.info(f"GET {path}")
        
        if path == 'health':
            self._health_check()
        elif path == 'mcp/tools/list':
            self._handle_list_tools()
        else:
            self._error_response(404, f"Unknown endpoint: {path}")
    
    def do_OPTIONS(self):
        """Handle CORS preflight"""
        self.send_response(200)
        self._cors_headers()
        self.end_headers()
    
    def _health_check(self):
        """Health check endpoint"""
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        
        response = {
            "status": "ok",
            "service": "builders-diary-mcp",
            "version": "1.0.0"
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def _handle_list_tools(self):
        """List available MCP tools"""
        mcp_server = get_mcp_server()
        tools = mcp_server.list_tools()
        
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        
        response = {
            "tools": tools
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def _handle_tool_call(self, request_data: dict):
        """Call an MCP tool"""
        tool_name = request_data.get('tool')
        tool_input = request_data.get('input', {})
        
        if not tool_name:
            self._error_response(400, "Missing 'tool' field")
            return
        
        mcp_server = get_mcp_server()
        
        try:
            result = mcp_server.handle_tool_call(tool_name, tool_input)
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._cors_headers()
            self.end_headers()
            
            self.wfile.write(json.dumps(result).encode('utf-8'))
        except Exception as e:
            logger.error(f"Tool call error: {e}", exc_info=True)
            self._error_response(500, str(e))
    
    def _error_response(self, status_code: int, message: str):
        """Send error response"""
        self.send_response(status_code)
        self.send_header('Content-Type', 'application/json')
        self._cors_headers()
        self.end_headers()
        
        response = {
            "error": message,
            "status": "error"
        }
        self.wfile.write(json.dumps(response).encode('utf-8'))
    
    def _cors_headers(self):
        """Add CORS headers"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    def log_message(self, format, *args):
        """Suppress default HTTP logging"""
        # Use our logger instead
        logger.debug(format % args)


def run_http_server(host: str = '0.0.0.0', port: int = 8000):
    """Run the HTTP server"""
    server_address = (host, port)
    httpd = HTTPServer(server_address, MCPHTTPHandler)
    
    logger.info(f"🚀 Builder's Diary MCP HTTP Server")
    logger.info(f"   Listening on {host}:{port}")
    logger.info(f"   Ready for: Cursor, ChatGPT, Claude Web")
    logger.info(f"   Health: GET http://{host}:{port}/health")
    logger.info(f"   Tools: GET http://{host}:{port}/mcp/tools/list")
    
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        httpd.shutdown()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    host = os.environ.get('HOST', '0.0.0.0')
    run_http_server(host=host, port=port)
