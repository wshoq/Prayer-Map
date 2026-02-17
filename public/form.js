<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>The Living Prayer Map — Where do You pray?</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>Where do You pray?</h1>

      <p class="small">
        This form adds a point to <strong>The Living Prayer Map</strong>.<br><br>
        1) Write your name or the name of the place<br>
        2) Paste a Google Maps link (use <em>Share location</em>)<br>
        3) Choose your role in the ritual
      </p>

      <form id="f">
        <label>1) What’s your name / place name</label>
        <input name="name" required placeholder="Your name / place name" />

        <label>2) Google Maps link</label>
        <input
          name="link"
          required
          placeholder="https://maps.app.goo.gl/..."
        />

        <label>3) Role</label>
        <select name="role" required>
          <option value="" disabled selected>Select role…</option>

          <option value="RED PINS">
            RED PINS — If you bleed: offer.
            For women whose blood becomes prayer in the soil.
          </option>

          <option value="BLACK PINS">
            BLACK PINS — If you don’t: bless.
            For Wise Women, elders and keepers of the intention.
          </option>

          <option value="BLUE PINS">
            BLUE PINS — If you’re a man: protect the space.
            For men standing in protection and reverence for this ritual.
          </option>
        </select>

        <div class="row" style="margin-top:14px;">
          <button class="btn" type="submit">Submit prayer</button>
          <a class="btn" href="/">Back to the map</a>
        </div>

        <div id="msg" class="small" style="margin-top:10px;"></div>
      </form>
    </div>
  </div>

  <script src="/form.js"></script>
</body>
</html>
