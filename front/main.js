const { createApp, ref, onMounted, watch, computed, onUnmounted } = Vue;

createApp({
  setup() {
    const activeTab = ref("toaster");
    const adminSubTab = ref("users");
    const activeUsers = ref([]);
    const currentGoal = ref("");
    const inactiveUsers = ref([]);
    const queueUsers = ref([]);
    const currentUser = ref(null);
    let jiraWindow = null;

    // Jira конфиг
    const jiraConfig = ref({
        url: '',
        origin: ''
    });
    const testResult = ref(null);

    // Группы
    const groups = ref([]);
    const groupModalTitle = ref('');
    const groupForm = ref({ id: null, name: '', color: '#667eea' });
    const deleteGroup = ref(null);

    // Для добавления участников в группу
    const selectedGroup = ref(null);
    const memberSearchQuery = ref('');
    const filteredAvailableUsers = ref([]);

    // Для загрузки конфига
    const selectedFile = ref(null);
    const uploadPreview = ref(null);

    // Рулетка - конструктор списка
    const rouletteSelectedGroups = ref([]);
    const rouletteSelectedUsers = ref([]);
    const rouletteWinner = ref(null);
    const rouletteSpinning = ref(false);
    const rollingUsers = ref([]);
    const rollerOffset = ref(0);
    let rollingInterval = null;

    // Для хранения изначального порядка пользователей с фиксированными номерами
    const originalQueueOrder = ref([]);
    const lateUsers = ref(new Set());

    // Группы - новый дизайн
    const allUsersList = computed(() => {
        return [...activeUsers.value, ...inactiveUsers.value];
    });
    const selectedGroupForMembers = ref(null);

    let draggedUser = null;
    let draggedFrom = null;
    let draggedUserForGroup = null;

    // Таймер
    const timerSeconds = ref(0);
    const timerRunning = ref(false);
    let timerStartTime = null;
    let timerAnimationFrame = null;

    const formattedTime = computed(() => {
      const mins = Math.floor(timerSeconds.value / 60);
      const secs = timerSeconds.value % 60;
      return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    });

    const toastType = computed(() => {
      if (timerSeconds.value < 30) return "new";
      if (timerSeconds.value < 60) return "ready";
      return "burnt";
    });

    const toastClass = computed(() => {
      if (timerSeconds.value < 30) return "toast-new";
      if (timerSeconds.value < 60) return "toast-ready";
      return "toast-burnt";
    });

    // Финальный список пользователей для рулетки (объединение выбранных групп и конкретных пользователей)
    const rouletteFinalUsersList = computed(() => {
        const userSet = new Map();

        if (rouletteSelectedGroups.value && rouletteSelectedGroups.value.length > 0) {
            rouletteSelectedGroups.value.forEach(groupId => {
                const groupUsers = activeUsers.value.filter(u => u.groups && u.groups.includes(groupId));
                groupUsers.forEach(u => {
                    if (!userSet.has(u.id)) {
                        userSet.set(u.id, u);
                    }
                });
            });
        }

        if (rouletteSelectedUsers.value && rouletteSelectedUsers.value.length > 0) {
            rouletteSelectedUsers.value.forEach(userId => {
                const user = activeUsers.value.find(u => u.id === userId);
                if (user && !userSet.has(user.id)) {
                    userSet.set(user.id, user);
                }
            });
        }

        return Array.from(userSet.values());
    });

        // Рулетка - drag & drop
    let draggedRouletteUser = null;
    let draggedRouletteGroup = null;

    const dragRouletteUserStart = (event, user) => {
        draggedRouletteUser = user;
        event.dataTransfer.effectAllowed = 'move';
        event.target.style.opacity = '0.5';
    };

    const dragRouletteUserEnd = (event) => {
        event.target.style.opacity = '1';
        draggedRouletteUser = null;
    };

    const dragRouletteGroupStart = (event, group) => {
        draggedRouletteGroup = group;
        event.dataTransfer.effectAllowed = 'move';
        event.target.style.opacity = '0.5';
    };

    const dragRouletteGroupEnd = (event) => {
        event.target.style.opacity = '1';
        draggedRouletteGroup = null;
    };

    const dropToRoulette = async (event) => {
        event.preventDefault();
        const dropZone = event.currentTarget;
        dropZone.classList.remove('drag-over');

        // Добавляем пользователя
        if (draggedRouletteUser) {
            addUserToRoulette(draggedRouletteUser);
            draggedRouletteUser = null;
            return;
        }

        // Добавляем группу
        if (draggedRouletteGroup) {
            addGroupToRoulette(draggedRouletteGroup);
            draggedRouletteGroup = null;
            return;
        }
    };

    const addUserToRoulette = (user) => {
        // Проверяем, есть ли уже пользователь в списке
        const userSet = new Set(rouletteSelectedUsers.value);
        if (!userSet.has(user.id)) {
            rouletteSelectedUsers.value.push(user.id);
        }
    };

    const addGroupToRoulette = (group) => {
        // Проверяем, есть ли уже группа в списке
        const groupSet = new Set(rouletteSelectedGroups.value);
        if (!groupSet.has(group.id)) {
            rouletteSelectedGroups.value.push(group.id);
        }
    };

    const removeUserFromRoulette = (userId) => {
        rouletteSelectedUsers.value = rouletteSelectedUsers.value.filter(id => id !== userId);
    };

    // Выбрать всех пользователей
    const selectAllUsers = computed({
        get: () => {
            return rouletteSelectedUsers.value.length === activeUsers.value.length && activeUsers.value.length > 0;
        },
        set: (val) => {
            if (val) {
                rouletteSelectedUsers.value = activeUsers.value.map(u => u.id);
            } else {
                rouletteSelectedUsers.value = [];
            }
        }
    });

    // Выбрать все группы
    const selectAllGroups = computed({
        get: () => {
            return rouletteSelectedGroups.value.length === groups.value.length && groups.value.length > 0;
        },
        set: (val) => {
            if (val) {
                rouletteSelectedGroups.value = groups.value.map(g => g.id);
            } else {
                rouletteSelectedGroups.value = [];
            }
        }
    });

    // Загрузка Jira конфига
    const loadJiraConfig = async () => {
        try {
            const res = await fetch('/api/config');
            const config = await res.json();
            jiraConfig.value = {
                url: config.url || '',
                origin: config.origin || ''
            };
            initJiraWindow();
        } catch (error) {
            console.error('Ошибка загрузки конфига Jira:', error);
        }
    };

    // Инициализация Jira окна
    const initJiraWindow = () => {
        if (jiraWindow && !jiraWindow.closed) {
            jiraWindow.close();
        }
        if (jiraConfig.value.url) {
            jiraWindow = window.open(jiraConfig.value.url, 'jira');
            setupGoalListener();
        }
    };

    // Настройка слушателя цели спринта
    const setupGoalListener = () => {
        const goalListener = (event) => {
            if (event.origin !== jiraConfig.value.origin) return;
            currentGoal.value = event.data;
        };
        window.addEventListener('message', goalListener);

        const goalTimer = setInterval(() => {
            if (currentGoal.value) {
                clearInterval(goalTimer);
            }
            if (jiraWindow && !jiraWindow.closed) {
                jiraWindow.postMessage({ type: 'getGoal' }, jiraConfig.value.origin);
            }
        }, 1000);
    };

    // Сохранение Jira конфига
    const saveJiraConfig = async () => {
        try {
            const res = await fetch('/api/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: jiraConfig.value.url,
                    origin: jiraConfig.value.origin
                })
            });
            if (res.ok) {
                closeJiraModal();
                initJiraWindow();
                alert('Настройки Jira сохранены!');
            }
        } catch (error) {
            console.error('Ошибка сохранения:', error);
            alert('Ошибка сохранения настроек');
        }
    };

    // Проверка подключения к Jira
    const testJiraConnection = () => {
        if (!jiraConfig.value.url || !jiraConfig.value.origin) {
            testResult.value = { success: false, message: 'Заполните URL и Origin' };
            return;
        }

        const testWindow = window.open(jiraConfig.value.url, 'jira_test');
        if (testWindow) {
            testResult.value = { success: true, message: 'Jira доступна!' };
            setTimeout(() => testWindow.close(), 2000);
        } else {
            testResult.value = { success: false, message: 'Не удалось открыть Jira. Проверьте URL и разрешите всплывающие окна' };
        }
    };

    const openJiraModal = () => {
        document.getElementById('jiraModal').classList.add('show');
    };

    const closeJiraModal = () => {
        document.getElementById('jiraModal').classList.remove('show');
        testResult.value = null;
    };

    // Загрузка групп
    const loadGroups = async () => {
        try {
            const res = await fetch('/api/groups');
            groups.value = await res.json();
        } catch (error) {
            console.error('Ошибка загрузки групп:', error);
        }
    };

    const getGroupName = (groupId) => {
        const group = groups.value.find(g => g.id === groupId);
        return group ? group.name : '';
    };

    const getGroupColor = (groupId) => {
        const group = groups.value.find(g => g.id === groupId);
        return group ? group.color : '#6c757d';
    };

    // Получить пользователей группы
    const getGroupUsers = (groupId) => {
        return [...activeUsers.value, ...inactiveUsers.value].filter(user =>
            user.groups && user.groups.includes(groupId)
        );
    };

    // Получить пользователей не входящих в группу
    const getAvailableUsersForGroup = (groupId) => {
        return [...activeUsers.value, ...inactiveUsers.value].filter(user =>
            !user.groups || !user.groups.includes(groupId)
        );
    };

    // Фильтрация пользователей для добавления в группу
    const filterUsersForGroup = () => {
        const available = getAvailableUsersForGroup(selectedGroup.value?.id);
        if (!memberSearchQuery.value) {
            filteredAvailableUsers.value = available;
        } else {
            const query = memberSearchQuery.value.toLowerCase();
            filteredAvailableUsers.value = available.filter(user =>
                user.surname.toLowerCase().includes(query) ||
                user.name.toLowerCase().includes(query) ||
                (user.patronymic && user.patronymic.toLowerCase().includes(query))
            );
        }
    };

    // Открыть модалку добавления участника
    const openAddMemberModal = (group) => {
        selectedGroup.value = group;
        memberSearchQuery.value = '';
        filteredAvailableUsers.value = getAvailableUsersForGroup(group.id);
        document.getElementById('addMemberModal').classList.add('show');
    };

    // Закрыть модалку добавления участника
    const closeAddMemberModal = () => {
        selectedGroup.value = null;
        memberSearchQuery.value = '';
        filteredAvailableUsers.value = [];
        document.getElementById('addMemberModal').classList.remove('show');
    };

    // Добавить пользователя в группу
    const addUserToGroup = async (user) => {
        if (!selectedGroup.value) return;

        if (!user.groups) user.groups = [];
        if (!user.groups.includes(selectedGroup.value.id)) {
            user.groups.push(selectedGroup.value.id);

            const activeIndex = activeUsers.value.findIndex(u => u.id === user.id);
            if (activeIndex !== -1) {
                activeUsers.value[activeIndex] = { ...user };
            } else {
                const inactiveIndex = inactiveUsers.value.findIndex(u => u.id === user.id);
                if (inactiveIndex !== -1) {
                    inactiveUsers.value[inactiveIndex] = { ...user };
                }
            }

            await saveToBackend();
            filteredAvailableUsers.value = getAvailableUsersForGroup(selectedGroup.value.id);
        }
    };

    // Удалить пользователя из группы
    const removeUserFromGroup = async (user, groupId) => {
        if (user.groups && user.groups.includes(groupId)) {
            user.groups = user.groups.filter(g => g !== groupId);

            const activeIndex = activeUsers.value.findIndex(u => u.id === user.id);
            if (activeIndex !== -1) {
                activeUsers.value[activeIndex] = { ...user };
            } else {
                const inactiveIndex = inactiveUsers.value.findIndex(u => u.id === user.id);
                if (inactiveIndex !== -1) {
                    inactiveUsers.value[inactiveIndex] = { ...user };
                }
            }

            await saveToBackend();
        }
    };

    // Модалки групп
    const openAddGroupModal = () => {
        groupModalTitle.value = 'Добавить группу';
        groupForm.value = { id: null, name: '', color: '#667eea' };
        document.getElementById('groupModal').classList.add('show');
    };

    const openEditGroupModal = (group) => {
        groupModalTitle.value = 'Редактировать группу';
        groupForm.value = { ...group };
        document.getElementById('groupModal').classList.add('show');
    };

    const closeGroupModal = () => {
        document.getElementById('groupModal').classList.remove('show');
    };

    const saveGroup = async () => {
        if (!groupForm.value.name) {
            alert('Введите название группы');
            return;
        }

        try {
            if (!groupForm.value.id) {
                const existingGroup = groups.value.find(g => g.name.toLowerCase() === groupForm.value.name.toLowerCase());
                if (existingGroup) {
                    alert('Группа с таким названием уже существует!');
                    return;
                }
            }

            const method = groupForm.value.id ? 'PUT' : 'POST';
            const url = groupForm.value.id ? `/api/groups/${groupForm.value.id}` : '/api/groups';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: groupForm.value.name,
                    color: groupForm.value.color
                })
            });

            if (res.ok) {
                closeGroupModal();
                await loadGroups();
                await loadUsers();
                alert('Группа сохранена!');
            } else {
                const error = await res.json();
                alert('Ошибка при сохранении группы: ' + (error.message || 'Неизвестная ошибка'));
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при сохранении группы');
        }
    };

    const openDeleteGroupModal = (group) => {
        deleteGroup.value = group;
        document.getElementById('deleteGroupModal').classList.add('show');
    };

    const closeDeleteGroupModal = () => {
        deleteGroup.value = null;
        document.getElementById('deleteGroupModal').classList.remove('show');
    };

    const confirmDeleteGroup = async () => {
        if (!deleteGroup.value) return;

        try {
            const usersRes = await fetch("/api/users");
            const currentUsers = await usersRes.json();

            const updatedUsers = currentUsers.map(user => {
                if (user.groups && user.groups.includes(deleteGroup.value.id)) {
                    return {
                        ...user,
                        groups: user.groups.filter(g => g !== deleteGroup.value.id)
                    };
                }
                return user;
            });

            const saveUsersRes = await fetch("/api/users", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updatedUsers)
            });

            if (!saveUsersRes.ok) {
                throw new Error('Ошибка при обновлении пользователей');
            }

            const deleteGroupRes = await fetch(`/api/groups/${deleteGroup.value.id}`, {
                method: 'DELETE'
            });

            if (deleteGroupRes.ok) {
                closeDeleteGroupModal();
                await loadGroups();
                await loadUsers();
                alert('Группа удалена!');
            } else {
                throw new Error('Ошибка при удалении группы');
            }
        } catch (error) {
            console.error('Ошибка:', error);
            alert('Ошибка при удалении группы: ' + error.message);
        }
    };

    // Очистка выбора в рулетке
    const clearRouletteSelection = () => {
        rouletteSelectedGroups.value = [];
        rouletteSelectedUsers.value = [];
    };

    // Функции для toggle
    const toggleAllUsers = () => {
        if (selectAllUsers.value) {
            rouletteSelectedUsers.value = activeUsers.value.map(u => u.id);
        } else {
            rouletteSelectedUsers.value = [];
        }
    };

    const toggleAllGroups = () => {
        if (selectAllGroups.value) {
            rouletteSelectedGroups.value = groups.value.map(g => g.id);
        } else {
            rouletteSelectedGroups.value = [];
        }
    };

    // Функция вращения рулетки с анимацией
    const spinRoulette = () => {
        if (rouletteFinalUsersList.value.length === 0) return;

        rouletteSpinning.value = true;
        rouletteWinner.value = null;

        const usersList = [...rouletteFinalUsersList.value];
        const repeatCount = 5;
        rollingUsers.value = [];
        for (let i = 0; i < repeatCount; i++) {
            rollingUsers.value.push(...usersList);
        }

        let currentPosition = 0;
        const itemHeight = 60;
        const totalHeight = rollingUsers.value.length * itemHeight;
        const targetPosition = (rollingUsers.value.length - usersList.length) * itemHeight;

        if (rollingInterval) clearInterval(rollingInterval);

        rollingInterval = setInterval(() => {
            currentPosition += itemHeight / 2;
            if (currentPosition >= totalHeight) {
                currentPosition = targetPosition;
            }
            rollerOffset.value = currentPosition;
        }, 30);

        setTimeout(() => {
            if (rollingInterval) {
                clearInterval(rollingInterval);
                rollingInterval = null;
            }

            const randomIndex = Math.floor(Math.random() * rouletteFinalUsersList.value.length);
            rouletteWinner.value = rouletteFinalUsersList.value[randomIndex];

            const winnerPosition = randomIndex * itemHeight;
            rollerOffset.value = winnerPosition;

            setTimeout(() => {
                rouletteSpinning.value = false;
            }, 200);
        }, 2500);
    };

    // Сброс рулетки
    const resetRoulette = () => {
        rouletteWinner.value = null;
        rouletteSpinning.value = false;
        if (rollingInterval) {
            clearInterval(rollingInterval);
            rollingInterval = null;
        }
        rollerOffset.value = 0;
    };

    // Группы - выбор группы и добавление пользователя
    const selectGroup = (group) => {
        selectedGroupForMembers.value = group;
    };

    const selectUserForGroup = async (user) => {
        if (!selectedGroupForMembers.value) {
            alert('Сначала выберите группу (нажмите на группу справа)');
            return;
        }

        if (!user.groups) user.groups = [];
        if (!user.groups.includes(selectedGroupForMembers.value.id)) {
            user.groups.push(selectedGroupForMembers.value.id);

            const activeIndex = activeUsers.value.findIndex(u => u.id === user.id);
            if (activeIndex !== -1) {
                activeUsers.value[activeIndex] = { ...user };
            } else {
                const inactiveIndex = inactiveUsers.value.findIndex(u => u.id === user.id);
                if (inactiveIndex !== -1) {
                    inactiveUsers.value[inactiveIndex] = { ...user };
                }
            }

            await saveToBackend();
        }
    };

    const dragUserStart = (event, user) => {
        draggedUserForGroup = user;
        event.dataTransfer.effectAllowed = 'move';
        event.target.style.opacity = '0.5';
    };

    const dragUserEnd = (event) => {
        event.target.style.opacity = '1';
        draggedUserForGroup = null;
    };

    const dropUserToGroup = async (event) => {
        event.preventDefault();
        if (!draggedUserForGroup) {
            return;
        }
        if (!selectedGroupForMembers.value) {
            alert('Сначала выберите группу (нажмите на группу справа)');
            return;
        }

        const user = draggedUserForGroup;

        if (!user.groups) user.groups = [];
        if (!user.groups.includes(selectedGroupForMembers.value.id)) {
            user.groups.push(selectedGroupForMembers.value.id);

            const activeIndex = activeUsers.value.findIndex(u => u.id === user.id);
            if (activeIndex !== -1) {
                activeUsers.value[activeIndex] = { ...user };
            } else {
                const inactiveIndex = inactiveUsers.value.findIndex(u => u.id === user.id);
                if (inactiveIndex !== -1) {
                    inactiveUsers.value[inactiveIndex] = { ...user };
                }
            }

            await saveToBackend();
        }
        draggedUserForGroup = null;
    };

    const updateTimer = () => {
      if (!timerRunning.value) return;
      if (timerStartTime) {
        const now = Date.now();
        const elapsed = Math.floor((now - timerStartTime) / 1000);
        timerSeconds.value = elapsed;
      }
      timerAnimationFrame = requestAnimationFrame(updateTimer);
    };

    const startTimer = () => {
      if (timerRunning.value) return;
      timerStartTime = Date.now() - (timerSeconds.value * 1000);
      timerRunning.value = true;
      timerAnimationFrame = requestAnimationFrame(updateTimer);
      if (currentUser.value && jiraWindow && !jiraWindow.closed) {
        jiraWindow.postMessage(
          `${currentUser.value.surname} ${currentUser.value.name}`,
          jiraConfig.value.origin
        );
      }
    };

    const pauseTimer = () => {
      if (!timerRunning.value) return;
      timerRunning.value = false;
      if (timerAnimationFrame) {
        cancelAnimationFrame(timerAnimationFrame);
        timerAnimationFrame = null;
      }
      if (timerStartTime) {
        const now = Date.now();
        const elapsed = Math.floor((now - timerStartTime) / 1000);
        timerSeconds.value = elapsed;
        timerStartTime = null;
      }
    };

    const resetTimer = () => {
      pauseTimer();
      timerSeconds.value = 0;
      timerStartTime = null;
    };

    const resetAndStartTimer = () => {
      resetTimer();
      startTimer();
    };

    const resetTimerOnly = () => {
      resetTimer();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && timerRunning.value && timerStartTime) {
        const now = Date.now();
        const elapsed = Math.floor((now - timerStartTime) / 1000);
        timerSeconds.value = elapsed;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Для модалок пользователей
    const modalTitle = ref("");
    const form = ref({
      surname: "",
      name: "",
      patronymic: "",
      status: "Активен",
      groups: []
    });
    let editingUserId = null;
    const deleteUser = ref(null);

    // Инициализация очереди с фиксированными номерами (без запуска таймера)
    const initQueue = () => {
        originalQueueOrder.value = activeUsers.value.map((user, index) => ({
            ...user,
            fixedNumber: index + 1
        }));

        queueUsers.value = originalQueueOrder.value.map(u => ({ ...u }));

        if (queueUsers.value.length > 0) {
            currentUser.value = queueUsers.value[0];
            resetTimerOnly();
        } else {
            currentUser.value = null;
            resetTimer();
        }
    };

    const loadUsers = async () => {
      const res = await fetch("/api/users");
      const users = await res.json();
      activeUsers.value = users.filter((u) => u.status === "Активен");
      inactiveUsers.value = users.filter((u) => u.status !== "Активен");

      initQueue();
    };

    const downloadConfig = async () => {
    try {
        // Получаем всех пользователей
        const usersResponse = await fetch("/api/users");
        const users = await usersResponse.json();

        // Получаем группы
        const groupsResponse = await fetch("/api/groups");
        const groupsData = await groupsResponse.json();

        // Получаем Jira конфиг
        const jiraResponse = await fetch("/api/config");
        const jiraData = await jiraResponse.json();

        // Формируем полный YAML контент
        let yamlContent = "# AXIOMA Daily Toaster Configuration\n";
        yamlContent += "# Users, Groups and Jira settings\n\n";

        // Группы
        yamlContent += "groups:\n";
        groupsData.forEach(group => {
            yamlContent += `  - id: ${group.id}\n`;
            yamlContent += `    name: "${group.name}"\n`;
            yamlContent += `    color: "${group.color}"\n`;
        });

        yamlContent += "\n";

        // Jira
        yamlContent += "jira:\n";
        yamlContent += `  url: "${jiraData.url || ''}"\n`;
        yamlContent += `  origin: "${jiraData.origin || ''}"\n`;

        yamlContent += "\n";

        // Пользователи
        yamlContent += "users:\n";
        users.forEach(user => {
            yamlContent += `  - surname: ${user.surname}\n`;
            yamlContent += `    name: ${user.name}\n`;
            yamlContent += `    patronymic: ${user.patronymic || ''}\n`;
            yamlContent += `    status: ${user.status}\n`;
            yamlContent += `    groups: ${JSON.stringify(user.groups || [])}\n`;
        });

        // Создаем и скачиваем файл
        const blob = new Blob([yamlContent], { type: "text/yaml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "config.yaml";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert("Конфигурация успешно скачана!");
    } catch (error) {
        console.error("Download error:", error);
        alert("Ошибка при скачивании конфига: " + error.message);
    }
    };

    const openUploadModal = () => {
      selectedFile.value = null;
      uploadPreview.value = null;
      const modal = document.getElementById("uploadModal");
      if (modal) modal.style.display = "flex";
    };

    const closeUploadModal = () => {
      const modal = document.getElementById("uploadModal");
      if (modal) modal.style.display = "none";
      selectedFile.value = null;
      uploadPreview.value = null;
      const fileInput = document.getElementById("configFile");
      if (fileInput) fileInput.value = "";
    };

    const handleFileSelect = (event) => {
      const file = event.target.files[0];
      if (!file) return;
      selectedFile.value = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        uploadPreview.value = e.target.result;
      };
      reader.readAsText(file);
    };

    const uploadConfig = async () => {
      if (!selectedFile.value) {
        alert('Пожалуйста, выберите файл');
        return;
      }
      try {
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = (e) => reject(e);
          reader.readAsText(selectedFile.value);
        });
        let data;
        if (typeof jsyaml !== 'undefined') {
          data = jsyaml.load(content);
        } else {
          throw new Error('js-yaml library not loaded');
        }
        const users = data.users || data;
        if (!Array.isArray(users)) {
          alert('Неверный формат: ожидается массив users');
          return;
        }
        const normalizedUsers = users.map((u, idx) => ({
          id: Date.now() + idx,
          surname: u.surname || '',
          name: u.name || '',
          patronymic: u.patronymic || '',
          status: u.status === 'Активен' ? 'Активен' : (u.status || 'Активен'),
          groups: u.groups || []
        }));
        const response = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(normalizedUsers)
        });
        if (response.ok) {
          alert(`Загружено ${normalizedUsers.length} пользователей`);
          closeUploadModal();
          await loadUsers();
        } else {
          alert('Ошибка при сохранении конфигурации');
        }
      } catch (error) {
        console.error('Upload error:', error);
        alert('Ошибка загрузки: ' + error.message);
      }
    };

    const updateToasterQueue = (shouldStartTimer = true) => {
      if (queueUsers.value.length === 0 && activeUsers.value.length > 0) {
        shuffleUsers(shouldStartTimer);
      } else if (activeUsers.value.length === 0) {
        queueUsers.value = [];
        currentUser.value = null;
        resetTimer();
      } else {
        const currentActiveIds = new Set(activeUsers.value.map((u) => u.id));
        const queueIds = new Set(queueUsers.value.map((u) => u.id));
        queueUsers.value = queueUsers.value.filter((u) => currentActiveIds.has(u.id));
        const newActiveUsers = activeUsers.value.filter((u) => !queueIds.has(u.id));
        if (newActiveUsers.length > 0) {
          for (let i = newActiveUsers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newActiveUsers[i], newActiveUsers[j]] = [newActiveUsers[j], newActiveUsers[i]];
          }
          queueUsers.value.push(...newActiveUsers);
        }
        if (currentUser.value && !currentActiveIds.has(currentUser.value.id)) {
          currentUser.value = queueUsers.value[0] || null;
          if (currentUser.value && shouldStartTimer) {
            resetAndStartTimer();
          }
        }
      }
    };

    const shuffleUsers = (shouldStartTimer = true) => {
      if (originalQueueOrder.value.length === 0) {
        originalQueueOrder.value = activeUsers.value.map((user, index) => ({
            ...user,
            fixedNumber: index + 1
        }));
      }

      queueUsers.value = originalQueueOrder.value.map(u => ({ ...u }));

      for (let i = queueUsers.value.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queueUsers.value[i], queueUsers.value[j]] = [queueUsers.value[j], queueUsers.value[i]];
      }
      if (queueUsers.value.length > 0) {
        currentUser.value = queueUsers.value[0];
        if (shouldStartTimer) {
          resetAndStartTimer();
        } else {
          resetTimerOnly();
        }
      } else {
        currentUser.value = null;
        resetTimer();
      }
    };

    const resetToOriginalOrder = () => {
      if (originalQueueOrder.value.length > 0) {
        queueUsers.value = originalQueueOrder.value.map(u => ({ ...u }));
        lateUsers.value.clear();
        if (queueUsers.value.length > 0) {
          currentUser.value = queueUsers.value[0];
          resetAndStartTimer();
        }
      }
    };

    const nextUser = () => {
      if (queueUsers.value.length === 0) return;

      const currentIndex = queueUsers.value.findIndex((u) => u.id === currentUser.value.id);
      if (currentIndex !== -1) {
        if (lateUsers.value.has(currentUser.value.id)) {
          lateUsers.value.delete(currentUser.value.id);
        }
        queueUsers.value.splice(currentIndex, 1);
      }

      if (queueUsers.value.length > 0) {
        currentUser.value = queueUsers.value[0];
        resetAndStartTimer();
      } else {
        currentUser.value = null;
        resetTimer();
      }
    };

    const markLate = () => {
      if (!currentUser.value) return;
      const currentIndex = queueUsers.value.findIndex((u) => u.id === currentUser.value.id);
      if (currentIndex !== -1) {
        const lateUser = queueUsers.value.splice(currentIndex, 1)[0];
        queueUsers.value.push(lateUser);
        lateUsers.value.add(lateUser.id);
        currentUser.value = queueUsers.value[0];
        resetAndStartTimer();
      }
    };

    const selectUser = (user) => {
      currentUser.value = user;
      resetAndStartTimer();
    };

    watch(activeUsers, () => {
      updateToasterQueue(true);
    }, { deep: true });

    const saveToBackend = async () => {
      const all = [...activeUsers.value, ...inactiveUsers.value];
      await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(all),
      });
    };

    const changeStatus = (user, newStatus) => {
      const oldStatus = user.status;
      user.status = newStatus;
      if (oldStatus === "Активен" && (newStatus === "В отпуске" || newStatus === "Болеет")) {
        const index = activeUsers.value.findIndex((u) => u.id === user.id);
        if (index !== -1) {
          activeUsers.value.splice(index, 1);
          inactiveUsers.value.push(user);
        }
      } else if ((oldStatus === "В отпуске" || oldStatus === "Болеет") && newStatus === "Активен") {
        const index = inactiveUsers.value.findIndex((u) => u.id === user.id);
        if (index !== -1) {
          inactiveUsers.value.splice(index, 1);
          activeUsers.value.push(user);
        }
      }
      saveToBackend();
    };

    const openAddModal = () => {
      modalTitle.value = "Добавить пользователя";
      form.value = { surname: "", name: "", patronymic: "", status: "Активен", groups: [] };
      editingUserId = null;
      document.getElementById("userModal").classList.add("show");
    };

    const openEditModal = (user) => {
      modalTitle.value = "Редактировать пользователя";
      form.value = {
        surname: user.surname || "",
        name: user.name || "",
        patronymic: user.patronymic || "",
        status: user.status || "Активен",
        groups: user.groups ? [...user.groups] : []
      };
      editingUserId = user.id;
      document.getElementById("userModal").classList.add("show");
    };

    const saveUser = () => {
      if (!form.value.surname || !form.value.name) {
        alert("Заполните все поля");
        return;
      }
      if (editingUserId === null) {
        const newUser = { id: Date.now(), ...form.value };
        if (newUser.status === "Активен") {
          activeUsers.value.push(newUser);
        } else {
          inactiveUsers.value.push(newUser);
        }
      } else {
        let found = false;
        let index = activeUsers.value.findIndex((u) => u.id === editingUserId);
        if (index !== -1) {
          const oldStatus = activeUsers.value[index].status;
          activeUsers.value[index] = { ...form.value, id: editingUserId };
          found = true;
          if (oldStatus !== form.value.status) {
            const movedUser = activeUsers.value[index];
            activeUsers.value.splice(index, 1);
            if (form.value.status === "Активен") {
              activeUsers.value.push(movedUser);
            } else {
              inactiveUsers.value.push(movedUser);
            }
          }
        }
        if (!found) {
          index = inactiveUsers.value.findIndex((u) => u.id === editingUserId);
          if (index !== -1) {
            const oldStatus = inactiveUsers.value[index].status;
            inactiveUsers.value[index] = { ...form.value, id: editingUserId };
            if (oldStatus !== form.value.status) {
              const movedUser = inactiveUsers.value[index];
              inactiveUsers.value.splice(index, 1);
              if (form.value.status === "Активен") {
                activeUsers.value.push(movedUser);
              } else {
                inactiveUsers.value.push(movedUser);
              }
            }
          }
        }
      }
      closeModal();
      saveToBackend();
    };

    const closeModal = () => {
      document.getElementById("userModal").classList.remove("show");
    };

    const openDeleteModal = (user) => {
      deleteUser.value = user;
      document.getElementById("deleteModal").classList.add("show");
    };

    const closeDeleteModal = () => {
      deleteUser.value = null;
      document.getElementById("deleteModal").classList.remove("show");
    };

    const confirmDelete = () => {
      if (deleteUser.value) {
        let index = activeUsers.value.findIndex((u) => u.id === deleteUser.value.id);
        if (index !== -1) activeUsers.value.splice(index, 1);
        index = inactiveUsers.value.findIndex((u) => u.id === deleteUser.value.id);
        if (index !== -1) inactiveUsers.value.splice(index, 1);
      }
      closeDeleteModal();
      saveToBackend();
    };

    const onDragStart = (event, user, from) => {
      draggedUser = user;
      draggedFrom = from;
      event.dataTransfer.effectAllowed = "move";
      event.target.style.opacity = "0.5";
    };

    const onDragEnd = (event) => {
      event.target.style.opacity = "1";
      draggedUser = null;
      draggedFrom = null;
      document.querySelectorAll(".users-list").forEach((el) => {
        el.classList.remove("drag-over");
      });
    };

    const onDragOver = (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      event.currentTarget.classList.add("drag-over");
    };

    const onDrop = (event, to) => {
      event.preventDefault();
      document.querySelectorAll(".users-list").forEach((el) => {
        el.classList.remove("drag-over");
      });
      if (!draggedUser) return;
      if (draggedFrom === "active") {
        const index = activeUsers.value.findIndex((u) => u.id === draggedUser.id);
        if (index !== -1) activeUsers.value.splice(index, 1);
      } else {
        const index = inactiveUsers.value.findIndex((u) => u.id === draggedUser.id);
        if (index !== -1) inactiveUsers.value.splice(index, 1);
      }
      if (to === "active") {
        draggedUser.status = "Активен";
        activeUsers.value.push(draggedUser);
      } else {
        if (draggedUser.status === "Активен") {
          draggedUser.status = "В отпуске";
        }
        inactiveUsers.value.push(draggedUser);
      }
      draggedUser = null;
      draggedFrom = null;
      saveToBackend();
    };

    onMounted(() => {
      loadUsers();
      loadJiraConfig();
      loadGroups();
    });

    onUnmounted(() => {
      if (timerAnimationFrame) {
        cancelAnimationFrame(timerAnimationFrame);
      }
      if (rollingInterval) {
        clearInterval(rollingInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    });

    return {
      activeTab,
      adminSubTab,
      activeUsers,
      inactiveUsers,
      queueUsers,
      currentUser,
      currentGoal,
      modalTitle,
      form,
      deleteUser,
      timerSeconds,
      timerRunning,
      formattedTime,
      toastType,
      toastClass,
      startTimer,
      pauseTimer,
      resetTimer,
      resetAndStartTimer,
      resetTimerOnly,
      shuffleUsers,
      nextUser,
      markLate,
      selectUser,
      changeStatus,
      openAddModal,
      openEditModal,
      saveUser,
      closeModal,
      openDeleteModal,
      closeDeleteModal,
      confirmDelete,
      onDragStart,
      onDragEnd,
      onDragOver,
      onDrop,
      downloadConfig,
      openUploadModal,
      closeUploadModal,
      handleFileSelect,
      uploadConfig,
      selectedFile,
      uploadPreview,
      // Jira
      jiraConfig,
      testResult,
      openJiraModal,
      closeJiraModal,
      saveJiraConfig,
      testJiraConnection,
      // Groups
      groups,
      groupModalTitle,
      groupForm,
      deleteGroup,
      selectedGroup,
      memberSearchQuery,
      filteredAvailableUsers,
      getGroupName,
      getGroupColor,
      getGroupUsers,
      openAddGroupModal,
      openEditGroupModal,
      closeGroupModal,
      saveGroup,
      openDeleteGroupModal,
      closeDeleteGroupModal,
      confirmDeleteGroup,
      openAddMemberModal,
      closeAddMemberModal,
      addUserToGroup,
      removeUserFromGroup,
      filterUsersForGroup,
      // Рулетка
      rouletteSelectedGroups,
      rouletteSelectedUsers,
      rouletteWinner,
      rouletteSpinning,
      rouletteFinalUsersList,
      rollingUsers,
      rollerOffset,
      spinRoulette,
      resetRoulette,
      clearRouletteSelection,
      selectAllUsers,
      selectAllGroups,
      toggleAllUsers,
      toggleAllGroups,
      // Тостера
      originalQueueOrder,
      lateUsers,
      resetToOriginalOrder,
      // Группы - новый дизайн
      allUsersList,
      selectedGroupForMembers,
      selectGroup,
      selectUserForGroup,
      dragUserStart,
      dragUserEnd,
      dropUserToGroup,
      dragRouletteUserStart,
      dragRouletteUserEnd,
      dragRouletteGroupStart,
      dragRouletteGroupEnd,
      dropToRoulette,
      addUserToRoulette,
      addGroupToRoulette,
      removeUserFromRoulette
    };
  },
}).mount("#app");