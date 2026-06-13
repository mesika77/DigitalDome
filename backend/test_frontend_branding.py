from pathlib import Path

from PIL import Image


PROJECT_ROOT = Path(__file__).resolve().parent.parent
APP_SHELL = PROJECT_ROOT / "frontend" / "src" / "components" / "AppShell.jsx"
LOGO_ASSET = PROJECT_ROOT / "frontend" / "public" / "brand" / "digitaldome-logo-transparent.png"


def test_app_shell_uses_transparent_digitaldome_logo_asset():
    shell_source = APP_SHELL.read_text(encoding="utf-8")

    assert LOGO_ASSET.exists()
    assert 'src="/brand/digitaldome-logo-transparent.png"' in shell_source
    assert 'alt="DigitalDome logo"' in shell_source
    assert "ShieldCheck" not in shell_source

    with Image.open(LOGO_ASSET) as logo:
        assert logo.mode == "RGBA"
        assert logo.getpixel((0, 0))[3] == 0
        assert logo.getpixel((logo.width - 1, logo.height - 1))[3] == 0
