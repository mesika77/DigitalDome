from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
APP_SHELL = PROJECT_ROOT / "frontend" / "src" / "components" / "AppShell.jsx"
LOGO_ASSET = PROJECT_ROOT / "frontend" / "public" / "brand" / "digitaldome-logo.jpeg"


def test_app_shell_uses_digitaldome_logo_asset():
    shell_source = APP_SHELL.read_text(encoding="utf-8")

    assert LOGO_ASSET.exists()
    assert 'src="/brand/digitaldome-logo.jpeg"' in shell_source
    assert 'alt="DigitalDome logo"' in shell_source
    assert "ShieldCheck" not in shell_source
