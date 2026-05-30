"""
Genki 2.0 — SRS Module (SM-2 Algorithm)

Pure Python implementation of SuperMemo 2 with improvements:
- Hard (3) → interval * 0.5 (no reset to 0)
- Easy (5) → interval * 1.3 bonus
- Cap interval at MAX_INTERVAL (365 days)
- Mastered = interval > 21 AND ef >= 2.0

No I/O, no database. Pure function for testability.
"""
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Literal

Quality = Literal[0, 3, 4, 5]
Status = Literal["new", "learning", "review", "mastered"]

# ── Constants ────────────────────────────────────────────────────────────────

MIN_EF = 1.3
MAX_INTERVAL = 365  # days
EASY_BONUS = 1.3
HARD_PENALTY_RATIO = 0.5
EF_DEDUCT_HARD = 0.15
EF_DEDUCT_AGAIN = 0.2
MASTERY_INTERVAL = 21  # days
MASTERY_EF = 2.0

# XP rewards
XP_AGAIN = 1
XP_HARD = 3
XP_GOOD = 5
XP_EASY = 8

# ── Dataclass ─────────────────────────────────────────────────────────────

@dataclass
class SRSResult:
    ef: float
    interval: int  # days
    repetition: int
    next_review: datetime
    status: Status
    xp_earned: int


# ── Public API ──────────────────────────────────────────────────────────

def calculate_sm2(
    current_ef: float,
    current_interval: int,
    current_repetition: int,
    quality: Quality,
) -> SRSResult:
    """
    SM-2 algorithm. Returns full SRSResult with next review timestamp.

    Quality grades:
    - 0 (Again): complete blackout, repetitions reset
    - 3 (Hard): incorrect but recognizable, half interval, no reset
    - 4 (Good): correct with hesitation
    - 5 (Easy): perfect response
    """
    _validate_quality(quality)

    # ── PASSED: Good (4) or Easy (5) ────────────────────────────────
    if quality >= 4:
        new_ef = _calc_ef(current_ef, quality)
        new_interval = _calc_interval(
            current_interval, current_repetition, new_ef, quality
        )
        new_repetition = current_repetition + 1
        new_status = _derive_status(new_interval, new_ef)
        xp = XP_EASY if quality == 5 else XP_GOOD

    # ── FAILED ────────────────────────────────────────────────────────
    else:
        if quality == 0:
            # Again: full reset
            new_ef = max(MIN_EF, current_ef - EF_DEDUCT_AGAIN)
            new_interval = 0
            new_repetition = 0
            new_status: Status = "learning"
            xp = XP_AGAIN
        else:
            # Hard (3): half interval, no repetition reset
            new_ef = max(MIN_EF, current_ef - EF_DEDUCT_HARD)
            new_interval = max(1, int(current_interval * HARD_PENALTY_RATIO))
            new_repetition = current_repetition  # NOT reset
            new_status = "learning"
            xp = XP_HARD

    return SRSResult(
        ef=new_ef,
        interval=new_interval,
        repetition=new_repetition,
        next_review=datetime.now() + timedelta(days=new_interval),
        status=new_status,
        xp_earned=xp,
    )


def get_next_interval_preview(
    current_ef: float,
    current_interval: int,
    current_repetition: int,
    quality: Quality,
) -> int:
    """
    Preview the next interval without committing the review.
    Used to show the user what will happen before they confirm.
    """
    result = calculate_sm2(current_ef, current_interval, current_repetition, quality)
    return result.interval


# ── Private helpers ────────────────────────────────────────────────────────

def _validate_quality(quality: int) -> None:
    if quality not in (0, 3, 4, 5):
        raise ValueError(f"quality must be 0, 3, 4, or 5; got {quality}")


def _calc_ef(current_ef: float, quality: Quality) -> float:
    """
    EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    """
    delta = 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    return max(MIN_EF, current_ef + delta)


def _calc_interval(
    current_interval: int,
    current_repetition: int,
    new_ef: float,
    quality: Quality,
) -> int:
    """Calculate new interval based on repetition count."""
    if current_repetition == 0:
        interval = 1
    elif current_repetition == 1:
        interval = 6
    else:
        interval = int(round(current_interval * new_ef))

    # Easy bonus
    if quality == 5:
        interval = int(round(interval * EASY_BONUS))

    return min(interval, MAX_INTERVAL)


def _derive_status(interval: int, ef: float) -> Status:
    """Determine card status from interval and ef."""
    if interval > MASTERY_INTERVAL and ef >= MASTERY_EF:
        return "mastered"
    if interval == 0:
        return "learning"
    return "review"
