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
      .map(humanizeOperationName)
      .filter(Boolean);
    if (operationNames.length === 0) {
      return "empty";
    }
    return operationNames.join(", ");
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

      (sections || []).forEach((section, sectionIndex) => {
        const sectionCard = document.createElement("div");
        sectionCard.className = "structure-section-card";

        const head = document.createElement("div");
        head.className = "structure-section-head";

        const title = document.createElement("div");
        title.className = "structure-section-title";

        const sectionBtn = document.createElement("button");
        sectionBtn.type = "button";
        sectionBtn.className = "structure-section-btn";
        if (sectionIndex === activeSectionIndex) {
          sectionBtn.classList.add("active");
        }
        sectionBtn.textContent = "Section " + (sectionIndex + 1);
        sectionBtn.addEventListener("click", () => {
          onSelectSection(sectionIndex, section);
        });
        title.appendChild(sectionBtn);

        const chip = document.createElement("span");
        chip.className = "structure-chip";
        chip.textContent = section.skip_key_contains_check
          ? "skip contains check"
          : section.groups.length + " phase(s)";
        title.appendChild(chip);
        head.appendChild(title);

        const actions = document.createElement("div");
        actions.className = "structure-actions";

        const addGroupButton = document.createElement("button");
        addGroupButton.type = "button";
        addGroupButton.className = "structure-mini-btn";
        addGroupButton.textContent = "Add Phase";
        addGroupButton.addEventListener("click", () => {
          onAddGroup(sectionIndex, section);
        });
        actions.appendChild(addGroupButton);

        const removeSectionButton = document.createElement("button");
        removeSectionButton.type = "button";
        removeSectionButton.className = "structure-mini-btn";
        removeSectionButton.textContent = "Remove Section";
        removeSectionButton.disabled = (sections || []).length <= 1;
        removeSectionButton.addEventListener("click", () => {
          onRemoveSection(sectionIndex);
        });
        actions.appendChild(removeSectionButton);
        head.appendChild(actions);
        sectionCard.appendChild(head);

        const groupList = document.createElement("div");
        groupList.className = "structure-group-list";

        (section.groups || []).forEach((group, groupIndex) => {
          const row = document.createElement("div");
          row.className = "structure-group-row";

          const groupBtn = document.createElement("button");
          groupBtn.type = "button";
          groupBtn.className = "structure-group-btn";
          if (
            sectionIndex === activeSectionIndex &&
            groupIndex === activeGroupIndex
          ) {
            groupBtn.classList.add("active");
          }
          const opCount = countConfiguredGroupOperations(group);
          const opDescription =
            opCount > 0 ? describeGroupOperations(group) : "empty";
          groupBtn.textContent =
            "Phase " +
            (groupIndex + 1) +
            " • " +
            opDescription;
          groupBtn.addEventListener("click", () => {
            onSelectGroup(sectionIndex, groupIndex);
          });
          row.appendChild(groupBtn);

          const removeGroupButton = document.createElement("button");
          removeGroupButton.type = "button";
          removeGroupButton.className = "structure-mini-btn";
          removeGroupButton.textContent = "Remove";
          removeGroupButton.disabled = (section.groups || []).length <= 1;
          removeGroupButton.addEventListener("click", () => {
            onRemoveGroup(sectionIndex, groupIndex, section);
          });
          row.appendChild(removeGroupButton);

          groupList.appendChild(row);
        });

        sectionCard.appendChild(groupList);
        container.appendChild(sectionCard);
      });
    }

    return {
      render,
    };
  }

  globalThis.TectonicStructurePanel = {
    createRenderer,
  };
})();
