// Strona offline: reaguje na zmianę połączenia. Osobny plik (nie inline),
// żeby CSP `script-src 'self'` nie zgłaszał naruszenia.
var status = document.getElementById("status");
var label = document.getElementById("label");
function sync() {
  var on = navigator.onLine;
  status.className = "status" + (on ? " online" : "");
  label.textContent = on ? "Połączenie wróciło — odświeżam…" : "Brak połączenia z internetem";
  if (on) setTimeout(function () { location.reload(); }, 900);
}
window.addEventListener("online", sync);
window.addEventListener("offline", sync);
sync();
