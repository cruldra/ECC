const AUTOPLAY_MS = 2800;

/**
 * 把一个演示格子变成可交互的播放器：标题栏放翻页按钮，中间是动画画面，下面是当前这一步的说明。
 *
 * 格子第一次滚进视野才创建画面，滚出视野就暂停渲染、停止自动播放，一页放多个 3D 演示也不卡。点中格子后可以用 `←` `→` 翻页、空格播放、`F` 全屏。
 * 全屏时标题栏、画面和说明一起铺满屏幕，画面占满中间的空间，镜头按新的宽高比重新取景；`Esc` 退出。
 *
 * @param cell 带 `data-scene` 的格子元素
 * @param demo 演示内容：`name`、`tagline`、逐步画面 `steps`，以及创建画面的 `createView`
 * @param number 格子左侧显示的序号
 */
export function mountDemo(cell, demo, number) {
  cell.tabIndex = 0;
  cell.innerHTML = `
    <div class="cell-gutter">[${number}]</div>
    <div class="cell-body">
      <div class="demo-head">
        <b class="demo-name"></b><span class="demo-tagline"></span>
        <div class="demo-controls">
          <button data-act="prev" title="上一步（←）">←</button>
          <button data-act="play" class="play" title="自动播放（空格）">▶ 播放</button>
          <button data-act="next" title="下一步（→）">→</button>
          <button data-act="restart" title="从头开始">↺</button>
          <button data-act="fullscreen" title="全屏（F）">全屏</button>
        </div>
      </div>
      <div class="demo-stage"><div class="demo-hint">拖动平移 · 右键旋转 · 双指缩放 · 双击复位</div></div>
      <div class="demo-caption">
        <div class="demo-meta"><span class="phase"></span><b class="step-title"></b><span class="count"></span></div>
        <div class="demo-text"></div>
      </div>
    </div>`;
  const $ = (selector) => cell.querySelector(selector);
  const body = $('.cell-body');
  $('.demo-name').textContent = demo.name;
  $('.demo-tagline').textContent = demo.tagline;

  let view = null;
  let index = 0;
  let timer = null;

  function show(i, reset = false) {
    index = i;
    const step = demo.steps[i];
    $('.phase').textContent = step.phase;
    $('.phase').dataset.phase = step.phase;
    $('.step-title').textContent = step.title;
    $('.count').textContent = `${i + 1} / ${demo.steps.length}`;
    $('.demo-text').innerHTML = step.text;
    $('[data-act=prev]').disabled = i === 0;
    $('[data-act=next]').disabled = i === demo.steps.length - 1;
    view?.render(step, { reset });
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    $('[data-act=play]').textContent = '▶ 播放';
  }

  function next() {
    if (index + 1 < demo.steps.length) show(index + 1);
    else stop();
  }

  function toggle() {
    if (timer) return stop();
    if (index === demo.steps.length - 1) show(0, true);
    timer = setInterval(next, AUTOPLAY_MS);
    $('[data-act=play]').textContent = '⏸ 暂停';
  }

  function toggleFullscreen() {
    if (document.fullscreenElement === body) document.exitFullscreen();
    else body.requestFullscreen();
  }

  document.addEventListener('fullscreenchange', () => {
    $('[data-act=fullscreen]').textContent = document.fullscreenElement === body ? '退出全屏' : '全屏';
  });

  const actions = {
    prev: () => index > 0 && show(index - 1),
    next,
    play: toggle,
    restart: () => show(0, true),
    fullscreen: toggleFullscreen,
  };

  /** 执行一个按钮或快捷键的动作；翻页和从头开始会先停下自动播放。 */
  function run(act) {
    if (act !== 'play' && act !== 'fullscreen') stop();
    actions[act]();
  }

  cell.addEventListener('click', (e) => {
    // 全屏里点页内链接（概念图面板的「去讲它的那一节」），先退出全屏再跳，不然跳转发生在全屏背后
    const link = e.target.closest('a[href^="#"]');
    if (link && document.fullscreenElement === body) {
      e.preventDefault();
      document.exitFullscreen().then(() => link.click());
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act) run(act);
  });
  cell.addEventListener('keydown', (e) => {
    const act = { ArrowLeft: 'prev', ArrowRight: 'next', ' ': 'play', f: 'fullscreen', F: 'fullscreen' }[e.key];
    if (!act || e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    run(act);
  });

  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      if (!view) {
        view = demo.createView();
        view.mount($('.demo-stage'));
        show(index, true);
      }
      view.setActive(true);
    } else if (view && document.fullscreenElement !== body) {
      view.setActive(false);
      stop();
    }
  }, { rootMargin: '200px 0px' }).observe(cell);

  show(0);
}
