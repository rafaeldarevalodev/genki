"""
Genki 2.0 — Voice Services Health Test
Tests that Kokoro (port 5001) and Whisper (port 8001) are reachable.
Run: python3 tests/test_voice_services.py
"""
import sys

PASS = "✅"
FAIL = "❌"

KOKORO_URL = "http://localhost:5001/health"
WHISPER_URL = "http://localhost:8001/health"


def check_service(name: str, url: str) -> bool:
    import urllib.request
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            import json
            data = json.loads(r.read())
            print(f"  {PASS} {name}: {data}")
            return True
    except Exception as e:
        print(f"  {FAIL} {name}: {e}")
        return False


def main():
    print("=" * 50)
    print("Genki 2.0 — Voice Services Health")
    print("=" * 50)

    kokoro_ok = check_service("kokoro", KOKORO_URL)
    whisper_ok = check_service("whisper", WHISPER_URL)

    print("=" * 50)
    if kokoro_ok and whisper_ok:
        print("  🎉 All voice services healthy")
        sys.exit(0)
    else:
        print("  ⚠️  Some services unreachable")
        sys.exit(1)


if __name__ == "__main__":
    main()
