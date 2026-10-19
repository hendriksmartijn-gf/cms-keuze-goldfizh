/*
 * Goldfizh CMS-keuzehulp: embed voor Webflow.
 *
 *   <div data-gf-cms-keuzehulp></div>
 *   <script src="https://<jouw-vercel-domein>/embed.js" async></script>
 *
 * - Laadt de keuzehulp in een iframe dat automatisch meegroeit.
 * - Zet het advies in de URL van de blogpagina (?keuze=…), zodat deellinks op goldfizh.nl landen.
 * - Pusht events naar window.dataLayer (GTM): cms_keuzehulp_antwoord, _resultaat, _lead, …
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var app = new URL(script.src).origin;

  function mount(el) {
    if (el.dataset.gfMounted) return;
    el.dataset.gfMounted = "1";

    var page = new URL(window.location.href);
    var src = new URL(app + "/");
    src.searchParams.set("parent", window.location.origin);
    src.searchParams.set("p", page.origin + page.pathname);
    var keuze = page.searchParams.get("keuze");
    if (keuze) src.searchParams.set("keuze", keuze);

    var iframe = document.createElement("iframe");
    iframe.src = src.toString();
    iframe.title = "CMS-keuzehulp";
    iframe.loading = "lazy";
    iframe.allow = "clipboard-write";
    iframe.style.cssText = "width:100%;border:0;display:block;min-height:560px;transition:height .2s ease";
    el.appendChild(iframe);

    window.addEventListener("message", function (e) {
      if (e.origin !== app || e.source !== iframe.contentWindow || !e.data) return;
      var d = e.data;
      if (d.type === "gf-cms:resize" && typeof d.height === "number") {
        iframe.style.height = Math.max(400, Math.ceil(d.height)) + "px";
      } else if (d.type === "gf-cms:event" && typeof d.naam === "string") {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(Object.assign({ event: "cms_keuzehulp_" + d.naam }, d.params || {}));
      } else if (d.type === "gf-cms:keuze") {
        var url = new URL(window.location.href);
        if (typeof d.code === "string" && /^[a-j]{1,10}$/.test(d.code)) url.searchParams.set("keuze", d.code);
        else url.searchParams.delete("keuze");
        history.replaceState(history.state, "", url);
      }
    });
  }

  document.querySelectorAll("[data-gf-cms-keuzehulp]").forEach(mount);
})();
