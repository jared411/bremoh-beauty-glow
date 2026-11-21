(function () {
  const C = window.BBG_CONFIG;
  // Refresh or reopen the page: always start at the top, not where you left off
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  window.addEventListener("load", () => {
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    window.scrollTo(0, 0);
  });
  // Tapping the logo reloads the app and goes to the top
  document.addEventListener("click", (e) => {
    if (e.target.closest(".hs-logo")) { e.preventDefault(); location.href = location.pathname; }
  });
  const $ = (id) => document.getElementById(id);
  const money = (n) => `${C.CURRENCY} ${Number(n).toLocaleString()}`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Contact links
  $("yr").textContent = new Date().getFullYear();
  const waUrl = `https://wa.me/${C.WHATSAPP}?text=${encodeURIComponent("Hello Bremoh Beauty Glow, I'd like to book an appointment.")}`;
  $("wa-link").href = waUrl;
  $("wa-float").href = waUrl;
  $("hero-wa").href = waUrl;
  $("mobile-wa").href = waUrl;
  $("tel-link").href = `tel:${C.PHONE_DISPLAY.replace(/\s/g, "")}`;
  $("tel-link").textContent = C.PHONE_DISPLAY;
  $("mail-link").href = `mailto:${C.EMAIL}`;
  $("mail-link").textContent = C.EMAIL;

  // Date: no past dates
  $("date").min = new Date().toISOString().split("T")[0];

  if (C.SUPABASE_URL.includes("YOUR-PROJECT")) {
    $("services-grid").innerHTML = '<p class="section-sub">Site not connected yet. Add your Supabase keys in js/config.js.</p>';
    return;
  }

  const db = supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  async function loadServices() {
    const { data, error } = await db.from("services").select("*").eq("active", true).order("created_at");
    if (error) {
      console.error("Services error:", error);
      $("services-grid").innerHTML = `<p class="section-sub">Could not load services. (${String(error.message || error).replace(/[<>&]/g, "")})</p>`;
      return;
    }
    if (!data.length) { $("services-grid").innerHTML = '<p class="section-sub">Services coming soon.</p>'; return; }

    $("services-grid").innerHTML = data.map((s) => `
      <div class="card">
        <div class="img">${s.image_url ? `<img src="${esc(s.image_url)}" alt="${esc(s.name)}" loading="lazy">` : "&#10024;"}</div>
        <div class="body">
          <h3>${esc(s.name)}</h3>
          <p>${esc(s.description)}</p>
          <div class="meta"><span class="price">${money(s.price)}</span><span>${s.duration_minutes} min</span></div>
          <a href="#book" class="btn small" data-service="${s.id}" style="margin-top:12px">Book this</a>
        </div>
      </div>`).join("");

    $("service").innerHTML = '<option value="">Select a service</option>' +
      data.map((s) => `<option value="${s.id}">${esc(s.name)} - ${money(s.price)}</option>`).join("");

    document.querySelectorAll("[data-service]").forEach((b) =>
      b.addEventListener("click", () => { $("service").value = b.dataset.service; }));
  }

  async function loadGallery() {
    const { data } = await db.from("gallery").select("*").order("created_at", { ascending: false }).limit(12);
    const g = $("gallery-grid");
    // If the database has no gallery photos yet, keep the photos already on the page.
    if (!data || !data.length) return;
    g.innerHTML = data.map((i) => `<img src="${esc(i.image_url)}" alt="${esc(i.caption || "Bremoh Beauty Glow work")}" loading="lazy">`).join("");
  }

  // Booking dates cannot be in the past
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  $("date").min = today.toISOString().slice(0, 10);

  // The booking as a WhatsApp message, so the salon gets the details straight away
  function bookingText(d) {
    const svc = $("service").selectedOptions[0];
    return [
      "Hello Bremoh Beauty Glow, I'd like to book an appointment:",
      `Service: ${svc && svc.value ? svc.text : "-"}`,
      `Date: ${d.date}`,
      `Time: ${d.time}`,
      `Name: ${d.name}`,
      `Phone: ${d.phone}`,
      d.notes ? `Notes: ${d.notes}` : null,
    ].filter(Boolean).join("\n");
  }

  function showWhatsApp(text, lead) {
    const msg = $("booking-msg");
    msg.innerHTML = "";
    const p = document.createElement("p");
    p.textContent = lead;
    const a = document.createElement("a");
    a.className = "btn";
    a.target = "_blank";
    a.rel = "noopener";
    a.href = `https://wa.me/${C.WHATSAPP}?text=${encodeURIComponent(text)}`;
    a.textContent = "Send details on WhatsApp";
    msg.append(p, a);
  }

  $("booking-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("booking-msg");
    const btn = e.target.querySelector("button");
    const d = {
      service_id: $("service").value,
      name: $("name").value.trim(),
      phone: $("phone").value.trim(),
      email: $("email").value.trim() || null,
      date: $("date").value,
      time: $("time").value,
      notes: $("notes").value.trim() || null,
    };
    const text = bookingText(d);
    msg.className = "msg";
    btn.disabled = true;

    const { error } = await db.from("bookings").insert({
      service_id: d.service_id,
      customer_name: d.name,
      phone: d.phone,
      email: d.email,
      booking_date: d.date,
      booking_time: d.time,
      notes: d.notes,
      status: "pending"
    });

    btn.disabled = false;
    if (error) {
      // Never leave the customer stuck: send the request on WhatsApp instead
      console.error("Booking error:", error);
      msg.className = "msg err";
      showWhatsApp(text, "Our booking system is busy right now. Tap below to send your request on WhatsApp.");
    } else {
      msg.className = "msg ok";
      e.target.reset();
      showWhatsApp(text, "Thank you! Your request is saved. Tap below so we can confirm it quickly on WhatsApp.");
    }
  });

  loadServices();
  // The gallery is the fixed collage picture in index.html, so the database gallery is not loaded over it.
  // loadGallery();
})();
