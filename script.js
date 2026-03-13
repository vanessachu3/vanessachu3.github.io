/*
 * Scroll-driven animations + Gundam runner overlay
 * vanessachu3.github.io
 *
 * Sections use position:sticky inside tall .scroll-scene containers.
 * getProgress(scene) → 0-1 within each scene's scroll budget.
 *
 * Project carousel: auto-plays every 2.5 s when the section is visible.
 * Runners: a pair of fixed SVG paths drawn along the viewport edges,
 *          revealed stroke-by-stroke as the page is scrolled.
 */

(function () {
    'use strict';

    /* ── helpers ─────────────────────────────────────── */

    function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    function norm(v, lo, hi)  { return clamp((v - lo) / (hi - lo), 0, 1); }

    function getProgress(scene) {
        var rect     = scene.getBoundingClientRect();
        var scrollable = scene.offsetHeight - window.innerHeight;
        if (scrollable <= 0) return 0;
        return clamp(-rect.top / scrollable, 0, 1);
    }

    /* ── DOM ─────────────────────────────────────────── */

    var sceneTitle    = document.getElementById('scene-title');
    var sceneProjects = document.getElementById('scene-projects');
    var sceneSkills   = document.getElementById('scene-skills');
    var sceneAboutMe   = document.getElementById('scene-about-me');

    var titleSection    = document.querySelector('.title');
    var projectsSection = document.querySelector('.project_cards');
    var skillsSection   = document.querySelector('.skills');
    var aboutMeSection   = document.querySelector('.about-me');

    var projectCards = Array.from(document.querySelectorAll('.project_href'));
    var skillBoxes   = Array.from(document.querySelectorAll('.skills_box'));

    /* ── carousel (auto-play) ────────────────────────── */

    var CARD_STEP = 270;   // px between center card and each flank
    var carIdx    = 0;
    var carTimer  = null;

    function setCarousel(idx) {
        var total = projectCards.length;
        projectCards.forEach(function (card, i) {
            var d = ((i - idx) % total + total) % total;
            if (d > total / 2) d -= total;

            var absd    = Math.abs(d);
            var tx      = d * CARD_STEP;
            var scale   = absd <= 1 ? 1.15 - 0.33 * absd : Math.max(0.7, 0.82 - 0.12 * (absd - 1));
            var opacity = absd <= 1 ? 1 - 0.28 * absd    : Math.max(0, 0.72 - 0.72 * (absd - 1));

            card.style.transform = 'translateX(' + tx + 'px) scale(' + scale + ')';
            card.style.opacity   = Math.max(0, opacity);
            card.style.zIndex    = Math.max(1, Math.round(3 - absd));
        });
    }

    function startCarousel() {
        if (carTimer) return;
        carTimer = setInterval(function () {
            carIdx = (carIdx + 1) % projectCards.length;
            setCarousel(carIdx);
        }, 2500);
    }

    function stopCarousel() {
        clearInterval(carTimer);
        carTimer = null;
    }

    /* ── Gundam runners ──────────────────────────────── */
    /*
     * Two SVG paths are drawn along the left and right edges of the
     * fixed viewport.  Each path has 90° PCB-trace-style branches at
     * ~34% and ~67% viewport height.  stroke-dashoffset reveals the
     * path from top to bottom as the page scrolls.
     *
     * Circles mark every junction point and fade in as the path
     * passes through them.
     */

    var runnerL       = null;
    var runnerCircles = [];   /* junction squares */

    function buildRunners() {
        var NS  = 'http://www.w3.org/2000/svg';
        var vw  = window.innerWidth;
        var vh  = window.innerHeight;

        var svg = document.createElementNS(NS, 'svg');
        svg.id  = 'runners-svg';
        svg.setAttribute('width',   vw);
        svg.setAttribute('height',  vh);
        svg.setAttribute('viewBox', '0 0 ' + vw + ' ' + vh);
        svg.style.cssText = [
            'position:fixed', 'top:0', 'left:0',
            'pointer-events:none', 'z-index:99', 'overflow:visible'
        ].join(';');

        /*
         * Geometry — single left-side runner starting under "vc" in the nav.
         * lx  = spine x-position
         * bw  = branch width (how far it extends right)
         * bh  = branch height
         * sw  = stroke-width (thick, like a real plastic sprue)
         */
        var lx = 60, bw = 68, bh = 60, sw = '10';
        var y1 = Math.round(vh * 0.2);
        var y2 = Math.round(vh * 0.4);
        var y3 = Math.round(vh * 0.6);
        var stroke = 'rgba(232,173,201,0.98)';

        /* ── main frame path ─────────────────────────────────── */
        var d = [
            'M', lx, 70,
            'L', lx, y1,
            'L', lx + bw, y1,
            'L', lx + bw, y1 + bh,
            'L', lx, y1 + bh,
            'L', lx, y2,
            'L', lx + bw, y2,
            'L', lx + bw, y2 + bh,
            'L', lx, y2 + bh,
            'L', lx, y3,
            'L', lx + bw, y3,
            'L', lx + bw, y3 + bh,
            'L', lx, y3 + bh,
            'L', lx, vh
        ].join(' ');

        runnerL = document.createElementNS(NS, 'path');
        runnerL.setAttribute('d', d);
        runnerL.setAttribute('stroke', stroke);
        runnerL.setAttribute('stroke-width', sw);
        runnerL.setAttribute('fill', 'none');
        runnerL.setAttribute('stroke-linecap', 'round');
        runnerL.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(runnerL);

        /* ── junction squares at every branch corner ─────────── */
        /*var junctionPts = [
            [lx,      y1],       [lx + bw, y1],
            [lx + bw, y1 + bh],  [lx,      y1 + bh],
            [lx,      y2],       [lx + bw, y2],
            [lx + bw, y2 + bh],  [lx,      y2 + bh]
        ];*/

        /*runnerCircles = [];
        junctionPts.forEach(function (pt) {
            var r = document.createElementNS(NS, 'circle');
            r.setAttribute('cx',      pt[0]);
            r.setAttribute('cy',      pt[1]);
            r.setAttribute('r',       '8');
            r.setAttribute('fill',    stroke);
            r.setAttribute('opacity', '0');
            svg.appendChild(r);
            runnerCircles.push({ el: r, yFrac: pt[1] / vh });
        });*/

        document.body.appendChild(svg);

        /* dasharray must be initialised after the element is in the DOM */
        var len = runnerL.getTotalLength();
        runnerL.setAttribute('stroke-dasharray', len);
        runnerL.setAttribute('stroke-dashoffset', len);
    }

    function updateRunners(scrollProg) {
        if (!runnerL) return;

        /* reveal the main stroke from top to bottom */
        var len = parseFloat(runnerL.getAttribute('stroke-dasharray'));
        runnerL.setAttribute('stroke-dashoffset', len * (1 - scrollProg));

        /* junction squares */
        /*runnerCircles.forEach(function (item) {
            item.el.setAttribute('opacity',
                norm(scrollProg, item.yFrac - 0.025, item.yFrac + 0.025));
        });*/
    }

    /* ── main animation loop ─────────────────────────── */

    function animate() {

        /* 1 ── Title: sticky → fade + drift up */
        if (sceneTitle && titleSection) {
            var p  = getProgress(sceneTitle);
            var op = 1 - norm(p, 0.55, 1.0);
            titleSection.style.opacity   = op;
            titleSection.style.transform = 'translateY(' + (1 - op) * -70 + 'px)';
        }

        /* 2 ── Projects: fade in/out; auto-play carousel while visible */
        if (sceneProjects && projectsSection && projectCards.length) {
            var p = getProgress(sceneProjects);
            var op;
            if      (p < 0.08) op = norm(p, 0, 0.08);
            else if (p > 0.88) op = 1 - norm(p, 0.88, 1.0);
            else               op = 1;
            projectsSection.style.opacity = op;

            if (op > 0.5) startCarousel();
            else          stopCarousel();
        }

        /* 3 ── Skills: section fade + staggered box reveal */
        if (sceneSkills && skillsSection) {
            var p = getProgress(sceneSkills);
            skillsSection.style.opacity = norm(p, 0, 0.12);

            var n = skillBoxes.length;
            skillBoxes.forEach(function (box, i) {
                var start = 0.12 + (i / n) * 0.73;
                var end   = start + 0.73 / n;
                var bop   = norm(p, start, end);
                box.style.opacity   = bop;
                box.style.transform = 'translateY(' + (1 - bop) * 28 + 'px)';
            });
        }

        /* 4 ── About me: fade in */
        if (sceneAboutMe && aboutMeSection) {
            var p  = getProgress(sceneAboutMe);
            var op = norm(p, 0, 0.15);
            aboutMeSection.style.opacity   = op;
            aboutMeSection.style.transform = 'translateY(' + (1 - op) * 40 + 'px)';
        }

        /* 5 ── Runners: reveal proportional to total page scroll */
        var maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
        updateRunners(window.scrollY / maxScroll);
    }

    /* ── init ────────────────────────────────────────── */

    setCarousel(0);
    buildRunners();
    animate();

    window.addEventListener('scroll', animate, { passive: true });

    /* rebuild runners if viewport is resized (dimensions change) */
    window.addEventListener('resize', function () {
        var old = document.getElementById('runners-svg');
        if (old) old.remove();
        runnerL = null;
        runnerCircles = [];
        buildRunners();
        animate();
    });

})();
