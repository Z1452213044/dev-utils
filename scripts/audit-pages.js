export default async function run(page) {
  const results = [];
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 150)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + String(m.text()).slice(0, 150));
  });

  const ids = [
    'diff', 'json', 'text', 'markdown', 'html',
    'base64', 'img64', 'url', 'escape', 'jwt', 'hash', 'password', 'uuid',
    'timestamp', 'radix', 'yaml', 'lineending', 'color', 'qrcode',
    'regex', 'cron', 'settings',
  ];

  for (const id of ids) {
    const before = errors.length;
    const r = { id, issues: [] };
    // 点击侧边栏对应项
    const item = page.locator(`.sidebar-nav .sidebar-item[data-tool="${id}"], .sidebar-nav .sidebar-item:has-text("${id}")`).first();
    // 侧边栏项没有 data-tool 属性时，退回到按顺序点：用导航文本
    let clicked = false;
    try {
      await page.locator(`.sidebar-nav .sidebar-item >> nth=${ids.indexOf(id)}`).click({ timeout: 3000 });
      clicked = true;
    } catch { clicked = false; }
    if (!clicked) { r.issues.push('侧边栏项点击失败'); results.push(r); continue; }
    await page.waitForTimeout(350);

    // 1) 页面标题渲染
    const title = await page.locator('.page-title').textContent().catch(() => null);
    if (id !== 'settings' && !title) r.issues.push('缺少 .page-title');
    else if (id !== 'settings' && (!title || title.trim() === '')) r.issues.push('页面标题为空');

    // 2) 文档级横向溢出
    const overflow = await page.evaluate(() => {
      const d = document.documentElement;
      return { sw: d.scrollWidth, cw: d.clientWidth };
    });
    if (overflow.sw > overflow.cw + 1) r.issues.push(`文档横向溢出 sw=${overflow.sw} cw=${overflow.cw}`);

    // 3) 元素级溢出（可见元素超出视口右/下边界 4px 以上）
    const spill = await page.evaluate(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const bad = [];
      const els = document.querySelectorAll('main *, .app *');
      for (const el of els) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width < 4 || rect.height < 4) continue;
        // 超出右侧
        if (rect.right > vw + 4 && cs.overflowX !== 'hidden') {
          bad.push(`${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]} right=${Math.round(rect.right)}`);
        }
      }
      return bad.slice(0, 6);
    });
    if (spill.length) r.issues.push('溢出元素: ' + spill.join(' | '));

    // 4) 布局探针：page-content 高度为 0 或极小
    const probe = await page.evaluate(() => {
      const pc = document.querySelector('.page-content') || document.querySelector('.workspace');
      if (!pc) return 'no .page-content';
      const h = pc.getBoundingClientRect().height;
      return h < 40 ? `page-content 高度异常 ${Math.round(h)}px` : null;
    });
    if (probe) r.issues.push(probe);

    // 5) 截图
    await page.screenshot({ path: `shots/page-${id}.png` });

    if (errors.length > before) {
      r.issues.push('报错: ' + errors.slice(before).join(' ; '));
    }
    results.push(r);
  }
  return { results, errors };
}
