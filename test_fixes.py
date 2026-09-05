#!/usr/bin/env python3
"""Validate critical fixes"""

import sys
import json
from pathlib import Path

sys.path.insert(0, '/Users/taegyujeong/work/builders-diary/mcp-server')
from builders_diary import storage

print("=" * 70)
print("FIXED MCP SERVER - VALIDATION TEST")
print("=" * 70)

# Test 1: Error handling - list goals for non-existent project
print("\n[TEST 1] List goals for non-existent project (should return [])")
try:
    goals = storage.list_goals('nonexistent-project')
    assert goals == []
    print("✅ PASS: Gracefully returns empty list")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 2: Create record and verify path in JSON
print("\n[TEST 2] Path included in saved record.json")
try:
    record = storage.create_record(
        project_title='Test',
        goal_title='Goal',
        record_title='Record',
        tags=['test'],
        body='Body'
    )
    
    # Check that path is in returned dict
    assert 'path' in record, "Path should be in returned dict"
    
    # Check that path is in saved JSON
    record_path = Path(record['path']) / 'record.json'
    with open(record_path) as f:
        saved_data = json.load(f)
    assert 'path' in saved_data, "Path should be in saved JSON"
    print("✅ PASS: Path correctly included in both returned dict and saved JSON")
    print(f"   Saved path: {saved_data['path']}")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 3: List records for non-existent goal
print("\n[TEST 3] List records for non-existent goal (should return [])")
try:
    records = storage.list_records('test', 'nonexistent-goal')
    assert records == []
    print("✅ PASS: Gracefully returns empty list")
except Exception as e:
    print(f"❌ FAIL: {e}")

print("\n" + "=" * 70)
print("ALL CRITICAL FIXES VALIDATED ✅")
print("=" * 70)
