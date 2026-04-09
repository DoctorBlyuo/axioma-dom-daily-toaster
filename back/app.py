from flask import Flask, send_from_directory, jsonify, request
import yaml
import os
from flask_httpauth import HTTPBasicAuth
from werkzeug.security import generate_password_hash, check_password_hash
from dotenv import load_dotenv

# Загружаем переменные окружения из .env файла
load_dotenv()

app = Flask(__name__, static_folder='../front/static', static_url_path='/static')
auth = HTTPBasicAuth()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
USERS_FILE = os.path.join(BASE_DIR, 'users.yaml')

# Получаем логин и пароль из переменных окружения - БЕЗ ЗНАЧЕНИЙ ПО УМОЛЧАНИЮ
AUTH_USERNAME = os.environ.get('AUTH_USERNAME')
AUTH_PASSWORD = os.environ.get('AUTH_PASSWORD')

# Проверяем, что переменные окружения заданы
if not AUTH_USERNAME or not AUTH_PASSWORD:
    raise ValueError(
        "Environment variables AUTH_USERNAME and AUTH_PASSWORD must be set!"
    )

# Хранилище пользователей для авторизации
users_auth = {
    AUTH_USERNAME: generate_password_hash(AUTH_PASSWORD)
}

@auth.verify_password
def verify_password(username, password):
    if username in users_auth and check_password_hash(users_auth.get(username), password):
        return username
    return None

@auth.error_handler
def unauthorized():
    return jsonify({'error': 'Unauthorized access', 'message': 'Authentication required'}), 401

@app.route('/')
@auth.login_required
def index():
    return send_from_directory('../front/templates', 'index.html')

@app.route('/main.js')
@auth.login_required
def main_js():
    return send_from_directory('../front', 'main.js')

@app.route('/api/users')
@auth.login_required
def get_users():
    with open(USERS_FILE, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
        users = data.get('users', [])
        for i, u in enumerate(users):
            u['id'] = i
    return jsonify(users)

@app.route('/api/users', methods=['PUT'])
@auth.login_required
def put_users():
    users = request.json
    to_save = []
    for u in users:
        u_copy = u.copy()
        u_copy.pop('id', None)
        to_save.append(u_copy)
    with open(USERS_FILE, 'w', encoding='utf-8') as f:
        yaml.dump({'users': to_save}, f, allow_unicode=True)
    return jsonify({'ok': True})

if __name__ == '__main__':
    app.run(debug=False, host='0.0.0.0', port=5001)