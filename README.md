# Daily Toaster

Приложение для управления статусами пользователей с возможностью перетаскивания между списками.

## Функциональность

- Daily Toster
- Управление пользователями
- Сохранение изменений в YAML файл
- Визуальные уведомления

## Установка

1. Установите зависимости:
   ```bash
   pip install flask pyyaml pydantic

## Сборка и запуск докер-контейнера

1. Простая сборка
   ```bash
   docker build -t daily-toaster .
   ```

2. Запуск

   bash:
   ```bash
   docker run -d -p 5001:5001 -v $(pwd)/users.yaml:/app/users.yaml --name daily-toaster daily-toaster
   ```
   PowerShell:
   ```PowerShell
   docker run -d -p 5001:5001 -v ${PWD}/users.yaml:/app/users.yaml --name daily-toaster daily-toaster
   ```
3. Загрузка образа на сервер

   На локальном компе сохраняем образ:
   ```bash
   docker save -o daily-toaster.tar daily-toaster
   ````
   Далее, копируем его и файл users.yaml на удалённый компъютер, в заданную папку...

   На удалённом компьютере загружаем:
   ```bash
   sudo docker load -i daily-toaster.tar
   ```
   Проверяем:
   ```bash
   sudo docker images | grep daily
   daily-toaster                                         
   ```
   Запускаем:
   ```bash
   sudo docker run -d \
   --name daily-toaster \
   -p 8080:5001 \
   -v /app/AT2.0/daily_toaster/users.yaml:/app/users.yaml \
   -e AUTH_USERNAME=admin \
   -e AUTH_PASSWORD=your_secure_password_here \
   --restart unless-stopped \
   daily-toaster
   ```
   или, если есть файл с логином и паролем:
   ```bash
   sudo docker run -d \
   --name daily-toaster \
   -p 8080:5001 \
   -v /app/AT2.0/daily_toaster/users.yaml:/app/users.yaml \
   --env-file /app/AT2.0/daily_toaster/.env \
   --restart unless-stopped \
   daily-toaster
   ```
   Если надо переустановить, то из портейнера удаляем действующий контейнер и образ и повторяем операцию загрузки...
