"""LLM handler for generating record proposals and summaries."""
import json
from typing import Dict, Any, Optional
from anthropic import Anthropic


class LLMHandler:
    """Handles LLM calls via Claude API."""
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize LLM handler.
        
        Args:
            api_key: Anthropic API key (defaults to ANTHROPIC_API_KEY env var)
        """
        self.client = Anthropic(api_key=api_key)
        self.model = "claude-3-5-sonnet-20241022"
    
    def analyze_context(self, context: str, portfolio_path: str) -> Dict[str, Any]:
        """Analyze context and propose project/goal/title/tags.
        
        Step 1: Extract structure from context.
        
        Args:
            context: Full conversation context from the work session
            portfolio_path: Path to portfolio folder (for context)
            
        Returns:
            Dictionary with proposal data
        """
        prompt = f"""You are an AI assistant helping a builder create work records. Analyze the following work context and propose:
1. project_slug (kebab-case identifier)
2. project_title (friendly name)
3. goal_slug (kebab-case)
4. goal_title (friendly name)
5. record_title (what was accomplished)
6. tags (list of relevant tags, 3-5 items)

Context:
{context}

Return ONLY a JSON object with these keys:
- project_slug
- project_title
- project_is_new (boolean guess)
- goal_slug
- goal_title
- goal_is_new (boolean guess)
- record_title
- tags (array of strings)

Be concise. The project and goal names should be reasonable guesses based on the context."""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=500,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        response_text = response.content[0].text
        
        try:
            proposal = json.loads(response_text)
        except json.JSONDecodeError:
            # Try to extract JSON from markdown code block
            if "```json" in response_text:
                json_str = response_text.split("```json")[1].split("```")[0].strip()
                proposal = json.loads(json_str)
            elif "```" in response_text:
                json_str = response_text.split("```")[1].split("```")[0].strip()
                proposal = json.loads(json_str)
            else:
                raise ValueError(f"Failed to parse LLM response: {response_text}")
        
        return proposal
    
    def generate_summary(self, record_title: str, context: str) -> str:
        """Generate a brief summary of the work done.
        
        Args:
            record_title: Title of the record
            context: Work context
            
        Returns:
            Summary string
        """
        prompt = f"""Based on this work context, write a 1-2 sentence summary for a work record.

Title: {record_title}

Context:
{context}

Return only the summary text, no quotes or markdown."""

        response = self.client.messages.create(
            model=self.model,
            max_tokens=150,
            messages=[
                {"role": "user", "content": prompt}
            ]
        )
        
        return response.content[0].text.strip()
