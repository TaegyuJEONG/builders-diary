"""File manager for creating portfolio folders and markdown files."""
import os
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Tuple
import yaml


class FileManager:
    """Manages portfolio folder structure and file creation."""
    
    def __init__(self, portfolio_path: str):
        """Initialize file manager.
        
        Args:
            portfolio_path: Root portfolio directory path
        """
        self.portfolio_path = Path(portfolio_path)
        self.content_path = self.portfolio_path / "content"
        self.metadata_path = self.portfolio_path / "_metadata"
    
    def ensure_directories(self, project_slug: str, goal_slug: str) -> Path:
        """Ensure all necessary directories exist (Obsidian style auto-create).
        
        Creates:
        - content/projects-{project_slug}/
        - content/projects-{project_slug}/goals/{goal_slug}/
        - content/projects-{project_slug}/goals/{goal_slug}/records/
        
        Args:
            project_slug: Project identifier
            goal_slug: Goal identifier
            
        Returns:
            Path to records directory
        """
        # Create directory structure
        project_dir = self.content_path / f"projects-{project_slug}"
        goal_dir = project_dir / "goals" / goal_slug
        records_dir = goal_dir / "records"
        
        # Create all directories
        records_dir.mkdir(parents=True, exist_ok=True)
        
        # Create metadata files if they don't exist
        self._create_metadata_files(project_dir, project_slug, goal_dir, goal_slug)
        
        return records_dir
    
    def _create_metadata_files(self, project_dir: Path, project_slug: str, 
                               goal_dir: Path, goal_slug: str) -> None:
        """Create YAML metadata files at each level.
        
        Args:
            project_dir: Project directory path
            project_slug: Project slug
            goal_dir: Goal directory path
            goal_slug: Goal slug
        """
        # Create project.yaml if it doesn't exist
        project_yaml = project_dir / "project.yaml"
        if not project_yaml.exists():
            project_meta = {
                "slug": project_slug,
                "created_at": datetime.utcnow().isoformat() + "Z"
            }
            with open(project_yaml, 'w', encoding='utf-8') as f:
                yaml.dump(project_meta, f, allow_unicode=True, default_flow_style=False)
        
        # Create goal.yaml if it doesn't exist
        goal_yaml = goal_dir / "goal.yaml"
        if not goal_yaml.exists():
            goal_meta = {
                "slug": goal_slug,
                "project_slug": project_slug,
                "created_at": datetime.utcnow().isoformat() + "Z"
            }
            with open(goal_yaml, 'w', encoding='utf-8') as f:
                yaml.dump(goal_meta, f, allow_unicode=True, default_flow_style=False)
    
    def get_next_record_filename(self, records_dir: Path, record_title: str) -> Tuple[str, int]:
        """Get the next filename for a record.
        
        Filename format: {YYYYMMDD}-{seq}-{title-kebab}.md
        
        Args:
            records_dir: Directory containing records
            record_title: Title of the record
            
        Returns:
            Tuple of (filename, sequence_number)
        """
        today = datetime.now().strftime("%Y%m%d")
        
        # Convert title to kebab-case
        title_kebab = self._to_kebab_case(record_title)
        
        # Find existing files for today to get next sequence
        existing_files = list(records_dir.glob(f"{today}-*-*.md"))
        seq = len(existing_files)
        
        filename = f"{today}-{seq:03d}-{title_kebab}.md"
        return filename, seq
    
    def create_record_file(self, records_dir: Path, proposal: Dict[str, Any], 
                          context: str, summary: str) -> str:
        """Create a markdown record file with front matter.
        
        Args:
            records_dir: Directory to save the file in
            proposal: Proposal data (from Step 1)
            context: Original work context
            summary: Generated summary
            
        Returns:
            Path to created file
        """
        filename, seq = self.get_next_record_filename(records_dir, proposal["record_title"])
        filepath = records_dir / filename
        
        # Create front matter
        front_matter = {
            "id": f"rec-{datetime.now().strftime('%Y%m%d')}-{seq:03d}",
            "project_id": f"proj-{proposal['project_slug']}",
            "project_slug": proposal["project_slug"],
            "project_title": proposal["project_title"],
            "goal_id": f"goal-{proposal['goal_slug']}",
            "goal_slug": proposal["goal_slug"],
            "goal_title": proposal["goal_title"],
            "title": proposal["record_title"],
            "summary": summary,
            "tags": proposal["tags"],
            "created_at": datetime.utcnow().isoformat() + "Z",
            "updated_at": datetime.utcnow().isoformat() + "Z",
            "status": "completed"
        }
        
        # Create markdown content
        markdown_content = self._generate_markdown(front_matter, context)
        
        # Write file
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        return str(filepath)
    
    def _generate_markdown(self, front_matter: Dict[str, Any], context: str) -> str:
        """Generate markdown content with front matter.
        
        Args:
            front_matter: Front matter dictionary
            context: Work context to use as body
            
        Returns:
            Full markdown content
        """
        # Create front matter YAML
        fm_yaml = yaml.dump(front_matter, allow_unicode=True, default_flow_style=False)
        
        # Create body
        body = f"""
# 무엇을 했는가

{front_matter['summary']}

## 과정

{context[:500]}...

# 왜 했는가

이 작업은 프로젝트의 다음 단계를 위해 필요했습니다.

# 배운 점

이 작업을 통해 새로운 것을 배웠습니다.

# 다음은 무엇인가

다음 단계로 진행할 계획입니다.
"""
        
        # Combine front matter and body
        markdown = f"---\n{fm_yaml}---\n{body}"
        return markdown
    
    @staticmethod
    def _to_kebab_case(text: str) -> str:
        """Convert text to kebab-case.
        
        Args:
            text: Text to convert
            
        Returns:
            Kebab-case version
        """
        # Remove special characters and convert to lowercase
        text = text.lower()
        # Replace spaces with hyphens
        text = text.replace(" ", "-")
        # Remove non-alphanumeric characters except hyphens
        text = "".join(c for c in text if c.isalnum() or c == "-")
        # Remove multiple consecutive hyphens
        while "--" in text:
            text = text.replace("--", "-")
        # Remove leading/trailing hyphens
        text = text.strip("-")
        # Truncate to reasonable length
        return text[:50]
