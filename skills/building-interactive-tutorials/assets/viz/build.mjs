/**
 * 把每个知识点打包成一个自带全部脚本和样式的笔记本式 HTML，双击就能离线打开。
 *
 * 每个知识点一个目录，放在 `src/topics/` 下：`notebook.html` 是从上到下的正文和演示格子，`main.js` 注册演示，
 * 可选的 `topic.css` 放只有这一页用的样式（比如它的阶段颜色），接在共用的 `notebook.css` 后面。
 * 浏览器不允许 `file://` 页面加载本地的 ES 模块，所以用 [esbuild](https://esbuild.github.io) 把脚本打成一段内联代码。
 */
import { build } from 'esbuild';
import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { codeToHtml } from 'shiki';

const style = await readFile('src/notebook/notebook.css', 'utf8');

const unescapeHtml = (text) => text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&');

/**
 * 给正文里带 `data-lang` 的代码格子上色：打包时用 [Shiki](https://shiki.style) 把代码换成带颜色的 HTML，页面不用再加载高亮脚本。
 *
 * 去掉主题自带的背景色和前景色，让代码块沿用页面的配色。
 */
async function highlightCode(page) {
  const blocks = [...page.matchAll(/<pre class="code-in" data-lang="(\w+)">([\s\S]*?)<\/pre>/g)];
  const rendered = await Promise.all(blocks.map(([, lang, code]) => codeToHtml(unescapeHtml(code), {
    lang,
    theme: 'github-dark',
    transformers: [{
      pre(node) {
        this.addClassToHast(node, 'code-in');
        delete node.properties.style;
      },
    }],
  })));
  return blocks.reduce((html, [whole], i) => html.replace(whole, () => rendered[i]), page);
}

// 命令行给了名字就只打包这几个知识点，不动别的页面：`node build.mjs example`。
const only = process.argv.slice(2);
const topics = (await readdir('src/topics')).filter((t) => only.length === 0 || only.includes(t));
for (const topic of topics) {
  const dir = `src/topics/${topic}`;
  const result = await build({
    entryPoints: [`${dir}/main.js`],
    bundle: true,
    format: 'iife',
    minify: true,
    target: 'es2022',
    write: false,
    legalComments: 'none',
  });
  const script = result.outputFiles[0].text.replaceAll('</script', '<\\/script');
  const page = await highlightCode(await readFile(`${dir}/notebook.html`, 'utf8'));
  const topicStyle = existsSync(`${dir}/topic.css`) ? await readFile(`${dir}/topic.css`, 'utf8') : '';
  // 用函数做替换，避免压缩后的脚本里出现 `$&` 之类被当成替换模式。
  const html = page.replace('{{STYLE}}', () => style + topicStyle).replace('{{SCRIPT}}', () => script);
  await writeFile(`${topic}.html`, html);
  console.log(`${topic}.html  ${(html.length / 1024).toFixed(0)} KB`);
}
