import assert from 'assert';
import { buildTargets } from '../src/common/device/build-targets';
import {
  buildScript,
  cmakeArguments,
  cmakePath,
  isWindowsPath,
  mapArgument,
  shellArgument,
  wslPath,
  wslRefs,
} from '../src/common/device/build-script';
import { KllLayout } from '../src/common/config/kll';

const toolchain = {
  controller: 'C:\\kiibohd-Controller',
  kll: 'C:\\kiibohd-kll',
  layouts: 'C:\\layouts',
  cmake: 'cmake',
  python: '/home/user/.kiibohd/venv/bin/python3',
  extraPath: '',
};

const kll: KllLayout = {
  name: 'KType-Standard',
  board: 'KType',
  layout: 'Standard',
  layers: [
    { name: 'KType-Standard-0.kll', content: 'layer0' },
    { name: 'KType-Standard-1.kll', content: 'layer1' },
  ],
};

describe('path and quoting helpers', () => {
  it('converts Windows paths to cmake-safe unix separators', () => {
    assert.strictEqual(cmakePath('C:\\foo\\bar'), 'C:/foo/bar');
    assert.strictEqual(cmakePath('/already/unix'), '/already/unix');
  });

  it('detects Windows paths', () => {
    assert.strictEqual(isWindowsPath('C:\\foo'), true);
    assert.strictEqual(isWindowsPath('d:/foo'), true);
    assert.strictEqual(isWindowsPath('/home/user/foo'), false);
    assert.strictEqual(isWindowsPath('relative\\win'), true);
  });

  it('wraps WSL translations around Windows paths only', () => {
    assert.strictEqual(wslPath('C:\\kiibohd-Controller'), "$(wslpath -a 'C:\\kiibohd-Controller')");
    assert.strictEqual(wslPath('/home/user/.kiibohd/venv/bin/python3'), "'/home/user/.kiibohd/venv/bin/python3'");
  });

  it('single-quotes literals and leaves $ variables expandable', () => {
    assert.strictEqual(shellArgument('cmake'), "'cmake'");
    assert.strictEqual(shellArgument("it's"), `'it'\\''s'`);
    assert.strictEqual(shellArgument('$CONTROLLER'), '"$CONTROLLER"');
  });

  it('formats DefaultMap / PartialMaps the way the compile server did', () => {
    assert.strictEqual(mapArgument('stdFuncMap', kll.layers[0]), 'stdFuncMap KType-Standard-0');
    assert.strictEqual(mapArgument('stdFuncMap', undefined), 'stdFuncMap');
  });
});

describe('cmakeArguments', () => {
  it('passes board parameters, layer maps, and WSL variable refs', () => {
    const { extraMap, targets } = buildTargets('KType', 'standard');
    const args = cmakeArguments(targets[0], kll, extraMap, wslRefs);

    assert.ok(args.includes('-G'));
    assert.ok(args.includes('$GENERATOR'));
    assert.ok(args.includes('-DCHIP=mk20dx256vlh7'));
    assert.ok(args.includes('-DScanModule=K-Type'));
    assert.ok(args.includes('-DLayoutName='));
    assert.ok(args.includes('-DDefaultMap=stdFuncMap KType-Standard-0'));
    assert.ok(args.includes('-DPartialMaps=stdFuncMap KType-Standard-1'));
    assert.ok(args.includes('-DPRODUCT_ID=0x0011'));
    assert.ok(args.includes('-DCONFIGURATOR=1'));
    assert.ok(args.includes('-DPYTHON_EXECUTABLE=$PYTHON'));
    assert.ok(args.includes('-DKLL_EXECUTABLE=$PYTHON;$KLL/kll/kll'));
    assert.ok(args.includes('-DKLL_WORKING_DIRECTORY=$KLL'));
    assert.strictEqual(args[args.length - 1], '$CONTROLLER');
  });

  it('prefixes a non-empty layout name with a colon, matching cmake.bash', () => {
    const { extraMap, targets } = buildTargets('WhiteFox', 'vanilla');
    const args = cmakeArguments(targets[0], kll, extraMap, wslRefs);
    assert.ok(args.includes('-DLayoutName=:vanilla'));
    assert.ok(args.includes('-DBaseMap=scancode_map scancode_map.vanilla'));
  });
});

describe('buildScript', () => {
  it('writes a bash script that translates Windows paths and never touches the network', () => {
    const { extraMap, targets } = buildTargets('KType', 'standard');
    const args = cmakeArguments(targets[0], kll, extraMap, wslRefs);
    const script = buildScript(toolchain, args);

    assert.ok(script.startsWith('#!/usr/bin/env bash\n'));
    assert.ok(script.includes("CONTROLLER=$(wslpath -a 'C:\\kiibohd-Controller')"));
    assert.ok(script.includes("PYTHON='/home/user/.kiibohd/venv/bin/python3'"));
    assert.ok(script.includes("export KLL_LAYOUTS_PATH=$(wslpath -a 'C:\\layouts')"));
    assert.ok(script.includes("KLL=$(wslpath -a 'C:\\kiibohd-kll')"));
    assert.ok(script.includes('GENERATOR=Ninja'));
    assert.ok(script.includes("'cmake' --build ."));
    assert.ok(!/input\.club/i.test(script));
    assert.ok(!/github\.com/i.test(script));
  });

  it('omits KLL when unset and prepends extra PATH', () => {
    const script = buildScript({ ...toolchain, kll: '', extraPath: 'C:\\arm-none-eabi\\bin' }, ['-G', '$GENERATOR']);
    assert.ok(!script.includes('\nKLL='));
    assert.ok(script.includes("export PATH=$(wslpath -a 'C:\\arm-none-eabi\\bin'):$PATH"));
    assert.ok(script.includes('"$GENERATOR"'));
  });
});
