// CTA scroll
document.getElementById("ctaBtn").addEventListener("click", function () {
    document.getElementById("landingForms").scrollIntoView({ behavior: "smooth" });
});

// ── Animated floating labels around tectonic icon ──
(function () {
    var zoneL = document.getElementById("floatZoneLeft");
    var zoneR = document.getElementById("floatZoneRight");
    if (!zoneL || !zoneR) return;

    var workloads = [
        "YCSB A", "YCSB B", "YCSB C", "YCSB D", "YCSB E", "YCSB F",
        "KVBench I", "KVBench II", "KVBench III", "KVBench IV", "KVBench V",
        "db_bench 1", "db_bench 2", "db_bench 3", "db_bench 4", "db_bench 5",
        "Tectonic 1", "Tectonic 2", "Tectonic 3", "Tectonic 4", "Tectonic 5",
        "Tectonic 6", "Tectonic 7"
    ];

    var databases = [
        { name: "RocksDB", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/></svg>' },
        { name: "Cassandra", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="4" r="1.5"/><circle cx="12" cy="20" r="1.5"/><circle cx="5" cy="8" r="1.5"/><circle cx="19" cy="8" r="1.5"/><circle cx="5" cy="16" r="1.5"/><circle cx="19" cy="16" r="1.5"/></svg>' },
        { name: "LevelDB", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="17" width="18" height="4" rx="1"/></svg>' },
        { name: "MongoDB", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>' },
        { name: "Postgres NOSQL", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>' },
        { name: "Redis", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>' },
        { name: "Scylla", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v12c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/></svg>' },
        { name: "Couchbase", icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="16" r="4"/><circle cx="16" cy="14" r="3"/><circle cx="12" cy="7" r="3.5"/></svg>' }
    ];

    // Slot positions (top %) for left and right zones
    var leftSlots = [
        { top: 5, size: 10 },
        { top: 25, size: 9 },
        { top: 48, size: 11 },
        { top: 68, size: 9 },
        { top: 88, size: 10 }
    ];

    var rightSlots = [
        { top: 2, type: "db" },
        { top: 22, type: "plot" },
        { top: 42, type: "db" },
        { top: 62, type: "line" },
        { top: 82, type: "db" }
    ];

    var colors = [
        "rgba(179,58,58,0.2)", "rgba(45,45,45,0.18)", "rgba(100,60,60,0.15)",
        "rgba(58,58,58,0.2)", "rgba(140,80,80,0.18)"
    ];

    function shuffle(arr) {
        var a = arr.slice();
        for (var i = a.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
        }
        return a;
    }

    function randBetween(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a; }

    function makeBarPlot() {
        var n = randBetween(4, 7);
        var html = '';
        var barColors = ["rgba(179,58,58,0.5)", "rgba(45,45,45,0.4)", "rgba(120,60,60,0.45)", "rgba(80,80,80,0.35)"];
        for (var i = 0; i < n; i++) {
            var h = randBetween(4, 18);
            var c = barColors[Math.floor(Math.random() * barColors.length)];
            html += '<span class="plot-bar" style="height:' + h + 'px;background:' + c + '"></span>';
        }
        return html;
    }

    function makeLinePlot() {
        var pts = [];
        for (var i = 0; i < 6; i++) {
            pts.push(randBetween(2, 16));
        }
        var w = 40, h = 20;
        var step = w / (pts.length - 1);
        var d = "M" + pts.map(function (v, i) { return (i * step).toFixed(1) + "," + (h - v).toFixed(1); }).join(" L");
        var lineColors = ["rgba(179,58,58,0.6)", "rgba(45,45,45,0.5)", "rgba(100,60,60,0.5)"];
        var c = lineColors[Math.floor(Math.random() * lineColors.length)];
        return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '"><path d="' + d + '" fill="none" stroke="' + c + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }

    function makeDotPlot() {
        var n = randBetween(5, 10);
        var w = 36, h = 20;
        var dots = '';
        var c = "rgba(179,58,58,0.5)";
        for (var i = 0; i < n; i++) {
            dots += '<circle cx="' + randBetween(2, w - 2) + '" cy="' + randBetween(2, h - 2) + '" r="1.5" fill="' + c + '"/>';
        }
        return '<svg width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '">' + dots + '</svg>';
    }

    function populateLeft() {
        zoneL.innerHTML = "";
        var picked = shuffle(workloads).slice(0, leftSlots.length);
        leftSlots.forEach(function (slot, i) {
            var el = document.createElement("span");
            el.className = "disc-float-item wl";
            el.style.top = (slot.top + randBetween(-3, 3)) + "%";
            el.style.fontSize = slot.size + "px";
            // Wave: random horizontal offset from the right edge
            el.style.right = randBetween(-15, 35) + "px";
            el.textContent = picked[i];
            zoneL.appendChild(el);
        });
    }

    function populateRight() {
        zoneR.innerHTML = "";
        var pickedDbs = shuffle(databases);
        var dbIdx = 0;
        rightSlots.forEach(function (slot) {
            var el = document.createElement("span");
            el.style.top = (slot.top + randBetween(-3, 3)) + "%";
            // Wave: random horizontal offset from the left edge
            el.style.left = randBetween(-10, 30) + "px";

            if (slot.type === "db") {
                var db = pickedDbs[dbIdx % pickedDbs.length];
                dbIdx++;
                el.className = "disc-float-item db";
                el.innerHTML = '<span class="db-icon">' + db.icon + '</span>' + db.name;
            } else if (slot.type === "plot") {
                el.className = "disc-float-item plot";
                el.innerHTML = makeBarPlot();
            } else {
                el.className = "disc-float-item line-plot";
                var plotFns = [makeLinePlot, makeDotPlot];
                el.innerHTML = plotFns[Math.floor(Math.random() * plotFns.length)]();
            }
            zoneR.appendChild(el);
        });
    }

    // Show/hide sides in sync with the 3s disc animation
    // Red disc goes LEFT at 0% → show workloads (left), hide right
    // Red disc goes RIGHT at 100% → show databases (right), hide left
    var showingLeft = true;

    function fadeIn(zone) {
        var items = zone.querySelectorAll(".disc-float-item");
        items.forEach(function (el, i) {
            setTimeout(function () { el.classList.add("visible"); }, i * 80);
        });
    }

    function fadeOut(zone) {
        var items = zone.querySelectorAll(".disc-float-item");
        items.forEach(function (el) { el.classList.remove("visible"); });
    }

    function cycle() {
        if (showingLeft) {
            // Fade out left, populate and show right
            fadeOut(zoneL);
            setTimeout(function () {
                populateRight();
                fadeIn(zoneR);
            }, 400);
        } else {
            // Fade out right, populate and show left
            fadeOut(zoneR);
            setTimeout(function () {
                populateLeft();
                fadeIn(zoneL);
            }, 400);
        }
        showingLeft = !showingLeft;
    }

    // Initial
    populateLeft();
    setTimeout(function () { fadeIn(zoneL); }, 300);

    // Cycle every 3s (matches animation duration)
    setInterval(cycle, 3000);
})();

// Navbar show/hide on scroll
(function () {
    var navbar = document.querySelector(".navbar");
    var hero = document.getElementById("landingHero");
    var overviewLink = document.querySelector(".navbar-link.overview");
    var benchmarkLink = document.querySelector(".navbar-link.benchmark");
    var aboutSection = document.getElementById("landingAbout");
    var formsSection = document.getElementById("landingForms");
    function checkNavbar() {
        if (window.scrollY > 50) {
            navbar.classList.add("visible");
        } else {
            navbar.classList.remove("visible");
        }
        var formsTop = formsSection.getBoundingClientRect().top;
        var aboutTop = aboutSection.getBoundingClientRect().top;
        var aboutBottom = aboutSection.getBoundingClientRect().bottom;
        overviewLink.classList.remove("active");
        benchmarkLink.classList.remove("active");
        if (formsTop < window.innerHeight / 2) {
            benchmarkLink.classList.add("active");
        } else if (aboutTop < window.innerHeight / 2 && aboutBottom > 0) {
            overviewLink.classList.add("active");
        }
    }
    window.addEventListener("scroll", checkNavbar, { passive: true });
    checkNavbar();
})();

// Sync landing dropdowns from preset-flow catalog
(function () {
    var origFamily = document.getElementById("presetFamilySelect");
    var origFile = document.getElementById("presetFileSelect");
    var landFamily = document.getElementById("landingPresetFamily");
    var landFile = document.getElementById("landingPresetFile");

    function syncOptions(src, dest) {
        if (!src || !dest) return;
        dest.innerHTML = src.innerHTML;
        dest.disabled = src.disabled;
        dest.value = src.value;
    }

    function observeSelect(src, dest) {
        if (!src || !dest) return;
        var obs = new MutationObserver(function () { syncOptions(src, dest); });
        obs.observe(src, { childList: true, attributes: true });
    }

    // Initial sync after preset-flow populates
    setTimeout(function () {
        syncOptions(origFamily, landFamily);
        syncOptions(origFile, landFile);
    }, 500);

    observeSelect(origFamily, landFamily);
    observeSelect(origFile, landFile);

    // When landing family changes, update the original and trigger its change event
    if (landFamily && origFamily) {
        landFamily.addEventListener("change", function () {
            origFamily.value = this.value;
            origFamily.dispatchEvent(new Event("change", { bubbles: true }));
            setTimeout(function () { syncOptions(origFile, landFile); }, 100);
        });
    }

    // When landing file changes, update the original
    if (landFile && origFile) {
        landFile.addEventListener("change", function () {
            origFile.value = this.value;
            origFile.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }
})();

// Form validation — enable/disable buttons
(function () {
    var family = document.getElementById("landingPresetFamily");
    var file = document.getElementById("landingPresetFile");
    var scale = document.getElementById("landingPresetScale");
    var presetBtn = document.getElementById("landingPresetSubmit");
    var prompt = document.getElementById("landingWorkloadPrompt");
    var promptBtn = document.getElementById("landingPromptSubmit");

    function checkPreset() {
        var valid = family.value.trim() !== "" &&
            file.value.trim() !== "" &&
            scale.value.trim() !== "" &&
            parseFloat(scale.value) > 0;
        presetBtn.disabled = !valid;
    }

    function checkPrompt() {
        promptBtn.disabled = prompt.value.trim() === "";
    }

    family.addEventListener("change", checkPreset);
    file.addEventListener("change", checkPreset);
    scale.addEventListener("input", checkPreset);
    prompt.addEventListener("input", checkPrompt);

    checkPreset();
    checkPrompt();
})();

// ── App Progress Step Switching ──
(function () {
    var steps = document.querySelectorAll(".app-step");
    var connectorAB = document.getElementById("connectorAB");
    var connectorBC = document.getElementById("connectorBC");
    var tabContents = {
        edit: document.getElementById("tabEdit"),
        databases: document.getElementById("tabDatabases"),
        results: document.getElementById("tabResults")
    };
    var stepOrder = ["edit", "databases", "results"];

    function switchTab(tabName) {
        var activeIdx = stepOrder.indexOf(tabName);

        steps.forEach(function (s) {
            var tab = s.getAttribute("data-tab");
            var idx = stepOrder.indexOf(tab);
            s.classList.remove("active", "done");
            if (idx < activeIdx) s.classList.add("done");
            if (idx === activeIdx) s.classList.add("active");
        });

        // Update connectors
        if (connectorAB) connectorAB.classList.toggle("done", activeIdx > 0);
        if (connectorBC) connectorBC.classList.toggle("done", activeIdx > 1);

        Object.keys(tabContents).forEach(function (key) {
            if (tabContents[key]) {
                tabContents[key].classList.toggle("active", key === tabName);
            }
        });
    }

    steps.forEach(function (step) {
        step.addEventListener("click", function () {
            switchTab(this.getAttribute("data-tab"));
        });
    });

    // Wire the databases tab Run Workload button
    var dbRunBtn = document.getElementById("dbRunWorkloadBtn");
    if (dbRunBtn) {
        dbRunBtn.addEventListener("click", function () {
            var dbTabChecks = document.querySelectorAll("#dbOptionList input[name='benchmarkDatabase']");
            var origChecks = document.querySelectorAll("#rightRail input[name='benchmarkDatabase']");
            dbTabChecks.forEach(function (chk, i) {
                if (origChecks[i]) origChecks[i].checked = chk.checked;
            });
            // Unhide the runsPanel so results are visible
            var tabRunsPanel = document.getElementById("tabRunsPanel");
            if (tabRunsPanel) tabRunsPanel.hidden = false;
            var origRunBtn = document.getElementById("runWorkloadBtn");
            if (origRunBtn) origRunBtn.click();
            switchTab("results");
            // Also switch the spec progress tabs to results
            if (window.__switchSpecTab) window.__switchSpecTab("results");
        });
    }

    // Expose switchTab globally
    window.__switchAppTab = switchTab;
})();

// ── Transition: landing forms → app ──
(function () {
    var landingHero = document.getElementById("landingHero");
    var landingAbout = document.getElementById("landingAbout");
    var landingForms = document.getElementById("landingForms");
    var appShell = document.getElementById("appShell");
    var navbar = document.querySelector(".navbar");
    var specBadge = document.getElementById("specBadge");
    var specBadgeText = document.getElementById("specBadgeText");
    var specBadgeDot = document.getElementById("specBadgeDot");
    var overviewLink = document.querySelector(".navbar-link.overview");
    var benchmarkLink = document.querySelector(".navbar-link.benchmark");

    // ── JSON syntax highlighter ──
    function highlightJson(json) {
        var str = typeof json === "string" ? json : JSON.stringify(json, null, 2);
        return str.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
            var cls = "json-number";
            if (/^"/.test(match)) {
                cls = /:$/.test(match) ? "json-key" : "json-string";
            } else if (/true|false/.test(match)) {
                cls = "json-bool";
            }
            return '<span class="' + cls + '">' + match + '</span>';
        });
    }

    // ── Show spec summary view ──
    function showSpecSummary(options) {
        var openChat = options && options.openChat;
        var formsRow = document.getElementById("formsRow");
        var summaryView = document.getElementById("specSummaryView");
        var collapsedTabs = document.getElementById("formsCollapsedTabs");
        // Collapse forms row
        formsRow.classList.add("collapsed");
        // Reduce top gap
        landingForms.classList.add("spec-loaded");
        // // Hide spec badge (redundant now)
        // specBadge.classList.remove("visible");
        // Hide app shell (everything is in workload editor now)
        appShell.classList.remove("active");
        // Show collapsed side tab, summary, and chat panel after collapse animation
        setTimeout(function () {
            collapsedTabs.classList.add("active");
            summaryView.classList.add("active");
            positionCollapsedTabs();
            // Populate workload structure
            populateSpecEditor();
            // Open chat panel if requested (e.g. from Generate Specification)
            if (openChat) {
                var chatPanel = document.getElementById("specChatPanel");
                var rightTab = document.getElementById("collapsedTabRight");
                if (chatPanel) {
                    chatPanel.classList.add("active");
                    landingForms.classList.add("chat-open");
                    if (rightTab) rightTab.style.display = "none";
                    positionChatPanel();
                }
            }
        }, 300);

        // Populate JSON viewer from the existing jsonOutput
        refreshSpecJson();

        // Update validation
        updateSpecValidation();

        // Scroll to A/B/C progress bar
        setTimeout(function () {
            var progressTabs = document.getElementById("specProgressTabs");
            if (progressTabs) {
                progressTabs.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }, 100);

    }

    // Move the workload editor components into the spec summary area
    function populateSpecEditor() {
        var target = document.getElementById("specWorkloadEditor");
        if (!target || target.dataset.populated) return;

        // Tell app.js to stop hiding the panels
        window.__specEditorActive = true;

        // Move (not clone) the actual editor panels — preserves event listeners
        var structurePanel = document.getElementById("structurePanel");
        var workloadForm = document.getElementById("workloadForm");

        target.innerHTML = "";

        // Move structure panel (the actual element, with all its listeners)
        if (structurePanel) {
            structurePanel.hidden = false;
            target.appendChild(structurePanel);
        }

        // Move workload form — hidden until user clicks a phase
        if (workloadForm) {
            workloadForm.hidden = false;
            workloadForm.classList.add("spec-form-collapsed");
            target.appendChild(workloadForm);
        }

        // Toggle form when user clicks a phase pill; show on other structure actions
        target.addEventListener("click", function (e) {
            var pill = e.target.closest(".struct-phase-pill");
            var removeBtn = e.target.closest(".struct-phase-remove");
            var actionBtn = e.target.closest(".struct-action-btn");
            var addSection = e.target.closest("#addSectionBtn");
            var sectionLabel = e.target.closest(".struct-section-label");

            // If clicking remove × on a pill, don't toggle — just let remove logic run
            if (removeBtn) return;

            if (pill) {
                // Toggle: if this pill was already active, hide form; otherwise show
                if (pill.classList.contains("active") && !workloadForm.classList.contains("spec-form-collapsed")) {
                    workloadForm.classList.add("spec-form-collapsed");
                } else {
                    workloadForm.classList.remove("spec-form-collapsed");
                }
            } else if (actionBtn || addSection || sectionLabel) {
                workloadForm.classList.remove("spec-form-collapsed");
            }
        });

        target.dataset.populated = "true";
    }

    // Refresh JSON in spec summary viewer
    function refreshSpecJson() {
        var jsonOutput = document.getElementById("jsonOutput");
        var specJsonPre = document.getElementById("specJsonPre");
        if (jsonOutput && specJsonPre && jsonOutput.value && jsonOutput.value !== "{}") {
            try {
                var parsed = JSON.parse(jsonOutput.value);
                specJsonPre.innerHTML = highlightJson(parsed);
            } catch (e) {
                specJsonPre.textContent = jsonOutput.value;
            }
        }
    }

    // Update validation indicator
    function updateSpecValidation() {
        var validationResult = document.getElementById("validationResult");
        var summaryValid = document.getElementById("specSummaryValid");
        if (validationResult && validationResult.textContent.indexOf("Valid") > -1) {
            summaryValid.style.display = "";
        } else {
            summaryValid.style.display = "none";
        }
    }

    // Watch for JSON changes to keep spec viewer in sync
    var jsonOutputEl = document.getElementById("jsonOutput");
    if (jsonOutputEl) {
        var jsonObserver = new MutationObserver(function () {
            refreshSpecJson();
            updateSpecValidation();
        });
        jsonObserver.observe(jsonOutputEl, { attributes: true, childList: true, characterData: true });
        // Also poll for value changes (textarea value changes don't trigger MutationObserver)
        setInterval(function () {
            var summaryView = document.getElementById("specSummaryView");
            if (summaryView && summaryView.classList.contains("active")) {
                refreshSpecJson();
                updateSpecValidation();
            }
        }, 1000);
    }

    function showWorkloadEditor() {
        // Hide the "Choose how to begin" builder entry card
        var entryCard = document.querySelector(".builder-entry-card");
        if (entryCard) entryCard.style.display = "none";

        // Remove builder-only class so right rail shows
        appShell.classList.remove("builder-only");

        // Force show the builder panel and preview panel
        var builderPanel = document.getElementById("builderPanel");
        var previewPanel = document.getElementById("previewPanel");
        var rightRail = document.getElementById("rightRail");
        if (builderPanel) builderPanel.hidden = false;
        if (previewPanel) previewPanel.hidden = false;
        if (rightRail) rightRail.style.display = "";

        // Auto-expand the structure panel and workload form
        var structurePanelToggleRow = document.getElementById("structurePanelToggleRow");
        var structurePanel = document.getElementById("structurePanel");
        var workloadForm = document.getElementById("workloadForm");
        if (structurePanelToggleRow) structurePanelToggleRow.hidden = false;
        if (structurePanel) structurePanel.hidden = false;
        if (workloadForm) workloadForm.hidden = false;

        // Show action buttons
        var runWorkloadBtn = document.getElementById("runWorkloadBtn");
        var downloadJsonBtn = document.getElementById("downloadJsonBtn");
        var copyBtn = document.getElementById("copyBtn");
        var newWorkloadBtn = document.getElementById("newWorkloadBtn");
        if (runWorkloadBtn) runWorkloadBtn.hidden = false;
        if (downloadJsonBtn) downloadJsonBtn.hidden = false;
        if (copyBtn) copyBtn.hidden = false;
        if (newWorkloadBtn) newWorkloadBtn.hidden = false;

        // Switch to edit tab
        if (window.__switchAppTab) window.__switchAppTab("edit");
    }

    function enterApp() {
        // Hide old app header
        var appHeader = document.getElementById("appHeader");
        if (appHeader) appHeader.hidden = true;

        // Show navbar always in app mode
        navbar.classList.add("visible");
        document.body.classList.add("app-active");
        overviewLink.classList.remove("active");
        benchmarkLink.classList.remove("active");

        // Show app shell (keep landing sections visible — single page)
        appShell.classList.add("active");

        // // Show spec badge
        // specBadgeText.textContent = label;
        // specBadgeDot.className = "spec-badge-dot " + (isPreset ? "preset" : "custom");
        // specBadge.classList.add("visible");

        // Show the workload editor (hidden initially, shown by Edit button)
        showWorkloadEditor();
    }

    function exitApp() {
        // Hide app
        appShell.classList.remove("active");
        document.body.classList.remove("app-active");
        specBadge.classList.remove("visible");

        // Restore builder entry card visibility for next time
        var entryCard = document.querySelector(".builder-entry-card");
        if (entryCard) entryCard.style.display = "";

        // Show forms, hide summary, collapsed tabs, and chat panel
        var formsRow = document.getElementById("formsRow");
        var summaryView = document.getElementById("specSummaryView");
        var collapsedTabs = document.getElementById("formsCollapsedTabs");
        var chatPanel = document.getElementById("specChatPanel");
        formsRow.classList.remove("collapsed");
        summaryView.classList.remove("active");
        collapsedTabs.classList.remove("active");
        landingForms.classList.remove("spec-loaded");
        landingForms.classList.remove("chat-open");
        if (chatPanel) chatPanel.classList.remove("active");
        // Remove sticky progress bar
        var progressTabs = document.getElementById("specProgressTabs");
        var placeholder = document.getElementById("specProgressPlaceholder");
        if (progressTabs) progressTabs.classList.remove("sticky");
        if (placeholder) placeholder.classList.remove("active");
        // Clear chat messages
        var chatMessages = document.getElementById("specChatMessages");
        var chatEmpty = document.getElementById("specChatEmpty");
        if (chatMessages) {
            var msgs = chatMessages.querySelectorAll(".spec-chat-msg");
            msgs.forEach(function (m) { m.remove(); });
            if (chatEmpty) chatEmpty.style.display = "";
        }
        var chatInput = document.getElementById("specChatInput");
        if (chatInput) chatInput.value = "";
        // Restore right tab visibility
        var rightTab = document.getElementById("collapsedTabRight");
        if (rightTab) rightTab.style.display = "";

        // Clear spec editor flag and move elements back to app shell
        window.__specEditorActive = false;
        var specEditor = document.getElementById("specWorkloadEditor");
        var builderPanel = document.getElementById("builderPanel");
        var structurePanel = document.getElementById("structurePanel");
        var workloadForm = document.getElementById("workloadForm");
        if (builderPanel && structurePanel && specEditor && specEditor.contains(structurePanel)) {
            var panelBody = builderPanel.querySelector(".panel-body");
            if (panelBody) {
                panelBody.appendChild(structurePanel);
                if (workloadForm) panelBody.appendChild(workloadForm);
            }
        }
        if (specEditor) {
            specEditor.innerHTML = "";
            delete specEditor.dataset.populated;
        }

        // Hide JSON viewer and clear inline display overrides
        var jsonViewer = document.getElementById("specJsonViewer");
        jsonViewer.classList.remove("active");
        jsonViewer.style.display = "";
        document.getElementById("specSummaryBody").classList.remove("with-json");

        // Scroll to forms
        setTimeout(function () {
            landingForms.scrollIntoView({ behavior: "smooth" });
        }, 100);
    }

    // Spec badge click → go back to forms
    specBadge.addEventListener("click", exitApp);

    // "Let's Benchmark" nav link → exit spec view if active
    if (benchmarkLink) {
        benchmarkLink.addEventListener("click", function () {
            var summaryView = document.getElementById("specSummaryView");
            if (summaryView && summaryView.classList.contains("active")) {
                exitApp();
            }
        });
    }

    // Collapsed side tab — Left ("Standard Benchmarks") → expand forms back
    document.getElementById("collapsedTabLeft").addEventListener("click", exitApp);

    // Collapsed side tab — Right ("Describe Workload") → open chat panel & hide tab
    var collapsedTabRight = document.getElementById("collapsedTabRight");
    collapsedTabRight.addEventListener("click", function () {
        var chatPanel = document.getElementById("specChatPanel");
        if (chatPanel) {
            chatPanel.classList.add("active");
            collapsedTabRight.style.display = "none";
            landingForms.classList.add("chat-open");
            positionChatPanel();
        }
    });

    // Chat close button → hide chat panel & re-show right tab
    var specChatCloseBtn = document.getElementById("specChatCloseBtn");
    if (specChatCloseBtn) {
        specChatCloseBtn.addEventListener("click", function () {
            var chatPanel = document.getElementById("specChatPanel");
            if (chatPanel) chatPanel.classList.remove("active");
            collapsedTabRight.style.display = "";
            landingForms.classList.remove("chat-open");
        });
    }

    // Position chat panel below A/B/C bar, within landing-forms bounds
    function positionChatPanel() {
        var chatPanel = document.getElementById("specChatPanel");
        if (!chatPanel || !chatPanel.classList.contains("active")) return;
        var progressTabs = document.getElementById("specProgressTabs");
        var sRect = landingForms.getBoundingClientRect();
        var navH = 60;
        // Top: below the A/B/C bar (whether sticky or inline)
        var progressBottom = progressTabs ? progressTabs.getBoundingClientRect().bottom : navH;
        var topBound = Math.max(progressBottom, navH);
        // Bottom: end of landing-forms or viewport
        var bottomBound = Math.min(sRect.bottom, window.innerHeight);
        var chatH = bottomBound - topBound;
        if (chatH < 200) chatH = 200;
        chatPanel.style.top = topBound + "px";
        chatPanel.style.height = chatH + "px";
        chatPanel.style.transform = "none";
    }

    window.addEventListener("scroll", function () {
        positionChatPanel();
        handleProgressSticky();
    }, { passive: true });
    window.addEventListener("resize", function () {
        positionChatPanel();
        handleProgressSticky();
    });

    // Sticky A/B/C progress bar
    function handleProgressSticky() {
        var progressTabs = document.getElementById("specProgressTabs");
        var placeholder = document.getElementById("specProgressPlaceholder");
        var summaryView = document.getElementById("specSummaryView");
        if (!progressTabs || !summaryView || !summaryView.classList.contains("active")) {
            if (progressTabs) progressTabs.classList.remove("sticky");
            if (placeholder) placeholder.classList.remove("active");
            return;
        }
        var navH = 60;
        // Use placeholder position if it's active, otherwise use progress tab's natural position
        var refEl = placeholder.classList.contains("active") ? placeholder : progressTabs;
        var refRect = refEl.getBoundingClientRect();
        if (refRect.top <= navH) {
            if (!progressTabs.classList.contains("sticky")) {
                progressTabs.classList.add("sticky");
                placeholder.classList.add("active");
            }
        } else {
            progressTabs.classList.remove("sticky");
            placeholder.classList.remove("active");
        }
    }

    // ── Spec progress tab switching (mirrors app tabs) ──
    (function () {
        var specSteps = document.querySelectorAll(".spec-progress-step");
        var specStepOrder = ["edit", "databases", "results"];
        var specConAB = document.getElementById("specConnectorAB");
        var specConBC = document.getElementById("specConnectorBC");

        var specEditorArea = document.getElementById("specWorkloadEditor");
        var specSummaryBody = document.getElementById("specSummaryBody");
        var tabDatabases = document.getElementById("tabDatabases");
        var tabResults = document.getElementById("tabResults");

        function switchSpecTab(tabName) {
            var activeIdx = specStepOrder.indexOf(tabName);
            specSteps.forEach(function (s) {
                var tab = s.getAttribute("data-tab");
                var idx = specStepOrder.indexOf(tab);
                s.classList.remove("active", "done");
                if (idx < activeIdx) s.classList.add("done");
                if (idx === activeIdx) s.classList.add("active");
            });
            if (specConAB) specConAB.classList.toggle("done", activeIdx > 0);
            if (specConBC) specConBC.classList.toggle("done", activeIdx > 1);

            // Hide/show right collapsed tab and action bar based on tab
            var collapsedTabR = document.getElementById("collapsedTabRight");
            var specHeader = document.querySelector(".spec-summary-header");

            if (tabName === "edit") {
                // Restore workload editor
                specEditorArea.style.display = "";
                if (specHeader) specHeader.style.display = "";
                if (collapsedTabR && !document.getElementById("specChatPanel").classList.contains("active")) {
                    collapsedTabR.style.display = "";
                }
                // Restore JSON viewer visibility if it was active
                var jsonViewer = document.getElementById("specJsonViewer");
                if (jsonViewer && jsonViewer.classList.contains("active")) {
                    jsonViewer.style.display = "";
                }
                // Move databases/results content back to app shell if needed
                if (tabDatabases && tabDatabases.parentElement === specSummaryBody) {
                    var appMain = appShell.querySelector("main");
                    if (appMain) {
                        appMain.appendChild(tabDatabases);
                        appMain.appendChild(tabResults);
                    }
                }
            } else if (tabName === "databases") {
                // Hide workload editor + action bar + right tab
                specEditorArea.style.display = "none";
                if (specHeader) specHeader.style.display = "none";
                if (collapsedTabR) collapsedTabR.style.display = "none";
                var jsonViewer = document.getElementById("specJsonViewer");
                if (jsonViewer) jsonViewer.style.display = "none";
                tabDatabases.classList.add("active");
                tabResults.classList.remove("active");
                specSummaryBody.appendChild(tabDatabases);
            } else if (tabName === "results") {
                specEditorArea.style.display = "none";
                if (specHeader) specHeader.style.display = "none";
                if (collapsedTabR) collapsedTabR.style.display = "none";
                var jsonViewer2 = document.getElementById("specJsonViewer");
                if (jsonViewer2) jsonViewer2.style.display = "none";
                tabResults.classList.add("active");
                tabDatabases.classList.remove("active");
                specSummaryBody.appendChild(tabResults);
            }
        }

        specSteps.forEach(function (step) {
            step.addEventListener("click", function () {
                switchSpecTab(this.getAttribute("data-tab"));
            });
        });

        // Expose globally so other parts (dbRunBtn) can switch spec tabs
        window.__switchSpecTab = switchSpecTab;
    })();

    // Position collapsed tabs within the forms section on scroll
    function positionCollapsedTabs() {
        var wrapper = document.getElementById("formsCollapsedTabs");
        if (!wrapper || !wrapper.classList.contains("active")) return;
        var section = document.getElementById("landingForms");
        var tabL = document.getElementById("collapsedTabLeft");
        var tabR = document.getElementById("collapsedTabRight");
        if (!section || !tabL || !tabR) return;

        var sRect = section.getBoundingClientRect();
        var tabH = tabL.offsetHeight;
        var viewH = window.innerHeight;

        // The section top in viewport = sRect.top
        // We want tabs to:
        //   - Touch the top of the section (dark section bottom edge) when scrolled up
        //   - Center in viewport when the section fills the view
        //   - Never go below the section bottom

        // Ideal: vertically centered in the visible portion of the section
        var visibleTop = Math.max(sRect.top, 0);
        var visibleBot = Math.min(sRect.bottom, viewH);
        var visibleCenter = (visibleTop + visibleBot) / 2;

        // Convert to position relative to the section
        var topInSection = visibleCenter - sRect.top - tabH / 2;

        // Clamp: don't go above section start or below section end
        topInSection = Math.max(0, Math.min(topInSection, sRect.height - tabH));

        tabL.style.top = topInSection + "px";
        tabR.style.top = topInSection + "px";
    }

    window.addEventListener("scroll", positionCollapsedTabs, { passive: true });
    window.addEventListener("resize", positionCollapsedTabs);

    // ── Spec summary button handlers ──
    // View JSON
    document.getElementById("specViewJsonBtn").addEventListener("click", function () {
        var viewer = document.getElementById("specJsonViewer");
        var body = document.getElementById("specSummaryBody");
        var isOpen = viewer.classList.contains("active");
        if (isOpen) {
            viewer.classList.remove("active");
            body.classList.remove("with-json");
            this.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>View JSON';
        } else {
            // Refresh JSON content
            var jsonOutput = document.getElementById("jsonOutput");
            if (jsonOutput) {
                try {
                    var parsed = JSON.parse(jsonOutput.value);
                    document.getElementById("specJsonPre").innerHTML = highlightJson(parsed);
                } catch (e) {
                    document.getElementById("specJsonPre").textContent = jsonOutput.value;
                }
            }
            viewer.classList.add("active");
            body.classList.add("with-json");
            this.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Hide JSON';
        }
    });

    // Download
    document.getElementById("specDownloadBtn").addEventListener("click", function () {
        var downloadBtn = document.getElementById("downloadJsonBtn");
        if (downloadBtn) downloadBtn.click();
    });

    // Copy
    document.getElementById("specCopyBtn").addEventListener("click", function () {
        var jsonOutput = document.getElementById("jsonOutput");
        if (jsonOutput && jsonOutput.value) {
            navigator.clipboard.writeText(jsonOutput.value).then(function () {
                var btn = document.getElementById("specCopyBtn");
                var orig = btn.innerHTML;
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Copied!';
                setTimeout(function () { btn.innerHTML = orig; }, 1500);
            });
        }
    });

    // Load Benchmark button
    document.getElementById("landingPresetSubmit").addEventListener("click", function () {
        var family = document.getElementById("landingPresetFamily");
        var file = document.getElementById("landingPresetFile");
        var scale = document.getElementById("landingPresetScale");
        var origFamily = document.getElementById("presetFamilySelect");
        var origFile = document.getElementById("presetFileSelect");
        var origScale = document.getElementById("presetScaleInput");

        // // Build label from landing selects before syncing
        // var familyText = family.options[family.selectedIndex] ? family.options[family.selectedIndex].text : family.value;
        // var fileText = file.options[file.selectedIndex] ? file.options[file.selectedIndex].text : file.value;
        var targetFileValue = file.value;
        // var label = familyText + " / " + fileText + " (scale: " + scale.value + ")";

        // Sync family to original — this triggers async file population
        if (origFamily) { origFamily.value = family.value; origFamily.dispatchEvent(new Event("change", { bubbles: true })); }

        // Wait for file options to populate, then set file and trigger load
        var attempts = 0;
        var waitForFile = setInterval(function () {
            attempts++;
            var hasOption = Array.from(origFile.options).some(function (o) { return o.value === targetFileValue; });
            if (hasOption || attempts > 30) {
                clearInterval(waitForFile);
                // Set scale value silently, then trigger file change which reads scale
                if (origScale) { origScale.value = scale.value; }
                if (origFile) { origFile.value = targetFileValue; origFile.dispatchEvent(new Event("change", { bubbles: true })); }
                // Wait for preset to fully load, then show summary
                setTimeout(function () {
                    enterApp();
                    setTimeout(function () {
                        showWorkloadEditor();
                        // Show summary view after data is ready
                        setTimeout(function () { showSpecSummary(); }, 200);
                    }, 100);
                }, 400);
            }
        }, 50);
    });

    // Generate Specification button
    document.getElementById("landingPromptSubmit").addEventListener("click", function () {
        var prompt = document.getElementById("landingWorkloadPrompt");
        var assistantInput = document.getElementById("assistantInput");
        var assistantApplyBtn = document.getElementById("assistantApplyBtn");

        // Copy prompt to assistant input and trigger
        if (assistantInput) {
            assistantInput.value = prompt.value;
            assistantInput.dispatchEvent(new Event("input", { bubbles: true }));
        }

        enterApp();

        // Trigger the assistant apply after app is shown
        setTimeout(function () {
            if (assistantApplyBtn) { assistantApplyBtn.click(); }
        }, 500);

        // Show spec summary with chat open — the JSON will populate when ollama responds
        setTimeout(function () {
            showWorkloadEditor();
            setTimeout(function () { showSpecSummary({ openChat: true }); }, 200);
        }, 600);
    });

})();

// ── Spec Chat Panel — bridges to existing assistant panel (ollama API) ──
(function () {
    var chatInput = document.getElementById("specChatInput");
    var chatSendBtn = document.getElementById("specChatSendBtn");
    var chatMessages = document.getElementById("specChatMessages");
    var chatEmpty = document.getElementById("specChatEmpty");
    var chatStatus = document.getElementById("specChatStatus");
    var assistantInput = document.getElementById("assistantInput");
    var assistantApplyBtn = document.getElementById("assistantApplyBtn");
    var assistantTimeline = document.getElementById("assistantTimeline");

    if (!chatInput || !chatSendBtn) return;

    // Enable/disable send button
    chatInput.addEventListener("input", function () {
        chatSendBtn.disabled = chatInput.value.trim() === "";
    });

    // Allow Enter to send (Shift+Enter for newline)
    chatInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (!chatSendBtn.disabled) chatSendBtn.click();
        }
    });

    function addChatMessage(text, role) {
        if (chatEmpty) chatEmpty.style.display = "none";
        var msg = document.createElement("div");
        msg.className = "spec-chat-msg " + role;
        msg.textContent = text;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msg;
    }

    function addAssistantMessage(html) {
        if (chatEmpty) chatEmpty.style.display = "none";
        var msg = document.createElement("div");
        msg.className = "spec-chat-msg assistant";
        msg.innerHTML = html;
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msg;
    }

    // Watch the assistant timeline for new responses
    var lastTimelineCount = 0;
    function checkTimeline() {
        if (!assistantTimeline) return;
        var turns = assistantTimeline.querySelectorAll(".assistant-turn.assistant");
        if (turns.length > lastTimelineCount) {
            // New assistant response(s)
            for (var i = lastTimelineCount; i < turns.length; i++) {
                var turn = turns[i];
                var summary = turn.querySelector(".assistant-turn-message");
                var assumptions = turn.querySelector(".assistant-assumptions");
                var html = "";
                if (summary) html += summary.textContent;
                if (assumptions) {
                    var items = assumptions.querySelectorAll("li");
                    if (items.length > 0) {
                        html += '<div class="chat-assumptions">Assumptions:<ul>';
                        items.forEach(function (li) {
                            html += "<li>" + li.textContent + "</li>";
                        });
                        html += "</ul></div>";
                    }
                }
                if (html) addAssistantMessage(html);
            }
            lastTimelineCount = turns.length;
            if (chatStatus) {
                chatStatus.textContent = "Ready";
                chatStatus.className = "spec-chat-status";
            }
        }
    }

    // Observe timeline for changes
    if (assistantTimeline) {
        var timelineObserver = new MutationObserver(checkTimeline);
        timelineObserver.observe(assistantTimeline, { childList: true, subtree: true });
    }

    // Send message
    chatSendBtn.addEventListener("click", function () {
        var text = chatInput.value.trim();
        if (!text) return;

        // Show user message in chat
        addChatMessage(text, "user");
        chatInput.value = "";
        chatSendBtn.disabled = true;

        // Update status
        if (chatStatus) {
            chatStatus.textContent = "Thinking...";
            chatStatus.className = "spec-chat-status loading";
        }

        // Forward to the existing assistant panel
        if (assistantInput) {
            assistantInput.value = text;
            assistantInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
        // Trigger apply
        setTimeout(function () {
            if (assistantApplyBtn && !assistantApplyBtn.disabled) {
                assistantApplyBtn.click();
            }
        }, 100);
    });

    // Also sync when the landing "Generate Specification" copies text
    var landingPrompt = document.getElementById("landingWorkloadPrompt");
    if (landingPrompt) {
        var origSubmit = document.getElementById("landingPromptSubmit");
        if (origSubmit) {
            origSubmit.addEventListener("click", function () {
                var text = landingPrompt.value.trim();
                if (text) {
                    addChatMessage(text, "user");
                    if (chatStatus) {
                        chatStatus.textContent = "Thinking...";
                        chatStatus.className = "spec-chat-status loading";
                    }
                }
            });
        }
    }
})();