import base64
import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts.action_protocol import create_action
from skill.scripts.project_actions import apply_logo_action, validate_logo_bytes


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
JPEG = b"\xff\xd8\xff" + b"\x00" * 16
WEBP = b"RIFF" + b"\x10\x00\x00\x00WEBP" + b"\x00" * 8


class LogoActionTests(unittest.TestCase):
    def test_logo_magic_bytes_are_validated_against_declared_mime(self):
        self.assertEqual(validate_logo_bytes(PNG, "image/png"), "png")
        self.assertEqual(validate_logo_bytes(JPEG, "image/jpeg"), "jpg")
        self.assertEqual(validate_logo_bytes(WEBP, "image/webp"), "webp")
        with self.assertRaisesRegex(ValueError, "signature"):
            validate_logo_bytes(b"not an image", "image/png")
        with self.assertRaisesRegex(ValueError, "MIME"):
            validate_logo_bytes(PNG, "image/jpeg")

    def test_logo_action_copies_to_assets_and_stores_only_relative_path(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            project = root / "acme"
            project.mkdir()
            (project / "project.json").write_text(json.dumps({"id": "p-acme", "slug": "acme", "title": "Acme", "logo": "https://old.example/logo.png"}))
            action = create_action("project.logo", "logo-run", {"project_id": "p-acme", "mime": "image/png", "filename": "evil.png", "data_base64": base64.b64encode(PNG).decode()})
            result = apply_logo_action(root, action=action, run_id="logo-run")
            self.assertEqual(result["logo"], "assets/logo.png")
            self.assertEqual((project / "assets" / "logo.png").read_bytes(), PNG)
            metadata = json.loads((project / "project.json").read_text())
            self.assertEqual(metadata["logo"], "assets/logo.png")
            self.assertFalse((root / "evil.png").exists())

    def test_logo_action_rejects_oversize_and_traversal_without_changing_project(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            project = root / "acme"
            project.mkdir()
            metadata_path = project / "project.json"
            metadata_path.write_text(json.dumps({"id": "p-acme", "slug": "acme", "logo": "https://old.example/logo.png"}))
            oversized = PNG + b"x" * (5 * 1024 * 1024)
            action = create_action("project.logo", "logo-run", {"project_id": "p-acme", "mime": "image/png", "filename": "logo.png", "data_base64": base64.b64encode(oversized).decode()})
            with self.assertRaisesRegex(ValueError, "5 MB"):
                apply_logo_action(root, action=action, run_id="logo-run")
            self.assertEqual(json.loads(metadata_path.read_text())["logo"], "https://old.example/logo.png")


if __name__ == "__main__":
    unittest.main()
