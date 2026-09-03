#!/usr/bin/env python3
"""Comprehensive test suite for generate_record tool - all 3 steps."""
import json
import tempfile
import os
from pathlib import Path
from datetime import datetime
import sys

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from tools.generate_record import GenerateRecordTool
from lib.config import ConfigManager
from lib.file_manager import FileManager


def test_step_1_context_analysis():
    """Test Step 1: Context analysis and proposal generation."""
    print("\n" + "="*60)
    print("TEST 1: Step 1 - Context Analysis")
    print("="*60)
    
    tool = GenerateRecordTool()
    
    # Create a test portfolio directory
    with tempfile.TemporaryDirectory() as tmpdir:
        portfolio_path = tmpdir
        
        # Test context
        context = """
        I worked on implementing OAuth login for the Builder's Diary project. 
        I set up Google OAuth, integrated it with the authentication flow, 
        and fixed a redirect bug where users were going to the home page 
        instead of the dashboard after login.
        """
        
        # Execute step 1
        result = tool.execute(
            portfolio_path=portfolio_path,
            action="step_1",
            context=context
        )
        
        # Verify response structure
        assert result["step"] == 1
        assert result["status"] == "awaiting_confirmation"
        assert "proposal" in result
        assert "message" in result
        assert "state" in result
        
        # Verify proposal contains required fields
        proposal = result["proposal"]
        assert "project_slug" in proposal
        assert "project_title" in proposal
        assert "goal_slug" in proposal
        assert "goal_title" in proposal
        assert "record_title" in proposal
        assert "tags" in proposal
        assert isinstance(proposal["tags"], list)
        
        # Verify state for next turn
        assert result["state"]["proposal"] == proposal
        assert result["state"]["context"] == context
        assert result["state"]["portfolio_path"] == portfolio_path
        
        print(f"✅ Step 1 passed")
        print(f"\nProposal:")
        print(f"  Project: {proposal['project_title']} ({proposal['project_slug']})")
        print(f"  Goal: {proposal['goal_title']} ({proposal['goal_slug']})")
        print(f"  Title: {proposal['record_title']}")
        print(f"  Tags: {', '.join(proposal['tags'])}")
        print(f"\nMessage for user:\n{result['message']}")
        
        return result["state"]


def test_step_2_confirmation(state_from_step1):
    """Test Step 2: User confirmation handling."""
    print("\n" + "="*60)
    print("TEST 2: Step 2 - User Confirmation")
    print("="*60)
    
    tool = GenerateRecordTool()
    
    # Test case 1: User confirms proposal as-is
    print("\n--- Case 1: User confirms ('맞아') ---")
    result = tool.execute(
        action="step_2",
        context="맞아",
        state=state_from_step1
    )
    
    assert result["step"] == 2
    assert result["status"] == "confirmed"
    assert "confirmed_data" in result
    assert "message" in result
    assert "state" in result
    
    confirmed = result["confirmed_data"]
    original_proposal = state_from_step1["proposal"]
    
    # Verify proposal wasn't changed
    assert confirmed["project_slug"] == original_proposal["project_slug"]
    assert confirmed["goal_slug"] == original_proposal["goal_slug"]
    assert confirmed["record_title"] == original_proposal["record_title"]
    
    print(f"✅ Confirmation 'OK' handled")
    print(f"Message: {result['message']}")
    
    # Test case 2: User wants new project
    print("\n--- Case 2: User changes to new project ---")
    result2 = tool.execute(
        action="step_2",
        context="새 프로젝트: My New Project",
        state=state_from_step1
    )
    
    assert result2["status"] == "confirmed"
    assert result2["confirmed_data"]["project_title"] == "My New Project"
    assert result2["confirmed_data"]["project_slug"] == "my-new-project"
    assert result2["confirmed_data"]["project_is_new"] == True
    
    print(f"✅ New project handled")
    print(f"New project: {result2['confirmed_data']['project_title']}")
    
    # Test case 3: User changes goal
    print("\n--- Case 3: User changes goal ---")
    result3 = tool.execute(
        action="step_2",
        context="목표: Authentication Module",
        state=state_from_step1
    )
    
    assert result3["status"] == "confirmed"
    assert result3["confirmed_data"]["goal_title"] == "Authentication Module"
    assert result3["confirmed_data"]["goal_slug"] == "authentication-module"
    
    print(f"✅ Goal change handled")
    print(f"New goal: {result3['confirmed_data']['goal_title']}")
    
    return result


def test_step_3_file_creation(state_from_step2):
    """Test Step 3: File creation."""
    print("\n" + "="*60)
    print("TEST 3: Step 3 - File Creation")
    print("="*60)
    
    tool = GenerateRecordTool()
    
    # Create a test portfolio directory with proper structure
    with tempfile.TemporaryDirectory() as tmpdir:
        portfolio_path = tmpdir
        
        # Get state info
        state = state_from_step2["state"].copy()
        state["portfolio_path"] = portfolio_path
        
        # Re-run step 2 to confirm with correct portfolio path
        tool2 = GenerateRecordTool()
        confirmed_result = tool2.execute(
            portfolio_path=portfolio_path,
            action="step_1",
            context="I fixed an OAuth redirect bug and improved authentication flow"
        )
        
        confirmed_result2 = tool2.execute(
            action="step_2",
            context="맞아",
            state=confirmed_result["state"]
        )
        
        # Now test step 3
        result = tool2.execute(
            action="step_3",
            state=confirmed_result2["state"]
        )
        
        # Verify response structure
        assert result["step"] == 3
        assert result["status"] == "completed"
        assert "file_created" in result
        assert "message" in result
        
        file_info = result["file_created"]
        assert "path" in file_info
        assert "project_id" in file_info
        assert "goal_id" in file_info
        assert "record_id" in file_info
        
        # Verify file was actually created
        file_path = Path(file_info["path"])
        assert file_path.exists(), f"File not created at {file_path}"
        assert file_path.suffix == ".md", "File should be markdown"
        
        # Verify file contents
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Check for YAML front matter
        assert content.startswith("---"), "File should start with YAML front matter"
        
        # Check for required fields in front matter
        assert "project_id:" in content
        assert "project_slug:" in content
        assert "goal_id:" in content
        assert "goal_slug:" in content
        assert "title:" in content
        assert "tags:" in content
        assert "created_at:" in content
        assert "status: completed" in content
        
        # Check for body sections
        assert "# 무엇을 했는가" in content
        assert "# 왜 했는가" in content
        assert "# 배운 점" in content
        assert "# 다음은 무엇인가" in content
        
        print(f"✅ Step 3 passed")
        print(f"\nFile created at:")
        print(f"  {file_path}")
        print(f"  Relative: {file_info.get('relative_path', 'N/A')}")
        print(f"\nFile info:")
        print(f"  Project ID: {file_info['project_id']}")
        print(f"  Goal ID: {file_info['goal_id']}")
        print(f"  Record ID: {file_info['record_id']}")
        
        # Verify folder structure
        assert (Path(tmpdir) / "content").exists()
        project_slug = confirmed_result2["confirmed_data"]["project_slug"]
        goal_slug = confirmed_result2["confirmed_data"]["goal_slug"]
        expected_base = Path(tmpdir) / "content" / f"projects-{project_slug}" / "goals" / goal_slug
        assert expected_base.exists()
        assert (expected_base / "goal.yaml").exists()
        
        print(f"\nFolder structure verified:")
        print(f"  content/projects-{project_slug}/goals/{goal_slug}/records/")
        
        return file_path


def test_end_to_end():
    """Test complete E2E workflow from step 1 to step 3."""
    print("\n" + "="*60)
    print("E2E TEST: Complete 3-Turn Workflow")
    print("="*60)
    
    tool = GenerateRecordTool()
    
    with tempfile.TemporaryDirectory() as tmpdir:
        portfolio_path = tmpdir
        
        # Step 1: Analyze context
        print("\n[Step 1] Analyzing work context...")
        context = """
        Built a new authentication module for the Builder's Diary app.
        Integrated Google OAuth, implemented token refresh, and set up
        proper error handling for failed logins. Also created middleware
        to validate tokens on protected routes.
        """
        
        result1 = tool.execute(
            portfolio_path=portfolio_path,
            action="step_1",
            context=context
        )
        
        assert result1["status"] == "awaiting_confirmation"
        proposal = result1["proposal"]
        print(f"✓ LLM proposal: {proposal['record_title']}")
        print(f"✓ Project: {proposal['project_title']}")
        print(f"✓ Goal: {proposal['goal_title']}")
        
        # Step 2: User confirms
        print("\n[Step 2] User confirms proposal...")
        result2 = tool.execute(
            action="step_2",
            context="맞아",
            state=result1["state"]
        )
        
        assert result2["status"] == "confirmed"
        print(f"✓ Confirmation accepted")
        
        # Step 3: Create file
        print("\n[Step 3] Creating record file...")
        result3 = tool.execute(
            action="step_3",
            state=result2["state"]
        )
        
        assert result3["status"] == "completed"
        file_path = Path(result3["file_created"]["path"])
        assert file_path.exists()
        
        print(f"✓ File created: {file_path.name}")
        
        # Verify entire workflow
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        assert "Google OAuth" in content or "oauth" in content.lower()
        
        print("\n" + "="*60)
        print("✅ E2E TEST PASSED - Full workflow successful!")
        print("="*60)
        print(f"\nFile location: {file_path}")
        print(f"File size: {file_path.stat().st_size} bytes")


def test_error_handling():
    """Test error handling scenarios."""
    print("\n" + "="*60)
    print("TEST: Error Handling")
    print("="*60)
    
    tool = GenerateRecordTool()
    
    # Test 1: Invalid portfolio path
    print("\n--- Test 1: Invalid portfolio path ---")
    result = tool.execute(
        portfolio_path="/nonexistent/path",
        action="step_1",
        context="Some context"
    )
    
    assert result["status"] == "error"
    assert result["error"] == "portfolio_path_invalid"
    print(f"✓ Invalid path error caught: {result['message']}")
    
    # Test 2: Missing context in step 1
    print("\n--- Test 2: Missing context ---")
    with tempfile.TemporaryDirectory() as tmpdir:
        result = tool.execute(
            portfolio_path=tmpdir,
            action="step_1",
            context=""
        )
        
        assert result["status"] == "error"
        assert result["error"] == "missing_context"
        print(f"✓ Missing context error caught")
    
    # Test 3: Missing state in step 2
    print("\n--- Test 3: Missing state in step 2 ---")
    result = tool.execute(
        action="step_2",
        context="맞아",
        state=None
    )
    
    assert result["status"] == "error"
    assert result["error"] == "missing_state"
    print(f"✓ Missing state error caught")
    
    print("\n✅ Error handling tests passed")


def test_config_management():
    """Test configuration management."""
    print("\n" + "="*60)
    print("TEST: Configuration Management")
    print("="*60)
    
    # Create temporary config directory
    with tempfile.TemporaryDirectory() as tmpdir:
        config_path = Path(tmpdir) / "test_config.json"
        
        # Test config validation
        print("\n--- Test 1: Path validation ---")
        
        # Valid path (temp directory exists)
        is_valid = ConfigManager.validate_portfolio_path(tmpdir)
        assert is_valid, f"Should validate existing directory: {tmpdir}"
        print(f"✓ Valid path validation passed")
        
        # Invalid path
        is_invalid = ConfigManager.validate_portfolio_path("/nonexistent/path/12345")
        assert not is_invalid, "Should reject nonexistent path"
        print(f"✓ Invalid path validation passed")
        
        # Test slug generation
        print("\n--- Test 2: Slug generation ---")
        from tools.generate_record import GenerateRecordTool
        
        slugs = [
            ("Builder's Diary", "builders-diary"),
            ("UI Development", "ui-development"),
            ("OAuth  Setup", "oauth-setup"),
            ("Multiple---Hyphens", "multiple-hyphens"),
        ]
        
        for text, expected in slugs:
            result = GenerateRecordTool._to_slug(text)
            assert result == expected, f"Expected '{expected}', got '{result}'"
            print(f"✓ '{text}' → '{result}'")
    
    print("\n✅ Configuration tests passed")


if __name__ == "__main__":
    try:
        # Run all tests
        print("\n" + "="*60)
        print("BUILDER'S DIARY MCP SERVER - TEST SUITE")
        print("="*60)
        
        # Step 1 test
        state1 = test_step_1_context_analysis()
        
        # Step 2 test
        state2 = test_step_2_confirmation(state1)
        
        # Step 3 test
        test_step_3_file_creation(state2)
        
        # Error handling test
        test_error_handling()
        
        # Config management test
        test_config_management()
        
        # E2E test
        test_end_to_end()
        
        print("\n" + "="*60)
        print("✅ ALL TESTS PASSED!")
        print("="*60)
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
