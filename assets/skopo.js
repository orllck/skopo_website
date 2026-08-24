(function () {
  var els = document.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -10% 0px' });
  els.forEach(function (el) { io.observe(el); });
})();

/* Module avant/après (adapté de share-src/avant-apres/) : deux panneaux
   superposés, le panneau « après » [data-ba-after] est découpé par clip-path
   et la poignée [data-ba-handle] suit le pointeur. À l'entrée dans le
   viewport, la poignée glisse de 100 % à sa position de repos. */
(function () {
  var root = document.querySelector('[data-ba-root]');
  if (!root) return;
  var after = root.querySelector('[data-ba-after]');
  var handle = root.querySelector('[data-ba-handle]');
  if (!after || !handle) return;

  /* position de repos : la couture doit tomber sur une limite de colonne,
     qui bouge quand le responsive masque des colonnes (38 % = limite
     SIRET/contact en desktop, cf. share-src/avant-apres/README) */
  var rest = window.innerWidth <= 600 ? 42 : (window.innerWidth <= 960 ? 28 : 38);
  var revealMs = 1100, revealDelay = 220;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var auto = true;

  function apply(pct) {
    var p = Math.max(2, Math.min(98, pct));
    after.style.clipPath = 'inset(0 0 0 ' + p + '%)';
    handle.style.left = p + '%';
  }

  var dragging = false;
  function pctFromEvent(e) {
    var r = root.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  }
  root.addEventListener('pointerdown', function (e) {
    dragging = true; auto = false;
    try { root.setPointerCapture(e.pointerId); } catch (err) {}
    apply(pctFromEvent(e));
  });
  root.addEventListener('pointermove', function (e) { if (dragging) apply(pctFromEvent(e)); });
  root.addEventListener('pointerup', function () { dragging = false; });
  root.addEventListener('pointercancel', function () { dragging = false; });

  if (reduced || !('IntersectionObserver' in window)) { apply(rest); return; }
  apply(100);

  function reveal() {
    var t0 = performance.now();
    function step(now) {
      if (!auto) return;
      var p = Math.min(1, (now - t0) / revealMs);
      var e = 1 - Math.pow(1 - p, 3);
      apply(100 - (100 - rest) * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  var obs = new IntersectionObserver(function (entries) {
    if (entries.some(function (en) { return en.isIntersecting; })) {
      obs.disconnect();
      setTimeout(reveal, revealDelay);
    }
  }, { threshold: 0.35 });
  obs.observe(root);
})();

/* Animation de fond du hero (adaptée de share-src/hero-animation/) : tapis
   roulant de points. Ils entrent par la gauche en désordre, se rangent sur la
   grille en avançant (les 4 paliers de la charte), et les colonnes alignées
   continuent d'avancer et sortent par la droite, en boucle continue.
   Frame statique si l'utilisateur réduit les animations, pause hors écran. */
(function () {
  var canvas = document.querySelector('[data-skopo-hero]');
  if (!canvas || !canvas.getContext) return;

  var gap = 27, accent = '#b4562f', ink = '#221f1b';
  var speed = 14;        /* avancée du tapis en px/s (une colonne ≈ 2 s) */
  var driftMs = 2600;    /* période de la dérive résiduelle à gauche */
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ctx = canvas.getContext('2d');
  var w = 0, h = 0, cols = 0, rows = 0, beltW = 0, raf = null, visible = true;

  /* bruit déterministe : même flux à chaque chargement */
  function rand(seed) {
    var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  function build() {
    var r = canvas.getBoundingClientRect();
    w = r.width; h = r.height;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / gap) + 2;   /* colonnes hors champ pour l'entrée et la sortie */
    rows = Math.ceil(h / gap);
    beltW = cols * gap;
  }

  function render(el) {
    ctx.clearRect(0, 0, w, h);
    var advance = el / 1000 * speed;
    for (var i = 0; i < cols; i++) {
      /* position de la colonne sur le tapis, qui reboucle à gauche */
      var world = (i * gap + advance) % beltW;
      var gen = Math.floor((i * gap + advance) / beltW);  /* nouveau désordre à chaque retour */
      var x0 = world - gap;
      var t = Math.max(0, Math.min(1, x0 / (w - gap)));   /* 0 = gauche (désordre) → 1 = droite (aligné) */
      /* rangement continu (smoothstep), terminé à 95 % de la traversée :
         environ trois colonnes complètes et parfaitement alignées avant le bord */
      var a = Math.min(1, t / 0.95);
      var align = a * a * (3 - 2 * a);
      var fade = Math.pow(a, 1.3);
      var amp = gap * 2.1 * (1 - align);
      var drift = (1 - align) * 2.4;
      for (var j = 0; j < rows; j++) {
        var s = i * 31 + j * 7 + gen * 997;
        /* densité croissante : le point se matérialise en douceur, et la grille
           est complète (tous les points affichés) quand fade atteint 1 */
        var vis = ((0.18 + fade * 1.1) - rand(s + 900)) / 0.22;
        if (vis <= 0) continue;
        if (vis > 1) vis = 1;
        var phase = rand(s + 77) * Math.PI * 2;
        var x = x0 + gap / 2 + (rand(s) - 0.5) * amp + Math.sin(el / driftMs + phase) * drift;
        var y = j * gap + gap / 2 + (rand(s + 5) - 0.5) * amp + Math.cos(el / (driftMs * 1.19) + phase) * drift;
        var isAccent = rand(s + 40) > 0.93 && t > 0.25;
        var alpha = (0.06 + fade * 0.26) * vis;
        var radius = 1.3 + fade * 1.5;
        if (isAccent) {
          /* petite pulsation : des signaux qui s'activent dans le flux */
          alpha *= 0.75 + 0.45 * Math.sin(el / 900 + phase * 3);
          radius += 0.4;
        }
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = isAccent ? accent : ink;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  var start = performance.now();
  function draw(now) {
    if (!visible || document.hidden) { raf = null; return; }
    render(now - start);
    raf = requestAnimationFrame(draw);
  }
  function wake() { if (!raf && !reduced && visible && !document.hidden) raf = requestAnimationFrame(draw); }

  function refresh() {
    build();
    if (reduced) render(5000);   /* tout en place, sans animation */
    else wake();
  }

  /* pause quand le hero sort de l'écran ou que l'onglet est masqué */
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      wake();
    }).observe(canvas);
  }
  document.addEventListener('visibilitychange', wake);

  /* suit la taille réelle du canvas (resize, rotation, police) */
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () {
      var r = canvas.getBoundingClientRect();
      if (r.width !== w || r.height !== h) refresh();
    }).observe(canvas);
  } else {
    window.addEventListener('resize', refresh);
  }

  refresh();
})();

/* ============ Formulaires : recherche d'entreprise (API data.gouv) + envoi des leads ============ */
(function () {
  /* Webhooks qui reçoivent les leads en JSON (POST). Vides = rien n'est transmis, le lead est
     seulement loggé en console, et le visiteur n'est jamais bloqué. Voir ebook/README.md. */
  var GUIDE_ENDPOINT = ''   /* À REMPLIR : webhook n8n qui reçoit les demandes de guide */;
  var CONTACT_ENDPOINT = '' /* À REMPLIR : webhook n8n qui reçoit les prises de contact */;
  var SEARCH_URL = 'https://recherche-entreprises.api.gouv.fr/search';

  var EFFECTIFS = {
    'NN': 'non employeur', '00': '0 salarié', '01': '1 à 2 salariés', '02': '3 à 5 salariés',
    '03': '6 à 9 salariés', '11': '10 à 19 salariés', '12': '20 à 49 salariés', '21': '50 à 99 salariés',
    '22': '100 à 199 salariés', '31': '200 à 249 salariés', '32': '250 à 499 salariés',
    '41': '500 à 999 salariés', '42': '1 000 à 1 999 salariés', '51': '2 000 à 4 999 salariés',
    '52': '5 000 à 9 999 salariés', '53': '10 000 salariés et plus'
  };
  var FREE_MAIL = ['gmail.com', 'yahoo.fr', 'yahoo.com', 'hotmail.fr', 'hotmail.com', 'outlook.fr', 'outlook.com', 'live.fr', 'icloud.com', 'me.com', 'free.fr', 'orange.fr', 'wanadoo.fr', 'sfr.fr', 'laposte.net', 'protonmail.com', 'proton.me'];
  var HIDDEN_FIELDS = ['siren', 'siret_siege', 'nom_legal', 'naf', 'naf_libelle', 'adresse', 'effectif_code', 'effectif_libelle', 'categorie_entreprise', 'date_creation', 'code_postal', 'ville', 'nature_juridique', 'nb_etablissements', 'entreprise_verifiee'];

  function titleCase(str) {
    return (str || '').toLowerCase().replace(/(^|[\s\-'])([a-zà-ÿ])/g, function (m, p, c) { return p + c.toUpperCase(); });
  }
  var NAF_DIVISIONS = {
    '01': 'Agriculture', '02': 'Sylviculture', '03': 'Pêche et aquaculture', '05': 'Extraction de charbon',
    '06': 'Extraction d\'hydrocarbures', '07': 'Extraction de minerais', '08': 'Industries extractives', '09': 'Services miniers',
    '10': 'Industrie alimentaire', '11': 'Boissons', '12': 'Tabac', '13': 'Textile', '14': 'Habillement', '15': 'Cuir et chaussure',
    '16': 'Travail du bois', '17': 'Papier et carton', '18': 'Imprimerie', '19': 'Raffinage', '20': 'Industrie chimique',
    '21': 'Industrie pharmaceutique', '22': 'Caoutchouc et plastique', '23': 'Verre et matériaux', '24': 'Métallurgie',
    '25': 'Produits métalliques', '26': 'Électronique et informatique', '27': 'Équipements électriques', '28': 'Machines et équipements',
    '29': 'Automobile', '30': 'Matériels de transport', '31': 'Meubles', '32': 'Industries diverses', '33': 'Réparation de machines',
    '35': 'Énergie', '36': 'Eau', '37': 'Assainissement', '38': 'Déchets et recyclage', '39': 'Dépollution',
    '41': 'Construction de bâtiments', '42': 'Génie civil', '43': 'Travaux de construction',
    '45': 'Commerce et réparation auto', '46': 'Commerce de gros', '47': 'Commerce de détail',
    '49': 'Transport terrestre', '50': 'Transport par eau', '51': 'Transport aérien', '52': 'Logistique et entreposage',
    '53': 'Poste et courrier', '55': 'Hébergement', '56': 'Restauration', '58': 'Édition', '59': 'Cinéma et vidéo',
    '60': 'Audiovisuel', '61': 'Télécommunications', '62': 'Informatique et logiciels', '63': 'Services d\'information',
    '64': 'Activités financières', '65': 'Assurance', '66': 'Services financiers', '68': 'Immobilier',
    '69': 'Juridique et comptabilité', '70': 'Conseil de gestion', '71': 'Architecture et ingénierie',
    '72': 'Recherche et développement', '73': 'Publicité et études de marché', '74': 'Activités spécialisées',
    '75': 'Vétérinaire', '77': 'Location', '78': 'Emploi et ressources humaines', '79': 'Agences de voyage',
    '80': 'Sécurité', '81': 'Services aux bâtiments', '82': 'Services aux entreprises', '84': 'Administration publique',
    '85': 'Enseignement', '86': 'Santé', '87': 'Hébergement médico-social', '88': 'Action sociale',
    '90': 'Arts et spectacles', '91': 'Bibliothèques et musées', '92': 'Jeux d\'argent', '93': 'Sport et loisirs',
    '94': 'Organisations associatives', '95': 'Réparation de biens', '96': 'Services personnels',
    '97': 'Employeurs domestiques', '98': 'Ménages producteurs', '99': 'Organisations extraterritoriales'
  };
  function nafLabel(code) { return NAF_DIVISIONS[(code || '').slice(0, 2)] || ''; }
  /* Ligne 1 sous le nom : adresse, ville (département) */
  function companyAddr(r) {
    var s = (r && r.siege) || {};
    var street = [s.numero_voie, s.type_voie, s.libelle_voie].filter(Boolean).join(' ');
    var town = s.libelle_commune ? titleCase(s.libelle_commune) + (s.code_postal ? ' (' + s.code_postal.slice(0, 2) + ')' : '') : '';
    if (street && town) return titleCase(street) + ', ' + town;
    if (town) return town;
    return titleCase(s.adresse || '');
  }
  /* Ligne 2 : secteur · SIREN */
  function companySector(r) {
    var parts = [];
    var lab = nafLabel(r.activite_principale);
    if (lab) parts.push(lab);
    parts.push('SIREN ' + (r.siren || '').replace(/(\d{3})(?=\d)/g, '$1 '));
    return parts.join(' · ');
  }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  /* ---- Recherche d'entreprise : s'attache à tout .field[data-company-search] ---- */
  function attachCompanySearch(field) {
    var input = field.querySelector('input[type="text"]');
    var form = field.closest('form');
    if (!input || !form) return null;

    var list = el('ul', 'suggest'); list.setAttribute('role', 'listbox'); list.hidden = true;
    var pick = el('div', 'company-pick'); pick.hidden = true;
    var pickMain = el('div', 'company-pick-main');
    var pickName = el('span', 'company-pick-name'), pickAddr = el('span', 'company-pick-meta'), pickMeta = el('span', 'company-pick-meta');
    pickMain.appendChild(pickName); pickMain.appendChild(pickAddr); pickMain.appendChild(pickMeta);
    var changeBtn = el('button', 'company-pick-change', 'Changer'); changeBtn.type = 'button';
    pick.appendChild(pickMain); pick.appendChild(changeBtn);
    var hint = el('span', 'field-hint', 'Sélectionnez votre entreprise dans la liste, ou continuez avec le nom tel quel.'); hint.hidden = true;
    field.appendChild(list); field.appendChild(pick); field.appendChild(hint);

    var hidden = {};
    HIDDEN_FIELDS.forEach(function (name) {
      var h = document.createElement('input'); h.type = 'hidden'; h.name = name; h.value = name === 'entreprise_verifiee' ? 'non' : '';
      form.appendChild(h); hidden[name] = h;
    });

    var results = [], active = -1, timer = null, lastQuery = '', controller = null;

    function closeList() { list.hidden = true; list.innerHTML = ''; active = -1; input.setAttribute('aria-expanded', 'false'); }
    function highlight() { Array.prototype.forEach.call(list.children, function (li, i) { li.classList.toggle('is-active', i === active); }); }
    function render() {
      list.innerHTML = '';
      if (!results.length) {
        list.appendChild(el('li', 's-empty', 'Aucune entreprise trouvée. Vous pouvez continuer avec le nom tel quel.'));
      } else {
        results.forEach(function (r, i) {
          var li = el('li'); li.setAttribute('role', 'option');
          li.appendChild(el('span', 's-name', titleCase(r.nom_complet)));
          var addr = companyAddr(r); if (addr) li.appendChild(el('span', 's-meta', addr));
          li.appendChild(el('span', 's-meta', companySector(r)));
          li.addEventListener('mousedown', function (e) { e.preventDefault(); choose(i); });
          list.appendChild(li);
        });
      }
      list.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    function search(q) {
      if (controller) controller.abort();
      controller = ('AbortController' in window) ? new AbortController() : null;
      var url = SEARCH_URL + '?q=' + encodeURIComponent(q) + '&per_page=6&etat_administratif=A&minimal=true&include=siege';
      fetch(url, controller ? { signal: controller.signal } : {})
        .then(function (res) { return res.ok ? res.json() : { results: [] }; })
        .then(function (data) { if (q !== lastQuery) return; results = (data && data.results) || []; render(); })
        .catch(function (err) { if (err && err.name === 'AbortError') return; results = []; render(); });
    }
    function clearPick() {
      pick.hidden = true;
      HIDDEN_FIELDS.forEach(function (k) { hidden[k].value = k === 'entreprise_verifiee' ? 'non' : ''; });
    }
    function choose(i) {
      var r = results[i]; if (!r) return;
      var s = r.siege || {};
      input.value = titleCase(r.nom_complet);
      hidden.siren.value = r.siren || '';
      hidden.siret_siege.value = s.siret || '';
      hidden.nom_legal.value = r.nom_raison_sociale || r.nom_complet || '';
      hidden.naf.value = r.activite_principale || '';
      hidden.naf_libelle.value = nafLabel(r.activite_principale);
      hidden.adresse.value = companyAddr(r);
      hidden.effectif_code.value = r.tranche_effectif_salarie || '';
      hidden.effectif_libelle.value = EFFECTIFS[r.tranche_effectif_salarie] || '';
      hidden.categorie_entreprise.value = r.categorie_entreprise || '';
      hidden.date_creation.value = r.date_creation || '';
      hidden.code_postal.value = s.code_postal || '';
      hidden.ville.value = titleCase(s.libelle_commune || '');
      hidden.nature_juridique.value = r.nature_juridique || '';
      hidden.nb_etablissements.value = r.nombre_etablissements_ouverts != null ? String(r.nombre_etablissements_ouverts) : '';
      hidden.entreprise_verifiee.value = 'oui';
      pickName.textContent = titleCase(r.nom_complet);
      var pa = companyAddr(r); pickAddr.textContent = pa; pickAddr.hidden = !pa;
      pickMeta.textContent = companySector(r);
      pick.hidden = false; hint.hidden = true;
      closeList();
      /* passe au champ suivant du formulaire */
      var els = Array.prototype.slice.call(form.querySelectorAll('input:not([type=hidden]), select, textarea, button[type=submit]'));
      var next = els[els.indexOf(input) + 1]; if (next) next.focus();
    }

    input.addEventListener('input', function () {
      if (hidden.entreprise_verifiee.value === 'oui') clearPick();
      var q = input.value.trim(); lastQuery = q; clearTimeout(timer);
      if (q.length < 3) { closeList(); return; }
      timer = setTimeout(function () { search(q); }, 220);
    });
    input.addEventListener('keydown', function (e) {
      if (list.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, results.length - 1); highlight(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); highlight(); }
      else if (e.key === 'Enter') { if (active >= 0) { e.preventDefault(); choose(active); } else if (results.length === 1) { e.preventDefault(); choose(0); } }
      else if (e.key === 'Escape') { closeList(); }
    });
    input.addEventListener('blur', function () { setTimeout(closeList, 120); });
    changeBtn.addEventListener('click', function () { clearPick(); input.value = ''; input.focus(); });

    return {
      input: input,
      verified: function () { return hidden.entreprise_verifiee.value === 'oui'; },
      /* Un seul rappel si l'entreprise n'a pas été choisie dans la liste, jamais bloquant. */
      remindOnce: function () {
        if (this.verified() || hint.dataset.seen) return false;
        hint.hidden = false; hint.dataset.seen = '1'; input.focus(); return true;
      }
    };
  }

  /* ---- Utilitaires communs ---- */
  function isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v || ''); }
  function attachEmailHint(input, hintEl) {
    if (!input || !hintEl) return;
    input.addEventListener('blur', function () {
      var d = (input.value.split('@')[1] || '').toLowerCase();
      var free = FREE_MAIL.indexOf(d) !== -1;
      hintEl.hidden = !free; hintEl.classList.toggle('is-warn', free);
    });
  }
  function collect(form, extra) {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (f) { if (f.name) data[f.name] = f.value; });
    data.page_url = location.href;
    data.referrer = document.referrer || '';
    data.submitted_at = new Date().toISOString();
    data.email_domain = ((data.email || '').split('@')[1] || '').toLowerCase();
    data.email_pro = FREE_MAIL.indexOf(data.email_domain) === -1 ? 'oui' : 'non';
    data.icp_effectif = ['12', '21', '22'].indexOf(data.effectif_code) !== -1 ? 'oui' : (data.effectif_code ? 'non' : 'inconnu');
    for (var k in extra) data[k] = extra[k];
    return data;
  }
  function send(endpoint, data, label) {
    if (!endpoint) { console.warn('[' + label + '] endpoint non configuré, lead non transmis :', data); return Promise.resolve(); }
    return fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true })
      .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); })
      .catch(function (err) { console.error('[' + label + '] échec d\'envoi', err, data); /* on ne bloque jamais le visiteur */ });
  }
  function swap(form, doneBox) {
    form.hidden = true; doneBox.hidden = false; doneBox.classList.add('is-visible');
    try { doneBox.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
  }

  /* ---- Formulaire guide ---- */
  var gForm = document.getElementById('guide-form');
  if (gForm) {
    var gCompany = attachCompanySearch(gForm.querySelector('[data-company-search]'));
    var gEmail = document.getElementById('g-email'), gErr = document.getElementById('g-error'), gBtn = document.getElementById('g-submit');
    attachEmailHint(gEmail, document.getElementById('g-email-hint'));
    gForm.addEventListener('submit', function (e) {
      e.preventDefault(); gErr.hidden = true;
      var fail = function (msg, f) { gErr.textContent = msg; gErr.hidden = false; if (f) f.focus(); };
      if (!isEmail(gEmail.value)) return fail('Il manque une adresse email valide.', gEmail);
      if (!gCompany.input.value.trim()) return fail('Indiquez le nom de votre entreprise.', gCompany.input);
      if (!document.getElementById('g-fonction').value) return fail('Choisissez votre rôle, ça nous aide à vous répondre juste.', document.getElementById('g-fonction'));
      if (gCompany.remindOnce()) return;
      gBtn.disabled = true; gBtn.textContent = 'Un instant';
      send(GUIDE_ENDPOINT, collect(gForm, { source: location.pathname + '#guide', guide: 'votre-crm-vous-ment' }), 'guide')
        .then(function () { swap(gForm, document.getElementById('guide-done')); });
    });
  }

  /* ---- Formulaire contact (Parlons-en) ---- */
  var cForm = document.getElementById('contact-form');
  if (cForm) {
    var cCompany = attachCompanySearch(cForm.querySelector('[data-company-search]'));
    var cEmail = document.getElementById('c-email'), cErr = document.getElementById('c-error'), cBtn = document.getElementById('c-submit');
    cForm.addEventListener('submit', function (e) {
      e.preventDefault(); cErr.hidden = true;
      var fail = function (msg, f) { cErr.textContent = msg; cErr.hidden = false; if (f) f.focus(); };
      if (!document.getElementById('c-nom').value.trim()) return fail('Il manque votre nom.', document.getElementById('c-nom'));
      if (!isEmail(cEmail.value)) return fail('Il manque une adresse email valide.', cEmail);
      if (!cCompany.input.value.trim()) return fail('Indiquez le nom de votre entreprise.', cCompany.input);
      if (cCompany.remindOnce()) return;
      cBtn.disabled = true; cBtn.textContent = 'Un instant';
      send(CONTACT_ENDPOINT, collect(cForm, { source: location.pathname + '#rdv' }), 'contact')
        .then(function () { swap(cForm, document.getElementById('contact-done')); });
    });
  }
})();
