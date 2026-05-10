// Wraps a JP listing URL in Google Translate's host-proxy:
// e.g.  https://jp.mercari.com/item/X
//   →   https://jp-mercari-com.translate.goog/item/X?_x_tr_sl=ja&_x_tr_tl=en&_x_tr_hl=en
export function toTranslateUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/\./g, '-') + '.translate.goog';
    const params = new URLSearchParams(u.search);
    params.set('_x_tr_sl', 'ja');
    params.set('_x_tr_tl', 'en');
    params.set('_x_tr_hl', 'en');
    const qs = params.toString();
    return `https://${host}${u.pathname}${qs ? `?${qs}` : ''}`;
  } catch {
    return url;
  }
}
