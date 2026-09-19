#!/usr/bin/env bash
# Opens a peer Claude Code session and prints the name SendMessage can address.
#
# Two backends. `tab` (default) asks the VS Code extension to open a real
# terminal tab, which is what you want when a human needs to watch the session
# work. `bg` runs `claude --bg`, which needs no editor at all and is the only
# option over ssh or outside VS Code.
#
# The tab backend cannot report its own failures: the extension surfaces every
# error as a VS Code notification the calling agent never sees, and
# `code --open-url` exits 0 regardless. It also ignores the session name, so the
# peer registers under an auto-generated one. Both problems are solved the same
# way — snapshot the session list, spawn, then wait for the new entry and print
# whatever name it actually got.
set -euo pipefail

BACKEND=tab
PROFILE=""
NAME=""
PROMPT=""
CWD=""
TIMEOUT=40
EXTENSION="clurdra.superpowers-vscode-clurdra"

die() { echo "$*" >&2; exit 1; }

usage() {
  cat >&2 <<'USAGE'
用法: spawn-session.sh --profile <名字> --name <名字> --prompt <任务> [--cwd <目录>] [--backend tab|bg] [--timeout 秒]

  --profile   profiles/ 下的文件名，不带 .json
  --name      tab 标题；bg 后端下同时是 SendMessage 的地址
  --prompt    首个用户消息，不能含单引号
  --cwd       会话工作目录，默认当前目录
  --backend   tab（默认，需要 VS Code 和扩展）| bg（纯 CLI）
USAGE
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --profile) PROFILE="${2:-}"; shift 2 ;;
    --name)    NAME="${2:-}"; shift 2 ;;
    --prompt)  PROMPT="${2:-}"; shift 2 ;;
    --cwd)     CWD="${2:-}"; shift 2 ;;
    --backend) BACKEND="${2:-}"; shift 2 ;;
    --timeout) TIMEOUT="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) die "不认识的参数: $1" ;;
  esac
done

[ -n "$PROFILE" ] || usage
[ -n "$NAME" ] || usage
[ -n "$PROMPT" ] || usage
case "$BACKEND" in tab|bg) ;; *) die "--backend 只能是 tab 或 bg" ;; esac

PROFILES_DIR="${ECC_PROFILES_DIR:-$HOME/Sources/cruldra-profile/claude-config/profiles}"
PROFILE_PATH="$PROFILES_DIR/$PROFILE.json"
[ -f "$PROFILE_PATH" ] || die "找不到 profile: $PROFILE_PATH
可用的：$(ls "$PROFILES_DIR" 2>/dev/null | sed 's/\.json$//' | tr '\n' ' ')"

CWD="${CWD:-$PWD}"
[ -d "$CWD" ] || die "cwd 不存在或不是目录: $CWD"

# The extension refuses any prompt containing a single quote, because it builds
# the claude command line by wrapping the prompt in one.
case "$PROMPT" in
  *"'"*) die "prompt 里不能有单引号，扩展会拒绝执行" ;;
esac

# sessionId, one per line. Absent binary or a failed call yields an empty
# snapshot, which only costs us the ability to filter out pre-existing sessions.
snapshot() {
  claude agents --json 2>/dev/null \
    | python3 -c 'import json,sys
try: data = json.load(sys.stdin)
except Exception: data = []
for a in data: print(a.get("sessionId",""))' 2>/dev/null || true
}

# First session whose id was not in the snapshot. Prints "name<TAB>kind".
new_session() {
  claude agents --json 2>/dev/null \
    | BEFORE="$1" python3 -c 'import json,os,sys
before = set(filter(None, os.environ.get("BEFORE","").split("\n")))
try: data = json.load(sys.stdin)
except Exception: sys.exit(0)
for a in data:
    if a.get("sessionId") not in before:
        print("{}\t{}".format(a.get("name",""), a.get("kind","")))
        break' 2>/dev/null || true
}

urlencode_twice() {
  python3 -c 'import urllib.parse,sys; print(urllib.parse.quote(urllib.parse.quote(sys.argv[1], safe="")), end="")' "$1"
}

BEFORE="$(snapshot)"

if [ "$BACKEND" = bg ]; then
  claude --bg -n "$NAME" --settings "$PROFILE_PATH" "$PROMPT" >/dev/null
else
  command -v code >/dev/null 2>&1 || die "找不到 code 命令，用 --backend bg"
  [ "${TERM_PROGRAM:-}" = vscode ] || die "不在 VS Code 终端里，tab 后端开不出来，用 --backend bg"
  # URI 由最后激活的 VS Code 窗口接走，跟脚本在哪个终端里跑无关。用户切到别的项目窗口
  # 之后再 spawn，tab 就开在那个项目里。先把打开 CWD 的窗口拉到前台再发 URI。
  # 脚本要求在 VS Code 终端里跑，所以一定有窗口开着 CWD，-r 只聚焦，不会误开新目录。
  code -r "$CWD" >/dev/null 2>&1 || true
  sleep 1
  code --open-url "vscode://$EXTENSION/create-session?profile=$(urlencode_twice "$PROFILE")&name=$(urlencode_twice "$NAME")&prompt=$(urlencode_twice "$PROMPT")&cwd=$(urlencode_twice "$CWD")"
fi

i=0
while [ "$i" -lt "$TIMEOUT" ]; do
  FOUND="$(new_session "$BEFORE")"
  if [ -n "$FOUND" ]; then
    IFS=$'\t' read -r found_name found_kind <<< "$FOUND"
    echo "已开会话"
    echo "  名字: $found_name"
    echo "  类型: $found_kind"
    echo "  发消息: SendMessage {to: \"$found_name\", message: ...}"
    exit 0
  fi
  sleep 1
  i=$((i + 1))
done

if [ "$BACKEND" = tab ]; then
  die "等了 ${TIMEOUT} 秒没等到新会话。扩展的报错只会弹在 VS Code 通知里，本终端看不到 —— 让用户看一眼通知。
常见原因：profile 名字不对、当前窗口没打开工作区文件夹、首次触发时没点允许。"
fi
die "等了 ${TIMEOUT} 秒没等到新会话。claude --bg 没起来。"
