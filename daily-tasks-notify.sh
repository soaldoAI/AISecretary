#!/bin/bash
# Daily Telegram notification for pending Kanban tasks
# Configure TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.local

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load env vars from .env.local
if [ -f "$SCRIPT_DIR/.env.local" ]; then
  export $(grep -E '^TELEGRAM_' "$SCRIPT_DIR/.env.local" | xargs)
fi

BOT_TOKEN="${TELEGRAM_BOT_TOKEN}"
CHAT_ID="${TELEGRAM_CHAT_ID}"
DB="$SCRIPT_DIR/kanban.db"

if [ -z "$BOT_TOKEN" ] || [ -z "$CHAT_ID" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set in .env.local"
  exit 1
fi

# Build message
DATE=$(date '+%A, %d %B %Y')
MSG="📋 *Daily Task Brief — ${DATE}*"$'\n\n'

# Count by status
IN_PROGRESS=$(sqlite3 "$DB" "SELECT COUNT(*) FROM tasks WHERE status='in_progress';")
TODO=$(sqlite3 "$DB" "SELECT COUNT(*) FROM tasks WHERE status='todo';")
BACKLOG=$(sqlite3 "$DB" "SELECT COUNT(*) FROM tasks WHERE status='backlog';")
REVIEW=$(sqlite3 "$DB" "SELECT COUNT(*) FROM tasks WHERE status='review';")

MSG+="🔢 *Summary:* ${IN_PROGRESS} in progress · ${TODO} todo · ${REVIEW} in review · ${BACKLOG} backlog"$'\n\n'

# Urgent & High priority
URGENT=$(sqlite3 "$DB" "SELECT '• ' || title || COALESCE(' → ' || (SELECT name FROM agents WHERE id=t.assigned_to), '') FROM tasks t WHERE status NOT IN ('done') AND priority IN ('urgent','high') ORDER BY CASE priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 END;")
if [ -n "$URGENT" ]; then
  MSG+="🔴 *Urgent/High Priority:*"$'\n'"${URGENT}"$'\n\n'
fi

# In Progress
WIP=$(sqlite3 "$DB" "SELECT '• ' || title || COALESCE(' → ' || (SELECT name FROM agents WHERE id=t.assigned_to), '') FROM tasks t WHERE status='in_progress' AND priority NOT IN ('urgent','high');")
if [ -n "$WIP" ]; then
  MSG+="🟡 *In Progress:*"$'\n'"${WIP}"$'\n\n'
fi

# Todo
TODOS=$(sqlite3 "$DB" "SELECT '• ' || title || COALESCE(' → ' || (SELECT name FROM agents WHERE id=t.assigned_to), '') FROM tasks t WHERE status='todo' AND priority NOT IN ('urgent','high');")
if [ -n "$TODOS" ]; then
  MSG+="📝 *Todo:*"$'\n'"${TODOS}"$'\n\n'
fi

# Overdue (if due_date exists and is past)
OVERDUE=$(sqlite3 "$DB" "SELECT '• ' || title || ' (due ' || due_date || ')' FROM tasks WHERE status NOT IN ('done') AND due_date IS NOT NULL AND due_date < date('now') ORDER BY due_date;")
if [ -n "$OVERDUE" ]; then
  MSG+="⚠️ *Overdue:*"$'\n'"${OVERDUE}"$'\n\n'
fi

MSG+="💪 _Let's get it done today!_"

# Send via Telegram
curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d chat_id="${CHAT_ID}" \
  -d text="${MSG}" \
  -d parse_mode="Markdown" > /dev/null 2>&1
