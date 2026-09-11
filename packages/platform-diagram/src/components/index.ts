// ホーム図の描画コンポーネントのバレル export。
// PlatformDiagram が3層（対面乗換バナー / SVG / 出口・乗換プレート）をまとめた
// 主要エントリ。個別の層も export しておく（admin の編集レイヤが座標系の
// 参照先として直接使う可能性があるため。ADR-0010）。
export { PlatformDiagram } from './PlatformDiagram';
export { DiagramSvg } from './diagram/DiagramSvg';
export { ConcoursePlateRow } from './overlay/ConcoursePlateRow';
export { FacingTransferBannerRow } from './overlay/FacingTransferBannerRow';
