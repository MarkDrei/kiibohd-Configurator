import assert from 'assert';
import { buildTargets } from '../src/common/device/build-targets';

describe('buildTargets', () => {
  it('throws for an unknown board', () => {
    assert.throws(() => buildTargets('NoSuchBoard', 'standard'), /No firmware build configuration/);
  });

  it('uses stdFuncMap and a single target for KType', () => {
    const build = buildTargets('KType', 'standard');
    assert.strictEqual(build.extraMap, 'stdFuncMap');
    assert.strictEqual(build.targets.length, 1);
    const t = build.targets[0];
    assert.strictEqual(t.side, '');
    assert.strictEqual(t.scanModule, 'K-Type');
    assert.strictEqual(t.macroModule, 'PixelMap');
    assert.strictEqual(t.chip, 'mk20dx256vlh7');
    assert.strictEqual(t.compiler, 'gcc');
    assert.strictEqual(t.baseMap, 'scancode_map');
    assert.strictEqual(t.layoutName, '');
    assert.strictEqual(t.vendorId, '0x308F');
    assert.strictEqual(t.productId, '0x0011');
    assert.strictEqual(t.bootVendorId, '0x1C11');
    assert.strictEqual(t.bootProductId, '0xB007');
    assert.strictEqual(t.outputModule, 'USB');
    assert.strictEqual(t.debugModule, 'full');
  });

  it('builds both Infinity Ergodox halves with distinct maps and product ids', () => {
    const { extraMap, targets } = buildTargets('MDErgo1', '');
    assert.strictEqual(extraMap, 'infinity_ergodox/lcdFuncMap');
    assert.deepStrictEqual(
      targets.map((t) => ({ side: t.side, baseMap: t.baseMap, productId: t.productId })),
      [
        { side: 'left', baseMap: 'scancode_map leftHand slave1 rightHand', productId: '0x0004' },
        { side: 'right', baseMap: 'scancode_map rightHand slave1 leftHand', productId: '0x0025' },
      ]
    );
  });

  it('appends the WhiteFox variant to the base map and product string', () => {
    const { targets } = buildTargets('WhiteFox', 'truefox');
    const t = targets[0];
    assert.strictEqual(t.baseMap, 'scancode_map scancode_map.truefox');
    assert.strictEqual(t.layoutName, 'truefox');
    assert.strictEqual(t.productId, '0x000A');
  });

  it('selects Infinity 60 / 60 LED product ids from the variant', () => {
    assert.strictEqual(buildTargets('MD1', 'hacker').targets[0].productId, '0x0001');
    assert.strictEqual(buildTargets('MD1', 'standard').targets[0].productId, '0x0002');
    assert.strictEqual(buildTargets('MD1.1', 'alphabet').targets[0].productId, '0x000F');
    assert.strictEqual(buildTargets('MD1.1', 'hacker').targets[0].chip, 'mk20dx128vlf5');
    assert.strictEqual(buildTargets('MD1', 'hacker').targets[0].baseMap, 'scancode_map scancode_map.hacker');
  });

  it('uses Kira SAM4S ids including a distinct bootloader pair', () => {
    const t = buildTargets('Kira', 'standard').targets[0];
    assert.strictEqual(t.scanModule, 'Kira');
    assert.strictEqual(t.chip, 'sam4s8b');
    assert.strictEqual(t.productId, '0x0013');
    assert.strictEqual(t.bootVendorId, '0x308F');
    assert.strictEqual(t.bootProductId, '0x0012');
  });
});
