/* 综合测试 runner：功能基线(e2e-check.js) + 布局审计 + a11y + 移动端 + 边界/安全 */
const path = require('path');
const fs = require('fs');
const { createRequire } = require('module');
const PW = 'C:/Users/jiaqizeng/.workbuddy/binaries/node/versions/22.22.2-2/node_modules/@playwright/cli/node_modules/playwright-core';
const { chromium } = require(PW);

const ROOT = 'D:/WorkBuddy/个人/DeveloperToolbox';
const fs2 = require('fs');
const e2eSrc = fs2.readFileSync(path.join(ROOT, 'scripts/e2e-check.js'), 'utf8');
// e2e-check.js 是裸的 `async page => {...}` 表达式（供 playwright-cli run-code 使用），这里包一层求值
const e2eCheck = new Function('page', 'return (' + e2eSrc + ')(page);');

const PAGE_IDS = ['diff', 'json', 'text', 'markdown', 'html', 'base64', 'url', 'escape', 'jwt', 'hash', 'password', 'uuid', 'timestamp', 'radix', 'yaml', 'lineending', 'qrcode', 'regex', 'cron'];
const NAV_LABELS = { diff: '文本对比', json: 'JSON 格式化', text: '文本工具', markdown: 'Markdown 阅读', html: 'HTML 预览', base64: 'Base64', url: 'URL 编解码', escape: 'HTML/Unicode 转义', jwt: 'JWT 工具', hash: 'Hash 计算', password: '密码生成', uuid: 'UUID 生成', timestamp: '时间戳', radix: '进制转换', yaml: 'JSON ↔ YAML', lineending: '换行符转换', qrcode: '二维码生成', regex: '正则测试', cron: 'Cron 解析' };

const layoutProbe = () => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const doc = document.documentElement;
  const issues = [];
  if (doc.scrollWidth > vw + 1) issues.push(`DOC_H_OVERFLOW ${doc.scrollWidth}>${vw}`);
  // 元素溢出（排除有滚动容器的祖先内的溢出——只测真正伸出视口外的）
  const seen = new Set();
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) continue;
    const overRight = r.right - vw, overBottom = r.bottom - vh, overLeft = -r.left;
    if (Math.max(overRight, overBottom, overLeft) <= 6) continue;
    // 找滚动祖先：若任何祖先可横向滚动则视为容器内滚动，不算 bug
    let p = el.parentElement, scrollable = false;
    while (p && p !== document.body) {
      const pcs = getComputedStyle(p);
      if (/(auto|scroll|hidden|clip)/.test(pcs.overflowX + pcs.overflowY)) { scrollable = true; break; }
      p = p.parentElement;
    }
    if (scrollable) continue;
    const key = el.tagName + '.' + String(el.className).slice(0, 40);
    if (!seen.has(key)) { seen.add(key); issues.push(`EL_SPILL ${key} right=${Math.round(r.right)} bottom=${Math.round(r.bottom)}`); }
    if (seen.size > 5) break;
  }
  // 重复 id
  const ids = {};
  for (const el of document.querySelectorAll('[id]')) ids[el.id] = (ids[el.id] || 0) + 1;
  const dups = Object.entries(ids).filter(([, n]) => n > 1).map(([k]) => k);
  if (dups.length) issues.push('DUP_ID ' + dups.join(','));
  // icon-only 按钮无 aria-label（a11y）
  const noLabel = [];
  for (const btn of document.querySelectorAll('button')) {
    const label = (btn.getAttribute('aria-label') || btn.textContent || '').trim();
    const hasTextChild = btn.querySelector('span,svg text') && btn.textContent.trim().length > 0;
    if (!label && !hasTextChild && btn.querySelector('svg')) noLabel.push(btn.className.split(' ')[0]);
  }
  if (noLabel.length) issues.push('BTN_NO_ARIA ' + [...new Set(noLabel)].slice(0, 4).join(','));
  // 可见文本过小（<10px 且非装饰）
  return issues;
};

(async () => {
  const report = { baseline: null, desktop: [], mobile: [], edge: [], dark: [], errors: [] };
  const browser = await chromium.launch({ channel: 'chrome', headless: true });

  /* ========== 阶段 1：桌面视口 基线 + 布局审计 ========== */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.errors.push('pageerror: ' + String(e.message).slice(0, 120)));
  page.on('console', (m) => { if (m.type() === 'error') report.errors.push('console: ' + String(m.text()).slice(0, 120)); });

  await page.goto('http://localhost:4173');
  await page.waitForTimeout(800);

  // 1a. 运行项目自带的功能基线
  try {
    const baselineOut = await e2eCheck(page);
    report.baseline = baselineOut;
  } catch (e) {
    report.baseline = 'BASELINE_CRASH ' + String(e.message).slice(0, 200);
  }

  // 1b. 逐页布局审计 + 截图
  fs.mkdirSync(path.join(ROOT, 'shots/desktop'), { recursive: true });
  for (let i = 0; i < PAGE_IDS.length; i++) {
    const id = PAGE_IDS[i];
    try {
      await page.locator('.sidebar-nav .sidebar-item', { hasText: NAV_LABELS[id] }).first().click({ timeout: 4000 });
      await page.waitForTimeout(450);
      const issues = await page.evaluate(layoutProbe);
      // 设置页要从 footer 进
      if (issues.length) report.desktop.push({ page: NAV_LABELS[id], issues });
      await page.screenshot({ path: path.join(ROOT, `shots/desktop/${id}.png`) });
    } catch (e) {
      report.desktop.push({ page: NAV_LABELS[id], issues: ['NAV_FAIL ' + String(e.message).slice(0, 80)] });
    }
  }
  // 设置页
  try {
    await page.locator('.sidebar-footer').getByRole('button', { name: '设置' }).click();
    await page.waitForTimeout(400);
    const issues = await page.evaluate(layoutProbe);
    if (issues.length) report.desktop.push({ page: '设置', issues });
    await page.screenshot({ path: path.join(ROOT, 'shots/desktop/settings.png') });
  } catch (e) { report.desktop.push({ page: '设置', issues: ['NAV_FAIL ' + String(e.message).slice(0, 80)] }); }

  /* ========== 阶段 2：深色主题抽查 ========== */
  try {
    await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
    await page.waitForTimeout(300);
    fs.mkdirSync(path.join(ROOT, 'shots/dark'), { recursive: true });
    for (const id of ['diff', 'json', 'settings']) {
      const label = id === 'settings' ? null : NAV_LABELS[id];
      if (label) await page.locator('.sidebar-nav .sidebar-item', { hasText: label }).first().click();
      else await page.locator('.sidebar-footer').getByRole('button', { name: '设置' }).click();
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(ROOT, `shots/dark/${id}.png`) });
    }
    await page.evaluate(() => { document.documentElement.dataset.theme = 'light'; });
  } catch (e) { report.dark.push('DARK_FAIL ' + String(e.message).slice(0, 100)); }

  /* ========== 阶段 3：边界与安全 ========== */
  const edge = (name, ok, detail = '') => report.edge.push({ name, ok, detail });
  try {
    // 3a. Diff 超长单行（10k 字符）
    await page.locator('.sidebar-nav .sidebar-item', { hasText: '文本对比' }).first().click();
    await page.waitForTimeout(300);
    const long1 = 'a'.repeat(10000), long2 = 'a'.repeat(9999) + 'b';
    await page.evaluate(([a, b]) => {
      const els = document.querySelectorAll('.cm-content');
      function setTxt(el, t) {
        el.focus();
        document.execCommand('insertText', false, t);
      }
      setTxt(els[0], a); setTxt(els[1], b);
    }, [long1, long2]);
    await page.waitForTimeout(1500);
    const diffOk = await page.evaluate(() => {
      const s = document.querySelector('.summary-total');
      return s ? s.textContent : 'NO_SUMMARY';
    });
    edge('diff-10k-char-line', /差异/.test(diffOk || ''), String(diffOk).slice(0, 40));

    // 3b. Diff 1000 行文本
    await page.locator(':is(.diff-surface, .tool-surface)').getByRole('button', { name: '清空两侧' }).click();
    await page.waitForTimeout(300);
    const many1 = Array.from({ length: 1000 }, (_, i) => 'line-' + i).join('\n');
    const many2 = many1.replace('line-500', 'LINE-CHANGED');
    await page.evaluate(([a, b]) => {
      const els = document.querySelectorAll('.cm-content');
      document.execCommand('insertText', false, '');
      els[0].focus(); document.execCommand('insertText', false, a);
      els[1].focus(); document.execCommand('insertText', false, b);
    }, [many1, many2]);
    await page.waitForTimeout(2000);
    edge('diff-1000-lines', true);

    // 3c. F7 差异导航快捷键
    const navWorks = await page.evaluate(() => {
      const btn = document.querySelector('[title*="下一个差异"], [aria-label*="下一个差异"]');
      return btn ? 'found-btn' : 'no-btn';
    });
    await page.keyboard.press('F7');
    await page.waitForTimeout(200);
    edge('diff-F7-key', true, navWorks);

    // 3d. HTML 预览 XSS（DOMPurify 校验）
    await page.locator('.sidebar-nav .sidebar-item', { hasText: 'HTML 预览' }).first().click();
    await page.waitForTimeout(400);
    const editor0 = page.locator('.cm-content').first();
    await editor0.click();
    await page.keyboard.insertText('<img src=x onerror="window.__xss=1"><script>window.__xss2=1<\/script><p>safe</p>');
    await page.waitForTimeout(800);
    const xss = await page.evaluate(() => {
      const frame = document.querySelector('.html-preview-frame');
      let leaked = false;
      try { leaked = !!frame.contentWindow.__xss || !!frame.contentWindow.__xss2; } catch { /* cross */ }
      return { leaked, hasScript: (frame.getAttribute('srcdoc') || '').includes('<script') };
    });
    edge('html-xss-sanitized', !xss.leaked && !xss.hasScript, JSON.stringify(xss));

    // 3e. JSON 特殊输入：空、超深嵌套、大数
    await page.locator('.sidebar-nav .sidebar-item', { hasText: 'JSON 格式化' }).first().click();
    await page.waitForTimeout(300);
    await editor0.click();
    await page.keyboard.insertText('{"a":1e999,"b":"\\ud800"}');
    await page.waitForTimeout(500);
    const jsonState = await page.evaluate(() => document.querySelector('.status-bar, .status-ok, .status-error')?.textContent || 'none');
    edge('json-lone-surrogate', true, String(jsonState).slice(0, 60));

    // 3f. 设置持久化
    await page.locator('.sidebar-footer').getByRole('button', { name: '设置' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('radio', { name: '深色' }).click();
    await page.waitForTimeout(200);
    await page.reload();
    await page.waitForTimeout(800);
    const themeAfter = await page.evaluate(() => document.documentElement.dataset.theme);
    edge('settings-persist-reload', themeAfter === 'dark', 'theme=' + themeAfter);
    await page.getByRole('radio', { name: '跟随系统' }).click().catch(() => {});
    await page.waitForTimeout(200);
  } catch (e) {
    edge('edge-suite', false, String(e.message).slice(0, 150));
  }

  /* ========== 阶段 4：移动端视口 390x844 ========== */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  mpage.on('pageerror', (e) => report.errors.push('m-pageerror: ' + String(e.message).slice(0, 120)));
  // 移动端导航：常用项直接点底栏；其余通过「更多」菜单
  const mobGoto = async (label) => {
    const direct = mpage.locator('.bottom-nav .sidebar-item', { hasText: label });
    if (await direct.count()) {
      await direct.first().click({ timeout: 3000 });
    } else {
      await mpage.locator('.bottom-nav button[aria-label="更多工具"]').click({ timeout: 3000 });
      await mpage.waitForTimeout(350);
      await mpage.locator('.more-item', { hasText: label }).first().click({ timeout: 3000 });
    }
    await mpage.waitForTimeout(450);
  };
  try {
    await mpage.goto('http://localhost:4173');
    await mpage.waitForTimeout(800);
    fs.mkdirSync(path.join(ROOT, 'shots/mobile'), { recursive: true });
    const ids = ['diff', 'json', 'text', 'base64', 'qrcode', 'regex', 'jwt', 'timestamp'];
    for (const id of ids) {
      try {
        await mobGoto(NAV_LABELS[id]);
        const issues = await mpage.evaluate(layoutProbe);
        if (issues.length) report.mobile.push({ page: NAV_LABELS[id], issues });
        await mpage.screenshot({ path: path.join(ROOT, `shots/mobile/${id}.png`) });
      } catch (e) {
        report.mobile.push({ page: NAV_LABELS[id], issues: ['MOB_NAV_FAIL ' + String(e.message).slice(0, 80)] });
      }
    }
    // 「更多」菜单本身的布局检查
    await mobGoto('Cron 解析');
    await mpage.locator('.bottom-nav button[aria-label="更多工具"]').click();
    await mpage.waitForTimeout(400);
    const menuInfo = await mpage.evaluate(() => {
      const menu = document.querySelector('.more-menu');
      if (!menu) return { found: false };
      const r = menu.getBoundingClientRect();
      return { found: true, left: Math.round(r.left), right: Math.round(r.right), bottom: Math.round(r.bottom), vh: window.innerHeight, vw: window.innerWidth, items: menu.querySelectorAll('.more-item').length };
    });
    if (!menuInfo.found || menuInfo.left < 0 || menuInfo.right > menuInfo.vw || menuInfo.bottom > menuInfo.vh + 2) {
      report.mobile.push({ page: '更多菜单', issues: ['MENU_LAYOUT ' + JSON.stringify(menuInfo)] });
    }
    await mpage.screenshot({ path: path.join(ROOT, 'shots/mobile/more-menu.png') });
  } catch (e) {
    report.mobile.push({ page: 'init', issues: [String(e.message).slice(0, 100)] });
  }
  await mctx.close();

  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'test-report.json'), JSON.stringify(report, null, 1));
  // 控制台摘要
  const base = typeof report.baseline === 'string' ? report.baseline : String(report.baseline).slice(0, 300);
  console.log('=== BASELINE ===');
  console.log(base);
  console.log('=== DESKTOP LAYOUT ===');
  console.log(JSON.stringify(report.desktop, null, 1));
  console.log('=== MOBILE ===');
  console.log(JSON.stringify(report.mobile, null, 1));
  console.log('=== EDGE ===');
  console.log(JSON.stringify(report.edge, null, 1));
  console.log('=== CONSOLE ERRORS (first 10) ===');
  console.log(report.errors.slice(0, 10).join('\n') || '(none)');
})().catch((e) => { console.error('RUNNER_FAIL', e); process.exit(1); });
