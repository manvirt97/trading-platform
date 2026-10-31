import unittest
import importlib.util
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import Mock, patch

module_path = Path(__file__).resolve().parent / "server.py"
spec = importlib.util.spec_from_file_location("rangeform_skill_server", module_path)
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class HostedSkillSafetyTests(unittest.TestCase):
    def test_all_eleven_tools_allowlisted(self):
        self.assertEqual(len(server.SKILL_FILES), 11)
        self.assertIn("broker", server.SKILL_FILES)
        self.assertIn("pelosi", server.SKILL_FILES)

    def test_no_arbitrary_commands_broker_approval_or_short(self):
        with TemporaryDirectory() as directory:
            for name in server.SKILL_FILES:
                payload = {"skill": name, "symbol": "AAPL", "entry": 100, "stop": 99, "target": 102}
                with patch.dict(os.environ, {"SEC_USER_AGENT": "Rangeform test@example.com"}):
                    steps = server.safe_command(name, payload, directory)
                for label, cmd, _ in steps:
                    joined = " ".join(cmd).lower()
                    self.assertNotIn(" approve", joined)
                    self.assertNotIn(" flatten", joined)
                    self.assertNotIn(" fill ", joined)
                    self.assertNotIn(" place_stock_order", joined)
                    self.assertNotIn(" --short", joined)
                    self.assertNotIn(" --paper false", joined)
                if name == "broker":
                    self.assertEqual(steps[-1][1][2:4], ["show", "--json"])
            self.assertNotIn("order", server.SKILL_FILES)

    def test_trade_inputs_and_symbol_cannot_inject_shell(self):
        with TemporaryDirectory() as directory:
            for bad in [
                {"skill": "exit", "symbol": "AAPL;curl bad", "entry": 100, "stop": 99, "target": 102},
                {"skill": "exit", "symbol": "AAPL", "entry": 100, "stop": 102, "target": 101},
                {"skill": "timemachine", "symbol": "AAPL", "entry": 100, "stop": 99, "target": 102, "entry_time": "; touch x"},
                {"skill": "risk", "symbol": "AAPL", "entry": 100, "stop": 99, "target": "NaN"},
            ]:
                with self.assertRaises(server.InputError):
                    server.safe_command(bad["skill"], bad, directory)
            with self.assertRaises(server.InputError):
                server.safe_command("evil", {"skill": "evil"}, directory)

    def test_research_mode_is_paper_only_even_when_client_sends_flags(self):
        with TemporaryDirectory() as directory:
            data = {"skill": "broker", "symbol": "AAPL", "entry": 100, "stop": 99,
                    "target": 102, "paper": False, "allow_short": True, "command": "approve"}
            steps = server.safe_command("broker", data, directory)
            import json
            config = json.loads((Path(directory) / "trader/config.json").read_text())
            self.assertIs(config["paper"], True)
            self.assertIs(config["allow_short"], False)
            self.assertEqual(config["broker"], "none")
            self.assertEqual(steps[-1][0], "broker")

    def test_does_not_claim_success_on_data_failure(self):
        mock = Mock(return_value=Mock(stdout="", stderr="unavailable", returncode=1))
        with patch.dict(os.environ, {"SEC_USER_AGENT": "Rangeform test@example.com"}):
            result, code = server.run_skill({"skill": "news", "symbol": "AAPL"}, runner=mock)
        self.assertEqual(code, 422)
        self.assertIs(result["ok"], False)
        self.assertTrue(result["paper_only"])
        self.assertTrue(mock.called)

    def test_no_real_execution_paths_in_server(self):
        source = module_path.read_text()
        self.assertIn('"show"', source)
        self.assertNotIn('["approve"', source)
        self.assertNotIn('["flatten"', source)
        self.assertNotIn('["fill"', source)
        self.assertIn("TemporaryDirectory", source)
        self.assertIn("hmac.compare_digest", source)
        self.assertIn("BoundedSemaphore(2)", source)


if __name__ == "__main__":
    unittest.main()
