# -*- coding: utf-8 -*-
import io

p = 'src/features/diff/DiffPage.tsx'
s = io.open(p, encoding='utf-8').read()

# 1) 空态插入左栏
old = (
    "                {paneHeader('left', '原始文本')}\n"
    '                <div className="editor-host" ref={leftHostRef} />\n'
    '              </div>\n'
    '\n'
    '              <div\n'
    '                className="splitter"'
)
new = (
    "                {paneHeader('left', '原始文本')}\n"
    '                <div className="editor-host" ref={leftHostRef} />\n'
    "                {!hasContent && (\n"
    '                  <div className="empty-state" aria-label="开始使用">\n'
    '                    <div className="empty-icon-wrap">\n'
    '                      <FileDiff className="empty-icon" />\n'
    '                    </div>\n'
    '                    <div className="empty-text">点击任意位置开始输入，或拖入文件 / 粘贴</div>\n'
    '                    <div className="empty-caption">所有内容仅在当前设备处理</div>\n'
    '                    <div className="empty-actions">\n'
    "                      <button className=\"btn btn-secondary\" onClick={() => pasteInto('left')}>\n"
    '                        <ClipboardPaste style={{ width: 14, height: 14 }} />\n'
    '                        粘贴\n'
    '                      </button>\n'
    "                      <button className=\"btn btn-secondary\" onClick={() => openFile('left')}>\n"
    '                        <FolderOpen style={{ width: 14, height: 14 }} />\n'
    '                        打开文件\n'
    '                      </button>\n'
    '                    </div>\n'
    '                  </div>\n'
    '                )}\n'
    '              </div>\n'
    '\n'
    '              <div\n'
    '                className="splitter"'
)
assert old in s, 'left pane anchor not found'
s = s.replace(old, new)

# 2) 删除原 diff-body 尾部的空态块（从 "        {!hasContent && (" 到其配对 "        )}\n"）
start = s.index('        {!hasContent && (')
end = s.index('        )}\n', start) + len('        )}\n')
s = s[:start] + s[end:]

io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
print('empty state moved to left pane')
