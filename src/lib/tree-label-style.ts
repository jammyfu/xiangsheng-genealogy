export type TreeLabelState = { selected: boolean; related: boolean; compared?: boolean; shared?: boolean };
/** Keep every paper slip opaque; hierarchy comes from ink, type and scale. */
export function treeLabelStyle(state: TreeLabelState) {
  const mode = state.selected ? 'selected' : state.shared ? 'shared' : state.compared ? 'compared' : state.related ? 'related' : 'muted';
  const themes = {
    selected: { ink:'#ffe5ce', paper:'#3c2028', border:'#ff927f', width:34, font:'52px "Ma Shan Zheng", "Kaiti SC", serif' },
    shared: { ink:'#e3d4ff', paper:'#25213b', border:'#a98bd1', width:24, font:'600 48px "Noto Serif SC", serif' },
    compared: { ink:'#b5f6f2', paper:'#142e37', border:'#75dce3', width:24, font:'600 48px "Noto Serif SC", serif' },
    related: { ink:'#f1dfbd', paper:'#1c2331', border:'#867a65', width:24, font:'600 48px "Noto Serif SC", serif' },
    muted: { ink:'#abb9cd', paper:'#111c2b', border:'#34455c', width:16, font:'44px "PingFang SC", system-ui, sans-serif' },
  };
  return { mode, ...themes[mode], opacity:1 };
}
