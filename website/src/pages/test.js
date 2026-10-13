const SAVINGS_INTEREST_RATE = 2

const get_tax_rate = (v) => {
    let r = 12;
    if(v > 48475) r = 22;
    if(v > 103350) r = 24;
    if(v > 197300) r = 32;
    if(v > 250525) r = 35;
    if(v > 626350) r = 37;
    return r;
}

const calculate = (x) => {
    const base_income = 45600*Math.pow(1.02, x);
    const tax_rate = get_tax_rate(base_income);

    return base_income * (100-tax_rate)/100
}

function solve(expected_result) {
    let logs = new Array();
    let savings_balance = 0;
    let iteration = 0;
    const step = () => {
        savings_balance += calculate(iteration);
        savings_balance *= (100-SAVINGS_INTEREST_RATE)/100

        logs.push([iteration, savings_balance]);
        iteration += 0.1;
    }
    while(savings_balance < expected_result) step();
    return [savings_balance, iteration, logs];
}

const million = solve(1000000);
const billion = solve(1000000000);
const trillion = solve(1000000000000);

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const PADDING = 100; 
const graphWidth = canvas.width - PADDING * 2;
const graphHeight = canvas.height - PADDING * 2;

const minYValue = 1000;
const maxYValue = 1000000000000;

const logMin = Math.log10(minYValue);
const logMax = Math.log10(maxYValue);
const maxIteration = trillion[1];


ctx.fillStyle = "white";
ctx.fillRect(0, 0, canvas.width, canvas.height);

ctx.strokeStyle = "#e8e8e8"; 
ctx.lineWidth = 1;
ctx.fillStyle = "#333333";   
ctx.font = "11px sans-serif";

const xDivisions = 5;
for (let i = 0; i <= xDivisions; i++) {
    const fraction = i / xDivisions;
    const xPos = PADDING + fraction * graphWidth;
    const iterationValue = (fraction * maxIteration).toFixed(1);

    ctx.beginPath();
    ctx.moveTo(xPos, PADDING);
    ctx.lineTo(xPos, canvas.height - PADDING);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(iterationValue, xPos, canvas.height - PADDING + 8);
}

for (let pow = logMin; pow <= logMax; pow++) {
    const value = Math.pow(10, pow);
    
    const fraction = (pow - logMin) / (logMax - logMin);
    const yPos = canvas.height - PADDING - (fraction * graphHeight);

    let labelText = `$${(value / 1000).toFixed(0)}K`;
    if (value >= 1000000) labelText = `$${(value / 1000000).toFixed(0)}M`;
    if (value >= 1000000000) labelText = `$${(value / 1000000000).toFixed(0)}B`;
    if (value >= 1000000000000) labelText = `$${(value / 1000000000000).toFixed(0)}T`;

    ctx.strokeStyle = "#d0d0d0";
    ctx.beginPath();
    ctx.moveTo(PADDING, yPos);
    ctx.lineTo(canvas.width - PADDING, yPos);
    ctx.stroke();

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(labelText, PADDING - 10, yPos);

    if (pow < logMax) {
        ctx.strokeStyle = "#f3f3f3";
        for (let sub = 2; sub <= 9; sub++) {
            const subVal = value * sub;
            const subFraction = (Math.log10(subVal) - logMin) / (logMax - logMin);
            const subYPos = canvas.height - PADDING - (subFraction * graphHeight);
            
            ctx.beginPath();
            ctx.moveTo(PADDING, subYPos);
            ctx.lineTo(canvas.width - PADDING, subYPos);
            ctx.stroke();
        }
    }
}

ctx.strokeStyle = "#333333";
ctx.lineWidth = 2;
ctx.beginPath();
ctx.moveTo(PADDING, canvas.height - PADDING);
ctx.lineTo(canvas.width - PADDING, canvas.height - PADDING);
ctx.moveTo(PADDING, PADDING);
ctx.lineTo(PADDING, canvas.height - PADDING);
ctx.stroke();

ctx.fillStyle = "#000000";
ctx.font = "bold 12px sans-serif";
ctx.textAlign = "center";
ctx.fillText("Iterations (Time)", PADDING + graphWidth / 2, canvas.height - 20);

ctx.save();
ctx.translate(15, PADDING + graphHeight / 2);
ctx.rotate(-Math.PI / 2);
ctx.fillText("Savings Balance (Log Scale \$)", 0, 0);
ctx.restore();

const legendWidth = 110;
const legendHeight = 70;
const legendX = canvas.width - PADDING - legendWidth - 15;
const legendY = canvas.height - PADDING - legendHeight - 15;

ctx.fillStyle = "rgba(255, 255, 255, 0.95)"; 
ctx.strokeStyle = "#cccccc";
ctx.lineWidth = 1;
ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);

const legendItems = [
    { label: "million", color: "red" },
    { label: "billion", color: "blue" },
    { label: "trillion", color: "green" }
];

ctx.font = "11px sans-serif";
ctx.textAlign = "left";
ctx.textBaseline = "middle";

legendItems.forEach((item, index) => {
    const itemY = legendY + 15 + (index * 20);
    ctx.beginPath();
    ctx.arc(legendX + 15, itemY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.fillStyle = "#333333";
    ctx.fillText(item.label, legendX + 28, itemY);
});

trillion[2].forEach(e => {
    const balance = e[1];
    
    if (balance < minYValue) return;

    const xPos = PADDING + graphWidth * (e[0] / maxIteration);
    
    const currentLog = Math.log10(balance);
    const yFraction = (currentLog - logMin) / (logMax - logMin);
    const yPos = canvas.height - PADDING - (yFraction * graphHeight);

    let dotColor = "red"; 
    if (balance >= 1000000000) {
        dotColor = "green";  // Trillion
    } else if (balance >= 1000000) {
        dotColor = "blue";   // Billion
    }

    ctx.beginPath();
    ctx.arc(xPos, yPos, 3, 0, 2 * Math.PI);
    ctx.fillStyle = dotColor;
    ctx.fill(); 
});

billion[2].forEach(e => {
    const balance = e[1];
    
    if (balance < minYValue) return;

    const xPos = PADDING + graphWidth * (e[0] / maxIteration);
    
    const currentLog = Math.log10(balance);
    const yFraction = (currentLog - logMin) / (logMax - logMin);
    const yPos = canvas.height - PADDING - (yFraction * graphHeight);

    let dotColor = "red"; 
    if (balance >= 1000000000) {
        dotColor = "green";  // Trillion
    } else if (balance >= 1000000) {
        dotColor = "blue";   // Billion
    }

    ctx.beginPath();
    ctx.arc(xPos, yPos, 3, 0, 2 * Math.PI);
    ctx.fillStyle = dotColor;
    ctx.fill(); 
});

million[2].forEach(e => {
    const balance = e[1];
    
    if (balance < minYValue) return;

    const xPos = PADDING + graphWidth * (e[0] / maxIteration);
    
    const currentLog = Math.log10(balance);
    const yFraction = (currentLog - logMin) / (logMax - logMin);
    const yPos = canvas.height - PADDING - (yFraction * graphHeight);

    let dotColor = "red"; 
    if (balance >= 1000000000) {
        dotColor = "green";  // Trillion
    } else if (balance >= 1000000) {
        dotColor = "blue";   // Billion
    }

    ctx.beginPath();
    ctx.arc(xPos, yPos, 3, 0, 2 * Math.PI);
    ctx.fillStyle = dotColor;
    ctx.fill(); 
});

alert(`million: ${million[1].toFixed(1)} years, \nbillion: ${billion[1].toFixed(1)} years, \ntrillion: ${trillion[1].toFixed(1)} years`)