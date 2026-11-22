import os
import csv
import io
import json
import mimetypes
from pathlib import Path
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote
from email.parser import BytesParser
from email.policy import default


# =====================================
# PROJECT CONFIGURATION
# =====================================

BASE_DIR = Path(__file__).resolve().parent
PROJECT_DIR = BASE_DIR.parent
FRONTEND_DIR = PROJECT_DIR / "frontend"
UPLOAD_DIR = BASE_DIR / "uploads"

UPLOAD_DIR.mkdir(exist_ok=True)

HOST = "127.0.0.1"
PORT = 8000

# Store the currently uploaded dataset
dataset = []
headers = []
uploaded_filename = ""


# =====================================
# DATASET PROCESSING FUNCTIONS
# =====================================

def read_csv_file(file_content):

    global dataset, headers

    text = file_content.decode("utf-8-sig")

    reader = csv.DictReader(io.StringIO(text))

    if not reader.fieldnames:
        raise ValueError("CSV file has no column headings.")

    headers = [
        str(column).strip() if column else f"Column {i + 1}"
        for i, column in enumerate(reader.fieldnames)
    ]

    dataset = []

    for row in reader:

        new_row = {}

        for original, new in zip(reader.fieldnames, headers):
            new_row[new] = (row.get(original) or "").strip()

        if any(value != "" for value in new_row.values()):
            dataset.append(new_row)

    if not headers:
        raise ValueError("No columns found in the CSV file.")


def get_statistics():

    return {
        "total_rows": len(dataset),
        "total_columns": len(headers),
        "columns": headers
    }


def clean_dataset():

    global dataset

    original_count = len(dataset)

    unique_rows = []
    seen = set()

    for row in dataset:

        key = tuple(row.get(column, "") for column in headers)

        if key not in seen:
            seen.add(key)
            unique_rows.append(row)

    dataset = unique_rows

    removed_count = original_count - len(dataset)

    return {
        "message": "Dataset cleaned successfully!",
        "removed_rows": removed_count,
        "remaining_rows": len(dataset)
    }


# =====================================
# HTTP SERVER
# =====================================

class DashboardHandler(BaseHTTPRequestHandler):

    def send_json(self, data, status=200):

        response = json.dumps(data).encode("utf-8")

        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()

        self.wfile.write(response)


    # =================================
    # GET REQUESTS
    # =================================

    def do_GET(self):

        path = unquote(self.path.split("?")[0])

        # Backend status

        if path == "/api/status":

            self.send_json({
                "status": "success",
                "message": "Data Visualization Dashboard backend is running!"
            })

            return

        # Dataset information

        if path == "/api/data":

            self.send_json({
                "filename": uploaded_filename,
                "headers": headers,
                "data": dataset,
                "statistics": get_statistics()
            })

            return

        # Serve frontend files

        if path == "/":
            path = "/index.html"

        requested_file = (FRONTEND_DIR / path.lstrip("/")).resolve()

        if not requested_file.is_relative_to(FRONTEND_DIR.resolve()):
            self.send_error(403, "Access denied")
            return

        if requested_file.is_file():

            content = requested_file.read_bytes()

            content_type = mimetypes.guess_type(
                str(requested_file)
            )[0] or "application/octet-stream"

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()

            self.wfile.write(content)

        else:
            self.send_error(404, "File not found")


    # =================================
    # POST REQUESTS
    # =================================

    def do_POST(self):

        global uploaded_filename

        if self.path == "/api/upload":

            self.handle_upload()

        elif self.path == "/api/clean":

            result = clean_dataset()
            self.send_json(result)

        else:

            self.send_json({
                "error": "API endpoint not found"
            }, 404)


    # =================================
    # HANDLE FILE UPLOAD
    # =================================

    def handle_upload(self):

        global uploaded_filename

        try:

            content_type = self.headers.get("Content-Type", "")

            if not content_type.startswith("multipart/form-data"):
                self.send_json({
                    "error": "Please upload a file using multipart/form-data."
                }, 400)
                return

            content_length = int(self.headers.get("Content-Length", 0))

            if content_length <= 0 or content_length > 20 * 1024 * 1024:
                self.send_json({
                    "error": "File is empty or exceeds the 20 MB limit."
                }, 400)
                return

            body = self.rfile.read(content_length)

            message = BytesParser(policy=default).parsebytes(
                b"Content-Type: " + content_type.encode() +
                b"\r\nMIME-Version: 1.0\r\n\r\n" + body
            )

            file_content = None
            filename = None

            for part in message.iter_parts():

                field_name = part.get_param(
                    "name",
                    header="content-disposition"
                )

                if field_name == "file":

                    filename = part.get_filename()
                    file_content = part.get_payload(decode=True)
                    break

            if not filename or file_content is None:
                self.send_json({
                    "error": "No file received."
                }, 400)
                return

            safe_filename = Path(filename).name

            if Path(safe_filename).suffix.lower() != ".csv":
                self.send_json({
                    "error": "Only CSV files are supported by this backend."
                }, 400)
                return

            # Save uploaded file

            file_path = UPLOAD_DIR / safe_filename
            file_path.write_bytes(file_content)

            # Read dataset

            read_csv_file(file_content)

            uploaded_filename = safe_filename

            self.send_json({
                "message": "File uploaded successfully!",
                "filename": uploaded_filename,
                "statistics": get_statistics(),
                "data": dataset[:100]
            })

        except (ValueError, UnicodeDecodeError, csv.Error) as error:

            self.send_json({
                "error": str(error)
            }, 400)

        except Exception as error:

            self.send_json({
                "error": "Upload failed: " + str(error)
            }, 500)


# =====================================
# START SERVER
# =====================================

if __name__ == "__main__":

    server = HTTPServer((HOST, PORT), DashboardHandler)

    print("---------------------------------------")
    print(" Data Visualization Dashboard")
    print("---------------------------------------")
    print(f"Server running at http://{HOST}:{PORT}")
    print("Press CTRL + C to stop the server")
    print("---------------------------------------")

    try:
        server.serve_forever()

    except KeyboardInterrupt:
        print("\nServer stopped.")

    finally:
        server.server_close()
