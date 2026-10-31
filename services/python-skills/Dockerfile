FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HOST=0.0.0.0 PORT=8080
WORKDIR /opt/rangeform
RUN useradd --system --uid 10001 --create-home researcher
COPY local-toolkit/research ./local-toolkit/research
COPY services/python-skills/server.py ./services/python-skills/server.py
USER researcher
EXPOSE 8080
CMD ["python", "-u", "services/python-skills/server.py"]
