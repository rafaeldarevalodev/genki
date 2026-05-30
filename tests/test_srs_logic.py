"""
Genki 2.0 — SRS Logic Tests

Verifies SM-2 algorithm correctness.
Run: python3 tests/test_srs_logic.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'services', 'genki-db', 'app'))

from srs import (
    calculate_sm2,
    get_next_interval_preview,
    MIN_EF, MAX_INTERVAL, MASTERY_INTERVAL, MASTERY_EF,
    XP_AGAIN, XP_HARD, XP_GOOD, XP_EASY,
)

PASS = "✅"
FAIL = "❌"
total = 0
passed = 0

def check(label: str, got, expected, validator=None):
    global total, passed
    total += 1
    ok = validator(got, expected) if validator else got == expected
    if ok:
        passed += 1
        print(f"  {PASS} {label}: got={got!r}, expected={expected!r}")
    else:
        print(f"  {FAIL} {label}: got={got!r}, expected={expected!r}")


def is_close(a, b, tol=1e-6):
    return abs(a - b) < tol


# ── Test cases ────────────────────────────────────────────────────────

def test_fresh_card_good():
    """
    Fresh card (ef=2.5, int=0, rep=0) + q=4 (Good)
    - ef' = 2.5 + 0 = 2.5  (q=4 gives 0 penalty in V2)
    - rep=0 → interval = 1
    - rep' = 1
    - ef doesn't change for q=4 on fresh card
    """
    print("\n[Test] Fresh card + Good (ef=2.5, int=0, rep=0, q=4)")
    r = calculate_sm2(2.5, 0, 0, 4)
    check("ef stays 2.5", round(r.ef, 2), 2.5, is_close)
    check("interval = 1", r.interval, 1)
    check("repetition = 1", r.repetition, 1)
    check("status = review", r.status, "review")
    check("xp_earned = 5", r.xp_earned, XP_GOOD)


def test_fresh_card_easy():
    """
    Fresh card (ef=2.5, int=0, rep=0) + q=5 (Easy)
    - ef' = 2.5 + 0.1 = 2.6
    - interval = 1 * 1.3 = 1 (capped, rounded)
    """
    print("\n[Test] Fresh card + Easy (ef=2.5, int=0, rep=0, q=5)")
    r = calculate_sm2(2.5, 0, 0, 5)
    check("ef = 2.6", round(r.ef, 2), 2.6, is_close)
    check("interval = 1", r.interval, 1)
    check("repetition = 1", r.repetition, 1)
    check("xp_earned = 8", r.xp_earned, XP_EASY)


def test_second_review_good():
    """
    After first review (ef=2.5, int=1, rep=1) + q=4 (Good)
    - rep=1 → interval = 6
    - ef doesn't change for q=4
    """
    print("\n[Test] Second Good (ef=2.5, int=1, rep=1, q=4)")
    r = calculate_sm2(2.5, 1, 1, 4)
    check("interval = 6", r.interval, 6)
    check("repetition = 2", r.repetition, 2)
    check("ef = 2.5", round(r.ef, 2), 2.5, is_close)


def test_third_review_good():
    """
    After second review (ef=2.5, int=6, rep=2) + q=4 (Good)
    - rep=2 → interval = 6 * 2.5 = 15
    """
    print("\n[Test] Third Good (ef=2.5, int=6, rep=2, q=4)")
    r = calculate_sm2(2.5, 6, 2, 4)
    check("interval = 15", r.interval, 15)
    check("repetition = 3", r.repetition, 3)


def test_again_resets():
    """
    Card with progress (ef=2.36, int=6, rep=2) + q=0 (Again)
    - Full reset: interval=0, repetition=0
    - ef -= 0.2
    """
    print("\n[Test] Again resets (ef=2.36, int=6, rep=2, q=0)")
    r = calculate_sm2(2.36, 6, 2, 0)
    check("interval = 0", r.interval, 0)
    check("repetition = 0", r.repetition, 0)
    check("ef = 2.16", round(r.ef, 2), 2.16, is_close)
    check("status = learning", r.status, "learning")
    check("xp_earned = 1", r.xp_earned, XP_AGAIN)


def test_hard_no_reset():
    """
    Card (ef=2.5, int=10, rep=5) + q=3 (Hard)
    - Key V2 improvement: repetition STAYS at 5, NOT reset to 0
    - interval = max(1, 10 * 0.5) = 5
    """
    print("\n[Test] Hard keeps repetition (ef=2.5, int=10, rep=5, q=3)")
    r = calculate_sm2(2.5, 10, 5, 3)
    check("interval = 5", r.interval, 5)
    check("repetition STAYS at 5 (NOT reset)", r.repetition, 5)
    check("ef -= 0.15 → 2.35", round(r.ef, 2), 2.35, is_close)
    check("xp_earned = 3", r.xp_earned, XP_HARD)


def test_ef_never_below_min():
    """
    Many consecutive failures: ef converges to MIN_EF = 1.3
    """
    print("\n[Test] EF converges to MIN_EF=1.3 after repeated fails")
    ef = 2.5
    for _ in range(20):
        r = calculate_sm2(ef, 10, 5, 0)
        ef = r.ef
    check("ef >= 1.3", round(r.ef, 1), 1.3, is_close)
    check("interval = 0", r.interval, 0)


def test_mastered():
    """
    Card (ef=2.0, int=22, rep=10) + q=4 → mastered
    interval > 21 AND ef >= 2.0
    Status is set AFTER interval calculation, so interval is 44 (22 * 2.0).
    """
    print("\n[Test] Mastered status (ef=2.0, int=22, rep=10, q=4)")
    r = calculate_sm2(2.0, 22, 10, 4)
    check("status = mastered", r.status, "mastered")
    check("interval = 44 (calculated first)", r.interval, 44)
    check("repetition = 11", r.repetition, 11)


def test_not_mastered_low_ef():
    """
    Card (ef=1.5, int=25, rep=8) + q=4 → NOT mastered
    ef < 2.0 even though interval > 21
    """
    print("\n[Test] Not mastered when ef < 2.0 (ef=1.5, int=25, rep=8, q=4)")
    r = calculate_sm2(1.5, 25, 8, 4)
    check("status = review (not mastered)", r.status, "review")


def test_interval_never_exceeds_365():
    """
    Very long interval is capped at MAX_INTERVAL = 365
    """
    print("\n[Test] Interval capped at MAX=365")
    r = calculate_sm2(2.5, 365, 100, 4)
    check("interval <= 365", r.interval, 365)
    check("ef doesn't go negative", r.ef > 0, True)


def test_preview_equals_commit():
    """
    Preview must match the interval that will be committed.
    """
    print("\n[Test] Preview equals commit (ef=2.5, int=0, rep=0, q=4)")
    preview = get_next_interval_preview(2.5, 0, 0, 4)
    committed = calculate_sm2(2.5, 0, 0, 4).interval
    check(f"preview={preview} == committed={committed}", preview, committed)


def test_invalid_quality_raises():
    print("\n[Test] Invalid quality raises ValueError")
    try:
        calculate_sm2(2.5, 0, 0, 2)
        print("  {FAIL} Expected ValueError, got none")
    except ValueError as e:
        print(f"  {PASS} ValueError raised: {e}")


# ── Run ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("Genki 2.0 — SRS Logic Tests")
    print("=" * 60)

    test_fresh_card_good()
    test_fresh_card_easy()
    test_second_review_good()
    test_third_review_good()
    test_again_resets()
    test_hard_no_reset()
    test_ef_never_below_min()
    test_mastered()
    test_not_mastered_low_ef()
    test_interval_never_exceeds_365()
    test_preview_equals_commit()
    test_invalid_quality_raises()

    print("\n" + "=" * 60)
    result = f"  {passed}/{total} tests passed"
    print(result)
    if passed == total:
        print("  🎉 All tests passed")
    print("=" * 60)
    sys.exit(0 if passed == total else 1)
