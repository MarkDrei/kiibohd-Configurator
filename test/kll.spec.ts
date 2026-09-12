import assert from 'assert';
import { generateKll, layoutHash } from '../src/common/config/kll';
import { PersistedConfig } from '../src/common/config/types';
import { key, loadLayout } from './helpers';

function config(partial: Partial<PersistedConfig> & Pick<PersistedConfig, 'header' | 'matrix'>): PersistedConfig {
  return {
    defines: [],
    leds: [],
    animations: {},
    macros: {},
    custom: {},
    canned: {},
    ...partial,
  };
}

describe('generateKll', () => {
  it('throws when Name or Layout is missing', () => {
    const empty = config({ header: {}, matrix: [] });
    assert.throws(() => generateKll(empty, empty), /Name or Layout/);
  });

  it('sanitizes board and layout for file names', () => {
    const layout = config({
      header: { Name: 'K Type!', Layout: 'My Layout' },
      matrix: [key('0x01', { '0': { key: 'A' } })],
    });
    const base = config({
      header: { Name: 'K Type!', Layout: 'Base' },
      matrix: [key('0x01', { '0': { key: 'ESC' } })],
    });

    const kll = generateKll(layout, base);
    assert.strictEqual(kll.board, 'K_Type');
    assert.strictEqual(kll.layout, 'My_Layout');
    assert.strictEqual(kll.layers[0].name, 'K_Type-My_Layout-0.kll');
  });

  it('maps assigned keys against the base key on the left-hand side', () => {
    const layout = config({
      header: { Name: 'KType', Layout: 'Custom' },
      matrix: [
        key('0x01', {
          '0': { key: 'A' },
          '1': { key: '#:flashMode()' },
          '2': { key: 'CONS:MUTE' },
          '3': { key: 'SYS:SLEEP' },
        }),
      ],
      custom: { '0': 'CustomKll();' },
      defines: [{ name: 'Foo', value: 'bar' }],
    });
    const base = config({
      header: { Name: 'KType', Layout: 'Base' },
      matrix: [key('0x01', { '0': { key: 'ESC' } })],
    });

    const kll = generateKll(layout, base);
    const layer0 = kll.layers[0].content;
    const layer1 = kll.layers[1].content;
    const layer2 = kll.layers[2].content;
    const layer3 = kll.layers[3].content;

    assert.ok(layer0.includes('U"ESC" : U"A";'));
    assert.ok(layer0.includes('Foo = "bar";'));
    assert.ok(layer0.includes('CustomKll();'));
    assert.ok(layer0.includes('Name = "KType";'));

    assert.ok(layer1.includes('U"ESC" : flashMode();'));
    assert.ok(!layer1.includes('Foo = "bar";'), 'defines belong on layer 0');
    assert.ok(!layer1.includes('CustomKll();'));

    assert.ok(layer2.includes('U"ESC" : CONS"MUTE";'));
    assert.ok(layer3.includes('U"ESC" : SYS"SLEEP";'));
  });

  it('skips layers with no remaps and no custom KLL', () => {
    const layout = config({
      header: { Name: 'KType', Layout: 'Sparse' },
      matrix: [key('0x01', { '0': { key: 'A' }, '2': { key: 'B' } })],
    });
    const base = config({
      header: { Name: 'KType', Layout: 'Base' },
      matrix: [key('0x01', { '0': { key: 'ESC' } })],
    });

    const kll = generateKll(layout, base);
    assert.ok(kll.layers[0]);
    assert.strictEqual(kll.layers[1], undefined);
    assert.ok(kll.layers[2]);
  });

  it('matches WhiteFox keys by scan code rather than matrix index', () => {
    const layout = config({
      header: { Name: 'WhiteFox', Layout: 'Short' },
      matrix: [key('0x00', { '0': { key: 'TAB' } }), key('0x02', { '0': { key: 'Q' } })],
    });
    const base = config({
      header: { Name: 'WhiteFox', Layout: 'VanillaBase' },
      matrix: [
        key('0x00', { '0': { key: 'ESC' } }),
        key('0x01', { '0': { key: 'ONE' } }),
        key('0x02', { '0': { key: 'TWO' } }),
      ],
    });

    const content = generateKll(layout, base).layers[0].content;
    assert.ok(content.includes('U"ESC" : U"TAB";'));
    assert.ok(content.includes('U"TWO" : U"Q";'));
    assert.ok(!content.includes('U"ONE"'), 'index 1 of the layout is code 0x02, not the base key at index 1');
  });

  it('emits animation frames on layer 0 and skips empty animations', () => {
    const layout = config({
      header: { Name: 'KType', Layout: 'Lights' },
      matrix: [key('0x01', { '0': { key: 'A' } })],
      animations: {
        wave: { type: 'custom', settings: 'loop', frames: ['P[c:0%](0,0,0)', '# comment', 'P[c:100%](255,0,0)'] },
        empty: { type: 'custom', settings: 'loop', frames: ['# only a comment'] },
      },
    });
    const base = config({
      header: { Name: 'KType', Layout: 'Base' },
      matrix: [key('0x01', { '0': { key: 'ESC' } })],
    });

    const layer0 = generateKll(layout, base).layers[0].content;
    assert.ok(layer0.includes('A[wave] <= loop;'));
    assert.ok(layer0.includes('A[wave, 1] <= P[c:0%](0,0,0);'));
    assert.ok(layer0.includes('# comment'));
    assert.ok(layer0.includes('A[wave, 2] <= P[c:100%](255,0,0);'));
    assert.ok(layer0.includes('### empty is empty, skipping'));
  });

  it('produces named layer files from bundled KType layouts', () => {
    const standard = loadLayout('KType-Standard.json');
    const base = loadLayout('KType-Base.json');
    const kll = generateKll(standard, base);

    assert.strictEqual(kll.name, 'KType-Standard');
    assert.ok(kll.layers[0], 'layer 0 is always present for a stock layout');
    assert.strictEqual(kll.layers[0].name, 'KType-Standard-0.kll');
    assert.ok(kll.layers[0].content.includes('A[rainbow_wave]'));
    assert.ok(kll.layers[1].content.includes('flashMode()'));
    assert.ok(kll.layers[1].content.includes('CONS"PAUSE"'));
  });
});

describe('layoutHash', () => {
  it('is stable for the same layout and toolchain, and changes when either changes', () => {
    const standard = loadLayout('KType-Standard.json');
    const base = loadLayout('KType-Base.json');
    const kll = generateKll(standard, base);

    assert.strictEqual(layoutHash(kll, 'abc'), layoutHash(kll, 'abc'));
    assert.notStrictEqual(layoutHash(kll, 'abc'), layoutHash(kll, 'abd'));

    const other = generateKll(loadLayout('KType-NoAnimations.json'), base);
    assert.notStrictEqual(layoutHash(kll, 'abc'), layoutHash(other, 'abc'));
  });
});
