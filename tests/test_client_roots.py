from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from skill.scripts.client_roots import (
    CLIENT_ADAPTER_IDS,
    DEFAULT_CLAUDE_ADAPTER_IDS,
    build_import_config,
    validate_client_roots,
    validate_source_root,
)


class ClientRootValidationTests(unittest.TestCase):
    def test_source_root_must_be_absolute_and_existing_directory(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "claude-projects"
            root.mkdir()
            self.assertEqual(validate_source_root(str(root)), root.resolve())
            with self.assertRaisesRegex(ValueError, "absolute"):
                validate_source_root("relative/claude")
            with self.assertRaisesRegex(ValueError, "directory"):
                validate_source_root(str(root / "missing"))

    def test_only_allowlisted_adapter_ids_are_accepted(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            valid = {"claude": [{"adapter_id": "claude_code", "path": str(root)}]}
            self.assertEqual(validate_client_roots(valid)["claude"][0]["adapter_id"], "claude_code")
            with self.assertRaisesRegex(ValueError, "adapter"):
                validate_client_roots({"claude": [{"adapter_id": "cursor", "path": str(root)}]})

    def test_fixture_backed_clients_are_allowlisted_but_antigravity_is_blocked(self) -> None:
        self.assertEqual(CLIENT_ADAPTER_IDS["cursor"], ("cursor",))
        self.assertEqual(CLIENT_ADAPTER_IDS["codex"], ("codex",))
        self.assertEqual(CLIENT_ADAPTER_IDS["hermes"], ("hermes",))
        self.assertEqual(CLIENT_ADAPTER_IDS["antigravity"], ())

    def test_non_claude_clients_have_no_implicit_roots(self) -> None:
        config = build_import_config()
        self.assertEqual(config["source_roots"], [])
        self.assertTrue(all(not item["roots"] for name, item in config["clients"].items() if name != "claude"))

    def test_default_claude_config_is_enabled_but_has_no_implicit_roots(self) -> None:
        config = build_import_config()
        self.assertEqual(config["enabled_clients"], ["claude"])
        self.assertEqual(config["source_roots"], [])
        self.assertEqual(config["clients"]["claude"]["adapter_ids"], DEFAULT_CLAUDE_ADAPTER_IDS)

    def test_config_round_trips_explicit_roots_without_home_scan(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            config = build_import_config({"claude": [{"adapter_id": "claude_chat_export", "path": tmp}]})
            encoded = json.loads(json.dumps(config))
            self.assertEqual(encoded["source_roots"][0]["path"], str(Path(tmp).resolve()))
            self.assertNotIn("home", json.dumps(encoded).lower())


if __name__ == "__main__":
    unittest.main()
