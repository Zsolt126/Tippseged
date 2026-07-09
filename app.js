function switchTab(mode) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    if(mode === 'pre') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('pre-mode').classList.add('active');
    } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('live-mode').classList.add('active');
    }
}

function poissonPMF(k, lambda) {
    return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let res = 1;
    for (let i = 2; i <= n; i++) res *= i;
    return res;
}

function generalmator(lambda_home, lambda_away) {
    let matrix = {};
    for (let h = 0; h < 6; h++) {
        for (let a = 0; a < 6; a++) {
            matrix[`${h}-${a}`] = poissonPMF(h, lambda_home) * poissonPMF(a, lambda_away);
        }
    }
    return matrix;
}

function szamolPreMeccs() {
    let h_att = parseFloat(document.getElementById('home_att').value);
    let h_def = parseFloat(document.getElementById('home_def').value);
    let a_att = parseFloat(document.getElementById('away_att').value);
    let a_def = parseFloat(document.getElementById('away_def').value);
    let odds = parseFloat(document.getElementById('bookie_odds').value);

    let xG_h = h_att * a_def;
    let xG_a = a_att * h_def;

    megjelenitEredmenyek(xG_h, xG_a, 0, 0, odds, false);
}

function szamolLiveMeccs() {
    let perc = parseInt(document.getElementById('live_minute').value);
    let gh = parseInt(document.getElementById('live_gh').value);
    let ga = parseInt(document.getElementById('live_ga').value);
    let sh = parseInt(document.getElementById('live_sh').value);
    let sa = parseInt(document.getElementById('live_sa').value);
    let possh = parseInt(document.getElementById('live_possh').value);
    let possa = parseInt(document.getElementById('live_possa').value);
    let ch = parseInt(document.getElementById('live_ch').value);
    let ca = parseInt(document.getElementById('live_ca').value);

    // Hátralévő idő aránya (pl. a 65. percben még a meccs 27,7%-a van hátra)
    let hatralevo_ido_arany = (90 - perc) / 90;
    if(hatralevo_ido_arany < 0) hatralevo_ido_arany = 0;

    // ÉLŐ NYOMÁSFAKTOR (Lövések, szögletek ÉS a labdabirtoklás súlyozva)
    // A birtoklás 50% feletti része extra nyomást generál
    let hazai_birtoklas_plusz = Math.max(0, possh - 50) * 0.01;
    let vendeg_birtoklas_plusz = Math.max(0, possa - 50) * 0.01;

    let hazai_nyomas = (sh * 0.12) + (ch * 0.06) + hazai_birtoklas_plusz;
    let vendeg_nyomas = (sa * 0.12) + (ca * 0.06) + vendeg_birtoklas_plusz;

    // Hátralévő időre számolt dinamikus xG értékek
    let xG_h = hazai_nyomas * hatralevo_ido_arany;
    let xG_a = vendeg_nyomas * hatralevo_ido_arany;

    megjelenitEredmenyek(xG_h, xG_a, gh, ga, null, true);
}

function megjelenitEredmenyek(xG_h, xG_a, jelenlegi_gh, jelenlegi_ga, bookie_odds, isLive) {
    let matrix = generalmator(xG_h, xG_a);
    
    let p_h15 = 0, p_v15 = 0, p_gg = 0, p_o25 = 0, p_o35 = 0;
    let pontos_tippek = [];

    Object.keys(matrix).forEach(key => {
        let [h, a] = key.split('-').map(Number);
        let prob = matrix[key];
        
        // Az élőben már meglévő gólokat hozzáadjuk a Poisson mátrix eredményeihez
        let vegso_h = h + jelenlegi_gh;
        let vegso_a = a + jelenlegi_ga;

        if (vegso_h >= 2) p_h15 += prob;
        if (vegso_a >= 2) p_v15 += prob;
        if (vegso_h >= 1 && vegso_a >= 1) p_gg += prob;
        if ((vegso_h + vegso_a) > 2) p_o25 += prob;
        if ((vegso_h + vegso_a) > 3) p_o35 += prob;

        pontos_tippek.push({ score: `${vegso_h}-${vegso_a}`, prob: prob });
    });

    pontos_tippek.sort((a, b) => b.prob - a.prob);

    // Bizalom index belövése
    let stars = 1;
    if(p_o25 > 0.75) stars = 5;
    else if(p_o25 > 0.65) stars = 4;
    else if(p_o25 > 0.55) stars = 3;
    else if(p_o25 > 0.45) stars = 2;

    // Következő gól esélyének kiszámítása leegyszerűsítve az xG arányokból
    let kov_gol_hazai = 0;
    let kov_gol_vendeg = 0;
    if ((xG_h + xG_a) > 0) {
        kov_gol_hazai = (xG_h / (xG_h + xG_a)) * 100;
        kov_gol_vendeg = (xG_a / (xG_h + xG_a)) * 100;
    }

    let html = `
        <h3>${isLive ? 'Élő (Live) Elemzés Eredménye' : 'Meccs Előtti Eredmények'}</h3>
        <div class="result-item"><span>Hátralévő várható Hazai gól (xG):</span> <strong>${xG_h.toFixed(2)}</strong></div>
        <div class="result-item"><span>Hátralévő várható Vendég gól (xG):</span> <strong>${xG_a.toFixed(2)}</strong></div>
        
        ${isLive && (xG_h + xG_a > 0) ? `
            <div class="result-item"><span>Következő gól esélye:</span> <strong>Hazai: ${kov_gol_hazai.toFixed(1)}% / Vendég: ${kov_gol_vendeg.toFixed(1)}%</strong></div>
        ` : ''}
        
        <hr style="border: 0; border-top: 1px solid #eee;">
        <div class="result-item"><span>Hazai 1.5+ gól esély (teljes meccs):</span> <strong> ${(p_h15*100).toFixed(1)}%</strong></div>
        <div class="result-item"><span>Vendég 1.5+ gól esély (teljes meccs):</span> <strong> ${(p_v15*100).toFixed(1)}%</strong></div>
        <div class="result-item"><span>GG (Mindkét csapat lő gólt):</span> <strong> ${(p_gg*100).toFixed(1)}%</strong></div>
        <div class="result-item"><span>Over 2.5 valószínűség:</span> <strong> ${(p_o25*100).toFixed(1)}%</strong></div>
        <div class="result-item"><span>Over 3.5 valószínűség:</span> <strong> ${(p_o35*100).toFixed(1)}%</strong></div>
        <div class="result-item"><span>Bizalom-index:</span> <span class="stars">${'★'.repeat(stars)}${'☆'.repeat(5-stars)}</span></div>
    `;

    if(bookie_odds) {
        let real_odds = 1 / p_o25;
        html += `
            <hr style="border: 0; border-top: 1px solid #eee;">
            <div class="result-item"><span>Modell szerinti reális odds:</span> <strong>${real_odds.toFixed(2)}</strong></div>
            <div class="result-item"><span>Iroda oddsa:</span> <strong>${bookie_odds}</strong></div>
            <div class="result-item"><span style="color:${bookie_odds > real_odds ? 'green':'red'}">${bookie_odds > real_odds ? '✔ A piac támogatja a tippet.':'✘ Nincs érték az oddsban.'}</span></div>
        `;
    }

    html += `<br><strong>Legvalószínűbb végeredmények (aktuális állással):</strong><ol class="score-list">`;
    pontos_tippek.slice(0, 5).forEach(t => {
        html += `<li><strong>${t.score}</strong> -> ${(t.prob*100).toFixed(1)}%</li>`;
    });
    html += `</ol>`;

    let out = document.getElementById('output');
    out.innerHTML = html;
    out.style.display = 'block';
}