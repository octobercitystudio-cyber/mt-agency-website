<?php
declare(strict_types=1);

// Run with: php tests/attendancePayrollNumeric.test.php [path/to/api/index.php]
$source = file_get_contents($argv[1] ?? __DIR__ . '/../api/index.php');
if ($source === false) throw new RuntimeException('Cannot read payroll source.');
$start = strpos($source, 'function attendanceSummary(');
$end = strpos($source, 'function sendWhatsAppTemplate(', $start);
$summary = substr($source, $start, $end - $start);
if (!preg_match('/\$lateDeduction=([^;]+);/', $summary, $match)) {
    throw new RuntimeException('Payroll deduction expression not found.');
}
function packageMoney(int $cents): string { return number_format($cents / 100, 2, '.', ''); }
foreach ([0 => 0.0, 1000 => 10.0, 2025 => 20.25, 12000 => 120.0] as $lateDeductionCents => $expected) {
    // Execute the production expression, then the same strict round() used by its DTO.
    $lateDeduction = eval('return ' . $match[1] . ';');
    $actual = round($lateDeduction, 2);
    if ($actual !== $expected) throw new RuntimeException('Incorrect deduction.');
    $net = round(max(0, 9000 - ($lateDeduction + 25.50)), 2);
    if ($net !== round(8974.50 - $expected, 2)) throw new RuntimeException('Incorrect payroll net.');
}
echo "PASS: production payroll deduction stays numeric under strict_types, including zero.\n";
