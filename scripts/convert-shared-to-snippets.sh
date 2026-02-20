#!/bin/bash
SRC_DIR="$HOME/git/neon-website/content/docs/shared-content"
DST_DIR="/Users/philip.olson/git/mintlify/mintlify-docs/snippets"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

convert_one() {
  local src="$1"
  local dst="$2"
  local placeholder="$3"
  [[ ! -f "$src" ]] && { echo "Missing: $src"; return 1; }
  local content
  content=$("$SCRIPT_DIR/convert.pl" < "$src")
  [[ -n "$placeholder" ]] && content="<!-- Replace $placeholder with the actual value -->"$'\n'"$content"
  echo "$content" > "$dst"
  echo "Created $dst"
}

convert_one "$SRC_DIR/need-help.md" "$DST_DIR/need-help.mdx" ""
convert_one "$SRC_DIR/feature-beta.md" "$DST_DIR/feature-beta.mdx" ""
convert_one "$SRC_DIR/feature-beta-props.md" "$DST_DIR/feature-beta-props.mdx" "{feature_name}"
convert_one "$SRC_DIR/mcp-tools.md" "$DST_DIR/mcp-tools.mdx" ""
convert_one "$SRC_DIR/manage-api-keys.md" "$DST_DIR/link-api-key.mdx" ""
convert_one "$SRC_DIR/lr-notice.md" "$DST_DIR/lr-notice.mdx" ""
convert_one "$SRC_DIR/coming-soon.md" "$DST_DIR/coming-soon.mdx" ""
convert_one "$SRC_DIR/private-preview.md" "$DST_DIR/private-preview.mdx" ""
convert_one "$SRC_DIR/private-preview-enquire.md" "$DST_DIR/private-preview-enquire.mdx" ""
convert_one "$SRC_DIR/public-preview.md" "$DST_DIR/public-preview.mdx" ""
convert_one "$SRC_DIR/lr-inbound-beta.md" "$DST_DIR/lr-beta.mdx" ""
convert_one "$SRC_DIR/migration-assistant.md" "$DST_DIR/migration-assistant.mdx" ""
convert_one "$SRC_DIR/next-steps.md" "$DST_DIR/next-steps.mdx" ""
convert_one "$SRC_DIR/new-pricing.md" "$DST_DIR/new-pricing.mdx" ""
convert_one "$SRC_DIR/early-access.md" "$DST_DIR/early-access.mdx" ""
convert_one "$SRC_DIR/early-access-props.md" "$DST_DIR/early-access-props.mdx" "{feature_name}"
convert_one "$SRC_DIR/ai-rule-usage.md" "$DST_DIR/ai-rule.mdx" "{name}"
echo "Done."
