/* Pure algorithm implementations: no DOM access or UI dependencies. */
(function (root) {
  "use strict";

  function normalizeItems(items) {
    if (!Array.isArray(items)) throw new TypeError("Items must be an array.");
    return items.map(function (item, index) {
      if (!item || !Number.isFinite(item.weight) || !Number.isFinite(item.value)) {
        throw new TypeError("Every item must have a finite weight and value.");
      }
      return {
        name: String(item.name || "Item " + (index + 1)),
        weight: item.weight,
        value: item.value,
        originalIndex: index
      };
    });
  }

  function validateCapacity(capacity) {
    if (!Number.isInteger(capacity) || capacity < 0) {
      throw new RangeError("Capacity must be a non-negative integer.");
    }
  }

  function makeResult(maxValue, selected, start, extraInfo) {
    return {
      maxValue: maxValue,
      selectedItems: selected.map(function (item) {
        return { name: item.name, weight: item.weight, value: item.value, originalIndex: item.originalIndex };
      }),
      timeMs: performance.now() - start,
      extraInfo: extraInfo || {}
    };
  }

  function dynamicProgramming(items, capacity) {
    validateCapacity(capacity);
    var start = performance.now();
    var normalized = normalizeItems(items);
    var n = normalized.length;
    var dp = Array.from({ length: n + 1 }, function () { return new Float64Array(capacity + 1); });

    for (var i = 1; i <= n; i += 1) {
      var item = normalized[i - 1];
      for (var c = 0; c <= capacity; c += 1) {
        dp[i][c] = dp[i - 1][c];
        if (item.weight <= c) {
          dp[i][c] = Math.max(dp[i][c], item.value + dp[i - 1][c - item.weight]);
        }
      }
    }

    var selected = [];
    var remaining = capacity;
    for (var row = n; row > 0; row -= 1) {
      if (dp[row][remaining] !== dp[row - 1][remaining]) {
        selected.push(normalized[row - 1]);
        remaining -= normalized[row - 1].weight;
      }
    }
    selected.reverse();

    var table = dp.map(function (rowValues) { return Array.from(rowValues); });
    return makeResult(dp[n][capacity], selected, start, { table: table, algorithm: "dynamicProgramming" });
  }

  function greedy(items, capacity) {
    validateCapacity(capacity);
    var start = performance.now();
    var sorted = normalizeItems(items).slice().sort(function (a, b) {
      var ratioA = a.weight === 0 ? (a.value > 0 ? Infinity : -Infinity) : a.value / a.weight;
      var ratioB = b.weight === 0 ? (b.value > 0 ? Infinity : -Infinity) : b.value / b.weight;
      return ratioB - ratioA || a.originalIndex - b.originalIndex;
    });
    var selected = [];
    var totalWeight = 0;
    var totalValue = 0;
    sorted.forEach(function (item) {
      if (item.value > 0 && totalWeight + item.weight <= capacity) {
        selected.push(item);
        totalWeight += item.weight;
        totalValue += item.value;
      }
    });
    selected.sort(function (a, b) { return a.originalIndex - b.originalIndex; });
    return makeResult(totalValue, selected, start, { algorithm: "greedy" });
  }

  function orderByRatio(items) {
    return normalizeItems(items).sort(function (a, b) {
      var ratioA = a.weight === 0 ? (a.value > 0 ? Infinity : -Infinity) : a.value / a.weight;
      var ratioB = b.weight === 0 ? (b.value > 0 ? Infinity : -Infinity) : b.value / b.weight;
      return ratioB - ratioA || a.originalIndex - b.originalIndex;
    });
  }

  function backtrackingWithPruning(items, capacity) {
    validateCapacity(capacity);
    var start = performance.now();
    var sorted = orderByRatio(items);
    var nodesExplored = 0;
    var bestValue = 0;
    var bestWeight = 0;
    var bestItems = [];
    var chosen = [];

    function upperBound(index, currentWeight, currentValue) {
      var bound = currentValue;
      var room = capacity - currentWeight;
      for (var i = index; i < sorted.length; i += 1) {
        var item = sorted[i];
        if (item.value <= 0) continue;
        if (item.weight === 0) {
          bound += item.value;
        } else if (item.weight <= room) {
          room -= item.weight;
          bound += item.value;
        } else {
          bound += item.value * (room / item.weight);
          break;
        }
      }
      return bound;
    }

    function search(index, currentWeight, currentValue) {
      nodesExplored += 1;
      if (currentValue > bestValue) {
        bestValue = currentValue;
        bestWeight = currentWeight;
        bestItems = chosen.slice();
      }
      if (index >= sorted.length || upperBound(index, currentWeight, currentValue) <= bestValue) return;

      var item = sorted[index];
      if (currentWeight + item.weight <= capacity) {
        chosen.push(item);
        search(index + 1, currentWeight + item.weight, currentValue + item.value);
        chosen.pop();
      }
      search(index + 1, currentWeight, currentValue);
    }

    search(0, 0, 0);
    bestItems.sort(function (a, b) { return a.originalIndex - b.originalIndex; });
    return makeResult(bestValue, bestItems, start, {
      algorithm: "backtrackingWithPruning",
      nodesExplored: nodesExplored,
      totalWeight: bestWeight
    });
  }

  function backtrackingWithoutPruning(items, capacity) {
    validateCapacity(capacity);
    var start = performance.now();
    var normalized = normalizeItems(items);
    var nodesExplored = 0;
    var bestValue = 0;
    var bestWeight = 0;
    var bestItems = [];
    var chosen = [];

    function search(index, currentWeight, currentValue) {
      nodesExplored += 1;
      if (index === normalized.length) {
        if (currentWeight <= capacity && currentValue > bestValue) {
          bestValue = currentValue;
          bestWeight = currentWeight;
          bestItems = chosen.slice();
        }
        return;
      }
      var item = normalized[index];
      // Explore both choices unconditionally; reject overweight subsets only at leaves.
      chosen.push(item);
      search(index + 1, currentWeight + item.weight, currentValue + item.value);
      chosen.pop();
      search(index + 1, currentWeight, currentValue);
    }

    search(0, 0, 0);
    return makeResult(bestValue, bestItems, start, {
      algorithm: "backtrackingWithoutPruning",
      nodesExplored: nodesExplored,
      totalWeight: bestWeight
    });
  }

  var api = {
    dynamicProgramming: dynamicProgramming,
    greedy: greedy,
    backtrackingWithPruning: backtrackingWithPruning,
    backtrackingWithoutPruning: backtrackingWithoutPruning
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KnapsackAlgorithms = api;
}(typeof globalThis !== "undefined" ? globalThis : this));
