const form = document.getElementById("f");
const msg = document.getElementById("msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  msg.textContent = "Submitting…";
  msg.className = "small";

  const fd = new FormData(form);
  const payload = Object.fromEntries(fd.entries());

  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Submit failed");

    msg.textContent = "✅ Submitted! Your pin should appear on the map within ~15 seconds.";
    msg.className = "small success";
    form.reset();
  } catch (e2) {
    msg.textContent = "⚠️ " + e2.message;
    msg.className = "small error";
  }
});
