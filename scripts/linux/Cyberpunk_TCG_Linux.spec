# -*- mode: python ; coding: utf-8 -*-


a = Analysis(
    ['/mnt/c/Users/marku/Python_codes_trusted/Cyberpunk_TCG/scripts/launcher.py'],
    pathex=[],
    binaries=[],
    datas=[('/mnt/c/Users/marku/Python_codes_trusted/Cyberpunk_TCG/assets', 'assets'), ('/mnt/c/Users/marku/Python_codes_trusted/Cyberpunk_TCG/data', 'data'), ('/mnt/c/Users/marku/Python_codes_trusted/Cyberpunk_TCG/dist/cyberpunk_tcg_monolith.html', 'dist'), ('/mnt/c/Users/marku/Python_codes_trusted/Cyberpunk_TCG/dist/assets', 'dist/assets'), ('/mnt/c/Users/marku/Python_codes_trusted/Cyberpunk_TCG/index.html', '.'), ('/mnt/c/Users/marku/Python_codes_trusted/Cyberpunk_TCG/src', 'src')],
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='Cyberpunk_TCG_Linux',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=['/mnt/c/Users/marku/Python_codes_trusted/Cyberpunk_TCG/assets/icon.png'],
)
