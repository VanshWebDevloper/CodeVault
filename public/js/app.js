var apps = document.querySelectorAll(".app");

apps.forEach(function (app) {
  app.addEventListener("click", function () 
  {
    openApp(app);
  });
});

function openApp(app) {
  var type = app.getAttribute("data-type");
  var url = app.getAttribute("data-url");

  if (type === "link" && url) {
    window.location.href = url;
  }
  // type "none" apps do nothing yet
}

// taskbar shortcuts open the same app tile by name
var taskbarIcons = document.querySelectorAll(".taskbar-apps img");

taskbarIcons.forEach(function (icon) {
  icon.addEventListener("click", function () {
    var targetName = icon.getAttribute("data-target");
    var match = findAppByName(targetName);
    if (match) {
      openApp(match);
    }
  });
});

function findAppByName(name) {
  for (var i = 0; i < apps.length; i++) {
    if (apps[i].getAttribute("data-name") === name) {
      return apps[i];
    }
  }
  return null;
}

// search
var searchInput = document.getElementById("searchInput");
var searchResults = document.getElementById("searchResults");

searchInput.addEventListener("input", function () {
  var query = searchInput.value.trim().toLowerCase();

  searchResults.innerHTML = "";

  if (query === "") {
    searchResults.classList.remove("show");
    return;
  }

  var matches = [];
  apps.forEach(function (app) {
    var name = app.getAttribute("data-name").toLowerCase();
    if (name.indexOf(query) !== -1) {
      matches.push(app);
    }
  });

  if (matches.length === 0) {
    var empty = document.createElement("div");
    empty.className = "result-empty";
    empty.textContent = "No apps found";
    searchResults.appendChild(empty);
  } else {
    matches.forEach(function (app) {
      var row = document.createElement("div");
      row.className = "result-item";

      var icon = app.querySelector("img").src;
      var name = app.getAttribute("data-name");

      row.innerHTML = '<img src="' + icon + '" alt=""> <span>' + name + "</span>";

      row.addEventListener("click", function () {
        openApp(app);
        searchInput.value = "";
        searchResults.classList.remove("show");
      });

      searchResults.appendChild(row);
    });
  }

  searchResults.classList.add("show");
});

document.addEventListener("click", function (e) {
  if (!e.target.closest(".search-box")) {
    searchResults.classList.remove("show");
  }
});

// clock
var clock = document.getElementById("clock");

function updateClock() {
  var now = new Date();
  var hours = now.getHours();
  var minutes = now.getMinutes();

  if (hours < 10) hours = "0" + hours;
  if (minutes < 10) minutes = "0" + minutes;

  clock.textContent = hours + ":" + minutes;
}

updateClock();
setInterval(updateClock, 60000);
