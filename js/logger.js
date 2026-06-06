/**
 * INSIGHT Analytics Workbench — Session Logger
 * 브라우저 localStorage에 세션 로그를 기록합니다.
 * 다른 모든 스크립트보다 먼저 로드되어야 합니다.
 *
 * API:
 *   window.LOG.info(category, message, data?)
 *   window.LOG.warn(category, message, data?)
 *   window.LOG.error(category, message, data?)
 *   window.LOG.getAll()          → 전체 로그 배열
 *   window.LOG.getSession()      → 현재 세션 로그만
 *   window.LOG.exportJSON()      → JSON 파일 다운로드
 *   window.LOG.exportText()      → TXT 파일 다운로드
 *   window.LOG.clear()           → 로그 전체 삭제
 *   window.LOG.openViewer()      → 로그 뷰어 열기
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'insight-session-log';
  var MAX_ENTRIES = 2000;
  var sessionId   = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* ── 로그 배열 초기화 ───────────────────────────── */
  var entries = [];
  try {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved) entries = JSON.parse(saved);
    if (!Array.isArray(entries)) entries = [];
  } catch (e) { entries = []; }

  /* ── 저장 ───────────────────────────────────────── */
  function persist() {
    try {
      if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // localStorage 용량 초과 시 절반 제거 후 재시도
      entries = entries.slice(-Math.floor(MAX_ENTRIES / 2));
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); } catch (e2) {}
    }
  }

  /* ── 엔트리 생성 & 추가 ─────────────────────────── */
  function log(level, cat, msg, data) {
    var entry = {
      id:  Math.random().toString(36).slice(2, 9),
      sid: sessionId,
      ts:  new Date().toISOString(),
      lv:  level,    // INFO | WARN | ERROR
      cat: cat,      // mode | ml | stats | sql | clean | ai | session | network | error
      msg: msg,
      data: data != null ? data : null
    };
    entries.push(entry);
    persist();

    // 콘솔 미러 (레벨별 색상)
    var style = level === 'ERROR' ? 'color:#ff6b6b;font-weight:bold'
              : level === 'WARN'  ? 'color:#f0a500'
              : 'color:#888';
    var prefix = '[INSIGHT ' + level + '][' + cat + '] ';
    if (level === 'ERROR') console.error(prefix + msg, data || '');
    else if (level === 'WARN') console.warn(prefix + msg, data || '');
    else console.log('%c' + prefix + msg, style, data || '');

    return entry;
  }

  /* ── 세션 시작 기록 ─────────────────────────────── */
  log('INFO', 'session', 'Session started', {
    sid:      sessionId,
    ua:       navigator.userAgent,
    screen:   screen.width + 'x' + screen.height,
    viewport: window.innerWidth + 'x' + window.innerHeight,
    online:   navigator.onLine,
    lang:     navigator.language,
    url:      location.href,
    ts_unix:  Date.now()
  });

  /* ── 전역 에러 캡처 ─────────────────────────────── */
  var _prevOnError = window.onerror;
  window.onerror = function (msg, src, line, col, err) {
    log('ERROR', 'uncaught', String(msg), {
      src:   src,
      line:  line,
      col:   col,
      stack: err ? err.stack : null
    });
    if (typeof _prevOnError === 'function') return _prevOnError.apply(this, arguments);
    return false;
  };

  /* ── 미처리 Promise rejection 캡처 ──────────────── */
  window.addEventListener('unhandledrejection', function (e) {
    var reason = e.reason;
    log('ERROR', 'promise', 'Unhandled Promise rejection', {
      reason: reason
        ? (reason.stack || (reason.message ? reason.message + '\n' + reason.stack : String(reason)))
        : 'unknown'
    });
  });

  /* ── 네트워크 상태 변화 ─────────────────────────── */
  window.addEventListener('offline', function () {
    log('WARN', 'network', '네트워크 연결 끊김 (offline)');
  });
  window.addEventListener('online', function () {
    log('INFO', 'network', '네트워크 연결 복구 (online)');
  });

  /* ── 탭 가시성 변화 (백그라운드/포그라운드) ────── */
  document.addEventListener('visibilitychange', function () {
    log('INFO', 'session', document.hidden ? 'Tab hidden (background)' : 'Tab visible (foreground)');
  });

  /* ── 페이지 언로드 기록 ─────────────────────────── */
  window.addEventListener('beforeunload', function () {
    log('INFO', 'session', 'Page unloading (beforeunload)');
    persist();
  });

  /* ── 단축키: Ctrl+Shift+L → 로그 뷰어 열기 ────── */
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'L') {
      e.preventDefault();
      openViewer();
    }
  });

  /* ── 내보내기 헬퍼 ──────────────────────────────── */
  function downloadBlob(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href   = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); document.body.removeChild(a); }, 1000);
  }

  function datestamp() {
    return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  }

  function openViewer() {
    window.open('docs/logs.html', 'insight-log-viewer');
  }

  /* ── 공개 API ───────────────────────────────────── */
  window.LOG = {
    info:  function (cat, msg, data) { return log('INFO',  cat, msg, data); },
    warn:  function (cat, msg, data) { return log('WARN',  cat, msg, data); },
    error: function (cat, msg, data) { return log('ERROR', cat, msg, data); },

    getAll:     function () { return entries.slice(); },
    getSession: function () {
      var sid = sessionId;
      return entries.filter(function (e) { return e.sid === sid; });
    },

    clear: function () {
      entries = [];
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
      console.log('%c[INSIGHT Logger] Log cleared.', 'color:#e8611a');
    },

    exportJSON: function () {
      downloadBlob(
        JSON.stringify(entries, null, 2),
        'insight-log-' + datestamp() + '.json',
        'application/json'
      );
    },

    exportText: function () {
      var lines = entries.map(function (e) {
        var line = '[' + e.ts + '] [' + e.lv + '] [' + e.cat + '] ' + e.msg;
        if (e.data) line += '\n    ' + JSON.stringify(e.data);
        return line;
      });
      downloadBlob(
        lines.join('\n'),
        'insight-log-' + datestamp() + '.txt',
        'text/plain'
      );
    },

    openViewer: openViewer,
    sessionId:  sessionId,
    STORAGE_KEY: STORAGE_KEY
  };

  console.log(
    '%c[INSIGHT Logger] initialized%c  session: ' + sessionId,
    'color:#e8611a;font-weight:bold',
    'color:#888'
  );
})();
