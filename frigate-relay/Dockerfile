FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY relay.py .

# -u: unbuffered stdout, so log lines show up in `docker logs` immediately
# instead of waiting for Python's output buffer to flush.
CMD ["python", "-u", "relay.py"]
