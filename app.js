const $ = s => document.querySelector(s), e = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
        const uid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
        const tok = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
        const fresh = () => ({ trip: { name: 'My trip', date: '' }, members: [], tags: [], bags: [], j: { from: '', to: '', stops: [], started: false, ended: false, returning: false, leg: '', legs: [], checkpoints: [], progress: { index: 0, phase: 'depart' } }, bc: [], pc: [], pmissed: [], missed: [] });
        const idb = (m, v) => new Promise(r => { try { const q = indexedDB.open('tripguard7', 1); q.onupgradeneeded = () => q.result.createObjectStore('k'); q.onsuccess = () => { const o = q.result.transaction('k', m === 'get' ? 'readonly' : 'readwrite').objectStore('k'); const x = m === 'get' ? o.get('s') : o.put(v, 's'); x.onsuccess = () => r(x.result); x.onerror = () => r() }; q.onerror = () => r() } catch (_) { r() } });
        function loadData(d) {
            S = Object.assign(fresh(), d);
            S.j = Object.assign(fresh().j, d.j);
            S.j.progress = Object.assign({ index: 0, phase: 'depart' }, d.j && d.j.progress);
            S.j.legs = Array.isArray(S.j.legs) ? S.j.legs : [];
            S.j.checkpoints = Array.isArray(S.j.checkpoints) ? S.j.checkpoints : [];
            if (S.j.started && !S.j.leg) S.j.leg = 'outbound';
            S.trip = Object.assign(fresh().trip, d.trip);
            S.bc = Array.isArray(d.bc) ? d.bc : [];
            S.pc = Array.isArray(d.pc) ? d.pc : [];
            S.pmissed = Array.isArray(d.pmissed) ? d.pmissed : [];
            S.missed = Array.isArray(d.missed) ? d.missed : [];
            S.bags = Array.isArray(d.bags) ? d.bags : []
        }
        const TYPES = ['Suitcase', 'Backpack', 'Duffel bag', 'Handbag', 'Box / carton', 'Other'];
        let S = fresh(), tab = 'trip', view = { m: null }, reg = null, msg = null, sc = null, camOn = false, last = { t: '', at: 0 }, ctab = 'bag', ready = false, selT = new Set(), flow = null;
        const save = () => { if (ready) idb('put', S) };
        const M = i => S.members.find(x => x.id === i), TG = i => S.tags.find(x => x.id === i), BG = i => S.bags.find(x => x.id === i), used = t => S.bags.some(b => b.tagId === t.id);
        const tm = t => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const tag = (t, c) => `<span class='tag ${c}'>${e(t)}</span>`;
        const stages = () => {
            const route = [{ id: 'start', name: S.j.from, role: 'Start' }, ...S.j.stops.map(x => ({ id: x.id, name: x.name, role: 'Connecting' })), { id: 'end', name: S.j.to, role: 'Destination' }];
            return S.j.returning ? route.reverse() : route;
        };
        const progress = () => {
            const list = stages(), p = S.j.progress || {};
            return { index: Math.min(Math.max(0, Number.isInteger(p.index) ? p.index : 0), list.length - 1), phase: p.phase === 'arrive' ? 'arrive' : 'depart' };
        };
        const curStage = () => stages()[progress().index];
        const checkpointKey = () => {
            const p = progress();
            return { leg: S.j.leg || 'outbound', s: curStage().id, phase: p.phase };
        };
        const currentBags = () => {
            const cp = checkpointKey();
            return S.bc.filter(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase);
        };
        const msgHtml = () => msg ? `<div class='msg ${msg.c}'>${e(msg.t)}${msg.i ? `<img class='ph' style='margin-top:8px' src='${msg.i}' alt=''>` : ''}</div>` : '';
        const camBtn = () => camOn ? `<button onclick='cam(false)'>⏹ Stop camera</button>` : `<button class='p' onclick='cam(true)'>📷 Start camera</button>`;
        const passengerReasonText = reason => ({ not_present: 'Not present with group', traveling_separately: 'Traveling separately', sick: 'Sick / resting', with_parent: 'With parent / guardian' }[reason] || reason);
        const bagReasonText = reason => ({ lost: 'Bag missing / lost', stowed: 'Bag empty; items moved into another bag', unverified: 'Bag with group but not scanned' }[reason] || reason);
        function qr(el, text, size) { el.innerHTML = ''; try { new QRCode(el, { text, width: size, height: size, correctLevel: QRCode.CorrectLevel.M }) } catch (_) { el.textContent = 'QR library not loaded. Open once while online.' } }
        const compress = f => new Promise((ok, no) => { const im = new Image(), u = URL.createObjectURL(f); im.onload = () => { const k = Math.min(1, 640 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', 0.65)) }; im.onerror = no; im.src = u });
        /* members */
        function ageForm() {
            const rawAge = $('#ma').value.trim(), age = Number(rawAge), guardian = $('#guardianFields');
            if (!guardian) return;
            guardian.innerHTML = rawAge !== '' && Number.isFinite(age) && age >= 0 && age < 18 ? `<h3>Parent / guardian details</h3><label class='mu'>Parent / guardian name</label><input id='mparent' class='wide' placeholder='Full name'><label class='mu'>Parent / guardian mobile</label><input id='mparentmobile' class='wide' type='tel' placeholder='Contact number'>` : '';
        }
        function addM() {
            const n = $('#mn').value.trim(), age = $('#ma').value.trim(), minor = age !== '' && Number(age) < 18;
            if (!n) { alert('Enter the member name.'); return }
            if (minor && (!$('#mparent')?.value.trim() || !$('#mparentmobile')?.value.trim())) { alert('For a passenger under 18, enter the parent / guardian name and mobile number.'); return }
            S.members.push({ id: uid(), name: n, age, village: $('#mv').value.trim(), mobile: $('#mm').value.trim(), guardianName: minor ? $('#mparent').value.trim() : '', guardianMobile: minor ? $('#mparentmobile').value.trim() : '' });
            save(); render()
        }
        function delM(i) { const bs = S.bags.filter(b => b.owner === i); if (!confirm(`Remove ${M(i).name}${bs.length ? ` and their ${bs.length} bag(s)` : ''}?`)) return; S.bags = S.bags.filter(b => b.owner !== i); S.members = S.members.filter(m => m.id !== i); S.pc = S.pc.filter(x => x.id !== i); S.pmissed = S.pmissed.filter(x => x.id !== i); S.bc = S.bc.filter(x => BG(x.id)); S.missed = S.missed.filter(x => BG(x.id)); view.m = null; save(); render() }
        /* tags and printing */
        function genTags() { const n = Math.max(1, Math.min(100, +$('#qn').value || 10)), mx = Math.max(0, ...S.tags.map(t => t.no)); for (let i = 1; i <= n; i++) { const no = mx + i; S.tags.push({ id: uid(), no, label: 'TG-' + String(no).padStart(3, '0'), token: tok() }) } save(); msg = { c: 'ok', t: `${n} new tags generated. Print them and stick one on each bag.` }; render() }
        function showTag(id) { const t = TG(id), b = S.bags.find(x => x.tagId === id); $('#mt').textContent = t.label; $('#ms').textContent = b ? `Bag of ${(M(b.owner) || {}).name || '?'} · ${b.type}` : 'Unused tag'; $('#modal').style.display = 'flex'; qr($('#mq'), `TRIPGUARD|T|${t.token}`, 220); $('#mp').onclick = () => printTags([id], 1) }
        function printTags(ids, n) { const L = ids.map(TG).filter(Boolean); if (!L.length) return; const sz = { 1: 260, 6: 150, 15: 100 }[n] || 150, p = $('#pr'); p.className = 'g' + n; p.innerHTML = L.map(t => `<div class='lb'><div id='pq${t.id}'></div><b>${t.label}</b><small>TripGuard · ${e(S.trip.name)}</small></div>`).join(''); L.forEach(t => qr(document.getElementById('pq' + t.id), `TRIPGUARD|T|${t.token}`, sz)); setTimeout(() => window.print(), 450) }
        const lay = () => +$('#lay').value;
        function printSel() { if (!selT.size) { alert('Tick the tags you want to print first.'); return } printTags(S.tags.filter(t => selT.has(t.id)).map(t => t.id), lay()) }
        function printUnused() { const u = S.tags.filter(t => !used(t)); if (!u.length) { alert('No unused tags.'); return } printTags(u.map(t => t.id), lay()) }
        function selAll(on) { selT = new Set(on ? S.tags.map(t => t.id) : []); render() }
        function selTag(id, on) { on ? selT.add(id) : selT.delete(id) }
        /* bags */
        function regPhoto(inp) { const f = inp.files && inp.files[0]; if (f) compress(f).then(d => { reg.photo = d; render() }).catch(() => alert('Could not read that image.')) }
        function openReg(id) { if (id) { if (camOn) cam(false); reg = { tag: id, owner: '', type: TYPES[0], desc: '', photo: null }; msg = null; render() } }
        function editBag(i) { const b = BG(i); reg = { tag: b.tagId, bag: b.id, owner: b.owner, type: b.type, desc: b.desc, photo: b.photo }; msg = null; tab = 'bags'; render(); scrollTo(0, 0) }
        function bagState(b) { return b.state || 'active' }
        function saveReg() {
            if (!reg.owner) { alert('Choose whose bag this is.'); return }
            const t = TG(reg.tag), isNew = !reg.bag;
            if (reg.bag) Object.assign(BG(reg.bag), { owner: reg.owner, type: reg.type, desc: reg.desc.trim(), photo: reg.photo });
            else {
                const b = { id: uid(), tagId: reg.tag, owner: reg.owner, type: reg.type, desc: reg.desc.trim(), photo: reg.photo, state: 'active' };
                S.bags.push(b);
                if (S.j.started) S.bc.push({ ...checkpointKey(), id: b.id, t: Date.now() });
            }
            msg = { c: 'ok', t: isNew && S.j.started ? `${t.label} added and scanned at ${curStage().name}.` : `${t.label} saved for ${M(reg.owner).name}. Scan the next tag.` };
            reg = null; save(); render()
        }
        function restoreBag(id, scanNow = false) {
            const b = BG(id);
            if (!b || bagState(b) === 'active') return;
            b.state = 'active';
            if (scanNow && S.j.started) {
                const cp = checkpointKey();
                if (!currentBags().some(x => x.id === b.id)) S.bc.push({ ...cp, id: b.id, t: Date.now() });
            }
            save(); msg = { c: 'ok', t: scanNow && S.j.started ? `${TG(b.tagId).label} marked found and scanned here.` : `${TG(b.tagId).label} marked found and available.` }; render()
        }
        function resumeBag(id) {
            const b = BG(id);
            if (!b || bagState(b) !== 'stowed') return;
            b.state = 'active'; save(); msg = { c: 'ok', t: `${TG(b.tagId).label} is traveling again. Scan it at this checkpoint.` }; render()
        }
        function delBag(i) { if (!confirm('Remove this bag? Its tag becomes unused again.')) return; S.bags = S.bags.filter(b => b.id !== i); S.bc = S.bc.filter(x => x.id !== i); S.missed = S.missed.filter(x => x.id !== i); save(); render() }
        const bagCard = b => { const t = TG(b.tagId), state = bagState(b), missed = S.missed.slice().reverse().find(x => x.id === b.id), reason = missed ? `<div class='mu'>Last not-scanned reason: ${e(bagReasonText(missed.reason))}</div>` : '', status = state === 'active' ? '' : `<div class='msg ${state === 'lost' ? 'bad' : 'wn'}'>${state === 'lost' ? '⚠️ Lost / missing — scanning is blocked until found.' : state === 'stowed' ? '📦 Empty / moved into another bag — not expected at check-ins.' : '⚠️ Not verified at the last checkpoint — scanning is blocked until found.'}</div>${reason}`, restore = state === 'stowed' ? `<button class='s' onclick="resumeBag('${b.id}')">Traveling again</button>` : state !== 'active' ? `<button class='s p' onclick="restoreBag('${b.id}')">Mark found / available</button>` : ''; return `<div class='card row'>${b.photo ? `<img class='ph' src='${b.photo}' alt=''>` : `<div class='ph nop'>🧳</div>`}<div style='flex:1;min-width:150px'><h3>${t.label} · ${e(b.type)}</h3><div class='mu'>${e(b.desc) || 'No description'}</div><div class='mu'>Owner: ${e((M(b.owner) || {}).name || 'none')}</div>${status}<div class='row' style='margin-top:8px'><button class='s' onclick="editBag('${b.id}')">Edit</button><button class='s' onclick="showTag('${t.id}')">QR</button>${restore}<button class='s d' onclick="delBag('${b.id}')">Remove</button></div></div></div>` };
        /* journey */
        function addStop() { const n = $('#sn').value.trim(); if (n) { S.j.stops.push({ id: uid(), name: n }); save(); render() } }
        function delStop(i) { S.j.stops.splice(i, 1); save(); render() }
        function moveStop(i, d) { const a = S.j.stops, k = i + d; if (k < 0 || k >= a.length) return;[a[i], a[k]] = [a[k], a[i]]; save(); render() }
        function startTrip() {
            if (!S.j.from.trim() || !S.j.to.trim()) { alert('Enter the start point and the final destination first.'); return }
            if (!S.bags.length && !confirm('No bags are registered yet. Start the pre-departure check anyway?')) return;
            S.j.returning = false; S.j.leg = uid(); S.j.started = true; S.j.ended = false; S.j.progress = { index: 0, phase: 'depart' };
            S.j.legs = [{ id: S.j.leg, returning: false }]; S.j.checkpoints = [];
            save(); go('check')
        }
        async function checkpointAction() {
            const p = progress(), list = stages();
            if (p.phase === 'depart' && !list[p.index + 1]) { msg = { c: 'bad', t: 'There is no next location on this route. Review the journey before continuing.' }; return render() }
            if (camOn) await cam(false);
            const missing = S.bags.filter(b => bagState(b) === 'active' && !currentBags().some(x => x.id === b.id));
            const cp = checkpointKey(), passengers = {};
            for (const person of S.members) {
                const checked = S.pc.some(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id);
                const saved = S.pmissed.slice().reverse().find(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id);
                if (!checked && saved) passengers[person.id] = { status: 'no', reason: ['not_present', 'traveling_separately', 'sick', 'with_parent'].includes(saved.reason) ? saved.reason : 'other', otherText: ['not_present', 'traveling_separately', 'sick', 'with_parent'].includes(saved.reason) ? '' : saved.reason };
            }
            flow = { p, missing: missing.map(b => b.id), reasons: {}, passengers };
            $('#flowTitle').textContent = p.phase === 'arrive' && p.index === list.length - 1 ? 'End trip check' : `${p.phase === 'depart' ? 'Leaving' : 'Arriving at'} ${curStage().name}`;
            renderFlow(); $('#flowModal').style.display = 'flex'
        }
        function renderFlow() {
            if (!flow) return;
            const options = `<option value=''>Choose a reason…</option><option value='lost'>⚠️ Bag is missing / lost</option><option value='stowed'>📦 Bag is empty; items moved into another bag</option><option value='unverified'>🧳 Bag is with the group but was not scanned</option><option value='other'>❓ Other reason</option>`;
            const rows = flow.missing.map(id => {
                const b = BG(id), reason = flow.reasons[id] || '';
                const otherText = flow.reasons[`${id}Text`] || '';
                return `<div class='flowBag'><b>🧳 ${e(TG(b.tagId).label)} · ${e((M(b.owner) || {}).name || 'Unknown owner')}</b><label class='mu'>Why was this bag not scanned?</label><select class='wide' aria-label='Reason bag was not scanned' onchange="flow.reasons['${id}']=this.value;renderFlow()">${options.replace(`value='${reason}'`, `value='${reason}' selected`)}</select>${reason === 'other' ? `<label class='mu'>Tell us why</label><input class='wide' aria-label='Other reason' value='${e(otherText)}' oninput="flow.reasons['${id}Text']=this.value" placeholder='Enter a short reason'>` : ''}</div>`
            }).join('');
            const cp = checkpointKey(), people = S.members.map(person => {
                const checked = S.pc.some(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id);
                const answer = flow.passengers[person.id] || {};
                const reason = answer.reason || '';
                const reasonOptions = `<option value=''>Choose a reason…</option><option value='not_present'>🚶 Not present with the group</option><option value='traveling_separately'>🚌 Traveling separately</option><option value='sick'>🤒 Sick / resting</option><option value='with_parent'>👪 With parent / guardian</option><option value='other'>❓ Other reason</option>`;
                const saved = S.pmissed.slice().reverse().find(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id);
                return `<div class='flowBag'><b>👤 ${e(person.name)}${Number(person.age) < 18 ? ' · Minor' : ''}</b>${person.guardianName ? `<div class='mu'>Parent / guardian: ${e(person.guardianName)} · ${e(person.guardianMobile)}</div>` : ''}<label class='mu'>Passenger check-in at ${e(curStage().name)}</label>${checked ? `<div class='msg ok'>✅ Checked in at this checkpoint.</div>` : `<select class='wide' aria-label='Passenger check-in status for ${e(person.name)}' onchange="flow.passengers['${person.id}']={...(flow.passengers['${person.id}']||{}),status:this.value};renderFlow()"><option value=''>Choose status…</option><option value='yes' ${answer.status === 'yes' ? 'selected' : ''}>✅ Checked in</option><option value='no' ${answer.status === 'no' ? 'selected' : ''}>⚠️ Not checked in</option></select>${answer.status === 'no' ? `<label class='mu'>Reason this passenger is not checked in</label><select class='wide' aria-label='Reason passenger not checked in' onchange="flow.passengers['${person.id}']={...(flow.passengers['${person.id}']||{}),reason:this.value};renderFlow()">${reasonOptions.replace(`value='${reason}'`, `value='${reason}' selected`)}</select>${reason === 'other' ? `<label class='mu'>Tell us why</label><input class='wide' aria-label='Other passenger reason' value='${e(answer.otherText || '')}' oninput="flow.passengers['${person.id}']={...(flow.passengers['${person.id}']||{}),otherText:this.value}">` : ''}` : ''}${saved ? `<div class='mu'>Previous reason: ${e(saved.reason)}</div>` : ''}</div>`}`
            }).join('');
            const final = flow.p.phase === 'arrive' && flow.p.index === stages().length - 1;
            const title = flow.missing.length ? 'Some bags were not scanned' : final ? 'All bags checked at destination' : 'Checkpoint bag check';
            const help = flow.missing.length ? 'For each bag, choose why it was not scanned. Lost or unverified bags will be blocked at the next check until marked found.' : 'All active bags are scanned for this checkpoint.';
            $('#flowBody').innerHTML = `<p>${help}</p>${flow.missing.length ? rows : `<div class='msg ok'>✅ ${S.bags.filter(b => bagState(b) === 'active').length} active bag(s) scanned.</div>`}<h3>Passenger check-in</h3><p class='mu'>Confirm who is checked in. For every passenger who is not checked in, record a reason.</p>${people}<div class='row' style='margin-top:14px'><button class='s' onclick='closeFlow()'>${flow.missing.length ? '📷 Go back and scan bags' : 'Cancel'}</button><button class='p' onclick='continueFlow()'>${flow.missing.length ? '⚠️ Continue anyway' : final ? '🏁 End trip' : '✅ Confirm and continue'}</button></div>`;
            $('#flowTitle').textContent = title
        }
        function closeFlow() { flow = null; $('#flowModal').style.display = 'none' }
        function continueFlow() {
            if (!flow) return;
            for (const id of flow.missing) {
                const reason = flow.reasons[id], otherText = flow.reasons[id + 'Text'];
                if (!reason || (reason === 'other' && !otherText?.trim())) {
                    msg = { c: 'wn', t: 'Choose a reason for every unscanned bag before continuing.' };
                    $('#flowBody').insertAdjacentHTML('afterbegin', msgHtml()); return
                }
            }
            const cp = checkpointKey();
            for (const person of S.members) {
                const alreadyChecked = S.pc.some(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id);
                if (alreadyChecked) continue;
                const answer = flow.passengers[person.id] || {};
                if (!['yes', 'no'].includes(answer.status) || (answer.status === 'no' && (!answer.reason || (answer.reason === 'other' && !answer.otherText?.trim())))) {
                    msg = { c: 'wn', t: 'Record each passenger check-in status, and a reason for every passenger not checked in.' };
                    $('#flowBody').insertAdjacentHTML('afterbegin', msgHtml()); return
                }
            }
            const { p, missing, reasons } = flow, final = p.phase === 'arrive' && p.index === stages().length - 1;
            for (const person of S.members) {
                const alreadyChecked = S.pc.some(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id);
                if (alreadyChecked) continue;
                const answer = flow.passengers[person.id];
                if (answer.status === 'yes') {
                    S.pc.push({ ...cp, id: person.id, t: Date.now() });
                    S.pmissed = S.pmissed.filter(x => !((x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id))
                }
                else {
                    const report = S.pmissed.find(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id);
                    const values = { ...cp, id: person.id, location: curStage().name, reason: answer.reason === 'other' ? answer.otherText.trim() : answer.reason, other: answer.reason === 'other', t: Date.now() };
                    report ? Object.assign(report, values) : S.pmissed.push(values)
                }
            }
            for (const id of missing) {
                const reason = reasons[id], b = BG(id), text = reason === 'other' ? reasons[id + 'Text'].trim() : reason;
                const passengerChecked = S.pc.some(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === b.owner);
                S.missed.push({ ...checkpointKey(), location: curStage().name, id, reason: text, passengerChecked, t: Date.now() });
                b.state = reason === 'lost' ? 'lost' : reason === 'stowed' ? 'stowed' : 'unverified';
            }
            S.j.checkpoints.push({ ...cp, location: curStage().name, t: Date.now() });
            closeFlow();
            if (final) {
                S.j.started = false; S.j.ended = true; save();
                msg = { c: missing.length ? 'wn' : 'ok', t: `Trip completed at ${curStage().name}. Check-in history was kept.` }; render(); return
            }
            S.j.progress = p.phase === 'arrive' ? { index: p.index, phase: 'depart' } : { index: p.index + 1, phase: 'arrive' };
            msg = { c: missing.length ? 'wn' : 'ok', t: p.phase === 'arrive' ? `Departure check opened for ${curStage().name}.` : `Next checkpoint: ${stages()[progress().index].name}.` };
            save(); render()
        }
        function startReturnTrip() {
            if (!S.j.ended) return;
            S.j.returning = !S.j.returning; S.j.leg = uid(); S.j.started = true; S.j.ended = false;
            S.j.legs.push({ id: S.j.leg, returning: S.j.returning });
            S.j.progress = { index: 0, phase: 'depart' }; ctab = 'bag'; msg = null; save(); go('check')
        }
        /* scanning */
        function handle(text) {
            const m = String(text).trim().split('|'); if (m[0] !== 'TRIPGUARD' || m[1] !== 'T' || m.length !== 3) { msg = { c: 'bad', t: 'This is not a TripGuard bag tag.' }; return render() }
            const t = S.tags.find(x => x.token === m[2]); if (!t) { msg = { c: 'bad', t: 'Unknown tag. It does not belong to this trip on this device.' }; return render() }
            const b = S.bags.find(x => x.tagId === t.id);
            if (tab === 'bags') { if (reg && reg.tag !== t.id) { msg = { c: 'wn', t: 'Save or cancel the bag you are registering first.' } } else if (b) { msg = { c: 'wn', t: bagState(b) === 'active' ? `${t.label} is already registered to ${(M(b.owner) || {}).name}. Use Edit to change it.` : `${t.label} is blocked: ${bagState(b) === 'lost' ? 'reported lost' : bagState(b) === 'stowed' ? 'marked empty / moved' : 'not verified at a checkpoint'}. Mark it found / available before scanning.`, i: b.photo }; reg = null } else { reg = { tag: t.id, owner: '', type: TYPES[0], desc: '', photo: null }; msg = { c: 'ok', t: `${t.label} scanned. Add the bag details below.` } } }
            else if (tab === 'check') checkBag(t, b); render()
        }
        function checkBag(t, b) {
            if (!b) { msg = { c: 'wn', t: `${t.label} has no bag details yet. Register it in the Bags tab first.` }; return }
            if (bagState(b) !== 'active') { msg = { c: 'bad', t: `${t.label} is blocked because it is ${bagState(b) === 'lost' ? 'reported lost' : bagState(b) === 'stowed' ? 'empty / moved into another bag' : 'not verified at a previous checkpoint'}. Mark it found / available before scanning.` }; return }
            const cp = checkpointKey(), o = (M(b.owner) || {}).name; if (currentBags().some(x => x.id === b.id)) { msg = { c: 'wn', t: `${t.label} (${o}) is already scanned for this checkpoint. Count unchanged.` }; return }
            S.bc.push({ ...cp, id: b.id, t: Date.now() }); save(); msg = { c: 'ok', t: `${t.label} scanned for ${progress().phase === 'depart' ? 'departure' : 'arrival'} check (${o}).`, i: b.photo }
        }
        function manualBag(id) { const b = BG(id); if (b) checkBag(TG(b.tagId), b); render() }
        function togP(id) {
            const cp = checkpointKey(), i = S.pc.findIndex(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === id);
            if (i >= 0) S.pc.splice(i, 1);
            else { S.pc.push({ ...cp, id, t: Date.now() }); S.pmissed = S.pmissed.filter(x => !((x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === id)) }
            save(); render()
        }
        function savePassengerReason(id, reason) {
            const cp = checkpointKey(), existing = S.pmissed.find(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === id);
            if (!reason) { S.pmissed = S.pmissed.filter(x => x !== existing); save(); render(); return }
            const report = existing || { ...cp, id, location: curStage().name, t: Date.now() };
            Object.assign(report, { reason: reason === 'other' ? '' : reason, other: reason === 'other', t: Date.now() });
            if (!existing) S.pmissed.push(report);
            save(); render()
        }
        function savePassengerOther(id, text) {
            const cp = checkpointKey(), report = S.pmissed.find(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === id);
            if (report) { report.reason = text.trim(); report.other = true; report.t = Date.now(); save() }
        }
        function passengerReport(cp) {
            const checked = new Map(S.pc.filter(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase).map(x => [x.id, x]));
            const total = S.members.length, present = checked.size, people = S.members.map(person => {
                const check = checked.get(person.id), report = S.pmissed.slice().reverse().find(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === person.id);
                const reason = report?.reason || '';
                const known = ['not_present', 'traveling_separately', 'sick', 'with_parent'];
                const customReason = report && report.reason && !known.includes(report.reason);
                const choices = `<option value=''>Select reason…</option><option value='not_present' ${report?.reason === 'not_present' ? 'selected' : ''}>Not present with group</option><option value='traveling_separately' ${report?.reason === 'traveling_separately' ? 'selected' : ''}>Traveling separately</option><option value='sick' ${report?.reason === 'sick' ? 'selected' : ''}>Sick / resting</option><option value='with_parent' ${report?.reason === 'with_parent' ? 'selected' : ''}>With parent / guardian</option><option value='other' ${report?.other || customReason ? 'selected' : ''}>Other reason</option>`;
                return `<div class='item'><span><b>${e(person.name)}${Number(person.age) < 18 ? ' · Minor' : ''}</b><div class='mu'>${check ? `Checked in ${tm(check.t)}` : `Not checked in · Reason: ${reason ? e(passengerReasonText(reason)) : 'Not recorded'}`}</div>${!check && person.guardianName ? `<div class='mu'>Parent / guardian: ${e(person.guardianName)} · ${e(person.guardianMobile)}</div>` : ''}${!check && (report?.other || customReason) ? `<input class='wide' aria-label='Other passenger reason' value='${e(report.reason)}' placeholder='Tell us why not checked in' oninput="savePassengerOther('${person.id}',this.value)">` : ''}</span>${check ? `<button class='s' onclick="togP('${person.id}')">Undo</button>` : `<span><select aria-label='Reason passenger not checked in' onchange="savePassengerReason('${person.id}',this.value)">${choices}</select>${!report || !report.reason ? `<div class='mu'>Choose a reason for the report.</div>` : ''}<button class='s p' onclick="togP('${person.id}')">Check in</button></span>`}</div>`
            }).join('');
            return `<div class='card'><div class='row sp'><h3>Passenger check-in · ${e(curStage().name)}</h3>${tag(`${present} / ${total} checked in`, present === total && total ? 'ok' : 'wn')}</div><div class='bar'><i style='width:${total ? present / total * 100 : 0}%'></i></div>${people || `<span class='mu'>No passengers added.</span>`}</div>`
        }
        function passengerHistory() {
            const reports = S.pmissed.slice().reverse();
            return reports.length ? `<div class='card'><h3>Previous passenger non-check-in reports (${reports.length})</h3>${reports.map(x => { const person = M(x.id); return `<div class='item'><span><b>${e(person?.name || 'Removed passenger')}</b> · ${e(x.location || x.s)} · ${x.phase === 'depart' ? 'Departure' : 'Arrival'}<div class='mu'>Reason: ${e(passengerReasonText(x.reason || 'Not recorded'))}</div><div class='mu'>${new Date(x.t).toLocaleString()}</div></span></div>` }).join('')}</div>` : ''
        }
        function tripReport() {
            const leg = S.j.leg || 'outbound', route = stages().map(x => x.name).filter(Boolean).join(' → '), checkpoints = new Map();
            const getCheckpoint = x => {
                const key = `${x.s}|${x.phase || 'arrive'}`;
                if (!checkpoints.has(key)) checkpoints.set(key, { s: x.s, phase: x.phase || 'arrive', time: x.t || 0, passengersChecked: new Map(), passengersMissed: new Map(), bagsScanned: new Set(), bagsMissed: new Map() });
                const checkpoint = checkpoints.get(key);
                checkpoint.time = Math.min(checkpoint.time || x.t || 0, x.t || checkpoint.time || 0);
                return checkpoint
            };
            const inLeg = x => (x.leg || 'outbound') === leg;
            S.pc.filter(inLeg).forEach(x => getCheckpoint(x).passengersChecked.set(x.id, x));
            S.pmissed.filter(inLeg).forEach(x => getCheckpoint(x).passengersMissed.set(x.id, x));
            S.bc.filter(inLeg).forEach(x => getCheckpoint(x).bagsScanned.add(x.id));
            S.missed.filter(inLeg).forEach(x => getCheckpoint(x).bagsMissed.set(x.id, x));
            const records = [...checkpoints.values()].sort((a, b) => a.time - b.time);
            const stageName = id => stages().find(x => x.id === id)?.name || id;
            const rows = records.map(cp => {
                const missedPassengers = [...cp.passengersMissed.values()].filter(x => !cp.passengersChecked.has(x.id));
                const checkedNames = [...cp.passengersChecked.keys()].map(id => M(id)?.name || 'Removed passenger');
                const missedBags = [...cp.bagsMissed.values()];
                const scannedTags = [...cp.bagsScanned].map(id => { const bag = BG(id); return bag ? TG(bag.tagId)?.label || 'Removed tag' : 'Removed bag' });
                return `<div class='card'><h3>${cp.phase === 'depart' ? 'Departure' : 'Arrival'} · ${e(stageName(cp.s))}</h3><div class='mu'>${cp.time ? new Date(cp.time).toLocaleString() : ''}</div><p><b>Passengers:</b> ${checkedNames.length} checked in${checkedNames.length ? ` — ${checkedNames.map(e).join(', ')}` : ''}</p>${missedPassengers.length ? `<p><b>Not checked in:</b> ${missedPassengers.map(x => `${e(M(x.id)?.name || 'Removed passenger')} (${e(passengerReasonText(x.reason || 'Not recorded'))})`).join(', ')}</p>` : ''}<p><b>Bags:</b> ${scannedTags.length} scanned${scannedTags.length ? ` — ${scannedTags.map(e).join(', ')}` : ''}</p>${missedBags.length ? `<p><b>Not scanned:</b> ${missedBags.map(x => { const bag = BG(x.id), label = bag ? TG(bag.tagId)?.label || 'Removed tag' : 'Removed bag'; return `${e(label)} (${e(bagReasonText(x.reason || 'Not recorded'))})` }).join(', ')}</p>` : ''}</div>`
            }).join('');
            const passengerChecks = records.reduce((n, cp) => n + cp.passengersChecked.size, 0), missedPassengers = records.reduce((n, cp) => n + [...cp.passengersMissed.keys()].filter(id => !cp.passengersChecked.has(id)).length, 0), bagScans = records.reduce((n, cp) => n + cp.bagsScanned.size, 0), missedBags = records.reduce((n, cp) => n + cp.bagsMissed.size, 0);
            return `<h1>Trip report</h1><div class='card'><h3>${e(S.trip.name || 'Trip')}</h3>${route ? `<p><b>Route:</b> ${e(route)}</p>` : ''}${S.trip.date ? `<p><b>Trip date:</b> ${e(S.trip.date)}</p>` : ''}<p><b>Members:</b> ${S.members.length} · <b>Bags registered:</b> ${S.bags.length} · <b>Checkpoints:</b> ${records.length}</p><p><b>Passenger check-ins:</b> ${passengerChecks} · <b>Not checked-in reports:</b> ${missedPassengers}</p><p><b>Bag scans:</b> ${bagScans} · <b>Unscanned bag reports:</b> ${missedBags}</p></div>${rows || `<div class='card mu'>No checkpoint activity was recorded for this trip.</div>`}<div class='row'><button class='s' onclick="go('journey')">Journey</button><button class='p' onclick='finishTrip()'>Download PDF and clear this device</button></div>`
        }
        async function finishTrip() {
            if (!S.j.ended || S.j.started) return;
            try {
                const JsPDF = window.jspdf && window.jspdf.jsPDF;
                if (!JsPDF) throw new Error('PDF library is unavailable.');
                const doc = new JsPDF(), pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight(), margin = 15;
                let y = 18;
                const line = (text, size = 10, bold = false) => {
                    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size);
                    const lines = doc.splitTextToSize(String(text), pageWidth - margin * 2);
                    if (y + lines.length * 5 + 2 > pageHeight - margin) { doc.addPage(); y = 18 }
                    doc.text(lines, margin, y); y += lines.length * 5 + 2
                };
                const activity = [...S.pc, ...S.pmissed, ...S.bc, ...S.missed], legTimes = new Map();
                activity.forEach(x => { const id = x.leg || 'outbound'; legTimes.set(id, Math.min(legTimes.get(id) || x.t || 0, x.t || legTimes.get(id) || 0)) });
                let legs = S.j.legs.filter(x => x && x.id);
                if (!legs.length) {
                    const ids = [...legTimes.keys()].sort((a, b) => legTimes.get(a) - legTimes.get(b));
                    if (S.j.leg && !ids.includes(S.j.leg)) ids.push(S.j.leg);
                    legs = ids.map((id, i) => ({ id, returning: S.j.returning ? (ids.length - 1 - i) % 2 === 0 : (ids.length - 1 - i) % 2 === 1 }));
                }
                if (!legs.length && S.j.leg) legs = [{ id: S.j.leg, returning: !!S.j.returning }];
                const baseStages = [{ id: 'start', name: S.j.from }, ...S.j.stops.map(x => ({ id: x.id, name: x.name })), { id: 'end', name: S.j.to }];
                const stageNames = new Map(baseStages.map(x => [x.id, x.name]));
                const checkpoints = new Map(), getCheckpoint = x => {
                    const leg = x.leg || 'outbound', phase = x.phase || 'arrive', key = `${leg}|${x.s}|${phase}`;
                    if (!checkpoints.has(key)) checkpoints.set(key, { leg, s: x.s, phase, time: x.t || 0, passengersChecked: new Map(), passengersMissed: new Map(), bagsScanned: new Set(), bagsMissed: new Map() });
                    const cp = checkpoints.get(key);
                    cp.time = Math.min(cp.time || x.t || 0, x.t || cp.time || 0);
                    return cp
                };
                S.j.checkpoints.forEach(x => getCheckpoint(x));
                S.pc.forEach(x => getCheckpoint(x).passengersChecked.set(x.id, x));
                S.pmissed.forEach(x => getCheckpoint(x).passengersMissed.set(x.id, x));
                S.bc.forEach(x => getCheckpoint(x).bagsScanned.add(x.id));
                S.missed.forEach(x => getCheckpoint(x).bagsMissed.set(x.id, x));
                const legOrder = new Map(legs.map((x, i) => [x.id, { ...x, index: i }]));
                const stagePosition = cp => {
                    const leg = legOrder.get(cp.leg), routeStages = leg && leg.returning ? baseStages.slice().reverse() : baseStages;
                    return routeStages.findIndex(x => x.id === cp.s)
                };
                const records = [...checkpoints.values()].sort((a, b) => {
                    const ai = legOrder.get(a.leg)?.index ?? 0, bi = legOrder.get(b.leg)?.index ?? 0;
                    return ai - bi || stagePosition(a) - stagePosition(b) || (a.phase === 'depart' ? -1 : 1) - (b.phase === 'depart' ? -1 : 1) || a.time - b.time
                });
                const routeText = baseStages.map(x => x.name).filter(Boolean).join(' -> ');
                const slug = (S.trip.name || 'trip').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'trip';
                line('TRIPGUARD - TRIP REPORT', 18, true);
                line(`Trip: ${S.trip.name || 'My trip'}`, 12, true);
                if (S.trip.date) line(`Trip date: ${S.trip.date}`);
                if (routeText) line(`Route: ${routeText}`);
                line(`Members: ${S.members.length} | Registered bags: ${S.bags.length} | Checkpoints: ${records.length}`);
                line(`Generated: ${new Date().toLocaleString()}`);
                line('');
                for (const cp of records) {
                    const leg = legOrder.get(cp.leg), routeStages = leg && leg.returning ? baseStages.slice().reverse() : baseStages;
                    const stageIndex = routeStages.findIndex(x => x.id === cp.s), direction = leg && leg.returning ? 'RETURN' : 'OUTBOUND';
                    line(`${direction} - ${cp.phase === 'depart' ? 'DEPARTURE' : 'ARRIVAL'}: ${stageNames.get(cp.s) || cp.s}`, 12, true);
                    if (cp.time) line(`Time: ${new Date(cp.time).toLocaleString()}`);
                    const checked = [], absent = [];
                    for (const person of S.members) {
                        if (cp.passengersChecked.has(person.id)) checked.push(person.name);
                        else {
                            const report = cp.passengersMissed.get(person.id);
                            absent.push(report ? `${person.name} - ${passengerReasonText(report.reason || 'Not recorded')}` : `${person.name} - No status recorded`);
                        }
                    }
                    line(`Passengers checked in (${checked.length}/${S.members.length}): ${checked.length ? checked.join(', ') : 'None recorded'}`);
                    if (absent.length) line(`Not checked in: ${absent.join('; ')}`);
                    const scanned = [], unscanned = [];
                    for (const bag of S.bags) {
                        const tagLabel = TG(bag.tagId)?.label || 'Unknown tag', owner = M(bag.owner)?.name || 'Unknown owner';
                        if (cp.bagsScanned.has(bag.id)) scanned.push(`${tagLabel} (${owner}, ${bag.type})`);
                        else {
                            const report = cp.bagsMissed.get(bag.id);
                            unscanned.push(report ? `${tagLabel} (${owner}) - ${bagReasonText(report.reason || 'Not recorded')}` : `${tagLabel} (${owner}) - No scan recorded`);
                        }
                    }
                    line(`Bags scanned (${scanned.length}/${S.bags.length}): ${scanned.length ? scanned.join(', ') : 'None recorded'}`);
                    if (unscanned.length) line(`Not scanned: ${unscanned.join('; ')}`);
                    if (stageIndex >= 0 && stageIndex < routeStages.length - 1) line(`Next stop: ${routeStages[stageIndex + 1].name}`);
                    line('')
                }
                const url = URL.createObjectURL(doc.output('blob')), link = document.createElement('a');
                link.href = url; link.download = `TripGuard-${slug}-report.pdf`; document.body.appendChild(link); link.click(); link.remove();
                setTimeout(() => URL.revokeObjectURL(url), 2000);
                S = fresh(); flow = null; $('#flowModal').style.display = 'none'; reg = null; view.m = null; selT = new Set(); tab = 'trip';
                await idb('put', S);
                msg = { c: 'ok', t: 'Trip report downloaded. Trip details have been cleared from this device.' };
                render(); scrollTo(0, 0)
            } catch (error) {
                console.error('Could not generate or save the trip report.', error);
                msg = { c: 'bad', t: 'Could not download the trip report. Trip details were kept; please try again.' };
                render()
            }
        }
        function bagHistory() {
            const reports = S.missed.slice().reverse();
            return reports.length ? `<div class='card'><h3>Previous unscanned bag reports (${reports.length})</h3>${reports.map(x => { const bag = BG(x.id), owner = bag && M(bag.owner); return `<div class='item'><span><b>${e(bag ? TG(bag.tagId).label : 'Removed bag')}</b>${owner ? ` · ${e(owner.name)}` : ''} · ${e(x.location || x.s)} · ${x.phase === 'depart' ? 'Departure' : 'Arrival'}<div class='mu'>Reason: ${e(bagReasonText(x.reason || 'Not recorded'))}</div><div class='mu'>${new Date(x.t).toLocaleString()}</div></span></div>` }).join('')}</div>` : ''
        }
        async function cam(on) {
            if (on && !camOn) { $('#cam').style.display = 'block'; try { sc = new Html5Qrcode('cam'); await sc.start({ facingMode: 'environment' }, { fps: 10, qrbox: 220 }, t => { const n = Date.now(); if (t === last.t && n - last.at < 2500) return; last = { t, at: n }; if (tab === 'bags') cam(false); handle(t) }); camOn = true } catch (_) { msg = { c: 'bad', t: 'Camera unavailable or permission denied. Use the manual list instead.' }; camOn = false; sc = null } }
            else if (!on && sc) { try { await sc.stop(); sc.clear() } catch (_) { } camOn = false; sc = null } render()
        }
        /* backup */
        function exportFile() { const slug = (S.trip.name || 'trip').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'trip', name = `TripGuard-${slug}-${new Date().toISOString().slice(0, 10)}.json`, blob = new Blob([JSON.stringify({ app: 'TripGuard', version: 7, exportedAt: new Date().toISOString(), data: S }, null, 1)], { type: 'application/json' }), a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); msg = { c: 'ok', t: `Exported ${name}. Check your Downloads folder.` }; render() }
        async function importFile(inp) {
            const f = inp.files && inp.files[0]; if (!f) return; try {
                const j = JSON.parse(await f.text()), d = j && j.data; if (!d || j.app !== 'TripGuard' || !Array.isArray(d.members) || !Array.isArray(d.tags) || !Array.isArray(d.bags)) throw 0;
                if (!confirm(`Import “${(d.trip || {}).name || 'trip'}” with ${d.members.length} members, ${d.tags.length} tags and ${d.bags.length} bags? This replaces the trip on this device.`)) { inp.value = ''; return }
                loadData(d); flow = null; $('#flowModal').style.display = 'none'; reg = null; view.m = null; selT = new Set(); save(); msg = { c: 'ok', t: `Imported ${f.name}.` }
            } catch (_) { msg = { c: 'bad', t: 'That file is not a valid TripGuard V7 export (.json).' } } inp.value = ''; render()
        }
        function wipe() { if (confirm('Delete the whole trip from this device? Export a file first if you need it.')) { S = fresh(); flow = null; $('#flowModal').style.display = 'none'; reg = null; view.m = null; save(); render() } }
        /* views */
        const V = {
            trip() {
                const st = [[S.members.length > 0, 'Add members', 'members'], [S.tags.length > 0, 'Generate and print QR tags', 'tags'], [S.bags.length > 0, 'Scan tags and add bag details', 'bags'], [!!(S.j.from && S.j.to), 'Set start, connections and destination', 'journey'], [S.j.started || S.j.ended, S.j.ended ? 'Trip completed' : 'Check bags along the route', 'check']];
                return `<h1>Trip</h1>${msgHtml()}<div class='card'><label class='mu' style='margin-top:0'>Trip name</label><input class='wide' value='${e(S.trip.name)}' onchange='S.trip.name=this.value;save()'><label class='mu'>Date</label><input type='date' class='wide' value='${e(S.trip.date)}' onchange='S.trip.date=this.value;save()'></div>
<div class='grid'><div class='card'><div class='big'>${S.members.length}</div><span class='mu'>members</span></div><div class='card'><div class='big'>${S.tags.length}</div><span class='mu'>QR tags</span></div><div class='card'><div class='big'>${S.bags.length}</div><span class='mu'>bags registered</span></div></div><h2>Steps</h2>` + st.map(([d, t, k], i) => `<div class='card row sp'><span><b>${i + 1}.</b> ${t}</span><span class='row'>${tag(d ? 'Done' : 'To do', d ? 'ok' : 'wn')}<button class='s' onclick="go('${k}')">Open</button></span></div>`).join('')
            },
            members() {
                if (view.m && M(view.m)) { const m = M(view.m), bs = S.bags.filter(b => b.owner === m.id); return `<button class='s' onclick='view.m=null;render()'>← All members</button><div class='card'><h2 style='margin-top:0'>${e(m.name)}</h2><p class='mu'>Age ${e(m.age) || '—'} · Village ${e(m.village) || '—'} · Mobile ${e(m.mobile) || '—'}</p>${m.guardianName ? `<p class='mu'>Parent / guardian: ${e(m.guardianName)} · ${e(m.guardianMobile)}</p>` : ''}</div><h2>Bags (${bs.length})</h2>` + (bs.map(bagCard).join('') || `<div class='card mu'>No bags yet. Scan a tag in the Bags tab and choose ${e(m.name)} as the owner.</div>`) }
                return `<h1>Members (${S.members.length})</h1><div class='card'><h3>Add member</h3><div class='grid' style='margin:10px 0'><input id='mn' placeholder='Name'><input id='ma' type='number' min='0' placeholder='Age' oninput='ageForm()'><input id='mv' placeholder='Village'><input id='mm' type='tel' placeholder='Mobile no.'></div><div id='guardianFields'></div><button class='p' onclick='addM()'>Add member</button></div>` + (S.members.map(m => `<div class='card row sp' style='cursor:pointer' onclick="view.m='${m.id}';render()"><div><h3>${e(m.name)}</h3><div class='mu'>Age ${e(m.age) || '—'} · ${e(m.village) || '—'} · ${e(m.mobile) || '—'}</div>${m.guardianName ? `<div class='mu'>Parent / guardian: ${e(m.guardianName)} · ${e(m.guardianMobile)}</div>` : ''}</div><div class='row'>${tag(S.bags.filter(b => b.owner === m.id).length + ' bags', 'ld')}<button class='s d' onclick="event.stopPropagation();delM('${m.id}')">Remove</button></div></div>`).join('') || `<div class='card mu'>No members yet. Add the first one above.</div>`)
            },
            tags() {
                const un = S.tags.filter(t => !used(t)); return `<h1>QR tags</h1>${msgHtml()}<div class='card'><h3>Generate tags</h3><p class='mu'>Common QR stickers with different numbers. Any tag can go on any bag.</p><div class='row'><input id='qn' type='number' min='1' max='100' value='10' style='width:90px' aria-label='How many tags'><button class='p' onclick='genTags()'>Generate</button></div></div>
<div class='card'><h3>Print</h3><div class='row'><select id='lay' aria-label='Layout'><option value='1'>1 tag per page</option><option value='6' selected>6 tags per page</option><option value='15'>15 tags per page</option></select><button class='p' onclick='printSel()'>Print selected</button><button onclick='printUnused()'>Print all unused</button></div><div class='row' style='margin-top:8px'><button class='s' onclick='selAll(true)'>Select all</button><button class='s' onclick='selAll(false)'>Clear selection</button></div></div>
<h2>Tags (${S.tags.length}) · ${un.length} unused</h2><div class='grid'>` + S.tags.map(t => { const b = S.bags.find(x => x.tagId === t.id); return `<div class='card' style='margin:0'><label class='row'><input type='checkbox' ${selT.has(t.id) ? 'checked' : ''} onchange="selTag('${t.id}',this.checked)"><span class='big'>${t.label}</span></label><div style='margin:6px 0'>${b ? tag((M(b.owner) || {}).name || 'Assigned', 'ok') : tag('Unused', 'mu2')}</div><div class='row'><button class='s' onclick="showTag('${t.id}')">View QR</button><button class='s' onclick="printTags(['${t.id}'],1)">Print</button></div></div>` }).join('') + `</div>`
            },
            bags() { const un = S.tags.filter(t => !used(t)); return `<h1>Bags</h1>${S.j.started ? `<div class='msg'>➕ Need to add a bag during this trip? Register it here; it will be added to this checkpoint automatically.</div>` : ''}<div class='card'><h3>Scan a tag, then add the bag details</h3><p class='mu'>Stick the tag on the bag, scan it, and fill in whose bag it is, the type and a photo.</p><div class='row'>${camBtn()}<select aria-label='Choose tag manually' onchange='openReg(this.value)'><option value=''>No camera? Pick a tag…</option>${un.map(t => `<option value='${t.id}'>${t.label}</option>`).join('')}</select></div></div>${msgHtml()}` },
            bags2() {
                if (reg) { const t = TG(reg.tag); return `<div class='card' style='border:2px solid var(--ac)'><h3>${reg.bag ? 'Edit' : 'Register'} bag · ${t.label}</h3><label class='mu'>Whose bag?</label><select class='wide' onchange='reg.owner=this.value'><option value=''>Select owner…</option>${S.members.map(m => `<option value='${m.id}' ${reg.owner === m.id ? 'selected' : ''}>${e(m.name)}${m.village ? ' · ' + e(m.village) : ''}</option>`).join('')}</select><label class='mu'>Bag type</label><select class='wide' onchange='reg.type=this.value'>${TYPES.map(x => `<option ${reg.type === x ? 'selected' : ''}>${x}</option>`).join('')}</select><label class='mu'>Colour / description</label><input class='wide' value='${e(reg.desc)}' oninput='reg.desc=this.value' placeholder='e.g. Blue, large, red ribbon'><label class='mu'>Bag photo</label>${reg.photo ? `<img class='ph' style='margin-bottom:8px' src='${reg.photo}' alt=''>` : ''}<label class='mu'>Take a new photo</label><input class='wide' type='file' accept='image/*' capture='environment' aria-label='Take a new bag photo' onchange='regPhoto(this)'><label class='mu'>Or choose an existing photo</label><input class='wide' type='file' accept='image/*' aria-label='Choose an existing bag photo' onchange='regPhoto(this)'><div class='row' style='margin-top:12px'><button class='p' onclick='saveReg()'>Save bag</button><button onclick='reg=null;render()'>Cancel</button></div></div>` }
                return `<h2>Registered bags (${S.bags.length})</h2>` + (S.bags.map(bagCard).join('') || `<div class='card mu'>No bags registered yet.</div>`)
            },
            journey() {
                const J = S.j, locked = J.started || J.ended, routeStages = stages(), route = routeStages.map(x => x.name).filter(Boolean).join('  →  ');
                return `<h1>Journey</h1>${J.ended ? `<div class='msg ok'>Trip completed. Your check-in history is saved.</div>` : ''}<div class='card'><h3>${J.returning ? 'Return route' : 'Main route'}</h3><label class='mu'>Start point</label><input class='wide' ${locked ? 'disabled' : ''} value='${e(routeStages[0].name)}' placeholder='e.g. Bengaluru' onchange='S.j.from=this.value;save();render()'><label class='mu'>Final destination</label><input class='wide' ${locked ? 'disabled' : ''} value='${e(routeStages[routeStages.length - 1].name)}' placeholder='e.g. Kashi' onchange='S.j.to=this.value;save();render()'></div>
<div class='card'><h3>Connecting stops (optional)</h3><p class='mu'>Add them in order, from first to last.</p>${locked ? '' : `<div class='row'><input id='sn' placeholder='e.g. Vijayawada' style='flex:1'><button class='p' onclick='addStop()'>Add stop</button></div>`}${J.stops.map((x, i) => `<div class='item'><span>${i + 1}. ${e(x.name)}</span>${locked ? '' : `<span class='row'><button class='s' onclick='moveStop(${i},-1)' aria-label='Move up'>↑</button><button class='s' onclick='moveStop(${i},1)' aria-label='Move down'>↓</button><button class='s d' onclick='delStop(${i})'>Remove</button></span>`}</div>`).join('')}</div>
${route ? `<div class='msg'>${J.returning ? '↩ Return route: ' : 'Route: '}${e(route)}</div>` : ''}<div class='card'>${J.started ? `<p>${tag('Trip in progress', 'ok')}</p><p class='mu'>The route is locked. Scan at each departure and arrival. Add newly purchased bags in the Bags tab.</p><button class='p wide' onclick="go('check')">Open check-in</button>` : J.ended ? `<p>Trip details stay on this device while you decide whether to start a return trip.</p><button class='s wide' onclick="go('check')">View trip report</button><button class='wide' onclick='startReturnTrip()'>↩ ${J.returning ? 'Start another outbound trip' : 'Start return trip'}</button><button class='p wide' onclick='finishTrip()'>Download PDF report and clear trip data</button>` : `<button class='p wide' onclick='startTrip()'>▶ Start pre-departure bag check</button><p class='mu'>Scan every registered bag before leaving ${e(J.from || 'the start point')}.</p>`}</div>`
            },
            check() {
                if (!S.j.started) return S.j.ended ? tripReport() : `<h1>Check-in</h1><div class='card'><p>Start the pre-departure check from Journey first.</p><button class='p' onclick="go('journey')">Go to Journey</button></div>`;
                const p = progress(), cs = curStage(), phase = p.phase === 'depart' ? 'Departure' : 'Arrival', action = p.phase === 'arrive' && p.index === stages().length - 1 ? 'End trip at destination' : p.phase === 'arrive' ? `Start departure check at ${e(curStage().name)}` : `Depart ${e(curStage().name)}${stages()[p.index + 1] ? ` → ${e(stages()[p.index + 1].name)}` : ''}`;
                const blocked = S.bags.filter(b => bagState(b) !== 'active');
                return `<h1>Check-in</h1><div class='card'><h3>${phase} check · ${e(cs.name)}</h3><p class='mu'>${p.phase === 'depart' ? 'Scan every registered bag before leaving this location.' : 'Scan every registered bag after arriving at this location.'}</p><div class='row' style='margin-top:10px'><button class='${ctab === 'bag' ? 'p' : ''}' onclick="ctab='bag';msg=null;render()">🧳 Bag check-in</button><button class='${ctab === 'pax' ? 'p' : ''}' onclick="ctab='pax';msg=null;if(camOn)cam(false);else render()">👥 Passenger check-in</button></div></div>` + (ctab === 'bag' ? `<div class='card row'>${camBtn()}<select aria-label='Manual bag check-in' onchange="if(this.value){manualBag(this.value)}"><option value=''>No camera? Pick a bag…</option>${S.bags.filter(b => bagState(b) === 'active' && !currentBags().some(x => x.id === b.id)).map(b => `<option value='${b.id}'>${TG(b.tagId).label} · ${e((M(b.owner) || {}).name)}</option>`).join('')}</select></div>${blocked.length ? `<div class='card'><h3>⚠️ Bags paused from scanning</h3><p class='mu'>These bags need to be found and confirmed before their QR tags can be scanned again.</p>${blocked.map(b => `<div class='item'><span><b>${TG(b.tagId).label}</b> · ${bagState(b) === 'lost' ? 'Lost / missing' : bagState(b) === 'stowed' ? 'Empty / moved into another bag' : 'Not verified'}</span>${bagState(b) === 'stowed' ? `<button class='s' onclick="resumeBag('${b.id}')">Traveling again</button>` : `<button class='s p' onclick="restoreBag('${b.id}',true)">✅ Found &amp; scan here</button>`}</div>`).join('')}</div>` : ''}${msgHtml()}` : '') + `<div class='card'><button class='p wide' onclick='checkpointAction()'>${action}</button><p class='mu'>If any bag is missing, choose a reason before continuing.</p></div>`
            },
            check2() {
                if (!S.j.started) return '';
                const p = progress(), cp = checkpointKey(), when = {};
                if (ctab === 'pax') return passengerReport(cp) + passengerHistory();
                currentBags().forEach(x => when[x.id] = x.t); const active = S.bags.filter(b => bagState(b) === 'active'), tot = active.length, dn = active.filter(b => when[b.id]).length;
                const own = S.members.filter(m => S.bags.some(b => b.owner === m.id)).map(m => { const bs = S.bags.filter(b => b.owner === m.id).sort((a, b) => (when[b.id] || 0) - (when[a.id] || 0) || TG(a.tagId).no - TG(b.tagId).no); return { m, bs, n: bs.filter(b => when[b.id]).length, t: Math.max(0, ...bs.map(b => when[b.id] || 0)) } }).sort((a, b) => b.t - a.t || a.m.name.localeCompare(b.m.name));
                const stateList = S.bags.filter(b => bagState(b) !== 'active');
                return passengerReport(cp) + `<div class='card'><div class='row sp'><h3>Bags scanned for ${p.phase === 'depart' ? 'departure' : 'arrival'}</h3>${tag(dn + ' / ' + tot, dn === tot && tot ? 'ok' : 'wn')}</div><div class='bar'><i style='width:${tot ? dn / tot * 100 : 0}%'></i></div><span class='mu'>${tot - dn} active bag(s) pending at this checkpoint. Paused bags: ${stateList.length}.</span></div>` + (own.map(o => `<div class='card'><div class='row sp'><div><h3>${e(o.m.name)}</h3><span class='mu'>${e(o.m.village)}</span></div>${tag(o.n + ' / ' + o.bs.filter(b => bagState(b) === 'active').length + ' active bags', 'ok')}</div>${o.bs.map(b => { const report = S.missed.slice().reverse().find(x => (x.leg || 'outbound') === cp.leg && x.s === cp.s && (x.phase || 'arrive') === cp.phase && x.id === b.id), latest = S.missed.slice().reverse().find(x => x.id === b.id); const reason = report ? bagReasonText(report.reason) : bagState(b) !== 'active' && latest ? `${bagReasonText(latest.reason)} · last reported at ${latest.location || latest.s}` : 'Reason not recorded yet'; return `<div class='item'><span class='row'>${b.photo ? `<img class='th' src='${b.photo}' alt=''>` : ''}<span><b>${TG(b.tagId).label}</b> ${e(b.type)}<div class='mu'>${e(b.desc)}</div>${!when[b.id] ? `<div class='mu'>Not checked in · Reason: ${e(reason)}</div>` : ''}</span></span>${bagState(b) !== 'active' ? `<span class='row'>${tag(bagState(b) === 'lost' ? 'Lost / blocked' : bagState(b) === 'stowed' ? 'Empty / moved' : 'Not verified', 'bad')}${bagState(b) === 'stowed' ? `<button class='s' onclick="resumeBag('${b.id}')">Traveling again</button>` : `<button class='s' onclick="restoreBag('${b.id}',true)">Found &amp; scan</button>`}</span>` : when[b.id] ? tag('✓ ' + tm(when[b.id]), 'ok') : `<span class='row'>${tag('Pending', 'bad')}<button class='s' onclick="manualBag('${b.id}')">Check</button></span>`}</div>` }).join('')}</div>`).join('') || `<div class='card mu'>No bags registered yet.</div>`) + bagHistory() + passengerHistory()
            },
            backup() {
                const missed = S.missed.slice().reverse(), passengerMissed = S.pmissed.slice().reverse();
                return `<h1>Backup</h1>${msgHtml()}${missed.length ? `<div class='card'><h3>Unscanned bag reports (${missed.length})</h3>${missed.map(x => { const b = BG(x.id), t = b && TG(b.tagId), owner = b && M(b.owner); return `<div class='item'><span><b>${t ? t.label : 'Removed bag'}</b>${owner ? ` · ${e(owner.name)}` : ''} · ${e(x.location || x.s)} · ${x.phase === 'depart' ? 'Departure' : 'Arrival'}<div class='mu'>Reason: ${e(bagReasonText(x.reason || 'Not recorded'))}</div><div class='mu'>${new Date(x.t).toLocaleString()}</div></span></div>` }).join('')}</div>` : ''}${passengerMissed.length ? `<div class='card'><h3>Passenger non-check-in reports (${passengerMissed.length})</h3>${passengerMissed.map(x => { const person = M(x.id); return `<div class='item'><span><b>${e(person?.name || 'Removed passenger')}</b> · ${e(x.location || x.s)} · ${x.phase === 'depart' ? 'Departure' : 'Arrival'}<div class='mu'>Reason: ${e(passengerReasonText(x.reason || 'Not recorded'))}</div><div class='mu'>${new Date(x.t).toLocaleString()}</div></span></div>` }).join('')}</div>` : ''}<div class='card'><h3>Export</h3><p class='mu'>Saves the trip as one <b>.json</b> file, including members, tags, bags with photos, passenger and bag check-ins, non-check-in reasons and return-trip history. Keep it private; it contains names and mobile numbers.</p><button class='p' onclick='exportFile()'>⬇ Export trip file</button></div>
<div class='card'><h3>Import</h3><p class='mu'>Upload a TripGuard .json file exported from this app. It replaces the trip on this device.</p><input type='file' class='wide' accept='.json,application/json' onchange='importFile(this)'></div>
<div class='card'><h3>This device</h3><p class='mu'>${S.members.length} members · ${S.tags.length} tags · ${S.bags.length} bags. This static app does not upload trip data to a backend; GitHub Pages only serves the app files, and trip data stays in this browser until exported.</p><button class='d' onclick='wipe()'>Delete all data</button></div>`
            }
        };
        const T = [['trip', '🏠', 'Trip'], ['members', '👥', 'Members'], ['tags', '🏷️', 'QR tags'], ['bags', '🧳', 'Bags'], ['journey', '🗺️', 'Journey'], ['check', '✅', 'Check-in'], ['backup', '💾', 'Backup']];
        function go(t) { if (camOn && t !== tab) cam(false); tab = t; msg = null; view.m = null; render(); scrollTo(0, 0) }
        function render() {
            $('#nav').innerHTML = T.map(([k, i, n]) => `<button class='${tab === k ? 'on' : ''}' onclick="go('${k}')"><span>${i}</span>${n}</button>`).join('');
            $('#v').innerHTML = V[tab](); $('#v2').innerHTML = V[tab + '2'] ? V[tab + '2']() : ''; $('#cam').style.display = camOn && (tab === 'bags' || (tab === 'check' && ctab === 'bag')) ? 'block' : 'none'
        }
        (async () => { const d = await idb('get'); if (d && d.members) loadData(d); ready = true; render() })(); render();
