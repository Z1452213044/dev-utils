#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SITE_DIR="$SCRIPT_DIR/site"
PID_FILE="$SCRIPT_DIR/.developer-toolbox.pid"
LOG_FILE="$SCRIPT_DIR/developer-toolbox.log"

HOST="${DEVELOPER_TOOLBOX_HOST:-0.0.0.0}"
PORT="${DEVELOPER_TOOLBOX_PORT:-8080}"
ACTION="${1:-start}"

read_pid() {
  if [[ -f "$PID_FILE" ]]; then
    tr -d '[:space:]' < "$PID_FILE"
  fi
}

is_running() {
  local pid command_line
  pid="$(read_pid)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  command_line="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  [[ "$command_line" == *"$SCRIPT_DIR/server.mjs"* || "$command_line" == *"$SCRIPT_DIR/server.py"* ]]
}

display_address() {
  local server_ip
  server_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  if [[ -z "$server_ip" ]]; then
    server_ip="服务器IP"
  fi
  printf '访问地址：http://%s:%s\n' "$server_ip" "$PORT"
}

health_ok() {
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --max-time 1 "http://127.0.0.1:$PORT/__health" >/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget --quiet --timeout=1 --output-document=/dev/null "http://127.0.0.1:$PORT/__health"
  else
    is_running
  fi
}

start_server() {
  local pid runtime

  if [[ ! -f "$SITE_DIR/index.html" ]]; then
    printf '启动失败：没有找到 %s\n' "$SITE_DIR/index.html" >&2
    exit 1
  fi

  if is_running; then
    pid="$(read_pid)"
    printf '开发者工具箱已经在运行，PID：%s\n' "$pid"
    display_address
    return
  fi

  rm -f -- "$PID_FILE"

  if command -v python3 >/dev/null 2>&1 && python3 -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 6) else 1)' >/dev/null 2>&1; then
    runtime="Python 3.6+"
    nohup env HOST="$HOST" PORT="$PORT" python3 "$SCRIPT_DIR/server.py" >>"$LOG_FILE" 2>&1 &
  elif command -v node >/dev/null 2>&1; then
    runtime="Node.js"
    nohup env HOST="$HOST" PORT="$PORT" node "$SCRIPT_DIR/server.mjs" >>"$LOG_FILE" 2>&1 &
  else
    printf '启动失败：服务器需要 Node.js 或 Python 3.6+，二者安装任意一个即可。\n' >&2
    exit 1
  fi

  pid="$!"
  printf '%s\n' "$pid" > "$PID_FILE"

  for _ in {1..25}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      printf '启动失败，请查看日志：%s\n' "$LOG_FILE" >&2
      tail -n 30 "$LOG_FILE" 2>/dev/null || true
      rm -f -- "$PID_FILE"
      exit 1
    fi
    if health_ok; then
      printf '开发者工具箱已启动（%s），PID：%s，端口：%s\n' "$runtime" "$pid" "$PORT"
      display_address
      printf '日志文件：%s\n' "$LOG_FILE"
      return
    fi
    sleep 0.2
  done

  printf '进程已经启动，但健康检查暂未通过，请查看日志：%s\n' "$LOG_FILE" >&2
  exit 1
}

stop_server() {
  local pid
  if ! is_running; then
    printf '开发者工具箱当前没有运行。\n'
    rm -f -- "$PID_FILE"
    return
  fi

  pid="$(read_pid)"
  kill "$pid"
  for _ in {1..25}; do
    if ! kill -0 "$pid" 2>/dev/null; then
      rm -f -- "$PID_FILE"
      printf '开发者工具箱已停止。\n'
      return
    fi
    sleep 0.2
  done

  printf '进程未在预期时间内退出，请检查 PID %s。\n' "$pid" >&2
  exit 1
}

status_server() {
  local pid
  if is_running; then
    pid="$(read_pid)"
    printf '运行中，PID：%s，端口：%s\n' "$pid" "$PORT"
    display_address
  else
    printf '未运行。\n'
    return 1
  fi
}

case "$ACTION" in
  start)
    start_server
    ;;
  stop)
    stop_server
    ;;
  restart)
    stop_server
    start_server
    ;;
  status)
    status_server
    ;;
  logs)
    touch "$LOG_FILE"
    tail -n 100 -f "$LOG_FILE"
    ;;
  *)
    printf '用法：%s [start|stop|restart|status|logs]\n' "$0" >&2
    exit 2
    ;;
esac
