FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
# Se usa Gunicorn para producción en vez del servidor de desarrollo de Flask
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "app:app"]