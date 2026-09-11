import { describe, it, expect } from 'vitest';
import { assignLanes, laneCount } from './lanes';

const GAP = 10;

describe('assignLanes', () => {
  it('重ならない要素はすべて同じレーンに収まる', () => {
    const result = assignLanes(
      [
        { id: 'a', startPx: 0, endPx: 50 },
        { id: 'b', startPx: 100, endPx: 150 },
        { id: 'c', startPx: 200, endPx: 250 },
      ],
      GAP,
    );

    expect(result.map((r) => r.lane)).toEqual([0, 0, 0]);
  });

  it('重なる要素は次のレーンへ送られる', () => {
    const result = assignLanes(
      [
        { id: 'a', startPx: 0, endPx: 100 },
        { id: 'b', startPx: 50, endPx: 150 },
      ],
      GAP,
    );

    expect(result.map((r) => r.lane)).toEqual([0, 1]);
  });

  it('入力順によらず startPx 昇順で処理する', () => {
    const items = [
      { id: 'c', startPx: 200, endPx: 250 },
      { id: 'a', startPx: 0, endPx: 50 },
      { id: 'b', startPx: 100, endPx: 150 },
    ];

    expect(assignLanes(items, GAP).map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('空いた内側のレーンを優先して埋める', () => {
    // a と b が重なって b が lane1 へ行ったあと、a から十分離れた c は lane0 に戻る
    const result = assignLanes(
      [
        { id: 'a', startPx: 0, endPx: 100 },
        { id: 'b', startPx: 50, endPx: 300 },
        { id: 'c', startPx: 150, endPx: 200 },
      ],
      GAP,
    );

    expect(result.map((r) => [r.id, r.lane])).toEqual([
      ['a', 0],
      ['b', 1],
      ['c', 0],
    ]);
  });

  it('間隔がちょうど gapPx なら同じレーンに置く', () => {
    const result = assignLanes(
      [
        { startPx: 0, endPx: 100 },
        { startPx: 110, endPx: 200 },
      ],
      GAP,
    );

    expect(result.map((r) => r.lane)).toEqual([0, 0]);
  });

  it('間隔が gapPx をわずかに下回ると別のレーンへ送る', () => {
    const result = assignLanes(
      [
        { startPx: 0, endPx: 100 },
        { startPx: 109, endPx: 200 },
      ],
      GAP,
    );

    expect(result.map((r) => r.lane)).toEqual([0, 1]);
  });

  it('3件が連続して重なると3段になる', () => {
    const result = assignLanes(
      [
        { startPx: 0, endPx: 200 },
        { startPx: 10, endPx: 210 },
        { startPx: 20, endPx: 220 },
      ],
      GAP,
    );

    expect(result.map((r) => r.lane)).toEqual([0, 1, 2]);
  });

  it('入力を破壊しない', () => {
    const items = [
      { startPx: 200, endPx: 250 },
      { startPx: 0, endPx: 50 },
    ];
    assignLanes(items, GAP);

    expect(items.map((i) => i.startPx)).toEqual([200, 0]);
  });

  it('空配列を受け取れる', () => {
    expect(assignLanes([], GAP)).toEqual([]);
  });
});

describe('laneCount', () => {
  it('使われている最大レーン番号 + 1 を返す', () => {
    expect(laneCount([{ lane: 0 }, { lane: 2 }, { lane: 1 }])).toBe(3);
  });

  it('空配列では0を返す', () => {
    expect(laneCount([])).toBe(0);
  });
});
