#!/usr/bin/env bash
# Encrypted side of the closing-custom-dev-deals skill.
#
# ECC is a public repository, so the company's own numbers — legal identity,
# bank details, staff cost, signed deal prices, the price floor — cannot sit in
# it as plain text. They live in vault/secrets.enc (AES-256, PBKDF2) and are
# decrypted on demand with a passphrase cached in the OS keyring, so the
# operator is asked for it once per machine rather than once per session.
#
#   vault.sh seal <plaintext-dir> [out.enc]   encrypt every *.md in the directory
#
# CCDD_ASKPASS=gui forces the native dialog even on a terminal; =tty forces the
# silent read. Default picks by whether stdin is a terminal.
#   vault.sh unlock                           ask for the passphrase, cache it
#   vault.sh show [name.md]                   decrypt to stdout
#   vault.sh list                             names inside the vault
#   vault.sh status                           is a key cached, does the vault exist
#   vault.sh lock                             forget the cached passphrase
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VAULT="${CCDD_VAULT:-$HERE/../vault/secrets.enc}"
SERVICE="ecc-closing-custom-dev-deals"
KEYFILE="${XDG_CONFIG_HOME:-$HOME/.config}/ecc/closing-custom-dev-deals.key"
ITER=600000

die() { echo "$*" >&2; exit 1; }

# macOS keeps the passphrase in the login keychain; elsewhere a 0600 file.
# CCDD_KEYRING=file forces the file backend — tests use it so they never touch
# the operator's real keychain (which would pop an authorization dialog).
keyring_kind() {
  if [ -n "${CCDD_KEYRING:-}" ]; then printf '%s' "$CCDD_KEYRING"
  elif [ "$(uname -s)" = "Darwin" ]; then printf 'keychain'
  else printf 'file'; fi
}

key_load() {
  if [ "$(keyring_kind)" = "keychain" ]; then
    security find-generic-password -a "$USER" -s "$SERVICE" -w 2>/dev/null || true
  else
    [ -f "$KEYFILE" ] && cat "$KEYFILE" || true
  fi
}

key_store() {
  if [ "$(keyring_kind)" = "keychain" ]; then
    security add-generic-password -U -a "$USER" -s "$SERVICE" -w "$1" >/dev/null
  else
    mkdir -p "$(dirname "$KEYFILE")"
    umask 177
    printf '%s' "$1" > "$KEYFILE"
  fi
}

key_forget() {
  if [ "$(keyring_kind)" = "keychain" ]; then
    security delete-generic-password -a "$USER" -s "$SERVICE" >/dev/null 2>&1 || true
  else
    rm -f "$KEYFILE"
  fi
}

# Asks for the passphrase without it ever crossing stdout. With a terminal the
# prompt is a silent read; without one (an agent session, a hook) macOS gets a
# native hidden-answer dialog, so the operator can type it where the calling
# process cannot see it. CCDD_ASKPASS=tty|gui forces either path.
ask_passphrase() {
  local label="${1:-口令}" kind="${CCDD_ASKPASS:-auto}" p
  if [ "$kind" = auto ]; then
    if [ -t 0 ]; then kind=tty
    elif [ "$(uname -s)" = Darwin ] && command -v osascript >/dev/null 2>&1; then kind=gui
    else kind=tty; fi
  fi
  case "$kind" in
    gui)
      p="$(osascript -e "text returned of (display dialog \"$label\" default answer \"\" with hidden answer with title \"ECC 保险箱\")" 2>/dev/null)" \
        || die "取消了，没有输入口令"
      ;;
    *)
      printf '%s: ' "$label" >&2
      read -rs p
      printf '\n' >&2
      ;;
  esac
  [ -n "$p" ] || die "口令是空的"
  printf '%s' "$p"
}

decrypt_to_stdout() {
  openssl enc -d -aes-256-cbc -pbkdf2 -iter "$ITER" -salt -in "$VAULT" -pass env:CCDD_PASS 2>/dev/null
}

# A wrong passphrase surfaces as a decrypt failure, which is how `unlock` checks.
verify() {
  CCDD_PASS="$1" decrypt_to_stdout | tar -tzf - >/dev/null 2>&1
}

need_vault() { [ -f "$VAULT" ] || die "还没有保险箱：$VAULT
先跑一次 seal，把明文那两份收进来：
  bash $HERE/vault.sh seal ~/.claude/skills/closing-custom-dev-deals"; }

need_key() {
  local k
  k="$(key_load)"
  [ -n "$k" ] || die "这台机器还没存口令。跑一次：
  bash $HERE/vault.sh unlock"
  printf '%s' "$k"
}

cmd_seal() {
  local src="${1:-}" out="${2:-$VAULT}"
  [ -n "$src" ] && [ -d "$src" ] || die "用法: vault.sh seal <明文目录> [输出.enc]"
  local files=()
  while IFS= read -r f; do files+=("$(basename "$f")"); done < <(find "$src" -maxdepth 1 -name '*.md' | sort)
  [ "${#files[@]}" -gt 0 ] || die "$src 下没有 .md"

  local pass
  pass="$(key_load)"
  if [ -z "$pass" ]; then
    pass="$(ask_passphrase "设一个口令（长一点，密文是公开的）")"
    local again; again="$(ask_passphrase "再输一次确认")"
    [ "$pass" = "$again" ] || die "两次不一致"
  fi

  mkdir -p "$(dirname "$out")"
  tar -czf - -C "$src" "${files[@]}" \
    | CCDD_PASS="$pass" openssl enc -aes-256-cbc -pbkdf2 -iter "$ITER" -salt -out "$out" -pass env:CCDD_PASS
  key_store "$pass"
  echo "已加密 ${#files[@]} 份 -> $out"
  printf '  %s\n' "${files[@]}"
  echo "口令已记在这台机器上，下次直接用。"
}

cmd_unlock() {
  need_vault
  local pass; pass="$(ask_passphrase "口令")"
  verify "$pass" || die "口令不对，保险箱打不开"
  key_store "$pass"
  echo "口令已记住。以后 show 直接出内容，不再问。"
}

cmd_show() {
  need_vault
  local pass; pass="$(need_key)"
  verify "$pass" || die "存着的口令打不开保险箱。重新跑 unlock。"
  if [ $# -gt 0 ]; then
    CCDD_PASS="$pass" decrypt_to_stdout | tar -xzOf - "$1"
  else
    local names
    names="$(CCDD_PASS="$pass" decrypt_to_stdout | tar -tzf -)"
    while IFS= read -r n; do
      [ -n "$n" ] || continue
      printf '\n===== %s =====\n' "$n"
      CCDD_PASS="$pass" decrypt_to_stdout | tar -xzOf - "$n"
    done <<< "$names"
  fi
}

cmd_list() {
  need_vault
  local pass; pass="$(need_key)"
  CCDD_PASS="$pass" decrypt_to_stdout | tar -tzf - || die "口令打不开保险箱"
}

cmd_status() {
  echo "保险箱: $([ -f "$VAULT" ] && echo "$VAULT" || echo '还没建')"
  echo "口令:   $([ -n "$(key_load)" ] && echo '已存在本机' || echo '未存')"
}

case "${1:-}" in
  seal)   shift; cmd_seal "$@" ;;
  unlock) cmd_unlock ;;
  show)   shift; cmd_show "$@" ;;
  list)   cmd_list ;;
  status) cmd_status ;;
  lock)   key_forget; echo "已忘记口令" ;;
  *)      die "用法: vault.sh {seal <目录>|unlock|show [名字]|list|status|lock}" ;;
esac
