"""Core MCP Tool: generate_record with 3-turn multiturn flow."""
import json
import os
from pathlib import Path
from typing import Dict, Any, Optional
from lib.config import ConfigManager
from lib.llm_handler import LLMHandler
from lib.file_manager import FileManager


class GenerateRecordTool:
    """MCP Tool for generating work records with multiturn flow."""
    
    def __init__(self):
        """Initialize the tool."""
        self.config_manager = ConfigManager()
        self.llm_handler = LLMHandler()
    
    def execute(self, portfolio_path: Optional[str] = None, action: str = "step_1",
                context: Optional[str] = None, state: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Execute the generate_record tool.
        
        Args:
            portfolio_path: Portfolio root path (optional, uses config if not provided)
            action: Current step ("step_1", "step_2", or "step_3")
            context: For step_1: full context; for step_2: user response
            state: Persistent state from previous turn
            
        Returns:
            Tool output dictionary with step, status, and message
        """
        # Get portfolio path from config if not provided
        if not portfolio_path:
            config = self.config_manager.load_or_create()
            portfolio_path = config.get("portfolio_path")
        
        # Validate portfolio path
        if not ConfigManager.validate_portfolio_path(portfolio_path):
            return {
                "step": int(action.split("_")[1]),
                "status": "error",
                "error": "portfolio_path_invalid",
                "message": f"포트폴리오 폴더를 찾을 수 없습니다: {portfolio_path}\n\n다시 설정해주세요: `@builders-diary setup /path/to/portfolio`"
            }
        
        if action == "step_1":
            return self._step_1_analyze_context(portfolio_path, context)
        elif action == "step_2":
            return self._step_2_confirm(portfolio_path, context, state)
        elif action == "step_3":
            return self._step_3_create_file(portfolio_path, state)
        else:
            return {
                "status": "error",
                "error": "invalid_action",
                "message": f"Invalid action: {action}. Use 'step_1', 'step_2', or 'step_3'"
            }
    
    def _step_1_analyze_context(self, portfolio_path: str, context: str) -> Dict[str, Any]:
        """Step 1: Analyze context and propose project/goal/title/tags.
        
        Args:
            portfolio_path: Portfolio path
            context: Full work context
            
        Returns:
            Step 1 response with proposal
        """
        if not context:
            return {
                "step": 1,
                "status": "error",
                "error": "missing_context",
                "message": "컨텍스트를 제공해주세요."
            }
        
        try:
            # Call LLM to analyze context
            proposal = self.llm_handler.analyze_context(context, portfolio_path)
            
            # Build message for user
            message = f"""이 내용이 맞나요?

프로젝트: {proposal['project_title']} (project_slug: {proposal['project_slug']})
목표: {proposal['goal_title']} (goal_slug: {proposal['goal_slug']})
제목: {proposal['record_title']}
태그: {', '.join(proposal['tags'])}

다음 중 하나로 답변해주세요:
- "맞아" → 그대로 진행
- "새 프로젝트" → 새 프로젝트 생성
- "목표 변경" → 다른 목표 선택
- 또는 직접 수정 (예: "프로젝트 이름 변경" 등)"""
            
            # Prepare state for next turn
            state = {
                "proposal": proposal,
                "context": context,
                "portfolio_path": portfolio_path
            }
            
            return {
                "step": 1,
                "status": "awaiting_confirmation",
                "proposal": proposal,
                "message": message,
                "state": state
            }
        
        except Exception as e:
            return {
                "step": 1,
                "status": "error",
                "error": "llm_failed",
                "message": f"LLM 분석 실패: {str(e)}. 다시 시도해주세요."
            }
    
    def _step_2_confirm(self, portfolio_path: str, user_response: str, 
                       state: Dict[str, Any]) -> Dict[str, Any]:
        """Step 2: Process user confirmation and finalize proposal.
        
        Args:
            portfolio_path: Portfolio path
            user_response: User's response
            state: State from step 1
            
        Returns:
            Step 2 response with confirmed data
        """
        if not state or "proposal" not in state:
            return {
                "step": 2,
                "status": "error",
                "error": "missing_state",
                "message": "상태 정보가 없습니다. Step 1부터 다시 시작해주세요."
            }
        
        proposal = state["proposal"]
        
        # Handle user response
        response_lower = user_response.lower().strip()
        
        if response_lower == "맞아" or response_lower == "ok" or response_lower == "yes":
            # User confirmed proposal as-is
            confirmed = proposal
            message = "좋아, 파일 생성 중..."
        
        elif response_lower.startswith("새 프로젝트"):
            # User wants new project
            parts = user_response.split(":", 1)
            if len(parts) > 1:
                new_project = parts[1].strip()
                confirmed = proposal.copy()
                confirmed["project_title"] = new_project
                confirmed["project_slug"] = self._to_slug(new_project)
                confirmed["project_is_new"] = True
                message = f"새 프로젝트 '{new_project}'을(를) 생성합니다."
            else:
                return {
                    "step": 2,
                    "status": "error",
                    "error": "invalid_response",
                    "message": "새 프로젝트 이름을 지정해주세요. (예: '새 프로젝트: My New Project')"
                }
        
        elif response_lower.startswith("목표"):
            # User wants to change goal
            parts = user_response.split(":", 1)
            if len(parts) > 1:
                new_goal = parts[1].strip()
                confirmed = proposal.copy()
                confirmed["goal_title"] = new_goal
                confirmed["goal_slug"] = self._to_slug(new_goal)
                confirmed["goal_is_new"] = True
                message = f"목표 '{new_goal}'으(로) 변경합니다."
            else:
                return {
                    "step": 2,
                    "status": "error",
                    "error": "invalid_response",
                    "message": "목표 이름을 지정해주세요. (예: '목표: New Goal')"
                }
        
        else:
            # Try to parse as direct modification
            confirmed = proposal.copy()
            message = f"입력: {user_response}\n파일을 생성합니다."
        
        # Prepare state for step 3
        state["confirmed_data"] = confirmed
        
        return {
            "step": 2,
            "status": "confirmed",
            "confirmed_data": confirmed,
            "message": message,
            "state": state
        }
    
    def _step_3_create_file(self, portfolio_path: str, state: Dict[str, Any]) -> Dict[str, Any]:
        """Step 3: Create the record file.
        
        Args:
            portfolio_path: Portfolio path
            state: State from step 2
            
        Returns:
            Step 3 response with file creation confirmation
        """
        if not state or "confirmed_data" not in state:
            return {
                "step": 3,
                "status": "error",
                "error": "missing_state",
                "message": "상태 정보가 없습니다. Step 1부터 다시 시작해주세요."
            }
        
        confirmed_data = state["confirmed_data"]
        context = state.get("context", "")
        
        try:
            # Initialize file manager
            file_manager = FileManager(portfolio_path)
            
            # Create directories
            records_dir = file_manager.ensure_directories(
                confirmed_data["project_slug"],
                confirmed_data["goal_slug"]
            )
            
            # Generate summary
            summary = self.llm_handler.generate_summary(
                confirmed_data["record_title"],
                context
            )
            
            # Create record file
            file_path = file_manager.create_record_file(
                records_dir,
                confirmed_data,
                context,
                summary
            )
            
            # Extract relative path for display
            relative_path = Path(file_path).relative_to(portfolio_path)
            
            message = f"""✅ 완료!

저장 위치: ~/{relative_path}

웹에서 보기: https://builders-diary.com?folder_access=true"""
            
            return {
                "step": 3,
                "status": "completed",
                "file_created": {
                    "path": file_path,
                    "relative_path": str(relative_path),
                    "project_id": f"proj-{confirmed_data['project_slug']}",
                    "goal_id": f"goal-{confirmed_data['goal_slug']}",
                    "record_id": f"rec-{Path(file_path).stem.split('-')[0]}"
                },
                "message": message
            }
        
        except Exception as e:
            return {
                "step": 3,
                "status": "error",
                "error": "file_creation_failed",
                "message": f"파일 생성 실패: {str(e)}\n\n디스크 공간과 권한을 확인해주세요."
            }
    
    @staticmethod
    def _to_slug(text: str) -> str:
        """Convert text to kebab-case slug.
        
        Args:
            text: Text to convert
            
        Returns:
            Kebab-case slug
        """
        text = text.lower()
        text = text.replace(" ", "-")
        text = "".join(c for c in text if c.isalnum() or c == "-")
        while "--" in text:
            text = text.replace("--", "-")
        return text.strip("-")[:50]


# Entry point for direct usage
if __name__ == "__main__":
    tool = GenerateRecordTool()
    print("GenerateRecordTool initialized successfully")
