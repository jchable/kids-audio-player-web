import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STEP_SIZE, CURRENT_SIZE, pathLayout, pathD,
} from '../js/path-layout.js';

test('tailles des étapes', () => {
  assert.equal(STEP_SIZE, 112);
  assert.equal(CURRENT_SIZE, 128);
});

test('zigzag : x alterne en dessous de 600 px', () => {
  const { points } = pathLayout(4, 390);
  assert.equal(points.length, 4);
  assert.ok(points[0].x < 195 && points[1].x > 195 && points[2].x < 195 && points[3].x > 195);
  assert.ok(points[1].y > points[0].y);
});

test('tablette : plusieurs étapes sur la même ligne', () => {
  const { points } = pathLayout(8, 1024);
  assert.equal(points[0].row, 0);
  assert.equal(points[5].row, 0);
  assert.equal(points[0].y, points[1].y);
  assert.ok(points[1].x > points[0].x);
});

test('tablette : deuxième ligne en sens inverse', () => {
  const { points } = pathLayout(8, 1024); // 6 par ligne
  assert.equal(points[6].row, 1);
  assert.ok(points[6].y > points[5].y);
  assert.ok(points[7].x < points[6].x);
});

test('600 px exactement : disposition tablette', () => {
  const { points } = pathLayout(4, 600);
  assert.equal(points[0].y, points[1].y);
});

test('la hauteur augmente sans réduire les étapes', () => {
  const few = pathLayout(4, 1024);
  const many = pathLayout(20, 1024);
  assert.ok(many.height > few.height);
  assert.deepEqual(many.points.slice(0, 4), few.points);
});

for (const width of [320, 390, 768, 1024]) {
  test(`toutes les étapes tiennent dans ${width} px`, () => {
    const { points } = pathLayout(20, width);
    for (const p of points) {
      assert.ok(p.x - CURRENT_SIZE / 2 >= 0 && p.x + CURRENT_SIZE / 2 <= width, `x=${p.x}`);
    }
  });
}

test('la hauteur contient la dernière étape et son titre', () => {
  const { points, height } = pathLayout(5, 390);
  assert.ok(height >= points[4].y + CURRENT_SIZE / 2 + 40);
});

test('aucun chapitre : disposition vide', () => {
  assert.deepEqual(pathLayout(0, 390).points, []);
});

test('pathD relie toutes les étapes', () => {
  const { points } = pathLayout(3, 390);
  const d = pathD(points);
  assert.ok(d.startsWith(`M${points[0].x} ${points[0].y}`));
  assert.ok(d.endsWith(`${points[2].x} ${points[2].y}`));
});

test('pathD sans étape', () => {
  assert.equal(pathD([]), '');
});
