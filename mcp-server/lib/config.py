"""Configuration management for Builder's Diary MCP Server."""
import json
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any


class ConfigManager:
    """Manages ~/.builders-diary/config.json configuration."""
    
    def __init__(self):
        """Initialize config manager."""
        self.config_dir = Path.home() / ".builders-diary"
        self.config_file = self.config_dir / "config.json"
    
    def load_or_create(self, portfolio_path: Optional[str] = None) -> Dict[str, Any]:
        """Load config or create if doesn't exist.
        
        Args:
            portfolio_path: Portfolio path to set if creating new config
            
        Returns:
            Configuration dictionary
        """
        if self.config_file.exists():
            with open(self.config_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        else:
            if not portfolio_path:
                raise ValueError(
                    "Config does not exist and no portfolio_path provided. "
                    "Run: builders-diary setup /path/to/portfolio"
                )
            return self._create_config(portfolio_path)
    
    def _create_config(self, portfolio_path: str) -> Dict[str, Any]:
        """Create and save new config.
        
        Args:
            portfolio_path: Portfolio root directory path
            
        Returns:
            New configuration dictionary
        """
        # Validate portfolio path
        portfolio_path = os.path.expanduser(portfolio_path)
        portfolio_abs = os.path.abspath(portfolio_path)
        
        if not os.path.isdir(portfolio_abs):
            raise ValueError(
                f"Portfolio path does not exist or is not a directory: {portfolio_path}"
            )
        
        config = {
            "version": "1.0",
            "portfolio_path": portfolio_abs,
            "user_id": self._generate_user_id(),
            "created_at": datetime.utcnow().isoformat() + "Z"
        }
        
        # Create config directory if it doesn't exist
        self.config_dir.mkdir(parents=True, exist_ok=True)
        
        # Save config
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        return config
    
    def save_config(self, config: Dict[str, Any]) -> None:
        """Save config to file.
        
        Args:
            config: Configuration dictionary to save
        """
        self.config_dir.mkdir(parents=True, exist_ok=True)
        with open(self.config_file, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
    
    @staticmethod
    def _generate_user_id() -> str:
        """Generate a unique user ID."""
        import uuid
        return f"user-{uuid.uuid4().hex[:12]}"
    
    @staticmethod
    def validate_portfolio_path(portfolio_path: str) -> bool:
        """Validate that portfolio path exists and is accessible.
        
        Args:
            portfolio_path: Path to validate
            
        Returns:
            True if valid, False otherwise
        """
        expanded = os.path.expanduser(portfolio_path)
        return os.path.isdir(expanded) and os.access(expanded, os.W_OK)
