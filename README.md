# Knapsack Solver: DP vs Greedy vs Backtracking

A self-contained, browser-based 0/1 Knapsack solver for a Design and Analysis of Algorithms mini project. Compare four strategies on the same item set, inspect the dynamic-programming table, and measure algorithm performance without a server or build tools.

## Run the project

Open `index.html` directly in a modern web browser. No backend, npm install, or build step is required. Chart.js is loaded from a CDN for the charts; the solver and input interface still work if the CDN is unavailable, but charts will not be shown.

## Features

- Edit item names, weights, and values; add/remove rows; choose bag capacity.
- Generate random items, load the standard greedy-fails example, or clear the input.
- Validates missing fields, non-integer/negative weights or values, and invalid capacity. Zero-weight items are supported.
- Compares bottom-up dynamic programming, ratio-based greedy, branch-and-bound, and plain recursive backtracking.
- Reports chosen items, total value/weight, average runtime, explored-node counts, and optimality against DP.
- Displays the DP table (up to 15 items and capacity 30) with the reconstruction path highlighted.
- Provides runtime and search-node benchmark charts, optional logarithmic time scale, and current-input value chart.
- Responsive light/dark interface; dark-mode preference is saved when browser storage is available.
- Browser-console sample tests: run `runKnapsackSampleTests()` after the page loads. It checks five test cases and verifies that DP and both backtracking implementations agree.

The interface limits the plain-recursion solver to 25 items and the branch-and-bound solver to 45 items to avoid unresponsive browser sessions. The benchmark limits plain recursion to 20 items. DP additionally limits the calculated table to 1,000,000 cells.

## Complexity comparison

Here `n` is the number of items and `W` is the integer capacity.

| Algorithm | Time complexity | Space complexity | Guaranteed optimal? |
|---|---:|---:|:---:|
| Dynamic programming | O(nW) | O(nW) | Yes |
| Greedy by value/weight ratio | O(n log n) | O(n) | No |
| Backtracking with branch-and-bound pruning | O(2^n) worst case | O(n) recursion depth | Yes |
| Plain recursive backtracking | O(2^n) | O(n) recursion depth | Yes |

Greedy is optimal for the fractional knapsack variant, where an item can be split, but is **not guaranteed** to be optimal for 0/1 knapsack.

## Sample test cases

Run these in the browser console with `runKnapsackSampleTests()`:

| Case | Capacity | Items (weight, value) | Optimal value |
|---|---:|---|---:|
| Greedy counterexample | 50 | (10, 60), (20, 100), (30, 120) | 220 |
| No items | 10 | none | 0 |
| Items exceed capacity | 4 | (8, 20) | 0 |
| Duplicate values | 5 | (2, 7), (3, 7), (5, 14) | 14 |
| Zero-weight item | 2 | (0, 3), (2, 4) | 7 |
