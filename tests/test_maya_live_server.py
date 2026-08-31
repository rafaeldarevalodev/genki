import unittest
from unittest.mock import patch

import maya_live_server as maya


class StreamTTSRoutingTests(unittest.IsolatedAsyncioTestCase):
    async def test_fast_f5_request_uses_f5_dispatch(self):
        async def f5(*args, **kwargs):
            yield {"route": "f5"}

        async def kokoro(*args, **kwargs):
            yield {"route": "kokoro"}

        with (
            patch.object(maya, "_stream_f5tts", f5),
            patch.object(maya, "_stream_kokoro_fallback", kokoro),
        ):
            chunks = [chunk async for chunk in maya.stream_tts(
                "Hello", "fast", tts_provider="f5tts", tts_voice="en-Emma_woman"
            )]

        self.assertEqual(chunks, [{"route": "f5"}])

    async def test_invalid_provider_falls_back_to_f5_dispatch(self):
        async def f5(*args, **kwargs):
            yield {"route": "f5"}

        async def kokoro(*args, **kwargs):
            yield {"route": "kokoro"}

        with (
            patch.object(maya, "_stream_f5tts", f5),
            patch.object(maya, "_stream_kokoro_fallback", kokoro),
        ):
            chunks = [chunk async for chunk in maya.stream_tts(
                "Hello", "fast", tts_provider="external", tts_voice="ignored"
            )]

        self.assertEqual(chunks, [{"route": "f5"}])

    async def test_immersive_f5_request_uses_f5_dispatch(self):
        async def f5(*args, **kwargs):
            yield {"route": "f5"}

        async def kokoro(*args, **kwargs):
            yield {"route": "kokoro"}

        with (
            patch.object(maya, "_stream_f5tts", f5),
            patch.object(maya, "_stream_kokoro_fallback", kokoro),
        ):
            chunks = [chunk async for chunk in maya.stream_tts(
                "Hello", "immersive", tts_provider="f5tts", tts_voice="en-Emma_woman"
            )]

        self.assertEqual(chunks, [{"route": "f5"}])

    async def test_immersive_kokoro_request_preserves_kokoro_dispatch_and_voice(self):
        kokoro_calls = []

        async def f5(*args, **kwargs):
            yield {"route": "f5"}

        async def kokoro(*args, **kwargs):
            kokoro_calls.append((args, kwargs))
            yield {"route": "kokoro"}

        with (
            patch.object(maya, "_stream_f5tts", f5),
            patch.object(maya, "_stream_kokoro_fallback", kokoro),
        ):
            chunks = [chunk async for chunk in maya.stream_tts(
                "Hello", "immersive", tts_provider="kokoro", tts_voice="af_sarah"
            )]

        self.assertEqual(chunks, [{"route": "kokoro"}])
        self.assertEqual(kokoro_calls, [(("Hello", None, ""), {"voice": "af_sarah"})])


if __name__ == "__main__":
    unittest.main()
