# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pillow>=12.3.0",
# ]
# ///
"""Export a front-end component's prototype picture: its board with everything but the component dimmed, cropped to one screen around it.

Run it while `op` has the prototype's `.op` open; it reads the board through `op layout` and `op export`:

    uv run export-component.py docs/prototype/<feature>/openpencil <board> <path>#<Component>

Nodes carry a component as a marker in their name, after ` · `: `top bar · src/components/SiteNav.tsx#SiteNav`.
A marker on the board itself means the component is the whole page, and the board is exported as is to
`exports/<board>.png`. Otherwise every node with the marker gets a frame and a name tag, and the picture goes to
`exports/<board>--<Component>.png`. The path written is printed.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont

OP = os.environ.get("OPENPENCIL_CLI", "/Applications/OpenPencil.app/Contents/MacOS/op")
MARK_SEPARATOR = " · "
SCALE = 2
SCREEN_HEIGHT = 900
MARGIN = 80
GAP = 6
LINE_WIDTH = 3
TAG_HEIGHT = 26
TAG_PADDING = 10
TAG_FONT_SIZE = 15
ACCENT = (47, 107, 255, 255)
SHADE = (20, 16, 12, 150)
TAG_TEXT = (255, 255, 255, 255)


class ExportError(Exception):
    """A marker or board that cannot be turned into a picture; the message says what to fix."""


def run_op(*args):
    """Runs one `op` command and returns what it printed.

    @throws [ExportError] when `op` fails, usually because no editor is running
    """
    result = subprocess.run([OP, *args], capture_output=True, text=True)
    if result.returncode != 0:
        raise ExportError(f"op {' '.join(args)} failed: {(result.stderr or result.stdout).strip()}")
    return result.stdout


def marks(node):
    """The parts of a node's name split at ` · `; a marker is one whole part."""
    return [part.strip() for part in (node.get("name") or "").split(MARK_SEPARATOR)]


def marked_nodes(node, marker):
    """Every node under `node`, itself included, whose name carries `marker`."""
    found = [node] if marker in marks(node) else []
    for child in node.get("children") or []:
        found.extend(marked_nodes(child, marker))
    return found


def find_board(boards, marker):
    """Finds the one board that carries `marker` and the nodes on it that do.

    @return the board and its marked nodes; an empty list when the marker is on the board itself
    @throws [ExportError] when no board or more than one board carries the marker, or when it is on a board and inside it
    """
    hits = [(board, marked_nodes(board, marker)) for board in boards]
    hits = [(board, nodes) for board, nodes in hits if nodes]
    if not hits:
        raise ExportError(
            f"no node is named with {marker}. Check that op has this prototype open, "
            "then add the marker to the node's name in build.js and rebuild the .op."
        )
    if len(hits) > 1:
        names = ", ".join(board.get("name", board["id"]).split(MARK_SEPARATOR)[0] for board, _ in hits)
        raise ExportError(f"{marker} is on more than one board ({names}); keep it on one board only.")
    board, nodes = hits[0]
    if board in nodes:
        if len(nodes) > 1:
            raise ExportError(f"{marker} is on the board and on nodes inside it; keep it on one or the other.")
        return board, []
    return board, nodes


def screen_window(boxes, board_height):
    """The top and height of the slice of the board to keep: one screen centred on `boxes`, taller when they do not fit.

    Room for each box's frame and name tag above it is counted in.
    """
    top = min(y for _, y, _, _ in boxes) - GAP - TAG_HEIGHT
    bottom = max(y + h for _, y, _, h in boxes) + GAP
    height = min(board_height, max(SCREEN_HEIGHT, bottom - top + 2 * MARGIN))
    start = (top + bottom) / 2 - height / 2
    return max(0, min(start, board_height - height)), height


def tag_font():
    """Pillow's bundled font at the tag size, so the picture looks the same on every machine."""
    return ImageFont.load_default(size=TAG_FONT_SIZE * SCALE)


def draw_focus(board_png, boxes, label, out_path):
    """Draws the focus picture from a board exported at [SCALE] and saves it at 1x.

    @param boxes the marked nodes as `(x, y, width, height)` in board units, measured from the board's corner
    @param label the name on each tag, the component's name
    """
    image = Image.open(board_png).convert("RGBA")
    board_width, board_height = image.width / SCALE, image.height / SCALE
    window_top, window_height = screen_window(boxes, board_height)
    # Kept inside the board, so a full-width bar still shows its left and right lines.
    frames = [
        (max(0, x - GAP), max(0, y - GAP), min(board_width, x + w + GAP), min(board_height, y + h + GAP))
        for x, y, w, h in boxes
    ]

    shade = Image.new("RGBA", image.size, SHADE)
    holes = ImageDraw.Draw(shade)
    for left, top, right, bottom in frames:
        holes.rectangle([left * SCALE, top * SCALE, right * SCALE, bottom * SCALE], fill=(0, 0, 0, 0))
    image = Image.alpha_composite(image, shade)

    pen = ImageDraw.Draw(image)
    font = tag_font()
    tag_width = pen.textlength(label, font=font) / SCALE + 2 * TAG_PADDING
    for left, top, right, bottom in frames:
        pen.rectangle(
            [left * SCALE, top * SCALE, right * SCALE, bottom * SCALE],
            outline=ACCENT,
            width=LINE_WIDTH * SCALE,
        )
        tag_left = max(0, min(left, board_width - tag_width))
        # Above the frame when that stays inside the picture, otherwise just inside its top edge.
        tag_top = top - TAG_HEIGHT if top - TAG_HEIGHT >= window_top else top + LINE_WIDTH
        pen.rectangle(
            [tag_left * SCALE, tag_top * SCALE, (tag_left + tag_width) * SCALE, (tag_top + TAG_HEIGHT) * SCALE],
            fill=ACCENT,
        )
        pen.text(
            ((tag_left + TAG_PADDING) * SCALE, (tag_top + TAG_HEIGHT / 2) * SCALE),
            label,
            font=font,
            fill=TAG_TEXT,
            anchor="lm",
        )

    crop = image.crop((0, round(window_top * SCALE), image.width, round((window_top + window_height) * SCALE)))
    crop = crop.resize((round(board_width), round(window_height)), Image.LANCZOS).convert("RGB")
    crop.save(out_path, optimize=True)


def export_component(prototype_dir, board_name, marker):
    """Writes the picture for the component `marker` names and returns its path.

    @param prototype_dir `docs/prototype/<feature>/openpencil`, the picture goes into its `exports/`
    @param board_name the board's file name in `exports/`, such as `desktop`
    @param marker `<path from the repo root>#<Component>`, as written in the node names
    @throws [ExportError] when the marker is malformed or [find_board] cannot place it
    """
    path, _, component = marker.partition("#")
    if not path or not component:
        raise ExportError(f"{marker} is not <path from the repo root>#<Component>.")
    if os.sep in board_name or "/" in board_name:
        raise ExportError(f"{board_name} is a file name in exports/, not a path.")

    boards = json.loads(run_op("layout", "--depth", "99"))["layout"]
    board, nodes = find_board(boards, marker)
    exports = os.path.join(prototype_dir, "exports")
    os.makedirs(exports, exist_ok=True)

    if not nodes:
        out_path = os.path.join(exports, f"{board_name}.png")
        run_op("export", "--item", board["id"], "--output", os.path.abspath(out_path), "--scale", str(SCALE))
        return out_path

    out_path = os.path.join(exports, f"{board_name}--{component}.png")
    boxes = [(n["x"] - board["x"], n["y"] - board["y"], n["width"], n["height"]) for n in nodes]
    with tempfile.TemporaryDirectory() as scratch:
        board_png = os.path.join(scratch, "board.png")
        run_op("export", "--item", board["id"], "--output", board_png, "--scale", str(SCALE))
        draw_focus(board_png, boxes, component, out_path)
    return out_path


def main():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("prototype_dir", help="docs/prototype/<feature>/openpencil")
    parser.add_argument("board", help="the board's file name in exports/, such as desktop")
    parser.add_argument("marker", help="<path from the repo root>#<Component>")
    args = parser.parse_args()
    try:
        print(export_component(args.prototype_dir, args.board, args.marker))
    except ExportError as error:
        sys.exit(f"export-component: {error}")


if __name__ == "__main__":
    main()
