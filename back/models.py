from datetime import datetime
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, field_validator, ConfigDict


class UserModel(BaseModel):
    """Модель пользователя для валидации"""

    # Настройки модели
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "id": 1,
                "name": "Иван",
                "surname": "Петров",
                "patronymic": "Иванович",
                "status": "Активен"
            }
        }
    )

    # Поля модели
    id: Optional[int] = Field(None, description="Уникальный идентификатор")
    name: str = Field(..., min_length=1, max_length=50, description="Имя")
    surname: str = Field(..., min_length=1, max_length=50, description="Фамилия")
    patronymic: str = Field(..., min_length=0, max_length=50, default='', description="Отчество")
    status: Literal['Активен', 'Болеет', 'В отпуске'] = Field(
        default='Активен',
        description="Статус пользователя"
    )
    created_at: Optional[str] = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="Дата создания"
    )
    updated_at: Optional[str] = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="Дата обновления"
    )

    @field_validator('name', 'surname', 'patronymic')
    @classmethod
    def validate_name_parts(cls, v: str) -> str:
        """Валидация частей ФИО"""
        if not v or not v.strip():
            raise ValueError('Поле не может быть пустым')

        # Разрешаем буквы, пробелы, дефисы
        cleaned = v.strip()
        if not all(c.isalpha() or c in ' -' for c in cleaned):
            raise ValueError('Имя может содержать только буквы, пробелы и дефисы')

        return cleaned.title()

    @field_validator('status')
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Валидация статуса"""
        allowed_statuses = ['Активен', 'Болеет', 'В отпуске']
        if v not in allowed_statuses:
            raise ValueError(f'Статус должен быть одним из: {", ".join(allowed_statuses)}')
        return v

    def get_full_name(self) -> str:
        """Получить полное ФИО"""
        return f"{self.surname} {self.name} {self.patronymic}"

    def get_short_name(self) -> str:
        """Получить краткое ФИО (Фамилия И.О.)"""
        return f"{self.surname} {self.name[0]}.{self.patronymic[0]}."

    def to_dict(self, exclude_fields: List[str] = None) -> dict:
        """Преобразование в словарь с возможностью исключения полей"""
        if exclude_fields is None:
            exclude_fields = []
        return self.model_dump(exclude=set(exclude_fields))

    def update_timestamp(self):
        """Обновление временной метки"""
        self.updated_at = datetime.now().isoformat()

    def is_active(self) -> bool:
        """Проверка, активен ли пользователь"""
        return self.status == 'Активен'

    def is_sick(self) -> bool:
        """Проверка, болеет ли пользователь"""
        return self.status == 'Болеет'

    def is_on_vacation(self) -> bool:
        """Проверка, в отпуске ли пользователь"""
        return self.status == 'В отпуске'


class UsersListModel(BaseModel):
    """Модель списка пользователей"""

    users: List[UserModel] = Field(default_factory=list, description="Список пользователей")
    total_count: int = Field(0, description="Общее количество")
    active_count: int = Field(0, description="Количество активных")
    inactive_count: int = Field(0, description="Количество неактивных")
    last_updated: str = Field(
        default_factory=lambda: datetime.now().isoformat(),
        description="Время последнего обновления"
    )

    def update_counts(self):
        """Обновление счетчиков"""
        self.total_count = len(self.users)
        self.active_count = sum(1 for u in self.users if u.is_active())
        self.inactive_count = self.total_count - self.active_count
        self.last_updated = datetime.now().isoformat()

    def get_active_users(self) -> List[UserModel]:
        """Получить только активных пользователей"""
        return [u for u in self.users if u.is_active()]

    def get_inactive_users(self) -> List[UserModel]:
        """Получить только неактивных пользователей"""
        return [u for u in self.users if not u.is_active()]

    def add_user(self, user: UserModel) -> bool:
        """Добавить пользователя"""
        try:
            # Генерируем новый ID
            if user.id is None:
                max_id = max([u.id for u in self.users]) if self.users else 0
                user.id = max_id + 1

            self.users.append(user)
            self.update_counts()
            return True
        except Exception as e:
            print(f"Ошибка добавления пользователя: {e}")
            return False

    def remove_user(self, user_id: int) -> bool:
        """Удалить пользователя по ID"""
        try:
            self.users = [u for u in self.users if u.id != user_id]
            self.update_counts()
            return True
        except Exception as e:
            print(f"Ошибка удаления пользователя: {e}")
            return False

    def update_user(self, user_id: int, new_data: dict) -> Optional[UserModel]:
        """Обновить пользователя"""
        try:
            for i, user in enumerate(self.users):
                if user.id == user_id:
                    # Обновляем поля
                    for key, value in new_data.items():
                        if hasattr(user, key) and key != 'id':
                            setattr(user, key, value)
                    user.update_timestamp()
                    self.update_counts()
                    return user
            return None
        except Exception as e:
            print(f"Ошибка обновления пользователя: {e}")
            return None

    def get_user_by_id(self, user_id: int) -> Optional[UserModel]:
        """Найти пользователя по ID"""
        for user in self.users:
            if user.id == user_id:
                return user
        return None

    def search_users(self, query: str) -> List[UserModel]:
        """Поиск пользователей по ФИО"""
        query_lower = query.lower()
        return [
            u for u in self.users
            if query_lower in u.get_full_name().lower()
        ]


class UserCreateModel(BaseModel):
    """Модель для создания нового пользователя (без ID)"""
    name: str = Field(..., min_length=1, max_length=50)
    surname: str = Field(..., min_length=1, max_length=50)
    patronymic: str = Field(..., min_length=1, max_length=50)
    status: Literal['Активен', 'Болеет', 'В отпуске'] = 'Активен'

    def to_user_model(self, user_id: int = None) -> UserModel:
        """Преобразование в полную модель пользователя"""
        return UserModel(
            id=user_id,
            name=self.name,
            surname=self.surname,
            patronymic=self.patronymic,
            status=self.status
        )


class UserUpdateModel(BaseModel):
    """Модель для обновления пользователя (все поля опциональны)"""
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    surname: Optional[str] = Field(None, min_length=1, max_length=50)
    patronymic: Optional[str] = Field(None, min_length=1, max_length=50)
    status: Optional[Literal['Активен', 'Болеет', 'В отпуске']] = None

    def apply_to_user(self, user: UserModel) -> UserModel:
        """Применить обновления к существующему пользователю"""
        if self.name is not None:
            user.name = self.name
        if self.surname is not None:
            user.surname = self.surname
        if self.patronymic is not None:
            user.patronymic = self.patronymic
        if self.status is not None:
            user.status = self.status
        user.update_timestamp()
        return user
