const form = document.querySelector("form");
const textarea = document.querySelector("textarea");
const notesList = document.querySelector(".notesList");

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const text = textarea.value.trim();

  if (!text) return;

  const note = document.createElement("div");
  note.className = "note";

  note.innerHTML = `
    <p>${text}</p>
    <button class="edit">Edit</button>
    <button class="delete">Delete</button>
  `;

  notesList.appendChild(note);
  textarea.value = "";

  note.querySelector(".delete").addEventListener("click", () => {
    note.remove();
  });

  note.querySelector(".edit").addEventListener("click", () => {
    textarea.value = note.querySelector("p").textContent;
    note.remove();
    textarea.focus();
  });
});