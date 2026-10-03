import os
import sys
from pathlib import Path

VENV = Path(__file__).resolve().parent / "venv"


def main():
    try:
        import django
    except ImportError:
        if (VENV / "bin" / "python").exists() and Path(sys.prefix) != VENV:
            os.execv(VENV / "bin" / "python", [str(VENV / "bin" / "python"), *sys.argv])
        raise
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
    from django.core.management import execute_from_command_line
    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
