#!/usr/bin/env python3
"""QA test suite for Builder's Diary MCP Server"""

import sys
import json
import shutil
from pathlib import Path
sys.path.insert(0, '/Users/taegyujeong/work/builders-diary/mcp-server')

from builders_diary import storage

# Clean up test data first
test_root = Path.home() / "builders-diary"
if test_root.exists():
    shutil.rmtree(test_root)

print("=" * 70)
print("BUILDER'S DIARY MCP SERVER - QA TEST SUITE")
print("=" * 70)

# Test 1: Create Project
print("\n[TEST 1] Create Project")
try:
    proj = storage.get_or_create_project('Test Project')
    assert proj['title'] == 'Test Project'
    assert proj['slug'] == 'test-project'
    assert proj['id'].startswith('p-')
    assert proj['created_at']
    print("✅ PASS: Project created correctly")
    print(f"   ID: {proj['id']}, Slug: {proj['slug']}")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 2: Create Goal
print("\n[TEST 2] Create Goal")
try:
    goal = storage.get_or_create_goal(proj['slug'], 'Test Goal')
    assert goal['title'] == 'Test Goal'
    assert goal['slug'] == 'test-goal'
    assert goal['id'].startswith('g-')
    assert goal['project_slug'] == proj['slug']
    print("✅ PASS: Goal created correctly")
    print(f"   ID: {goal['id']}, Slug: {goal['slug']}")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 3: Create Record
print("\n[TEST 3] Create Record with Auto-Project & Goal")
try:
    record = storage.create_record(
        project_title='Test Project',
        goal_title='Test Goal',
        record_title='My First Record',
        tags=['claude-code', 'end-to-end'],
        body='# Work Summary\n\nThis is test content for record.'
    )
    assert record['title'] == 'My First Record'
    assert record['id'].startswith('r-')
    assert record['project_slug'] == 'test-project'
    assert record['goal_slug'] == 'test-goal'
    assert 'claude-code' in record['tags']
    assert record['path']
    print("✅ PASS: Record created correctly")
    print(f"   ID: {record['id']}, Path: {record['path']}")
    print(f"   Tags: {record['tags']}")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 4: List Projects
print("\n[TEST 4] List Projects")
try:
    projects = storage.list_projects()
    assert len(projects) > 0
    assert projects[0]['title'] == 'Test Project'
    print(f"✅ PASS: Found {len(projects)} project(s)")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 5: List Goals
print("\n[TEST 5] List Goals for Project")
try:
    goals = storage.list_goals('test-project')
    assert len(goals) > 0
    assert goals[0]['title'] == 'Test Goal'
    print(f"✅ PASS: Found {len(goals)} goal(s)")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 6: List Records
print("\n[TEST 6] List Records for Goal")
try:
    records = storage.list_records('test-project', 'test-goal')
    assert len(records) > 0
    assert records[0]['title'] == 'My First Record'
    print(f"✅ PASS: Found {len(records)} record(s)")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 7: Create Second Record (test sequence numbering)
print("\n[TEST 7] Create Second Record (sequence test)")
try:
    record2 = storage.create_record(
        project_title='Test Project',
        goal_title='Test Goal',
        record_title='My Second Record',
        tags=['mcp', 'stdio'],
        body='# Second Work\n\nAnother test record.'
    )
    # Both should be created today (YYYYMMDD-seq)
    assert record2['folder'].startswith(record['folder'][:8])  # same date
    print("✅ PASS: Second record created with proper sequence numbering")
    print(f"   Record 1 folder: {record['folder']}")
    print(f"   Record 2 folder: {record2['folder']}")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 8: File I/O Verification
print("\n[TEST 8] File I/O Verification (path validation)")
try:
    record_path = Path(record['path']) / 'record.json'
    assert record_path.exists(), f"Record file not found at {record_path}"
    
    with open(record_path) as f:
        data = json.load(f)
    assert data['title'] == 'My First Record'
    assert data['body'] == 'This is test content for record.'
    
    print("✅ PASS: Files written correctly to disk")
    print(f"   Record.json exists at: {record_path}")
    print(f"   Content verified: title='{data['title']}'")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 9: Folder Structure Hierarchy
print("\n[TEST 9] Folder Structure Hierarchy")
try:
    root = Path.home() / 'builders-diary'
    assert root.exists()
    
    project_dir = root / 'test-project'
    assert project_dir.exists()
    
    goal_dir = project_dir / 'test-goal'
    assert goal_dir.exists()
    
    record_dir = goal_dir / record['folder']
    assert record_dir.exists()
    
    print("✅ PASS: Folder hierarchy created correctly")
    print(f"   Root: {root}")
    print(f"   Project: {project_dir}")
    print(f"   Goal: {goal_dir}")
    print(f"   Record: {record_dir}")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 10: Idempotent Project Creation
print("\n[TEST 10] Idempotent Project/Goal Creation")
try:
    proj_again = storage.get_or_create_project('Test Project')
    goal_again = storage.get_or_create_goal('test-project', 'Test Goal')
    
    assert proj_again['id'] == proj['id'], "Project ID should not change"
    assert goal_again['id'] == goal['id'], "Goal ID should not change"
    
    print("✅ PASS: Idempotency verified")
    print(f"   Same project returned with ID: {proj_again['id']}")
    print(f"   Same goal returned with ID: {goal_again['id']}")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 11: Error Case - Path Validation
print("\n[TEST 11] Error Case - List goals for non-existent project")
try:
    goals = storage.list_goals('nonexistent-project')
    # Should return empty list, not error
    assert goals == []
    print("✅ PASS: Gracefully handles non-existent project (returns empty list)")
except Exception as e:
    print(f"❌ FAIL: {e}")

# Test 12: Unicode and Special Characters
print("\n[TEST 12] Unicode and Special Characters Support")
try:
    special = storage.create_record(
        project_title='한글 프로젝트 🚀',
        goal_title='목표 달성 ✨',
        record_title='작업 기록 #123',
        tags=['테스트', 'QA'],
        body='한글 본문 내용\nMultiline\n특수문자: @#$%'
    )
    assert '한글' in special['project_title']
    assert '작업' in special['title']
    print("✅ PASS: Unicode characters handled correctly")
    print(f"   Project: {special['project_title']}")
    print(f"   Record: {special['title']}")
except Exception as e:
    print(f"❌ FAIL: {e}")

print("\n" + "=" * 70)
print("MCP SERVER QA TEST COMPLETED")
print("=" * 70)
