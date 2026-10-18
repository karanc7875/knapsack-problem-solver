(function () {
  "use strict";

  var algorithms = window.KnapsackAlgorithms;
  var MAX_DP_CELLS = 1000000;
  var MAX_ITEMS = 250;
  var itemSequence = 0;
  var lastResults = null;
  var charts = { value: null, time: null, nodes: null };
  var palette = ["#5368df", "#e3a23e", "#16a078", "#df6470"];

  var elements = {
    capacity: document.getElementById("capacity"),
    itemsBody: document.getElementById("items-body"),
    itemCount: document.getElementById("item-count"),
    inputError: document.getElementById("input-error"),
    resultMessage: document.getElementById("result-message"),
    resultsBody: document.getElementById("results-body"),
    solutionSummary: document.getElementById("solution-summary"),
    dpContainer: document.getElementById("dp-table-container"),
    valueChart: document.getElementById("value-chart"),
    chartUnavailable: document.getElementById("chart-unavailable"),
    benchmarkStatus: document.getElementById("benchmark-status"),
    timeChart: document.getElementById("time-chart"),
    nodesChart: document.getElementById("nodes-chart")
  };

  function addItemRow(name, weight, value) {
    itemSequence += 1;
    var row = document.createElement("tr");
    row.dataset.itemId = String(itemSequence);
    var fields = [
      { key: "name", type: "text", value: name || "Item " + itemSequence, placeholder: "e.g. Laptop" },
      { key: "weight", type: "number", value: weight === undefined ? "" : weight, placeholder: "e.g. 10" },
      { key: "value", type: "number", value: value === undefined ? "" : value, placeholder: "e.g. 60" }
    ];
    fields.forEach(function (field) {
      var cell = document.createElement("td");
      var input = document.createElement("input");
      input.type = field.type;
      input.dataset.field = field.key;
      input.value = field.value;
      input.placeholder = field.placeholder;
      input.setAttribute("aria-label", field.key + " for item " + itemSequence);
      if (field.type === "number") {
        input.min = field.key === "weight" ? "0" : "-1000000000";
        input.step = "1";
      }
      cell.appendChild(input);
      row.appendChild(cell);
    });
    var removeCell = document.createElement("td");
    var remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "×";
    remove.title = "Remove item";
    remove.setAttribute("aria-label", "Remove item " + itemSequence);
    remove.addEventListener("click", function () {
      row.remove();
      updateItemCount();
      hideInputError();
    });
    removeCell.appendChild(remove);
    row.appendChild(removeCell);
    elements.itemsBody.appendChild(row);
    updateItemCount();
  }

  function updateItemCount() {
    var count = elements.itemsBody.querySelectorAll("tr").length;
    elements.itemCount.textContent = count + (count === 1 ? " item" : " items");
  }

  function hideInputError() {
    elements.inputError.hidden = true;
    elements.inputError.textContent = "";
  }

  function showInputError(message) {
    elements.inputError.textContent = message;
    elements.inputError.hidden = false;
  }

  function readAndValidateInput() {
    var capacity = Number(elements.capacity.value);
    if (elements.capacity.value.trim() === "" || !Number.isInteger(capacity) || capacity <= 0) {
      return { error: "Bag capacity must be a whole number greater than 0." };
    }
    var rows = Array.from(elements.itemsBody.querySelectorAll("tr"));
    if (rows.length > MAX_ITEMS) return { error: "For browser responsiveness, use no more than " + MAX_ITEMS + " items at a time." };
    var items = [];
    for (var i = 0; i < rows.length; i += 1) {
      var nameInput = rows[i].querySelector('[data-field="name"]');
      var weightInput = rows[i].querySelector('[data-field="weight"]');
      var valueInput = rows[i].querySelector('[data-field="value"]');
      var name = nameInput.value.trim();
      var weightText = weightInput.value.trim();
      var valueText = valueInput.value.trim();
      if (!name || weightText === "" || valueText === "") {
        return { error: "Complete the name, weight, and value for item " + (i + 1) + "." };
      }
      var weight = Number(weightText);
      var value = Number(valueText);
      if (!Number.isSafeInteger(weight) || weight < 0) {
        return { error: "Item " + (i + 1) + " must have a non-negative whole-number weight." };
      }
      if (!Number.isSafeInteger(value) || value < 0) {
        return { error: "Item " + (i + 1) + " must have a non-negative whole-number value." };
      }
      items.push({ name: name, weight: weight, value: value });
    }
    if ((items.length + 1) * (capacity + 1) > MAX_DP_CELLS) {
      return { error: "This DP table would be too large to safely calculate in your browser. Reduce the item count or capacity so (items + 1) × (capacity + 1) is at most " + MAX_DP_CELLS.toLocaleString() + "." };
    }
    return { items: items, capacity: capacity };
  }

  function runAveraged(fn, repeats) {
    var result;
    var start = performance.now();
    for (var i = 0; i < repeats; i += 1) result = fn();
    result.timeMs = (performance.now() - start) / repeats;
    return result;
  }

  function runSolve() {
    hideInputError();
    var input = readAndValidateInput();
    if (input.error) {
      showInputError(input.error);
      return;
    }
    try {
      var items = input.items;
      var capacity = input.capacity;
      var dp = runAveraged(function () { return algorithms.dynamicProgramming(items, capacity); }, 5);
      var greedy = runAveraged(function () { return algorithms.greedy(items, capacity); }, 5);
      var quickBacktrackingRepeats = items.length <= 10 ? 5 : 1;
      var pruned = items.length <= 45
        ? runAveraged(function () { return algorithms.backtrackingWithPruning(items, capacity); }, quickBacktrackingRepeats)
        : null;
      var plain = items.length <= 25
        ? runAveraged(function () { return algorithms.backtrackingWithoutPruning(items, capacity); }, quickBacktrackingRepeats)
        : null;
      lastResults = { dp: dp, greedy: greedy, pruned: pruned, plain: plain, items: items, capacity: capacity };
      renderResults(lastResults);
      renderDpTable(dp, items, capacity);
      renderValueChart(lastResults);
      document.getElementById("results-section").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      showInputError("Could not solve this input: " + error.message);
    }
  }

  function totalWeight(result) {
    return result.selectedItems.reduce(function (total, item) { return total + item.weight; }, 0);
  }

  function formatTime(timeMs) {
    return timeMs < 0.01 ? timeMs.toFixed(4) : timeMs.toFixed(3);
  }

  function renderResults(results) {
    var rows = [
      { label: "Dynamic Programming", result: results.dp },
      { label: "Greedy by ratio", result: results.greedy },
      { label: "Backtracking + pruning", result: results.pruned },
      { label: "Plain recursion", result: results.plain }
    ];
    elements.resultsBody.replaceChildren();
    rows.forEach(function (entry) {
      var tr = document.createElement("tr");
      if (!entry.result) {
        tr.innerHTML = '<td class="result-algorithm">' + entry.label + '</td><td colspan="5" class="result-detail">Skipped for safety (input exceeds the item limit).</td><td><span class="optimal-badge optimal-skipped">Skipped</span></td>';
        elements.resultsBody.appendChild(tr);
        return;
      }
      var result = entry.result;
      var cells = [
        { className: "result-algorithm", text: entry.label },
        { text: String(result.maxValue) },
        { text: String(totalWeight(result)) },
        { text: result.selectedItems.length ? result.selectedItems.map(function (item) { return item.name; }).join(", ") : "None" },
        { text: formatTime(result.timeMs) },
        { text: result.extraInfo.nodesExplored === undefined ? "—" : result.extraInfo.nodesExplored.toLocaleString() }
      ];
      cells.forEach(function (cellInfo, index) {
        var td = document.createElement("td");
        if (cellInfo.className) td.className = cellInfo.className;
        td.textContent = cellInfo.text;
        if (index === 3 && result.selectedItems.length) {
          var detail = document.createElement("div");
          detail.className = "result-detail";
          detail.textContent = result.selectedItems.map(function (item) { return item.weight + "w / " + item.value + "v"; }).join(" · ");
          td.appendChild(detail);
        }
        tr.appendChild(td);
      });
      var optimal = result.maxValue === results.dp.maxValue;
      var badgeCell = document.createElement("td");
      var badge = document.createElement("span");
      badge.className = "optimal-badge " + (optimal ? "optimal-yes" : "optimal-no");
      badge.textContent = optimal ? "Optimal" : "Suboptimal";
      badgeCell.appendChild(badge);
      tr.appendChild(badgeCell);
      elements.resultsBody.appendChild(tr);
    });

    if (results.greedy.maxValue < results.dp.maxValue) {
      elements.resultMessage.textContent = "Greedy found " + results.greedy.maxValue + " but the optimal is " + results.dp.maxValue + " (a difference of " + (results.dp.maxValue - results.greedy.maxValue) + ").";
      elements.resultMessage.className = "message message-error";
      elements.resultMessage.hidden = false;
    } else {
      elements.resultMessage.textContent = "Greedy matched the optimal value for this input. It is still not guaranteed to do so for every 0/1 knapsack problem.";
      elements.resultMessage.className = "message message-success";
      elements.resultMessage.hidden = false;
    }
    elements.solutionSummary.textContent = results.dp.maxValue + " optimal value · " + results.dp.selectedItems.length + " items selected";
  }

  function renderDpTable(result, items, capacity) {
    if (items.length > 15 || capacity > 30) {
      elements.dpContainer.replaceChildren();
      var notice = document.createElement("p");
      notice.className = "placeholder-copy";
      notice.textContent = "The DP table is too large to display here (display is limited to 15 items and capacity 30). The result was still calculated.";
      elements.dpContainer.appendChild(notice);
      return;
    }
    var table = document.createElement("table");
    table.className = "dp-table";
    var path = new Set();
    var remaining = capacity;
    for (var row = items.length; row > 0; row -= 1) {
      path.add(row + ":" + remaining);
      if (result.extraInfo.table[row][remaining] !== result.extraInfo.table[row - 1][remaining]) {
        remaining -= items[row - 1].weight;
        path.add((row - 1) + ":" + remaining);
      }
    }
    var thead = document.createElement("thead");
    var heading = document.createElement("tr");
    ["Item \\ Capacity"].concat(Array.from({ length: capacity + 1 }, function (_, index) { return String(index); })).forEach(function (label) {
      var th = document.createElement("th");
      th.textContent = label;
      heading.appendChild(th);
    });
    thead.appendChild(heading);
    table.appendChild(thead);
    var tbody = document.createElement("tbody");
    result.extraInfo.table.forEach(function (values, rowIndex) {
      var tr = document.createElement("tr");
      var rowHeading = document.createElement("th");
      rowHeading.textContent = rowIndex === 0 ? "—" : rowIndex + ": " + items[rowIndex - 1].name;
      tr.appendChild(rowHeading);
      values.forEach(function (value, columnIndex) {
        var td = document.createElement("td");
        td.textContent = String(value);
        if (path.has(rowIndex + ":" + columnIndex)) td.className = "path-cell";
        if (rowIndex > 0 && path.has(rowIndex + ":" + columnIndex) &&
            result.extraInfo.table[rowIndex][columnIndex] !== result.extraInfo.table[rowIndex - 1][columnIndex]) {
          td.classList.add("selected-cell");
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    elements.dpContainer.replaceChildren(table);
  }

  function getChartColors() {
    var dark = document.documentElement.dataset.theme === "dark";
    return { text: dark ? "#a0adc1" : "#728096", grid: dark ? "#334158" : "#e3e9f1" };
  }

  function destroyChart(key) {
    if (charts[key]) {
      charts[key].destroy();
      charts[key] = null;
    }
  }

  function chartOptions(yTitle, logarithmic) {
    var colors = getChartColors();
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: colors.text, usePointStyle: true, boxWidth: 8, font: { family: "DM Sans" } } } },
      scales: {
        x: { title: { display: true, text: "Number of items", color: colors.text }, ticks: { color: colors.text }, grid: { color: colors.grid } },
        y: { beginAtZero: !logarithmic, type: logarithmic ? "logarithmic" : "linear", title: { display: true, text: yTitle, color: colors.text }, ticks: { color: colors.text }, grid: { color: colors.grid } }
      }
    };
  }

  function renderValueChart(results) {
    if (!window.Chart) {
      elements.chartUnavailable.hidden = false;
      return;
    }
    elements.chartUnavailable.hidden = true;
    destroyChart("value");
    var rows = [
      { label: "Dynamic Programming", value: results.dp.maxValue },
      { label: "Greedy", value: results.greedy.maxValue },
      { label: "Backtracking + pruning", value: results.pruned ? results.pruned.maxValue : null },
      { label: "Plain recursion", value: results.plain ? results.plain.maxValue : null }
    ];
    charts.value = new Chart(elements.valueChart, {
      type: "bar",
      data: { labels: rows.map(function (row) { return row.label; }), datasets: [{ label: "Total value", data: rows.map(function (row) { return row.value; }), backgroundColor: palette, borderRadius: 6 }] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { ticks: { color: getChartColors().text }, grid: { display: false } }, y: { beginAtZero: true, ticks: { color: getChartColors().text }, grid: { color: getChartColors().grid } } }
      }
    });
  }

  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function benchmarkInput(n, capacity) {
    var items = [];
    for (var i = 0; i < n; i += 1) {
      items.push({ name: "Item " + (i + 1), weight: randomInt(1, 40), value: randomInt(5, 100) });
    }
    return { items: items, capacity: capacity };
  }

  function setBenchmarkStatus(message, isError) {
    elements.benchmarkStatus.textContent = message;
    elements.benchmarkStatus.className = isError ? "message message-error" : "message";
    elements.benchmarkStatus.hidden = false;
  }

  function runBenchmark() {
    if (!window.Chart) {
      setBenchmarkStatus("Chart.js could not be loaded. Connect to the internet and reload this page to run charts.", true);
      return;
    }
    var button = document.getElementById("run-benchmark");
    button.disabled = true;
    button.textContent = "Running benchmark…";
    setBenchmarkStatus("Generating random inputs and measuring algorithms…", false);
    window.setTimeout(function () {
      try {
        var timeLabels = [5, 10, 15, 20, 25, 50, 100, 250, 500];
        var timeSeries = [
          { label: "Dynamic Programming", data: [] },
          { label: "Greedy", data: [] },
          { label: "Backtracking + pruning", data: [] },
          { label: "Plain recursion", data: [] }
        ];
        timeLabels.forEach(function (n) {
          var input = benchmarkInput(n, 250);
          timeSeries[0].data.push(runAveraged(function () { return algorithms.dynamicProgramming(input.items, input.capacity); }, 3).timeMs);
          timeSeries[1].data.push(runAveraged(function () { return algorithms.greedy(input.items, input.capacity); }, 3).timeMs);
          if (n <= 25) timeSeries[2].data.push(runAveraged(function () { return algorithms.backtrackingWithPruning(input.items, input.capacity); }, 1).timeMs);
          else timeSeries[2].data.push(null);
          if (n <= 20) timeSeries[3].data.push(runAveraged(function () { return algorithms.backtrackingWithoutPruning(input.items, input.capacity); }, 1).timeMs);
          else timeSeries[3].data.push(null);
        });

        var nodeLabels = [5, 10, 15, 20, 25];
        var prunedNodes = [];
        var plainNodes = [];
        nodeLabels.forEach(function (n) {
          var input = benchmarkInput(n, 250);
          prunedNodes.push(algorithms.backtrackingWithPruning(input.items, input.capacity).extraInfo.nodesExplored);
          plainNodes.push(n <= 20 ? algorithms.backtrackingWithoutPruning(input.items, input.capacity).extraInfo.nodesExplored : null);
        });
        renderBenchmarkCharts(timeLabels, timeSeries, nodeLabels, prunedNodes, plainNodes);
        setBenchmarkStatus("Benchmark complete. Backtracking measurements are limited to small inputs; larger exponential runs are intentionally skipped.", false);
      } catch (error) {
        setBenchmarkStatus("Benchmark failed: " + error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = "▶ Run benchmark";
      }
    }, 30);
  }

  function renderBenchmarkCharts(timeLabels, timeSeries, nodeLabels, prunedNodes, plainNodes) {
    destroyChart("time");
    destroyChart("nodes");
    var logarithmic = document.getElementById("log-scale").checked;
    charts.time = new Chart(elements.timeChart, {
      type: "line",
      data: { labels: timeLabels, datasets: timeSeries.map(function (series, index) {
        return { label: series.label, data: series.data, borderColor: palette[index], backgroundColor: palette[index], spanGaps: false, tension: .25, pointRadius: 3 };
      }) },
      options: chartOptions("Average running time (ms)", logarithmic)
    });
    charts.nodes = new Chart(elements.nodesChart, {
      type: "line",
      data: { labels: nodeLabels, datasets: [
        { label: "With pruning", data: prunedNodes, borderColor: palette[0], backgroundColor: palette[0], tension: .25, pointRadius: 3, spanGaps: false },
        { label: "Without pruning", data: plainNodes, borderColor: palette[3], backgroundColor: palette[3], tension: .25, pointRadius: 3, spanGaps: false }
      ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: getChartColors().text, usePointStyle: true, boxWidth: 8 } } },
        scales: { x: { title: { display: true, text: "Number of items", color: getChartColors().text }, ticks: { color: getChartColors().text }, grid: { color: getChartColors().grid } }, y: { beginAtZero: true, title: { display: true, text: "Nodes explored", color: getChartColors().text }, ticks: { color: getChartColors().text }, grid: { color: getChartColors().grid } } }
      }
    });
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    var dark = theme === "dark";
    document.getElementById("theme-label").textContent = dark ? "Light mode" : "Dark mode";
    document.getElementById("theme-toggle").setAttribute("aria-label", "Switch to " + (dark ? "light" : "dark") + " mode");
    try { localStorage.setItem("knapsack-theme", theme); } catch (error) { /* Theme still works for this page view. */ }
    if (lastResults) renderValueChart(lastResults);
    if (charts.time && charts.nodes) {
      var timeLabels = charts.time.data.labels;
      var series = charts.time.data.datasets.map(function (dataset) { return { label: dataset.label, data: dataset.data }; });
      var nodeLabels = charts.nodes.data.labels;
      renderBenchmarkCharts(nodeLabels.length ? timeLabels : [], series, nodeLabels, charts.nodes.data.datasets[0].data, charts.nodes.data.datasets[1].data);
    }
  }

  function runSampleTests() {
    var cases = [
      { name: "Greedy counterexample", capacity: 50, items: [{ name: "A", weight: 10, value: 60 }, { name: "B", weight: 20, value: 100 }, { name: "C", weight: 30, value: 120 }], expected: 220 },
      { name: "No items", capacity: 10, items: [], expected: 0 },
      { name: "Items exceed capacity", capacity: 4, items: [{ name: "Heavy", weight: 8, value: 20 }], expected: 0 },
      { name: "Duplicate values", capacity: 5, items: [{ name: "First", weight: 2, value: 7 }, { name: "Second", weight: 3, value: 7 }, { name: "Third", weight: 5, value: 14 }], expected: 14 },
      { name: "Zero-weight item", capacity: 2, items: [{ name: "Free", weight: 0, value: 3 }, { name: "Small", weight: 2, value: 4 }], expected: 7 }
    ];
    cases.forEach(function (testCase) {
      var dp = algorithms.dynamicProgramming(testCase.items, testCase.capacity);
      var pruned = algorithms.backtrackingWithPruning(testCase.items, testCase.capacity);
      var plain = algorithms.backtrackingWithoutPruning(testCase.items, testCase.capacity);
      if (dp.maxValue !== testCase.expected || dp.maxValue !== pruned.maxValue || dp.maxValue !== plain.maxValue) {
        throw new Error("Failed sample test: " + testCase.name);
      }
    });
    console.info("Knapsack sample tests passed: " + cases.length + " cases.");
    return cases.length;
  }

  document.getElementById("add-item").addEventListener("click", function () { addItemRow(); });
  document.getElementById("solve").addEventListener("click", runSolve);
  document.getElementById("random-items").addEventListener("click", function () {
    var count = window.prompt("How many random items? (1–100)", "8");
    if (count === null) return;
    var maxCount = Number(count);
    if (!Number.isInteger(maxCount) || maxCount < 1 || maxCount > 100) {
      showInputError("Choose a whole-number item count from 1 to 100.");
      return;
    }
    var maxWeightInput = window.prompt("Maximum item weight?", "30");
    if (maxWeightInput === null) return;
    var maxWeight = Number(maxWeightInput);
    if (!Number.isSafeInteger(maxWeight) || maxWeight < 1) {
      showInputError("Maximum weight must be a positive whole number.");
      return;
    }
    var maxValueInput = window.prompt("Maximum item value?", "100");
    if (maxValueInput === null) return;
    var maxValue = Number(maxValueInput);
    if (!Number.isSafeInteger(maxValue) || maxValue < 1) {
      showInputError("Maximum value must be a positive whole number.");
      return;
    }
    elements.itemsBody.replaceChildren();
    for (var i = 1; i <= maxCount; i += 1) addItemRow("Item " + i, randomInt(1, maxWeight), randomInt(1, maxValue));
    elements.capacity.value = String(Math.max(1, Math.floor(maxCount * (maxWeight / 2) * 0.45)));
    hideInputError();
  });
  document.getElementById("greedy-example").addEventListener("click", function () {
    elements.itemsBody.replaceChildren();
    elements.capacity.value = "50";
    addItemRow("Item A", 10, 60);
    addItemRow("Item B", 20, 100);
    addItemRow("Item C", 30, 120);
    hideInputError();
  });
  document.getElementById("clear-all").addEventListener("click", function () {
    elements.itemsBody.replaceChildren();
    elements.capacity.value = "";
    updateItemCount();
    hideInputError();
    elements.resultsBody.innerHTML = '<tr><td colspan="7" class="empty-state">Your comparison will appear here after you solve a problem.</td></tr>';
    elements.resultMessage.hidden = true;
    elements.solutionSummary.textContent = "Solve a problem to see results";
    elements.dpContainer.innerHTML = '<p class="placeholder-copy">Solve a problem to inspect its DP table.</p>';
    destroyChart("value");
    lastResults = null;
  });
  document.getElementById("run-benchmark").addEventListener("click", runBenchmark);
  document.getElementById("log-scale").addEventListener("change", function () {
    if (charts.time) {
      var timeLabels = charts.time.data.labels;
      var series = charts.time.data.datasets.map(function (dataset) { return { label: dataset.label, data: dataset.data }; });
      var nodeLabels = charts.nodes.data.labels;
      renderBenchmarkCharts(timeLabels, series, nodeLabels, charts.nodes.data.datasets[0].data, charts.nodes.data.datasets[1].data);
    }
  });
  document.getElementById("theme-toggle").addEventListener("click", function () {
    setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
  elements.capacity.addEventListener("input", hideInputError);
  elements.itemsBody.addEventListener("input", hideInputError);

  try {
    var savedTheme = localStorage.getItem("knapsack-theme");
    if (savedTheme === "dark") setTheme("dark");
  } catch (error) { /* Storage may be unavailable in private or local-file contexts. */ }

  window.runKnapsackSampleTests = runSampleTests;
  addItemRow("Item A", 10, 60);
  addItemRow("Item B", 20, 100);
  addItemRow("Item C", 30, 120);
}());
