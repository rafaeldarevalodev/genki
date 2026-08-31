import http.client
import threading
import unittest
from contextlib import contextmanager
from http.server import HTTPServer

from f5tts_server import F5TTSHandler
from kokoro_server import KokoroTTSHandler


LAN_ORIGIN = "http://192.168.1.135:9002"


@contextmanager
def running_server(handler):
    server = HTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1]
    finally:
        server.shutdown()
        thread.join()
        server.server_close()


def request(port, method, path, body=None):
    connection = http.client.HTTPConnection("127.0.0.1", port)
    connection.request(
        method,
        path,
        body=body,
        headers={
            "Content-Type": "application/json",
            "Origin": LAN_ORIGIN,
        },
    )
    response = connection.getresponse()
    result = response.status, dict(response.getheaders()), response.read()
    connection.close()
    return result


class TtsCorsTests(unittest.TestCase):
    def test_f5_error_response_keeps_success_cors_headers_for_lan_origin(self):
        with running_server(F5TTSHandler) as port:
            success_status, success_headers, _ = request(port, "GET", "/health")
            error_status, error_headers, _ = request(port, "POST", "/v1/audio/speech", b"{")

        self.assertEqual(success_status, 200)
        self.assertEqual(error_status, 400)
        self.assertEqual(error_headers.get("Access-Control-Allow-Origin"), success_headers.get("Access-Control-Allow-Origin"))
        self.assertEqual(error_headers.get("Access-Control-Allow-Methods"), success_headers.get("Access-Control-Allow-Methods"))
        self.assertEqual(error_headers.get("Access-Control-Allow-Headers"), success_headers.get("Access-Control-Allow-Headers"))

    def test_kokoro_error_response_keeps_success_cors_headers_for_lan_origin(self):
        with running_server(KokoroTTSHandler) as port:
            success_status, success_headers, _ = request(port, "GET", "/health")
            error_status, error_headers, _ = request(port, "POST", "/v1/audio/speech", b"{")

        self.assertEqual(success_status, 200)
        self.assertEqual(error_status, 400)
        self.assertEqual(error_headers.get("Access-Control-Allow-Origin"), success_headers.get("Access-Control-Allow-Origin"))
        self.assertEqual(error_headers.get("Access-Control-Allow-Methods"), success_headers.get("Access-Control-Allow-Methods"))
        self.assertEqual(error_headers.get("Access-Control-Allow-Headers"), success_headers.get("Access-Control-Allow-Headers"))


if __name__ == "__main__":
    unittest.main()
