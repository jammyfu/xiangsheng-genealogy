export type TreeLabelState = { selected: boolean; related: boolean; compared?: boolean; shared?: boolean };
/** Keep every paper slip opaque; hierarchy comes from ink, type and scale. */
export function treeLabelStyle(state: TreeLabelState) {
  const mode = state.selected ? 'selected' : state.shared ? 'shared' : state.compared ? 'compared' : state.related ? 'related' : 'muted';
  const themes = {
    selected: { ink:'#8b2626', paper:'#fff0d4', border:'#9d4540', width:34, font:'52px "Ma Shan Zheng", "Kaiti SC", serif' },
    shared: { ink:'#65447e', paper:'#f1eaf7', border:'#a48cba', width:24, font:'600 48px "Noto Serif SC", serif' },
    compared: { ink:'#17646c', paper:'#e8f3ef', border:'#6faba6', width:24, font:'600 48px "Noto Serif SC", serif' },
    related: { ink:'#493f30', paper:'#fff8e9', border:'#b7a78b', width:24, font:'600 48px "Noto Serif SC", serif' },
    muted: { ink:'#697064', paper:'#f5f1e7', border:'#c8c5b8', width:16, font:'44px "PingFang SC", system-ui, sans-serif' },
  };
  return { mode, ...themes[mode], opacity:1 };
}
