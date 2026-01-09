// State
const state = {
    data: [],
    columns: [],
    countries: [],
    years: [],
    metrics: [],
    // selectedCountry: '', // Removed
    currentMetric: 'GDP', // Default if available
    chartInstances: {}
};

// Config
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.color = '#94a3b8';
Chart.defaults.borderColor = 'rgba(148, 163, 184, 0.1)';

// Init
document.addEventListener('DOMContentLoaded', () => {
    initListeners();
    // Auto-load CSV
    loadCSV('Global Economy Indicators.csv');
});

function initListeners() {
    // File Upload Removed

    // Navigation
    document.getElementById('nav-overview').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('overview');
    });

    document.getElementById('nav-report').addEventListener('click', (e) => {
        e.preventDefault();
        switchView('report');
    });

    // Metric Buttons
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            state.currentMetric = e.target.dataset.metric;
            updateDashboard();
        });
    });
}

function loadCSV(path) {
    Papa.parse(path, {
        download: true,
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
            console.log('Autoload success', results);
            processData(results.data, results.meta.fields);
        },
        error: (err) => {
            console.warn('Autoload failed', err);
        }
    });
}


function processData(data, fields) {
    state.data = data;
    state.columns = fields;

    // Identify columns
    const countryCol = fields.find(f => /country|nation|location/i.test(f)) || fields[0];
    const yearCol = fields.find(f => /year|date|time/i.test(f));

    // Metrics are numeric columns excluding Year
    const numericCols = fields.filter(f => {
        const val = data[0][f];
        return typeof val === 'number' && f !== yearCol;
    });

    state.metrics = numericCols;

    // Populate dropdown
    state.countries = [...new Set(data.map(d => d[countryCol]))].sort();
    // Populate state.countries for internal use (even if selector is gone)
    state.countries = [...new Set(data.map(d => d[countryCol]))].sort();

    // Default selection
    if (state.countries.length > 0) {
        state.currentMetric = state.metrics[0] || 'Value'; // Fallback

        // Update Chart Buttons if specific metrics exist
        const btnContainer = document.querySelector('.chart-actions');
        if (state.metrics.length > 0) {
            btnContainer.innerHTML = '';
            state.metrics.slice(0, 3).forEach(m => {
                const btn = document.createElement('button');
                btn.className = `action-btn ${m === state.currentMetric ? 'active' : ''}`;
                btn.textContent = m; // Label
                btn.dataset.metric = m;
                btn.onclick = (e) => {
                    document.querySelectorAll('.action-btn').forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    state.currentMetric = m;
                    updateDashboard();
                };
                btnContainer.appendChild(btn);
            });
        }
    }

    updateDashboard();
}

function updateDashboard() {
    // Global Aggregation
    const yearCol = state.columns.find(f => /year|date/i.test(f));
    const years = [...new Set(state.data.map(d => d[yearCol]))].sort((a, b) => a - b);

    // Helper to aggregate
    const aggregate = (metric) => {
        const isAvg = /rate|inflation|percent|index/i.test(metric);
        return years.map(year => {
            const yearRows = state.data.filter(d => d[yearCol] === year);
            const validRows = yearRows.filter(d => typeof d[metric] === 'number');
            const sum = validRows.reduce((a, b) => a + b[metric], 0);
            const val = isAvg ? (sum / (validRows.length || 1)) : sum;
            return { [yearCol]: year, [metric]: val };
        });
    };

    const globalTrendData = aggregate(state.currentMetric);

    // Metric 2 for Growth Chart
    const metric2 = state.metrics[1] || state.metrics[0];
    const globalGrowthData = aggregate(metric2);

    renderTrendChart(globalTrendData, yearCol);
    renderDistChart(); // No arg needed, uses global state
    renderGrowthChart(globalGrowthData, yearCol, metric2);
}

function formatVal(v) {
    if (v === undefined || v === null) return '--';
    if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
    return v.toFixed(2);
}

function switchView(viewName) {
    const overviewNav = document.getElementById('nav-overview');
    const reportNav = document.getElementById('nav-report');
    const overviewView = document.getElementById('overview-view');
    const reportView = document.getElementById('report-view');

    if (viewName === 'overview') {
        overviewNav.classList.add('active');
        reportNav.classList.remove('active');
        overviewView.classList.remove('hidden');
        reportView.classList.add('hidden');
    } else {
        overviewNav.classList.remove('active');
        reportNav.classList.add('active');
        overviewView.classList.add('hidden');
        reportView.classList.remove('hidden');
    }
}

// ---- Chart Rendering ----

function renderTrendChart(data, yearCol) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    const labels = data.map(d => d[yearCol]);
    const values = data.map(d => d[state.currentMetric]);

    if (state.chartInstances.trend) state.chartInstances.trend.destroy();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.5)'); // Accent
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.0)');

    state.chartInstances.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: state.currentMetric,
                data: values,
                borderColor: '#6366f1',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderDistChart(data) {
    // Example: Dist of top metrics for the latest year
    // Since we don't know the metrics meaning, let's just Compare top 5 metrics of THIS country?
    // Or compare this country vs others?
    // Let's do: Global Comparison for Current Metric (Latest Year)

    // Find top 5 countries for the current metric in the latest year available
    const yearCol = state.columns.find(f => /year|date/i.test(f));
    const countryCol = state.columns.find(f => /country|nation/i.test(f)) || state.columns[0];

    // Get latest year in dataset
    const maxYear = Math.max(...state.data.map(d => d[yearCol]));
    const latestData = state.data.filter(d => d[yearCol] === maxYear);

    // Sort
    const sorted = [...latestData].sort((a, b) => b[state.currentMetric] - a[state.currentMetric]).slice(0, 5);

    const ctx = document.getElementById('distChart').getContext('2d');
    if (state.chartInstances.dist) state.chartInstances.dist.destroy();

    state.chartInstances.dist = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(d => d[countryCol]),
            datasets: [{
                label: `Top 5 (${maxYear})`,
                data: sorted.map(d => d[state.currentMetric]),
                backgroundColor: '#6366f1', // Unified color
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { display: false } }
        }
    });
}

function renderGrowthChart(data, yearCol, metricName) {
    // "Growth" chart - Global

    const ctx = document.getElementById('growthChart').getContext('2d');

    if (state.chartInstances.growth) state.chartInstances.growth.destroy();

    state.chartInstances.growth = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d[yearCol]),
            datasets: [{
                label: metricName,
                data: data.map(d => d[metricName]),
                borderColor: '#10b981', // Success color
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false }, title: { display: true, text: metricName } },
            scales: {
                y: { display: false },
                x: { display: false }
            }
        }
    });
}
