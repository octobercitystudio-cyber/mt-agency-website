<?php
declare(strict_types=1);

/** Validate new payments without reclassifying any historical ledger entries. */
function requirePaymentMethod(mixed $value): string {
    $aliases=['cash'=>'cash','كاش'=>'cash','نقدي'=>'cash','instapay'=>'instapay','انستاباي'=>'instapay','إنستاباي'=>'instapay','إنستاباي (InstaPay)'=>'instapay','vodafone_cash'=>'vodafone_cash','فودافون كاش'=>'vodafone_cash'];
    $key=is_string($value)?trim($value):'';
    if(!isset($aliases[$key]))fail('اختر طريقة الدفع: كاش أو انستاباي أو فودافون كاش.',422,'invalid_payment_method');
    return $aliases[$key];
}
