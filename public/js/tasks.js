const form = document.querySelector("#taskForm");
const input = document.querySelector("#taskInput");
const taskList = document.querySelector("#taskList");

let tasks = JSON.parse(localStorage.getItem("tasks")) || [];

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

function showTasks() {
  taskList.innerHTML = "";

  tasks.forEach((task, index) => {
    const div = document.createElement("div");
    div.className = "task";

    const text = document.createElement("span");
    text.textContent = task;

    const buttons = document.createElement("div");

    const edit = document.createElement("button");
    edit.textContent = "Edit";
    edit.className = "edit";

    const del = document.createElement("button");
    del.textContent = "Delete";
    del.className = "delete";

    edit.onclick = () => {
      const box = document.createElement("input");
      box.value = tasks[index];
      box.maxLength = 50;

      const save = document.createElement("button");
      save.textContent = "Save";

      div.replaceChild(box, text);
      buttons.replaceChild(save, edit);

      box.focus();

      save.onclick = () => {
        const newTask = box.value.trim();

        if (!newTask) return;

        tasks[index] = newTask;
        saveTasks();
        showTasks();
      };
    };

    del.onclick = () => {
      tasks.splice(index, 1);
      saveTasks();
      showTasks();
    };

    buttons.append(edit, del);
    div.append(text, buttons);
    taskList.appendChild(div);
  });
}

form.onsubmit = (e) => {
  e.preventDefault();

  const task = input.value.trim();

  if (!task) return;

  tasks.push(task);
  saveTasks();
  showTasks();

  input.value = "";
};

showTasks();