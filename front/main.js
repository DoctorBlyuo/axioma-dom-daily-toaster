const { createApp, ref, onMounted, watch, computed, onUnmounted } = Vue;

createApp({
  data() {},
  setup() {
    const activeTab = ref("toaster");
    const activeUsers = ref([]);
    const currentGoal = ref("");
    const inactiveUsers = ref([]);
    const queueUsers = ref([]);
    const currentUser = ref(null);

    // Для загрузки конфига
    const selectedFile = ref(null);
    const uploadPreview = ref(null);

    const jiraWindow = window.open(
      "https://oneproject.it-one.ru/jira/secure/RapidBoard.jspa?rapidView=327",
      "jira"
    );
    const goalListener = (event) => {
      if (event.origin !== "https://oneproject.it-one.ru") {
        return;
      }
      currentGoal.value = event.data;
    };
    window.addEventListener("message", goalListener);
    const goalTimer = setInterval(() => {
      if (currentGoal.value) {
        clearInterval(goalTimer);
      }

      jiraWindow.postMessage(
        { type: "getGoal" },
        "https://oneproject.it-one.ru"
      );
    }, 1000);

    let draggedUser = null;
    let draggedFrom = null;

    // Таймер
    const timerSeconds = ref(0);
    const timerRunning = ref(false);
    let timerInterval = null;

    const formattedTime = computed(() => {
      const mins = Math.floor(timerSeconds.value / 60);
      const secs = timerSeconds.value % 60;
      return `${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
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

    const startTimer = () => {
      if (timerRunning.value) return;
      timerRunning.value = true;
      timerInterval = setInterval(() => {
        timerSeconds.value++;
      }, 1000);
    };

    const pauseTimer = () => {
      if (!timerRunning.value) return;
      timerRunning.value = false;
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
    };

    const resetTimer = () => {
      pauseTimer();
      timerSeconds.value = 0;
    };

    const resetAndStartTimer = () => {
      resetTimer();
      startTimer();
    };

    const resetTimerOnly = () => {
      resetTimer();
    };

    // Для модалок
    const modalTitle = ref("");
    const form = ref({
      surname: "",
      name: "",
      patronymic: "",
      status: "Активен",
    });
    let editingUserId = null;
    const deleteUser = ref(null);

    const loadUsers = async () => {
      const res = await fetch("/api/users");
      const users = await res.json();
      activeUsers.value = users.filter((u) => u.status === "Активен");
      inactiveUsers.value = users.filter((u) => u.status !== "Активен");

      shuffleUsers(false);
    };

    // Функция для скачивания конфига
    const downloadConfig = async () => {
      try {
        const response = await fetch("/api/users");
        const users = await response.json();

        let yamlContent = "users:\n";
        users.forEach(user => {
          yamlContent += `  - surname: ${user.surname}\n`;
          yamlContent += `    name: ${user.name}\n`;
          yamlContent += `    patronymic: ${user.patronymic || ''}\n`;
          yamlContent += `    status: ${user.status}\n`;
        });

        const blob = new Blob([yamlContent], { type: "text/yaml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "config.yaml";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Download error:", error);
        alert("Ошибка при скачивании конфига");
      }
    };

    // Функции для загрузки конфига
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

        // Используем js-yaml для парсинга
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

        // Нормализуем данные
        const normalizedUsers = users.map((u, idx) => ({
          id: Date.now() + idx,
          surname: u.surname || '',
          name: u.name || '',
          patronymic: u.patronymic || '',
          status: u.status === 'Активен' ? 'Активен' : (u.status || 'Активен')
        }));

        const response = await fetch('/api/users', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
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

        queueUsers.value = queueUsers.value.filter((u) =>
          currentActiveIds.has(u.id)
        );

        const newActiveUsers = activeUsers.value.filter(
          (u) => !queueIds.has(u.id)
        );
        if (newActiveUsers.length > 0) {
          for (let i = newActiveUsers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [newActiveUsers[i], newActiveUsers[j]] = [
              newActiveUsers[j],
              newActiveUsers[i],
            ];
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
      queueUsers.value = [...activeUsers.value];
      for (let i = queueUsers.value.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [queueUsers.value[i], queueUsers.value[j]] = [
          queueUsers.value[j],
          queueUsers.value[i],
        ];
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

    const nextUser = () => {
      if (queueUsers.value.length === 0) return;

      const currentIndex = queueUsers.value.findIndex(
        (u) => u.id === currentUser.value.id
      );

      if (currentIndex !== -1) {
        queueUsers.value.splice(currentIndex, 1);
      }

      if (queueUsers.value.length > 0) {
        currentUser.value = queueUsers.value[0];
        jiraWindow?.postMessage(
          `${currentUser.value.surname} ${currentUser.value.name}`,
          "https://oneproject.it-one.ru"
        );
        resetAndStartTimer();
      } else {
        currentUser.value = null;
        resetTimer();
      }
    };

    const markLate = () => {
      if (!currentUser.value) return;
      const currentIndex = queueUsers.value.findIndex(
        (u) => u.id === currentUser.value.id
      );
      if (currentIndex !== -1) {
        const lateUser = queueUsers.value.splice(currentIndex, 1)[0];
        queueUsers.value.push(lateUser);
        currentUser.value = queueUsers.value[0];
        resetAndStartTimer();
      }
    };

    const selectUser = (user) => {
      currentUser.value = user;
      resetAndStartTimer();
      jiraWindow?.postMessage(
          `${currentUser.value.surname} ${currentUser.value.name}`,
          "https://oneproject.it-one.ru"
        );
    };

    watch(
      activeUsers,
      () => {
        updateToasterQueue(true);
      },
      { deep: true }
    );

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

      if (
        oldStatus === "Активен" &&
        (newStatus === "В отпуске" || newStatus === "Болеет")
      ) {
        const index = activeUsers.value.findIndex((u) => u.id === user.id);
        if (index !== -1) {
          activeUsers.value.splice(index, 1);
          inactiveUsers.value.push(user);
        }
      } else if (
        (oldStatus === "В отпуске" || oldStatus === "Болеет") &&
        newStatus === "Активен"
      ) {
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
      form.value = { surname: "", name: "", patronymic: "", status: "Активен" };
      editingUserId = null;
      document.getElementById("userModal").classList.add("show");
    };

    const openEditModal = (user) => {
      modalTitle.value = "Редактировать пользователя";
      form.value = { ...user };
      editingUserId = user.id;
      document.getElementById("userModal").classList.add("show");
    };

    const saveUser = () => {
      if (!form.value.surname || !form.value.name) {
        alert("Заполните все поля");
        return;
      }

      if (editingUserId === null) {
        const newUser = {
          id: Date.now(),
          ...form.value,
        };

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
        let index = activeUsers.value.findIndex(
          (u) => u.id === deleteUser.value.id
        );
        if (index !== -1) {
          activeUsers.value.splice(index, 1);
        }

        index = inactiveUsers.value.findIndex(
          (u) => u.id === deleteUser.value.id
        );
        if (index !== -1) {
          inactiveUsers.value.splice(index, 1);
        }
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
        const index = activeUsers.value.findIndex(
          (u) => u.id === draggedUser.id
        );
        if (index !== -1) activeUsers.value.splice(index, 1);
      } else {
        const index = inactiveUsers.value.findIndex(
          (u) => u.id === draggedUser.id
        );
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
    });

    onUnmounted(() => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    });

    return {
      activeTab,
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
    };
  },
}).mount("#app");