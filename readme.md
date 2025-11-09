Финальная инструкция по запуску проекта
1. Установка зависимостей

Для каждого сервиса (service_users, service_orders) нужно установить зависимости:

# В каталоге service_users
cd service_users
npm install

# В каталоге service_orders
cd ../service_orders
npm install

# Для API Gateway (если есть)
cd ../api_gateway
npm install

2. Запуск тестов
2.1. Unit-тесты каждого сервиса
# Тесты пользователей
cd service_users
npm test

# Тесты заказов
cd ../service_orders
npm test

# Тесты API Gateway (если есть)
cd ../api_gateway
npm test

2.2. Интеграционные тесты

Все интеграционные тесты находятся в __tests__/integration.test.js (или аналогичном файле). Они проверяют работу цепочки: Users → Orders.

# Находясь в корне проекта
npm test __tests__/integration.test.js


Примечание: убедись, что сервисы доступны на портах, которые тесты используют, либо запущены mock-сервисы внутри тестов.

3. Запуск сервисов
3.1. Users Service
cd service_users
node index.js


Доступные маршруты:

POST /users/register – регистрация пользователя

POST /users/login – логин

3.2. Orders Service
cd ../service_orders
node index.js


Доступные маршруты:

POST /orders/create – создание заказа

GET /orders – список заказов

3.3. API Gateway (если используется)
cd ../api_gateway
node index.js


Swagger UI доступен на /docs (если настроено)

Проксирует запросы к Users и Orders

4. Проверка traceId и логирования

Включен requestId / traceId middleware, который прокидывает уникальный идентификатор через все сервисы.

Логирование происходит через Winston и сохраняет информацию о пользователях и заказах.

Пример запроса с traceId:

curl -X POST http://localhost:3001/users/login \
  -H "Content-Type: application/json" \
  -H "X-Request-Id: 12345" \
  -d '{"username": "testuser", "password": "123456"}'


В логах будет:

info: User logged in: testuser
meta: { traceId: '12345' }

5. Проверка Outbox и событий

При регистрации пользователя сервис Users публикует событие в Outbox (user_registered).

Другие сервисы могут подписываться на эти события для обработки (например, создание записи в Orders или отправка email).

6. OpenAPI / Swagger

Swagger UI доступен на Gateway или отдельном YAML-файле:

# Через Swagger UI
http://localhost:3000/docs

# Или напрямую
api_gateway/openapi.yaml

7. Команды для полной проверки проекта
# Установка зависимостей
cd service_users && npm install && cd ../service_orders && npm install && cd ../api_gateway && npm install

# Запуск тестов всех сервисов и интеграции
cd ../../
npm test

# Запуск всех сервисов
cd service_users && node index.js & cd ../service_orders && node index.js & cd ../api_gateway && node index.js &


& в конце запускает процессы параллельно (Linux/Mac). На Windows PowerShell можно запускать в отдельных терминалах.