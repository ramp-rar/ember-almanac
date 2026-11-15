# The data team's Fire Calendar API, run unchanged. Build context = the team's project folder
# (FIRE_API_DIR, see docker-compose.yml); data is mounted read-only at runtime.
FROM python:3.12-slim
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH DATA_DIR=/data
WORKDIR /home/user/app
COPY --chown=user api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir --user -r requirements.txt
COPY --chown=user api ./api
EXPOSE 7860
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
