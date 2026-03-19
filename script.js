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

    var sceneTitle      = document.getElementById('scene-title');
    var sceneProjects   = document.getElementById('scene-projects');
    var sceneExperience = document.getElementById('scene-experience');
    var sceneSkills     = document.getElementById('scene-skills');
    var sceneAboutMe    = document.getElementById('scene-about-me');

    var titleSection      = document.querySelector('.title');
    var projectsSection   = document.querySelector('.project_cards');
    var experienceSection = document.querySelector('.experience');
    var skillsSection     = document.querySelector('.skills');
    var aboutMeSection    = document.querySelector('.about-me');

    var projectCards = Array.from(document.querySelectorAll('.project_href'));
    var skillBoxes   = Array.from(document.querySelectorAll('.skills_box'));

    /* ── carousel (auto-play) ────────────────────────── */

    var CARD_STEP = 210;   // px between center card and each flank

    function isPortrait() { return window.innerHeight > window.innerWidth; }
    var carIdx    = 0;
    var carTimer  = null;

    function setCarousel(idx) {
        if (isPortrait()) return;   /* CSS handles portrait layout */
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
        if (isPortrait()) return;   /* no carousel on portrait */
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

    /* ── carousel manual buttons ─────────────────────── */

    var resumeTimer = null;

    function pauseAndScheduleResume() {
        stopCarousel();
        clearTimeout(resumeTimer);
        resumeTimer = setTimeout(function () {
            /* only restart if the projects section is currently visible */
            if (projectsSection && parseFloat(projectsSection.style.opacity || '0') > 0.5) {
                startCarousel();
            }
        }, 5000);
    }

    var btnLeft  = document.querySelector('.carousel-btn-left');
    var btnRight = document.querySelector('.carousel-btn-right');

    if (btnLeft) {
        btnLeft.addEventListener('click', function () {
            carIdx = (carIdx - 1 + projectCards.length) % projectCards.length;
            setCarousel(carIdx);
            pauseAndScheduleResume();
        });
    }

    if (btnRight) {
        btnRight.addEventListener('click', function () {
            carIdx = (carIdx + 1) % projectCards.length;
            setCarousel(carIdx);
            pauseAndScheduleResume();
        });
    }

    /* ── background music ────────────────────────────── */
    var musicBtn    = document.getElementById('music-btn');
    var bgMusic     = document.getElementById('bg-music');
    var musicActive = false;

    if (musicBtn && bgMusic) {
        bgMusic.volume = 0.15;

        function startMusic() {
            bgMusic.currentTime = 0;
            bgMusic.play().then(function () {
                musicBtn.textContent = '♬';
                musicActive = true;
            }).catch(function (err) {
                console.warn('Music play failed:', err);
            });
        }

        /* auto-start on first scroll or click anywhere */
        function onFirstInteraction() {
            if (musicActive) return;
            startMusic();
            document.removeEventListener('scroll',     onFirstInteraction);
            document.removeEventListener('pointerdown', onFirstInteraction);
        }
        document.addEventListener('scroll',      onFirstInteraction, { once: true, passive: true });
        document.addEventListener('pointerdown', onFirstInteraction, { once: true });

        /* button: stop + rewind when playing, restart from beginning when stopped */
        musicBtn.addEventListener('click', function (e) {
            e.stopPropagation();   /* don't let this click trigger onFirstInteraction */
            if (musicActive) {
                bgMusic.pause();
                bgMusic.currentTime = 0;
                musicBtn.textContent = '♪';
                musicActive = false;
            } else {
                startMusic();
            }
        });
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

    var runnerL = null;

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
         * lx=85 leaves room for branches in both directions.
         * bw = branch width, and bh = branch height
         * to give a randomised asymmetric plastic-sprue feel.
         */
        var lx = 70, sw = '10';
        var y1 = Math.round(vh * 0.2);
        var y2 = Math.round(vh * 0.4);
        var y3 = Math.round(vh * 0.6);
        var y4 = Math.round(vh * 0.8);
        var stroke = 'rgba(232,173,201,0.98)';

        /* branches: alternating left/right with varied sizes */
        var b1 = { dir: +1, bw: 68, bh: 62 };   /* right — wide */
        var b2 = { dir: -1, bw: 45, bh: 88 };   /* left  — tall */
        var b3 = { dir: +1, bw: 55, bh: 60 };   /* right — medium */
        var b4 = { dir: -1, bw: 38, bh: 70 };   /* left  — narrow */

        var d = [
            'M',  lx, 70,
            'L',  lx, y1,
            'L',  lx + b1.dir * b1.bw, y1,
            'L',  lx + b1.dir * b1.bw, y1 + b1.bh,
            'L',  lx, y1 + b1.bh,
            'L',  lx, y2,
            'L',  lx + b2.dir * b2.bw, y2,
            'L',  lx + b2.dir * b2.bw, y2 + b2.bh,
            'L',  lx, y2 + b2.bh,
            'L',  lx, y3,
            'L',  lx + b3.dir * b3.bw, y3,
            'L',  lx + b3.dir * b3.bw, y3 + b3.bh,
            'L',  lx, y3 + b3.bh,
            'L',  lx, y4,
            'L',  lx + b4.dir * b4.bw, y4,
            'L',  lx + b4.dir * b4.bw, y4 + b4.bh,
            'L',  lx, y4 + b4.bh,
            'L',  lx, vh
        ].join(' ');

        runnerL = document.createElementNS(NS, 'path');
        runnerL.setAttribute('d',               d);
        runnerL.setAttribute('stroke',          stroke);
        runnerL.setAttribute('stroke-width',    sw);
        runnerL.setAttribute('fill',            'none');
        runnerL.setAttribute('stroke-linecap',  'round');
        runnerL.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(runnerL);

        document.body.appendChild(svg);

        var len = runnerL.getTotalLength();
        runnerL.setAttribute('stroke-dasharray',  len);
        runnerL.setAttribute('stroke-dashoffset', len);
    }

    function updateRunners(scrollProg) {
        if (!runnerL) return;
        var len = parseFloat(runnerL.getAttribute('stroke-dasharray'));
        runnerL.setAttribute('stroke-dashoffset', len * (1 - scrollProg));
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

        /* 2 ── Projects: fade in/out; carousel while visible */
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

        /* 3 ── Experience: parent handles fade-out; children stagger fade-in */
        if (sceneExperience && experienceSection) {
            var p = getProgress(sceneExperience);

            /* parent only fades OUT (children start at 0 and handle fade-in) */
            experienceSection.style.opacity   = p > 0.85 ? 1 - norm(p, 0.85, 1.0) : 1;
            experienceSection.style.transform = 'translateY(' + norm(p, 0, 0.15) * 0 + 'px)';

            /* title fades in first */
            var expTitle = document.getElementById('experience_title');
            if (expTitle) {
                var tOp = norm(p, 0, 0.12);
                expTitle.style.opacity   = tOp;
                expTitle.style.transform = 'translateY(' + (1 - tOp) * 28 + 'px)';
            }

            /* each box fades in sequentially after the title */
            var expBoxes = document.querySelectorAll('.experience-box');
            expBoxes.forEach(function (box, i) {
                var bOp = norm(p, 0.10 + i * 0.12, 0.22 + i * 0.12);
                box.style.opacity   = bOp;
                box.style.transform = 'translateY(' + (1 - bOp) * 28 + 'px)';
            });
        }

        /* 4 ── Skills: fade in + staggered box reveal + fade out */
        if (sceneSkills && skillsSection) {
            var p = getProgress(sceneSkills);
            var sectionOp;
            if      (p < 0.10) sectionOp = norm(p, 0, 0.10);
            else if (p > 0.90) sectionOp = 1 - norm(p, 0.90, 1.0);
            else               sectionOp = 1;
            skillsSection.style.opacity = sectionOp;
            var n = skillBoxes.length;
            skillBoxes.forEach(function (box, i) {
                var start = 0.10 + (i / n) * 0.65;
                var end   = start + 0.65 / n;
                var bop   = norm(p, start, end);
                box.style.opacity   = bop;
                box.style.transform = 'translateY(' + (1 - bop) * 28 + 'px)';
            });
        }

        /* 5 ── About me: fade in, stays visible */
        if (sceneAboutMe && aboutMeSection) {
            var p  = getProgress(sceneAboutMe);
            var op = norm(p, 0, 0.55);
            aboutMeSection.style.opacity   = op;
            aboutMeSection.style.transform = 'translateY(' + (1 - op) * 40 + 'px)';
        }

        /* 5 ── Runners: reveal proportional to total page scroll */
        var maxScroll = Math.max(1, document.body.scrollHeight - window.innerHeight);
        updateRunners(Math.min(1, window.scrollY / maxScroll));
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
        buildRunners();
        animate();
    });

    /* ── nav: scroll to the point where each section is fully revealed ── */

    /* minimum progress value at which each scene's content is fully visible */
    var navReveal = {
        'scene-projects':   { scene: sceneProjects,   p: 0.08 },
        'scene-experience': { scene: sceneExperience, p: 0.15 },
        'scene-skills':     { scene: sceneSkills,     p: 0.10 },
        'scene-about-me':   { scene: sceneAboutMe,    p: 0.45 }
    };

    document.querySelectorAll('.bot_nav a').forEach(function (link) {
        var href = link.getAttribute('href') || '';
        if (href.charAt(0) !== '#') return;
        var id = href.slice(1);

        link.addEventListener('click', function (e) {
            e.preventDefault();
            var info = navReveal[id];
            var targetY;

            if (info && info.scene) {
                var scene      = info.scene;
                var scrollable = scene.offsetHeight - window.innerHeight;
                targetY = scrollable > 0
                    ? scene.offsetTop + info.p * scrollable
                    : scene.offsetTop;
            } else {
                var el = document.getElementById(id);
                targetY = el ? el.offsetTop : 0;
            }

            window.scrollTo({ top: targetY, behavior: 'smooth' });
        });
    });

    /* ── project page: hide nav when project title scrolls past it ── */
    var projectTitle = document.querySelector('.project_title');
    if (projectTitle) {
        var topNav = document.querySelector('.top_nav');
        window.addEventListener('scroll', function () {
            var titleBottom = projectTitle.getBoundingClientRect().bottom;
            var navBottom   = topNav.getBoundingClientRect().bottom;
            topNav.classList.toggle('nav-hidden', titleBottom <= navBottom);
        }, { passive: true });
    }

})();

/*
/* ── puzzle piece game ───────────────────────────────────────────────── 
(function () {
    'use strict';

    /* ── config ─────────────────────────────────────────────────────── 
    var TOTAL_PIECES = 4;
    var YT_VIDEO_ID  = 'YOUR_VIDEO_ID';   /* ← replace with your YouTube video ID 

    /*
     * 6 predefined viewport positions [vx%, vy%].
     * 4 are randomly chosen each page load.
     * Keep them away from the nav (top 10%) and backpack corner (bottom-right).
     
    var SLOTS = [
        [8,  26], [82, 22],
        [5,  52], [88, 50],
        [12, 76], [74, 72]
    ];

    /* ── DOM refs ────────────────────────────────────────────────────── 
    var container    = document.getElementById('puzzle-pieces-container');
    var backpackBtn  = document.getElementById('backpack-btn');
    var badge        = document.getElementById('backpack-badge');
    var videoOverlay = document.getElementById('video-overlay');
    var ytPlayer     = document.getElementById('yt-player');
    var videoClose   = document.getElementById('video-close');
    var asmPieces    = Array.from(document.querySelectorAll('.asm-piece'));
    var asmDiv       = document.getElementById('puzzle-assembly');

    if (!container || !backpackBtn) return;   /* game HTML not present */

    /* ── pick random slots ───────────────────────────────────────────── 
    var chosen = SLOTS.slice()
        .sort(function () { return Math.random() - 0.5; })
        .slice(0, TOTAL_PIECES);

    var collected = 0;

    /* ── spawn pieces ────────────────────────────────────────────────── 
    chosen.forEach(function (pos, idx) {
        var el = document.createElement('div');
        el.className = 'puzzle-piece';
        el.textContent = '🧩';
        el.style.left             = pos[0] + 'vw';
        el.style.top              = pos[1] + 'vh';
        el.style.animationDelay   = (idx * 0.7) + 's';
        el.addEventListener('click', function () { collectPiece(el); });
        container.appendChild(el);
    });

    /* ── collect a piece ─────────────────────────────────────────────── 
    function collectPiece(el) {
        if (el.dataset.collected) return;
        el.dataset.collected = '1';

        var rect    = el.getBoundingClientRect();
        var originX = rect.left + rect.width  / 2;
        var originY = rect.top  + rect.height / 2;

        /* pop animation then remove 
        el.style.animation = 'piece-pop 0.4s ease forwards';
        setTimeout(function () { el.remove(); }, 420);

        /* fire sparkle trail → on arrival update counter 
        fireTrail(originX, originY, function () {
            collected++;
            badge.textContent = collected;

            /* badge bump 
            badge.style.animation = 'none';
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    badge.style.animation = 'badge-bump 0.35s ease';
                });
            });

            if (collected >= TOTAL_PIECES) {
                backpackBtn.classList.add('complete');
            }
        });
    }

    /* ── sparkle trail ───────────────────────────────────────────────── 
    function fireTrail(fromX, fromY, onArrival) {
        var bpRect = backpackBtn.getBoundingClientRect();
        var toX    = bpRect.left + bpRect.width  / 2;
        var toY    = bpRect.top  + bpRect.height / 2;
        var COUNT  = 10;
        var done   = 0;

        for (var i = 0; i < COUNT; i++) {
            (function (idx) {
                setTimeout(function () {
                    var s = document.createElement('div');
                    s.className = 'trail-sparkle';

                    /* small random scatter around origin 
                    var ox = fromX + (Math.random() - 0.5) * 22;
                    var oy = fromY + (Math.random() - 0.5) * 22;
                    s.style.left = ox + 'px';
                    s.style.top  = oy + 'px';
                    document.body.appendChild(s);

                    requestAnimationFrame(function () {
                        requestAnimationFrame(function () {
                            s.style.transition = 'left 0.55s ease-in, top 0.55s ease-in, opacity 0.55s ease';
                            s.style.left    = toX + 'px';
                            s.style.top     = toY + 'px';
                            s.style.opacity = '0';
                        });
                    });

                    setTimeout(function () {
                        s.remove();
                        done++;
                        if (done === COUNT) onArrival();
                    }, 600);
                }, idx * 45);
            })(i);
        }
    }

    /* ── open backpack ───────────────────────────────────────────────── 
    backpackBtn.addEventListener('click', function () {
        if (collected < TOTAL_PIECES) return;
        playAssembly();
    });

    /* ── puzzle assembly animation → video ──────────────────────────── 
    function playAssembly() {
        /* reset assembly pieces 
        asmDiv.style.display = 'flex';
        asmPieces.forEach(function (p) {
            p.style.transition = 'none';
            p.style.opacity    = '0';
            p.style.transform  = 'translateY(-60px) scale(0.5)';
        });

        videoOverlay.classList.add('active');

        /* stagger pieces flying down into view 
        asmPieces.forEach(function (p, i) {
            setTimeout(function () {
                p.style.transition = 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease';
                p.style.opacity    = '1';
                p.style.transform  = 'translateY(0) scale(1)';
            }, 200 + i * 180);
        });

        /* after all pieces land → click together → fade to video 
        var landTime = 200 + asmPieces.length * 180 + 400;
        setTimeout(function () {
            /* click together 
            asmPieces.forEach(function (p) {
                p.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
                p.style.transform  = 'scale(1.2)';
            });
            setTimeout(function () {
                asmPieces.forEach(function (p) {
                    p.style.transform = 'scale(0)';
                    p.style.opacity   = '0';
                });
                /* show video after pieces disappear 
                setTimeout(function () {
                    asmDiv.style.display = 'none';
                    ytPlayer.src = 'https://www.youtube.com/embed/' + YT_VIDEO_ID + '?autoplay=1';
                    ytPlayer.classList.add('visible');
                }, 250);
            }, 220);
        }, landTime);
    }

    /* ── close video ─────────────────────────────────────────────────── 
    videoClose.addEventListener('click', closeVideo);
    videoOverlay.addEventListener('click', function (e) {
        if (e.target === videoOverlay) closeVideo();
    });

    function closeVideo() {
        videoOverlay.classList.remove('active');
        ytPlayer.src = 'about:blank';
        ytPlayer.classList.remove('visible');
    }

})();*/
