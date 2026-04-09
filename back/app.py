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
CONFIG_FILE = os.path.join(BASE_DIR, 'config.yaml')

# Получаем логин и пароль из переменных окружения
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

def load_full_config():
    """Загрузка полного конфига из YAML файла"""
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)
    except FileNotFoundError:
        # Создаем дефолтный конфиг если файла нет
        default_config = {
            'users': [],
            'jira': {
                'url': 'https://oneproject.it-one.ru/jira/secure/RapidBoard.jspa?rapidView=327',
                'origin': 'https://oneproject.it-one.ru',
                'board_name': 'Daily Toaster Board'
            }
        }
        save_full_config(default_config)
        return default_config
    except Exception as e:
        print(f"Ошибка загрузки конфига: {e}")
        return {'users': [], 'jira': {}}

def save_full_config(config):
    """Сохранение полного конфига в YAML файл"""
    with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False)

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

@app.route('/api/users', methods=['GET'])
@auth.login_required
def get_users():
    config = load_full_config()
    users = config.get('users', [])
    for i, u in enumerate(users):
        u['id'] = i
    return jsonify(users)

@app.route('/api/users', methods=['PUT'])
@auth.login_required
def put_users():
    config = load_full_config()
    users = request.json
    to_save = []
    for u in users:
        u_copy = u.copy()
        u_copy.pop('id', None)
        to_save.append(u_copy)
    config['users'] = to_save
    save_full_config(config)
    return jsonify({'ok': True})

@app.route('/api/config', methods=['GET'])
@auth.login_required
def get_config():
    config = load_full_config()
    return jsonify(config.get('jira', {}))

@app.route('/api/config', methods=['PUT'])
@auth.login_required
def update_config():
    config = load_full_config()
    config['jira'] = request.json
    save_full_config(config)
    print(f"Jira config saved: {config['jira']}")  # Для отладки
    return jsonify({'ok': True})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"Server running on port {port}")
    print(f"Config file: {CONFIG_FILE}")
    app.run(debug=False, host='0.0.0.0', port=port)