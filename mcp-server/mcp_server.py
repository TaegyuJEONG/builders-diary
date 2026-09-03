"""MCP Server for Builder's Diary - Core Tool: generate_record"""
import json
import sys
import os
from pathlib import Path

# Add mcp-server directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from tools.generate_record import GenerateRecordTool


class BuildersDiaryMCPServer:
    """MCP Server implementing generate_record tool for Builder's Diary."""
    
    def __init__(self):
        """Initialize the MCP server."""
        self.tool = GenerateRecordTool()
        self.tools = {
            "generate_record": {
                "description": "Generate a work record through a 3-turn multiturn flow",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "portfolio_path": {
                            "type": "string",
                            "description": "Portfolio root directory path (e.g., /Users/username/portfolio)"
                        },
                        "action": {
                            "type": "string",
                            "enum": ["step_1", "step_2", "step_3"],
                            "description": "Current step in the multiturn flow"
                        },
                        "context": {
                            "type": "string",
                            "description": "Turn 1: Full conversation context; Turn 2: User response; Turn 3: Empty/not needed"
                        },
                        "state": {
                            "type": "object",
                            "description": "Persistent state from previous turn"
                        }
                    },
                    "required": ["action"]
                }
            }
        }
    
    def handle_tool_call(self, tool_name: str, tool_input: dict) -> dict:
        """Handle a tool call from the MCP client.
        
        Args:
            tool_name: Name of the tool to call
            tool_input: Input parameters for the tool
            
        Returns:
            Tool output as dictionary
        """
        if tool_name == "generate_record":
            return self.tool.execute(
                portfolio_path=tool_input.get("portfolio_path"),
                action=tool_input.get("action", "step_1"),
                context=tool_input.get("context"),
                state=tool_input.get("state")
            )
        else:
            return {
                "status": "error",
                "error": "unknown_tool",
                "message": f"Unknown tool: {tool_name}"
            }
    
    def list_tools(self) -> list:
        """List all available tools.
        
        Returns:
            List of tool definitions
        """
        tools = []
        for name, definition in self.tools.items():
            tools.append({
                "name": name,
                "description": definition["description"],
                "inputSchema": definition["inputSchema"]
            })
        return tools
    
    def run(self):
        """Run the MCP server (main loop for stdio transport).
        
        This reads JSON messages from stdin and writes responses to stdout.
        Implements the MCP protocol for tool calls and other operations.
        """
        print("Builder's Diary MCP Server started", file=sys.stderr)
        
        while True:
            try:
                # Read a line from stdin
                line = sys.stdin.readline()
                if not line:
                    break
                
                # Parse JSON message
                message = json.loads(line)
                
                # Handle different message types
                if message.get("method") == "initialize":
                    response = {
                        "jsonrpc": "2.0",
                        "id": message.get("id"),
                        "result": {
                            "protocolVersion": "2024-11-05",
                            "capabilities": {},
                            "serverInfo": {
                                "name": "builders-diary-mcp",
                                "version": "0.1.0"
                            }
                        }
                    }
                    print(json.dumps(response))
                
                elif message.get("method") == "tools/list":
                    response = {
                        "jsonrpc": "2.0",
                        "id": message.get("id"),
                        "result": {
                            "tools": self.list_tools()
                        }
                    }
                    print(json.dumps(response))
                
                elif message.get("method") == "tools/call":
                    tool_name = message.get("params", {}).get("name")
                    tool_input = message.get("params", {}).get("arguments", {})
                    
                    try:
                        result = self.handle_tool_call(tool_name, tool_input)
                        response = {
                            "jsonrpc": "2.0",
                            "id": message.get("id"),
                            "result": {
                                "content": [
                                    {
                                        "type": "text",
                                        "text": json.dumps(result, ensure_ascii=False, indent=2)
                                    }
                                ]
                            }
                        }
                    except Exception as e:
                        response = {
                            "jsonrpc": "2.0",
                            "id": message.get("id"),
                            "error": {
                                "code": -32603,
                                "message": str(e)
                            }
                        }
                    
                    print(json.dumps(response, ensure_ascii=False))
                
                else:
                    # Unknown method
                    response = {
                        "jsonrpc": "2.0",
                        "id": message.get("id"),
                        "error": {
                            "code": -32601,
                            "message": f"Method not found: {message.get('method')}"
                        }
                    }
                    print(json.dumps(response))
            
            except json.JSONDecodeError as e:
                print(f"JSON decode error: {e}", file=sys.stderr)
            except Exception as e:
                print(f"Error: {e}", file=sys.stderr)
                response = {
                    "jsonrpc": "2.0",
                    "error": {
                        "code": -32603,
                        "message": str(e)
                    }
                }
                print(json.dumps(response))


def main():
    """Main entry point for the MCP server."""
    server = BuildersDiaryMCPServer()
    server.run()


if __name__ == "__main__":
    main()
