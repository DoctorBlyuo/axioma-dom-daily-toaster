# Используем официальный образ Python (гораздо быстрее)
FROM python:3.13-slim

# Устанавливаем только необходимые системные зависимости
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    mc \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем только requirements.txt сначала (для кэширования)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальной код
COPY . .

# Создаем папки для логов
RUN mkdir -p /var/log/daily-toaster

# Открываем порт
EXPOSE 5001

# Запускаем приложение
CMD ["python", "back/app.py"]