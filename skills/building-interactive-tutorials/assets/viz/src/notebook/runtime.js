import { mountDemo } from './player.js';

/**
 * 把指向仓库源码的相对链接改成在 [VS Code](https://code.visualstudio.com/docs/configure/command-line#_opening-vs-code-with-urls) 里打开，而不是在浏览器里显示文件内容。
 *
 * 绝对路径由当前页面的位置推出来，所以仓库放在哪台电脑、哪个目录都能用；指向别的 `.html` 页面的链接保持在浏览器里打开。只在页面通过 `file://` 打开时生效，部署到网站上时链接保持原样。
 */
function openSourceLinksInVSCode() {
  if (location.protocol !== 'file:') return;
  for (const a of document.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href');
    if (/^([a-z]+:|#)/i.test(href) || /\.html?($|#)/.test(href)) continue;
    a.href = `vscode://file${new URL(href, location.href).pathname}`;
    a.title = '在 VS Code 中打开';
  }
}

/**
 * 启动一页笔记本：把每个 `data-scene` 格子换成对应的播放器，并按二、三级标题生成左侧目录。
 *
 * @param demos 以场景名为键的演示表，值的格式见 [mountDemo]
 * @throws [Error] 页面里有格子引用了 `demos` 中不存在的场景名时
 */
export function startNotebook(demos) {
  let number = 0;
  for (const cell of document.querySelectorAll('.cell.demo[data-scene]')) {
    const demo = demos[cell.dataset.scene];
    if (!demo) throw new Error(`没有名为 ${cell.dataset.scene} 的演示`);
    mountDemo(cell, demo, ++number);
  }

  // 外部链接在新标签页打开，读者看完解释还能回到教程原处。
  for (const a of document.querySelectorAll('a[href^="http"]')) {
    a.target = '_blank';
    a.rel = 'noopener';
  }
  openSourceLinksInVSCode();

  // 目录列出二级和三级标题，三级标题缩进在所属的二级标题下面。
  const toc = document.querySelector('.nb-toc');
  const headings = [...document.querySelectorAll('.notebook h2, .notebook h3')];
  const links = headings.map((h, i) => {
    h.id ||= `sec-${i + 1}`;
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent;
    a.className = `toc-${h.localName}`;
    toc.append(a);
    return a;
  });
  // 高亮当前读到的标题，即最后一个滚过页面上沿的；读到三级标题时，所属的二级标题也点亮文字。
  const highlight = () => {
    const current = Math.max(0, headings.filter((h) => h.getBoundingClientRect().top < 120).length - 1);
    const parent = headings.findLastIndex((h, i) => i <= current && h.localName === 'h2');
    links.forEach((a, i) => {
      a.classList.toggle('active', i === current);
      a.classList.toggle('parent', i === parent && i !== current);
    });
  };
  addEventListener('scroll', highlight, { passive: true });
  highlight();
}
