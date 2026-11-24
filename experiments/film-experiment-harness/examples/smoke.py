"""Loop integration check with fixture provider responses and real Blender."""
import json
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from harness import init, run

SCENE = """import bpy
import math
import sys

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 1
scene.render.resolution_x = 96
scene.render.resolution_y = 64
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.3, 0.3, 0.3, 1)
bpy.ops.mesh.primitive_cube_add()
bpy.ops.object.camera_add(location=(4, -5, 3), rotation=(math.radians(66), 0, math.radians(39)))
scene.camera = bpy.context.object
scene.render.filepath = sys.argv[-1]
scene.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)
"""


def tool_response(number, name, **args):
    return {"choices": [{"message": {"role": "assistant", "content": None,
        "reasoning_details": [{"type": "reasoning.summary", "summary": "fixture"}],
        "tool_calls": [{"id": f"call-{number}", "type": "function",
            "function": {"name": name, "arguments": json.dumps(args)}}]}}]}


def main():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp) / "run"
        init(root, "fixture", "Render a cube preview.", "high", 12, None)
        requests = []

        def fixture(payload):
            messages = payload["messages"]
            requests.append(len(messages))
            assert "max_tokens" not in payload and payload["reasoning"] == {"effort": "high"}
            if len(requests) > 1:
                assert messages[2]["reasoning_details"][0]["summary"] == "fixture"
            match len(requests):
                case 1:
                    return tool_response(1, "write_file", path="scene.py", text=SCENE, append=False)
                case 2:
                    return tool_response(2, "blender", script="scene.py", output="preview.png")
                case 3:
                    assert json.loads(messages[-1]["content"]).get("bytes", 0) > 0, messages[-1]["content"]
                    return tool_response(3, "inspect_png", path="preview.png")
                case 4:
                    assert messages[-1]["content"][1]["image_url"]["url"].startswith("data:image/png;base64,")
                    return tool_response(4, "write_file", path="scene.py",
                                         text="\n# Revised after inspecting the preview.\n", append=True)
                case 5:
                    return tool_response(5, "blender", script="scene.py", output="revised.png")
                case 6:
                    assert json.loads(messages[-1]["content"]).get("bytes", 0) > 0, messages[-1]["content"]
                    return tool_response(6, "finish", path="revised.png", summary="Reviewed cube preview.")
                case _:
                    raise AssertionError("Unexpected request")

        def state():
            return json.loads((root / "state.json").read_text())

        assert run(root, request=fixture) == "source_review"
        first = state()["review"]["digest"]
        assert run(root, request=fixture, approval=first) == "source_review"
        assert len(requests) == 5
        second = state()["review"]["digest"]
        assert first != second
        assert run(root, request=fixture, approval=first) == "source_review"
        assert len(requests) == 5
        assert run(root, request=fixture, approval=second) == "finished"
        assert state()["delivery"]["artifact"] == "revised.png"
        assert run(root, request=fixture) == "finished"
        assert len(requests) == 6
        assert all((root / f"response-{i:03}.json").is_file() for i in range(1, 7))
        print("PASS: six provider turns, two real Blender renders, preview feedback, source revision, and resume.")


if __name__ == "__main__":
    main()
