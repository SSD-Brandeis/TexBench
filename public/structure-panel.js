(() => {
  function humanizeOperationName(name) {
    return String(name || "")
      .replace(/_/g, " ")
      .trim();
  }

  function describeGroupOperations(group) {
    if (!group || typeof group !== "object") {
      return "empty";
    }
    const operationNames = Object.keys(group)
      .filter((k) => k !== "phase_name" && k !== "name")
      .map(humanizeOperationName)
      .filter(Boolean);
    if (operationNames.length === 0) {
      return "empty";
    }
    return operationNames.join(", ");
  }

  function getPhaseName(group, groupIndex) {
    // Try preset phase_name or name field first
    if (group && typeof group.phase_name === "string" && group.phase_name.trim()) {
      return group.phase_name.trim();
    }
    if (group && typeof group.name === "string" && group.name.trim()) {
      return group.name.trim();
    }
    // Fall back to operation names
    return describeGroupOperations(group);
  }

  function createRenderer({
    container,
    selectionLabel,
    countConfiguredGroupOperations,
    onSelectSection,
    onAddGroup,
    onRemoveSection,
    onSelectGroup,
    onRemoveGroup,
  }) {
    function render({ sections, activeSectionIndex, activeGroupIndex }) {
      if (!container) {
        return;
      }
      container.innerHTML = "";

      if (selectionLabel) {
        selectionLabel.textContent =
          "Editing Section " +
          (activeSectionIndex + 1) +
          " / Phase " +
          (activeGroupIndex + 1);
      }

      const wrapper = document.createElement("div");
      wrapper.className = "struct-compact";

      (sections || []).forEach((section, sectionIndex) => {
        const sBlock = document.createElement("div");
        sBlock.className = "struct-section";
        if (sectionIndex === activeSectionIndex) sBlock.classList.add("active");

        // Section header row
        const sHead = document.createElement("div");
        sHead.className = "struct-section-head";

        const sLabel = document.createElement("button");
        sLabel.type = "button";
        sLabel.className = "struct-section-label";
        if (sectionIndex === activeSectionIndex) sLabel.classList.add("active");
        sLabel.textContent = "Section " + (sectionIndex + 1);
        sLabel.addEventListener("click", () => {
          onSelectSection(sectionIndex, section);
        });
        sHead.appendChild(sLabel);

        // + Add Phase button
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "struct-add-phase-btn";
        addBtn.innerHTML =
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
          '<span>Add Phase</span>';
        addBtn.addEventListener("click", () => {
          onAddGroup(sectionIndex, section);
        });
        sHead.appendChild(addBtn);

        // Remove section (only if >1 section)
        if ((sections || []).length > 1) {
          const rmBtn = document.createElement("button");
          rmBtn.type = "button";
          rmBtn.className = "struct-remove-section-btn";
          rmBtn.textContent = "×";
          rmBtn.title = "Remove Section";
          rmBtn.addEventListener("click", () => {
            onRemoveSection(sectionIndex);
          });
          sHead.appendChild(rmBtn);
        }

        sBlock.appendChild(sHead);

        // Phase pills
        const pills = document.createElement("div");
        pills.className = "struct-phases";

        (section.groups || []).forEach((group, groupIndex) => {
          const isActive =
            sectionIndex === activeSectionIndex &&
            groupIndex === activeGroupIndex;

          const pill = document.createElement("button");
          pill.type = "button";
          pill.className = "struct-phase-pill";
          if (isActive) pill.classList.add("active");

          const phaseName = getPhaseName(group, groupIndex);

          pill.innerHTML =
            '<span class="struct-phase-num">Phase ' + (groupIndex + 1) + ':</span>' +
            '<span class="struct-phase-ops">' + phaseName + '</span>';

          pill.addEventListener("click", () => {
            onSelectGroup(sectionIndex, groupIndex);
          });

          // Remove × (only if >1 phase)
          if ((section.groups || []).length > 1) {
            const rmPill = document.createElement("span");
            rmPill.className = "struct-phase-remove";
            rmPill.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            rmPill.title = "Remove Phase";
            rmPill.addEventListener("click", (e) => {
              e.stopPropagation();
              onRemoveGroup(sectionIndex, groupIndex, section);
            });
            pill.appendChild(rmPill);
          }

          pills.appendChild(pill);
        });

        sBlock.appendChild(pills);

        // Hint text
        const hint = document.createElement("p");
        hint.className = "struct-hint";
        hint.textContent = "Click a phase to edit its configuration";
        sBlock.appendChild(hint);

        wrapper.appendChild(sBlock);
      });

      container.appendChild(wrapper);
    }

    return {
      render,
    };
  }

  globalThis.TectonicStructurePanel = {
    createRenderer,
  };
})();
