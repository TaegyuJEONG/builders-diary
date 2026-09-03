#!/usr/bin/env python3
"""
MCP Server Entry Point for Builder's Diary
Implements the Model Context Protocol using stdio transport.
"""
import sys
import os
from pathlib import Path

# Add mcp-server directory to path
sys.path.insert(0, str(Path(__file__).parent))

from mcp_server import main

if __name__ == "__main__":
    main()
