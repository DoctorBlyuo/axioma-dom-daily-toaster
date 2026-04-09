# Используем базовый образ Astra Linux
FROM registry.astralinux.ru/library/astra/ubi18-openjdk170:latest

# Устанавливаем системные зависимости (включая Midnight Commander)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    git \
    build-essential \
    zlib1g-dev \
    libncurses5-dev \
    libgdbm-dev \
    libnss3-dev \
    libssl-dev \
    libreadline-dev \
    libffi-dev \
    libsqlite3-dev \
    mc \
    nginx \
    curl

# Установка Python 3.13.5 (оптимизированная сборка)
WORKDIR /tmp/python-build
RUN wget -q --no-check-certificate https://www.python.org/ftp/python/3.13.5/Python-3.13.5.tgz \
&& tar -xzf Python-3.13.5.tgz \
&& cd Python-3.13.5 \
&& ./configure --enable-optimizations --with-lto \
&& make -j$(nproc) \
&& make altinstall \
&& rm -rf /tmp/python-build

# Настройка Midnight Commander
RUN mkdir -p /root/.config/mc/ \
    && echo "[Panels]\nNickList=1" > /root/.config/mc/ini

RUN rm -rf /var/lib/apt/lists/*

# Создание и активация venv
ENV VIRTUAL_ENV=/opt/venv
RUN python3.13 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /app
RUN chmod -R 777 /app

# Копируем проект
COPY . .

# Установка зависимостей Python
RUN python3.13 -m pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --upgrade pip
RUN pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org --no-cache-dir -r requirements.txt

# Создаем папки для логов
RUN mkdir -p /var/log/daily-toaster

# Открываем порт
EXPOSE 5001

# Запускаем приложение
CMD ["python", "back/app.py"]
