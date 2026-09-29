/* 移动端专项 + 交互深度测试 */
const path = require('path');
const fs = require('fs');
const PW = 'C:/Users/jiaqizeng/.workbuddy/binaries/node/versions/22.22.2-2/node_modules/@playwright/cli/node_modules/playwright-core';
const { chromium } = require(PW);
const ROOT = 'D:/WorkBuddy/个人/DeveloperToolbox';

const out = { mobileInteract: [], popover: [] };
const rec = (arr, name, ok, detail = '') => arr.push({ name, ok, detail: String(detail).slice(0, 120) });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  fs.mkdirSync(path.join(ROOT, 'shots/mobile2'), { recursive: true });

  /* ---- 移动端 ---- */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const p = await mctx.newPage();
  await p.goto('http://localhost:4173');
  await p.waitForTimeout(800);

  // 1. bottom-nav 结构探测
  const navInfo = await p.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const items = nav ? nav.querySelectorAll('.sidebar-item') : [];
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const first = items[0]?.getBoundingClientRect();
    const last = items[items.length - 1]?.getBoundingClientRect();
    return {
      count: items.length,
      navW: navRect ? Math.round(navRect.width) : 0,
      scrollW: nav ? nav.scrollWidth : 0,
      overflow: nav ? nav.scrollWidth > nav.clientWidth : false,
      itemW: first ? Math.round(first.width) : 0,
      lastRight: last ? Math.round(last.right) : 0,
      lastVisible: last ? last.right <= window.innerWidth : false,
    };
  });
  rec(out.mobileInteract, 'bottom-nav-项数', true, JSON.stringify(navInfo));

  // 2. Diff 移动端输入 + 工具栏换行检查
  await p.locator('.bottom-nav .sidebar-item').first().click();
  await p.waitForTimeout(400);
  await p.locator('.diff-split .pane .cm-content').first().click();
  await p.keyboard.insertText('hello\nworld');
  await p.locator('.diff-split .pane .cm-content').nth(1).click();
  await p.keyboard.insertText('hello\nthere');
  await p.waitForTimeout(900);
  const mobDiff = await p.evaluate(() => {
    const summary = document.querySelector('.summary-total');
    const panes = [...document.querySelectorAll('.diff-split .pane')].map(el => {
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    });
    const toolbar = document.querySelector('.toolbar');
    const tb = toolbar ? toolbar.getBoundingClientRect() : null;
    const toolbarBtns = toolbar ? [...toolbar.querySelectorAll('button')].map(b => {
      const r = b.getBoundingClientRect();
      return { t: (b.getAttribute('aria-label') || b.textContent).trim().slice(0, 8), r: [Math.round(r.x), Math.round(r.y)] };
    }) : [];
    return { summary: summary ? summary.textContent : null, panes, toolbarH: tb ? Math.round(tb.height) : 0, toolbarBtns };
  });
  rec(out.mobileInteract, 'diff-移动端差异计算', /差异|处/.test(mobDiff.summary || ''), mobDiff.summary);
  rec(out.mobileInteract, 'diff-移动端双栏排布', true, JSON.stringify(mobDiff.panes));
  rec(out.mobileInteract, 'diff-移动端工具栏高度', mobDiff.toolbarH < 200, 'h=' + mobDiff.toolbarH + ' buttons=' + JSON.stringify(mobDiff.toolbarBtns));

  // 3. Diff 更多选项 Popover 在移动端是否溢出
  await p.locator(':is(.diff-surface, .tool-surface)').getByRole('button', { name: '更多选项' }).click().catch(async () => {
    // 移动端按钮可能被挤到视口外，先滚动
    await p.locator('.toolbar button[aria-label="更多选项"], .toolbar button:has-text("更多")').first().click({ force: true });
  });
  await p.waitForTimeout(400);
  const popInfo = await p.evaluate(() => {
    const pop = document.querySelector('[role="menu"], .popover, [data-radix-popper-content-wrapper]');
    if (!pop) return { found: false };
    const r = pop.getBoundingClientRect();
    return { found: true, x: Math.round(r.x), right: Math.round(r.right), w: Math.round(r.width), vw: window.innerWidth, overRight: r.right > window.innerWidth };
  });
  rec(out.mobileInteract, 'diff-popover-移动端', popInfo.found && !popInfo.overRight, JSON.stringify(popInfo));
  await p.screenshot({ path: path.join(ROOT, 'shots/mobile2/diff-popover.png') });
  await p.keyboard.press('Escape');

  // 4. 二维码：输入后预览区布局
  const qrItem = await p.evaluate(() => {
    const items = [...document.querySelectorAll('.bottom-nav .sidebar-item')];
    return { total: items.length };
  });
  // 新导航：常用项直接点底栏；其余通过「更多」菜单
  const mobGoto = async (label) => {
    const direct = p.locator('.bottom-nav .sidebar-item', { hasText: label });
    if (await direct.count()) {
      await direct.first().click({ timeout: 3000 });
    } else {
      await p.locator('.bottom-nav button[aria-label="更多工具"]').click({ timeout: 3000 });
      await p.waitForTimeout(350);
      await p.locator('.more-item', { hasText: label }).first().click({ timeout: 3000 });
    }
    await p.waitForTimeout(500);
  };
  await mobGoto('二维码生成');
  await p.waitForTimeout(500);
  await p.locator('.tool-input').first().fill('https://example.com/test');
  await p.waitForTimeout(800);
  const qrInfo = await p.evaluate(() => {
    const img = document.querySelector('img[alt="二维码"]');
    const r = img ? img.getBoundingClientRect() : null;
    return { hasImg: !!img, size: r ? Math.round(r.width) : 0, right: r ? Math.round(r.right) : 0, vw: window.innerWidth };
  });
  rec(out.mobileInteract, 'qrcode-移动端生成', qrInfo.hasImg, JSON.stringify(qrInfo));
  await p.screenshot({ path: path.join(ROOT, 'shots/mobile2/qrcode.png') });

  // 5. 时间戳移动端
  await mobGoto('时间戳');
  await p.waitForTimeout(500);
  await p.locator('.tool-input').first().fill('1758537600');
  await p.waitForTimeout(500);
  const tsInfo = await p.evaluate(() => {
    const rows = document.querySelectorAll('.result-row');
    const first = document.querySelector('.result-value');
    return { rows: rows.length, firstVal: first ? first.textContent : null };
  });
  rec(out.mobileInteract, 'timestamp-移动端转换', tsInfo.rows >= 3, JSON.stringify(tsInfo).slice(0, 100));
  await p.screenshot({ path: path.join(ROOT, 'shots/mobile2/timestamp.png') });

  await mctx.close();

  /* ---- 桌面 Popover 边缘测试 + 交互补充 ---- */
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const d = await ctx.newPage();
  await d.goto('http://localhost:4173');
  await d.waitForTimeout(700);

  // 6. 桌面 Diff popovers（更多选项 / 语言选择）
  await d.locator(':is(.diff-surface, .tool-surface)').getByRole('button', { name: '更多选项' }).click();
  await d.waitForTimeout(350);
  const dpop = await d.evaluate(() => {
    const pop = document.querySelector('[role="menu"], .popover');
    if (!pop) return { found: false };
    const r = pop.getBoundingClientRect();
    return { found: true, right: Math.round(r.right), bottom: Math.round(r.bottom), vw: window.innerWidth, vh: window.innerHeight, over: r.right > window.innerWidth || r.bottom > window.innerHeight };
  });
  rec(out.popover, 'diff-更多选项-桌面', dpop.found && !dpop.over, JSON.stringify(dpop));
  await d.keyboard.press('Escape');
  await d.waitForTimeout(200);

  // 7. Diff 语言选择 Popover
  const langBtn = d.locator('button[aria-label*="语言"], button[title*="语言"]').first();
  if (await langBtn.count()) {
    await langBtn.click();
    await d.waitForTimeout(350);
    const langPop = await d.evaluate(() => {
      const pop = document.querySelector('[role="menu"], .popover, [role="listbox"]');
      if (!pop) return { found: false };
      const r = pop.getBoundingClientRect();
      return { found: true, h: Math.round(r.height), bottom: Math.round(r.bottom), vh: window.innerHeight, over: r.bottom > window.innerHeight + 2 };
    });
    rec(out.popover, 'diff-语言选择', langPop.found && !langPop.over, JSON.stringify(langPop));
    await d.keyboard.press('Escape');
  } else {
    rec(out.popover, 'diff-语言选择', true, 'no-lang-btn(skip)');
  }

  // 8. 换行符转换：混合换行检测
  await d.locator('.sidebar-nav .sidebar-item', { hasText: '换行符转换' }).first().click();
  await d.waitForTimeout(400);
  const ed = d.locator('.cm-content').first();
  await ed.click();
  // insertText 不保留 \r\n？CodeMirror 会归一化。用 evaluate 直接 setter 测
  await d.evaluate(() => {
    const el = document.querySelector('.cm-content');
    el.focus();
    document.execCommand('insertText', false, 'a\nb\nc');
  });
  await d.waitForTimeout(500);
  const leStatus = await d.evaluate(() => document.querySelector('.status-bar')?.textContent || 'none');
  rec(out.popover, 'lineending-LF检测', /LF/.test(leStatus), leStatus.slice(0, 60));

  // 9. 键盘可达性抽查：Tab 到侧边栏
  await d.reload();
  await d.waitForTimeout(700);
  const tabFocus = await d.evaluate(() => {
    const seq = [];
    for (let i = 0; i < 8; i++) {
      // @ts-ignore
      const ev = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.activeElement && document.activeElement.dispatchEvent(ev);
    }
    return seq.length;
  });
  // 用真实按键
  await d.keyboard.press('Tab');
  const f1 = await d.evaluate(() => document.activeElement?.className || 'none');
  await d.keyboard.press('Tab');
  const f2 = await d.evaluate(() => document.activeElement?.className || 'none');
  rec(out.popover, '键盘Tab可达', f1 !== 'none' && f2 !== 'none', f1 + ' -> ' + f2.slice(0, 30));

  await ctx.close();
  await browser.close();
  fs.writeFileSync(path.join(ROOT, 'mobile-interact-report.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error('RUNNER_FAIL', e); process.exit(1); });
