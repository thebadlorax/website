/*const calculate = (x) => {
    const a = 10000*Math.pow(1.075, x+24);
    const b = 45600*Math.pow(1.02, x);
    const c = a+b;
    
    return c;
}
function solve(expected_result, precision) {
    let last_result = null; let last_exponent = 0;
    while(last_result < expected_result) {
        last_exponent += precision;
        last_result = calculate(last_exponent);
    }
    return [last_result, last_exponent]
}

const million = solve(1000000, 0.00001);
const billion = solve(1000000000, 0.00001);
const trillion = solve(1000000000000, 0.00001);
console.log(`million:  ${million[1]}`);
console.log(`billion:  ${billion[1]}`);
console.log(`trillion: ${trillion[1]}`);*/

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
    let savings_balance = 0;
    let iteration = 0;
    const step = () => {
        savings_balance += calculate(iteration);
        savings_balance *= (100-SAVINGS_INTEREST_RATE)/100
        iteration += 0.1;
    }
    while(savings_balance < expected_result) step();
    return [savings_balance, iteration];
}

const million = solve(1000000);
const billion = solve(1000000000);
const trillion = solve(1000000000000);