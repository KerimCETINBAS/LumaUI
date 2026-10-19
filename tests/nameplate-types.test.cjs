const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ts = require('typescript');

test('BlizzardElement JSX requires one operation, a unit predicate and a per-unit factory', () => {
    const root = path.resolve(__dirname, '../packages/core');
    const config = ts.readConfigFile(path.join(root, 'tsconfig.json'), ts.sys.readFile);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    const filename = path.join(root, 'src/__nameplate_types.tsx');
    const source = `
        import { UI } from 'wuira/ui';
        import { HP } from 'wuira/datasources';
        import type { SkinAPI, LumaHelpers } from './core/builder';
        declare const skins: SkinAPI, helpers: LumaHelpers;
        const BlizzardElement = skins.BlizzardElement;
        const UnitToBool = helpers.UnitToBool;
        const replacement = <BlizzardElement replace type="dynamic" target="nameplate" filter={UnitToBool({ npcIds: [123] })}>
            {plate => <progress width={140} height={12} source={new HP(plate.Unit)} />}
        </BlizzardElement>;
        const applied = <BlizzardElement apply type="dynamic" target="nameplate" filter={UnitToBool({ player: false })} width={140} height={12} />;
        // @ts-expect-error Operations are mutually exclusive.
        const both = <BlizzardElement apply replace type="dynamic" target="nameplate" filter={UnitToBool()} />;
        // @ts-expect-error Filter must output boolean.
        const badFilter = <BlizzardElement apply type="dynamic" target="nameplate" filter={() => 'yes'} />;
        // @ts-expect-error Replace requires a factory.
        const missing = <BlizzardElement replace type="dynamic" target="nameplate" filter={UnitToBool()} />;
        // @ts-expect-error A shared JSX element is not a per-unit factory.
        const shared = <BlizzardElement replace type="dynamic" target="nameplate" filter={UnitToBool()}><cell /></BlizzardElement>;
        // @ts-expect-error Secure/static native targets are outside this dynamic primitive.
        const other = <BlizzardElement apply type="static" target="player" filter={UnitToBool()} />;
    `;
    const host = ts.createCompilerHost(parsed.options);
    const original = host.getSourceFile;
    host.getSourceFile = (file, version, ...rest) => path.resolve(file) === filename
        ? ts.createSourceFile(filename, source, version, true, ts.ScriptKind.TSX)
        : original(file, version, ...rest);
    const program = ts.createProgram([...parsed.fileNames, filename], { ...parsed.options, noEmit: true }, host);
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCurrentDirectory: () => root, getCanonicalFileName: f => f, getNewLine: () => '\n',
    }));
});
