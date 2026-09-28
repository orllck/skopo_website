/* Pré-diagnostic : deux écrans, un score de priorité interne, une projection
   de cadrage rendue dans le navigateur. S'appuie sur window.Skopo (skopo.js)
   pour la recherche d'entreprise, la collecte et l'envoi vers n8n. */
(function () {
  var S = window.Skopo;
  var form = document.getElementById('prediag-form');
  if (!form || !S) return;

  var result = document.getElementById('prediag-result');
  var aside = document.getElementById('prediag-aside');
  var err = document.getElementById('p-error');
  var steps = Array.prototype.slice.call(form.querySelectorAll('[data-step]'));
  var dots = Array.prototype.slice.call(form.querySelectorAll('[data-step-dot]'));

  /* ---- Source : ?source=interne marque les saisies faites par l'équipe ---- */
  var params = new URLSearchParams(location.search);
  var source = params.get('source') === 'interne' ? 'interne' : 'skopo.fr/pre-diagnostic';
  if (source === 'interne') { var banner = document.getElementById('pd-interne'); if (banner) banner.hidden = false; }

  /* ---- Libellés ---- */
  var SERVICES = {
    commerce: 'Commerce', adv: 'ADV et facturation', finance: 'Finance et compta', operations: 'Opérations et production',
    support: 'Support client', rh: 'RH', marketing: 'Marketing', it: 'IT', direction: 'Direction'
  };
  var OUTILS = {
    crm: ['Votre CRM', 'l\'état réel des données, et ce qui en sort vers la facturation et le reporting'],
    facturation: ['Votre outil de facturation et compta', 'le chemin du devis signé à la facture, et ce qui est recopié entre les deux'],
    erp: ['Votre ERP ou logiciel métier', 'ce qu\'il contient que les autres outils ressaisissent, et ce qu\'on peut en sortir proprement'],
    support: ['Votre outil de support', 'comment une demande arrive, qui la lit, et ce qui pourrait être préparé avant qu\'une personne ne la traite'],
    bureautique: ['Vos boîtes mail et votre bureautique', 'ce qui transite par mail parce qu\'aucun outil ne le porte'],
    documents: ['Votre stockage documentaire', 'les documents qu\'on relit un par un pour en extraire quelques informations'],
    rh: ['Votre outil RH ou paie', 'l\'arrivée d\'un collaborateur, de la promesse à son premier jour équipé'],
    tableurs: ['Vos tableurs partagés', 'les fichiers qui font foi à la place d\'un outil, et ce qu\'ils révèlent des manques']
  };
  var FLUX = {
    ressaisie: 'Du devis à la facture, en suivant chaque endroit où quelqu\'un recopie.',
    entrantes: 'De la demande entrante à la réponse, en regardant qui lit, qui trie, qui répond.',
    documents: 'Du document reçu à l\'information exploitable, sans relecture ligne à ligne.',
    reporting: 'Du terrain au reporting, pour que le chiffre se mette à jour seul.',
    relances: 'Du premier contact à la signature, avec des relances portées par le système.',
    information: 'De la question à la réponse, sans chercher dans trois outils.'
  };
  var MATURITE = {
    'non': 'Vous n\'avez pas encore testé l\'IA. C\'est un avantage : on part des flux, pas d\'un outil déjà choisi.',
    'quelques-personnes': 'Quelques personnes utilisent ChatGPT ou équivalent. Le cadrage sert à passer de l\'usage individuel au flux qui tourne pour toute l\'équipe.',
    'projet-abandonne': 'Un projet a été lancé et n\'a pas tenu. On commencera par comprendre pourquoi, avec les équipes, avant de proposer quoi que ce soit.',
    'en-production': 'Vous avez déjà un outil en production. On le prendra comme point d\'appui et on cherchera ce qui n\'est pas encore couvert.'
  };
  var PORTEUR = {
    'oui-temps': 'Quelqu\'un porte le sujet avec du temps. C\'est votre futur référent, on le forme dès la première semaine.',
    'oui-deborde': 'Quelqu\'un porte le sujet mais il est débordé. Le cadrage lui rend le sujet cadré et priorisé, et on installe le relais.',
    'non': 'Personne ne porte le sujet aujourd\'hui. On identifie le référent pendant le cadrage, c\'est une des trois conditions pour que ça tienne.'
  };
  var HORIZON = {
    'trimestre': 'Vous voulez avancer ce trimestre. Trois semaines de cadrage, puis un premier lot en production avant la fin.',
    'six-mois': 'Vous visez les six prochains mois. Le cadrage peut se caler sur le mois qui vous arrange.',
    'on-regarde': 'Vous regardez. La projection ci-dessous et le guide vous donneront de quoi décider.'
  };

  /* ---- Navigation entre écrans ---- */
  function show(n) {
    steps.forEach(function (s) { s.hidden = Number(s.getAttribute('data-step')) !== n; });
    dots.forEach(function (d) {
      var k = Number(d.getAttribute('data-step-dot'));
      d.classList.toggle('is-active', k === n);
      d.classList.toggle('is-done', k < n);
    });
    err.hidden = true;
    try { form.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
  }
  function fail(msg, f) { err.textContent = msg; err.hidden = false; if (f) f.focus(); }
  function checked(name) {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="' + name + '"]:checked')).map(function (i) { return i.value; });
  }
  function val(id) { return (document.getElementById(id) || {}).value || ''; }

  /* ---- Écran 1 : entreprise, pré-remplissage depuis l'API ---- */
  var company = S.attachCompanySearch(form.querySelector('[data-company-search]'));
  var effectif = document.getElementById('p-effectif'), effectifHint = document.getElementById('p-effectif-hint');
  var ca = document.getElementById('p-ca'), caHint = document.getElementById('p-ca-hint');
  S.attachEmailHint(document.getElementById('p-email'), document.getElementById('p-email-hint'));

  var EFFECTIF_MAP = { '12': '20-49', '21': '50-99', '22': '100-199', '31': '200-plus', '32': '200-plus', '41': '200-plus', '42': '200-plus', '51': '200-plus', '52': '200-plus', '53': '200-plus', '11': 'moins-20', '03': 'moins-20', '02': 'moins-20', '01': 'moins-20', '00': 'moins-20', 'NN': 'moins-20' };
  function caBucket(amount) {
    if (!amount || amount <= 0) return '';
    var m = amount / 1e6;
    if (m < 2) return 'moins-2'; if (m < 5) return '2-5'; if (m < 10) return '5-10'; if (m < 20) return '10-20'; return '20-plus';
  }
  form.addEventListener('company:selected', function (e) {
    var r = e.detail || {};
    var eff = EFFECTIF_MAP[r.tranche_effectif_salarie];
    if (eff && !effectif.dataset.user) { effectif.value = eff; effectifHint.textContent = 'proposé d\'après l\'INSEE, corrigez si besoin'; }
    var bucket = caBucket(S.latestCA(r).ca);
    if (bucket && !ca.dataset.user) { ca.value = bucket; caHint.textContent = 'proposé d\'après les comptes déposés, corrigez si besoin'; }
    else if (!ca.dataset.user) { caHint.textContent = ''; }
  });
  form.addEventListener('company:cleared', function () {
    if (!effectif.dataset.user) { effectif.value = ''; effectifHint.textContent = ''; }
    if (!ca.dataset.user) { ca.value = ''; caHint.textContent = ''; }
  });
  effectif.addEventListener('change', function () { effectif.dataset.user = '1'; effectifHint.textContent = ''; });
  ca.addEventListener('change', function () { ca.dataset.user = '1'; caHint.textContent = ''; });

  form.querySelector('[data-next]').addEventListener('click', function () {
    if (!company.input.value.trim()) return fail('Indiquez le nom de votre entreprise.', company.input);
    if (!effectif.value) return fail('Indiquez votre effectif, même approximatif.', effectif);
    if (!val('p-fonction')) return fail('Choisissez votre rôle, ça nous aide à vous répondre juste.', document.getElementById('p-fonction'));
    if (!S.isEmail(val('p-email'))) return fail('Il manque une adresse email valide.', document.getElementById('p-email'));
    if (company.remindOnce()) return;
    show(2);
  });
  form.querySelector('[data-prev]').addEventListener('click', function () { show(1); });

  /* Les chips reflètent l'état de leur case (pour le style) */
  Array.prototype.forEach.call(form.querySelectorAll('.chip input'), function (input) {
    var sync = function () {
      if (input.type === 'radio') {
        Array.prototype.forEach.call(form.querySelectorAll('input[name="' + input.name + '"]'), function (r) { r.closest('.chip').classList.toggle('is-on', r.checked); });
      } else {
        input.closest('.chip').classList.toggle('is-on', input.checked);
      }
    };
    input.addEventListener('change', sync); sync();
  });

  /* ---- Score de priorité (interne, jamais affiché) ---- */
  var PRIORITY_NAF = ['70', '68', '46', '71'];
  function score(d) {
    var s = 0;
    if (d.effectif_declare === '100-199') s += 3; else if (d.effectif_declare === '50-99') s += 2; else if (d.effectif_declare === '20-49') s += 1;
    if (d.ca_declare === '5-10' || d.ca_declare === '10-20' || d.ca_declare === '20-plus') s += 3; else if (d.ca_declare === '2-5') s += 1;
    if (['dirigeant', 'daf', 'coo-ops'].indexOf(d.fonction) !== -1) s += 3; else if (d.fonction === 'direction-commerciale') s += 1;
    if (d.services_n >= 4) s += 2; else if (d.services_n >= 2) s += 1;
    if (d.outils_n >= 4) s += 2; else if (d.outils_n >= 2) s += 1;
    if (d.horizon === 'trimestre') s += 3; else if (d.horizon === 'six-mois') s += 1;
    if (d.email_pro === 'oui') s += 1;
    if (d.entreprise_verifiee === 'oui') s += 1;
    if (PRIORITY_NAF.indexOf((d.naf || '').slice(0, 2)) !== -1) s += 1;
    if (d.porteur === 'non') s += 1;
    if (d.effectif_declare === 'moins-20' || d.effectif_declare === '200-plus') s -= 4;
    return s;
  }
  function level(s) { return s >= 13 ? 'A' : (s >= 8 ? 'B' : 'C'); }

  /* ---- Projection ---- */
  function li(text, strong) {
    var e = document.createElement('li');
    if (strong) { var b = document.createElement('strong'); b.textContent = strong; e.appendChild(b); e.appendChild(document.createTextNode(' ' + text)); }
    else e.textContent = text;
    return e;
  }
  function fill(id, items) { var ul = document.getElementById(id); ul.innerHTML = ''; items.forEach(function (n) { ul.appendChild(n); }); }

  function isSmall(d) { return (d.effectif_declare === '20-49' || d.effectif_declare === 'moins-20') && d.services_list.length <= 2; }

  function render(d) {
    var services = d.services_list, outils = d.outils_list, pertes = d.pertes_list;

    document.getElementById('pr-title').textContent = 'À quoi ressemblerait le cadrage de ' + (d.entreprise || 'votre entreprise');
    document.getElementById('pr-lead').textContent = 'Un aperçu construit à partir de vos réponses, sans avoir encore vu vos outils ni parlé à vos équipes. On le confirme ensemble en trente minutes.';

    document.getElementById('pr-duree').textContent = isSmall(d)
      ? 'Deux semaines suffiraient probablement : un ou deux services, une structure ramassée. On le confirme après un premier échange.'
      : 'Trois semaines. Une pour comprendre, une pour cartographier et tester sur vos données réelles, une pour prioriser avec la direction et écrire le plan.';

    var svc = services.length ? services.map(function (k) {
      var n = (k === 'direction' || k === 'it') ? 'un à deux entretiens' : 'deux à trois entretiens';
      return li(n + ', avec les personnes qui font le travail au quotidien.', SERVICES[k] + ' :');
    }) : [li('Vous n\'avez pas coché de service : on commencera par la direction et le service qui vous a fait remplir ce formulaire.')];
    fill('pr-services', svc);

    var flux = pertes.slice(0, 3).map(function (k) { return li(FLUX[k]); });
    if (!flux.length) flux.push(li('Du devis à la facture. C\'est le flux qui traverse le plus de services, et celui où l\'on trouve presque toujours de la ressaisie.'));
    if (services.indexOf('rh') !== -1 && flux.length < 4) flux.push(li('De la promesse d\'embauche au premier jour équipé, puisque le service RH est dans le périmètre.'));
    fill('pr-flux', flux);

    var out = outils.map(function (k) { return li(OUTILS[k][1] + '.', OUTILS[k][0] + ' :'); });
    if (d.outils_autres) out.push(li(d.outils_autres + '.', 'Ce que vous avez ajouté :'));
    if (!out.length) out.push(li('Vous n\'avez pas coché d\'outil : on fera l\'inventaire sur place, c\'est la première chose que fait Loick.'));
    fill('pr-outils', out);

    var ctx = [];
    if (MATURITE[d.maturite]) ctx.push(li(MATURITE[d.maturite]));
    if (PORTEUR[d.porteur]) ctx.push(li(PORTEUR[d.porteur]));
    if (HORIZON[d.horizon]) ctx.push(li(HORIZON[d.horizon]));
    if (d.sites === '2-3' || d.sites === '4-plus') ctx.push(li('Plusieurs sites : la carte des flux inclura ce qui circule entre eux, c\'est souvent là que l\'information se perd.'));
    if (d.effectif_declare === '200-plus') ctx.push(li('Au-dessus de 200 personnes, on n\'est pas toujours les bons interlocuteurs. On vous le dira franchement à l\'appel.'));
    if (d.effectif_declare === 'moins-20') ctx.push(li('En dessous de 20 personnes, le cadrage complet est rarement justifié. On vous proposera plutôt une demi-journée pour tracer un flux ensemble.'));
    fill('pr-contexte', ctx);
  }

  /* ---- Envoi ---- */
  form.addEventListener('submit', function (e) {
    e.preventDefault(); err.hidden = true;
    var services = checked('services'), outils = checked('outils'), pertes = checked('pertes');
    if (!services.length) return fail('Cochez au moins un service, même si c\'est seulement la direction.', form.querySelector('input[name="services"]'));
    if (!pertes.length) return fail('Cochez au moins un endroit où le temps se perd. Si vous hésitez, prenez celui qui vous agace le plus.', form.querySelector('input[name="pertes"]'));
    if (!checked('horizon').length) return fail('Indiquez un horizon, même « on regarde ».', form.querySelector('input[name="horizon"]'));

    var btn = document.getElementById('p-submit'); btn.disabled = true; btn.textContent = 'Un instant';

    var d = S.collect(form, { source: source });
    d.services = services.join('|'); d.services_n = services.length; d.services_list = services;
    d.outils = outils.join('|'); d.outils_n = outils.length; d.outils_list = outils;
    d.pertes = pertes.join('|'); d.pertes_n = pertes.length; d.pertes_list = pertes;
    d.maturite = checked('maturite')[0] || ''; d.porteur = checked('porteur')[0] || ''; d.horizon = checked('horizon')[0] || '';
    d.score = score(d); d.score_niveau = level(d.score);
    d.cadrage_projete = isSmall(d) ? '2 semaines' : '3 semaines';

    var payload = {}; for (var k in d) { if (!/_list$/.test(k)) payload[k] = d[k]; }
    S.send(S.PREDIAG_ENDPOINT, payload, 'prediag').then(function () {
      render(d);
      form.hidden = true; if (aside) aside.hidden = true;
      result.hidden = false; result.classList.add('is-visible');
      dots.forEach(function (x) { x.classList.add('is-done'); });
      try { result.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e2) { window.scrollTo(0, 0); }
    });
  });
})();
